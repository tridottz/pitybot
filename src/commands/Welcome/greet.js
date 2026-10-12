import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import greetDashboard from './modules/greet_dashboard.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('saludos')
        .setDescription('Administra la configuración de bienvenida y despedida')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Abre el panel de configuración de bienvenida y despedida'),
        ),

    async execute(interaction, config, client) {
        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar servidor** para usar `/saludos`.' });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'panel':
                    return await greetDashboard.execute(interaction, config, client);
                default:
                    logger.warn(`Subcomando desconocido de /saludos: ${subcommand}`);
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await replyUserError(interaction, { type: ErrorTypes.CONFIGURATION, message: error.userMessage || 'Algo salió mal.' });
            }
            await handleInteractionError(interaction, error, { command: 'greet' });
        }
    },
};
