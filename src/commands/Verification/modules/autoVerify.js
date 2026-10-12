import { botConfig, getColor } from '../../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { withErrorHandling, createError, ErrorTypes } from '../../../utils/errorHandler.js';
import { validateAutoVerifyCriteria } from '../../../services/verificationService.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getWelcomeConfig } from '../../../utils/database.js';
import autoVerifyDashboard from './autoVerifyDashboard.js';

const autoVerifyDefaults = botConfig.verification?.autoVerify || {};
const minAccountAgeDays = autoVerifyDefaults.minAccountAge ?? 1;
const maxAccountAgeDays = autoVerifyDefaults.maxAccountAge ?? 365;
const defaultAccountAgeDays = autoVerifyDefaults.defaultAccountAgeDays ?? 7;

export default {
    data: new SlashCommandBuilder()
        .setName("autoverify")
        .setDescription("Configura los ajustes de verificación automática")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription("Configura la verificación automática")
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Rol que se asignará a los usuarios que cumplan los criterios de verificación automática")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("criteria")
                        .setDescription("Criterios de verificación automática")
                        .addChoices(
                            { name: "Antigüedad de la cuenta", value: "account_age" },
                            { name: "Sin criterios", value: "none" }
                        )
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("account_age_days")
                        .setDescription("Antigüedad mínima de la cuenta en días (necesaria para usar este criterio)")
                        .setMinValue(minAccountAgeDays)
                        .setMaxValue(maxAccountAgeDays)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("dashboard")
                .setDescription("Abre el panel de verificación automática para personalizarlo")
        ),

    async execute(interaction, config, client) {
        const wrappedExecute = withErrorHandling(async () => {
            const subcommand = interaction.options.getSubcommand();
            const guild = interaction.guild;

            switch (subcommand) {
                case "setup":
                    return await handleSetup(interaction, guild, client);
                case "dashboard":
                    return await autoVerifyDashboard.execute(interaction, config, client);
                default:
                    throw createError(
                        `Unknown subcommand: ${subcommand}`,
                        ErrorTypes.VALIDATION,
                        "Invalid subcommand selected.",
                        { subcommand }
                    );
            }
        }, { command: 'autoverify', subcommand: interaction.options.getSubcommand() });

        return await wrappedExecute(interaction, config, client);
    }
};

async function handleSetup(interaction, guild, client) {
    const criteria = interaction.options.getString("criteria");
    const accountAgeDays = interaction.options.getInteger("account_age_days") || defaultAccountAgeDays;
    const targetRole = interaction.options.getRole("role");

    await InteractionHelper.safeDefer(interaction);

    try {
        const guildConfig = await getGuildConfig(client, guild.id);
        const welcomeConfig = await getWelcomeConfig(client, guild.id);
        const verificationEnabled = Boolean(guildConfig.verification?.enabled);
        const hasAutoRoleConfigured = Boolean(guildConfig.autoRole) || (Array.isArray(welcomeConfig.roleIds) && welcomeConfig.roleIds.length > 0);

        if (verificationEnabled || hasAutoRoleConfigured) {
            throw createError(
                'Auto-verify enable blocked by conflicting onboarding system',
                ErrorTypes.CONFIGURATION,
                'No puedes activar **AutoVerify** mientras la verificación o AutoRole estén configurados. Desactiva primero esas funciones.',
                {
                    guildId: guild.id,
                    verificationEnabled,
                    hasAutoRoleConfigured,
                    expected: true,
                    suppressErrorLog: true
                }
            );
        }

        const botMember = guild.members.me;
        if (!botMember) {
            throw createError(
                'Bot member not found in guild cache',
                ErrorTypes.CONFIGURATION,
                'No pude comprobar mis permisos en este servidor. Inténtalo de nuevo en un momento.',
                { guildId: guild.id }
            );
        }

        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            throw createError(
                'Missing ManageRoles permission',
                ErrorTypes.PERMISSION,
                "I need the 'Manage Roles' permission to assign auto-verify roles.",
                { guildId: guild.id }
            );
        }

        if (targetRole.id === guild.id || targetRole.managed) {
            throw createError(
                'Invalid auto-verify role selected',
                ErrorTypes.VALIDATION,
                'Selecciona un rol asignable (no puede ser @everyone ni estar administrado por una integración).',
                { guildId: guild.id, roleId: targetRole.id, managed: targetRole.managed }
            );
        }

        if (targetRole.position >= botMember.roles.highest.position) {
            throw createError(
                'Role hierarchy error for auto-verify setup',
                ErrorTypes.PERMISSION,
                'El rol de verificación automática debe estar por debajo de mi rol más alto en la jerarquía del servidor.',
                { guildId: guild.id, roleId: targetRole.id, rolePosition: targetRole.position, botRolePosition: botMember.roles.highest.position }
            );
        }

        validateAutoVerifyCriteria(criteria, criteria === 'account_age' ? accountAgeDays : 1);
        
        if (!guildConfig.verification) {
            guildConfig.verification = {};
        }

        guildConfig.verification.autoVerify = {
            enabled: true,
            criteria: criteria,
            accountAgeDays: criteria === "account_age" ? accountAgeDays : null,
            roleId: targetRole.id,
            configuredVia: 'setup'
        };

        await setGuildConfig(client, guild.id, guildConfig);

        let criteriaDescription = "";
        switch (criteria) {
            case "account_age":
                criteriaDescription = `\`${accountAgeDays} días\` de antigüedad`;
                break;
            case "none":
                criteriaDescription = "Todos los usuarios de inmediato";
                break;
        }

        logger.info('Auto-verify enabled', {
            guildId: guild.id,
            criteria,
            accountAgeDays: criteria === 'account_age' ? accountAgeDays : null,
            roleId: targetRole.id
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                "Verificación automática configurada",
                `¡Se configuró la verificación automática!\n\n**Rol:** ${targetRole}\n**Criterios:** ${criteriaDescription}\n\nLos usuarios que cumplan estos criterios recibirán este rol al unirse al servidor.`
            )]
        });

    } catch (error) {
        
        throw error;
    }
}
