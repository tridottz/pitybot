import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';

const durationChoices = [
    { name: "5 minutos", value: 5 },
    { name: "10 minutos", value: 10 },
    { name: "30 minutos", value: 30 },
    { name: "1 hora", value: 60 },
    { name: "6 horas", value: 360 },
    { name: "1 día", value: 1440 },
    { name: "1 semana", value: 10080 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Aplica un tiempo de espera a un usuario durante un periodo específico.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Usuario al que quieres aplicar el tiempo de espera")
                .setRequired(true),
        )
        .addIntegerOption(
            (option) =>
                option
                    .setName("duration")
                    .setDescription("Duración del tiempo de espera")
                    .setRequired(true)
                    .addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Motivo del tiempo de espera"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Timeout interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'timeout',
            });
            return;
        }

        const targetUser = interaction.options.getUser("target");
        const member = interaction.options.getMember("target");
        const durationMinutes = interaction.options.getInteger("duration");
        const reason = interaction.options.getString("reason") || "No reason provided";

        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Debes indicar un usuario para aplicar el tiempo de espera.',
                { subtype: 'invalid_user' },
            );
        }

        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot timeout self",
                ErrorTypes.VALIDATION,
                "No puedes aplicarte tiempo de espera a ti mismo.",
            );
        }
        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Cannot timeout bot",
                ErrorTypes.VALIDATION,
                "No puedes aplicar tiempo de espera al bot.",
            );
        }
        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "The target user is not currently in this server.",
            );
        }

        const durationMs = durationMinutes * 60 * 1000;
        const result = await ModerationService.timeoutUser({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
            durationMs,
            reason,
        });

        const durationDisplay =
            durationChoices.find((c) => c.value === durationMinutes)
                ?.name || `${durationMinutes} minutos`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `⏳ **Tiempo de espera aplicado a** ${targetUser.tag} durante ${durationDisplay}.`,
                    `**Motivo:** ${reason}\n**ID del caso:** #${result.caseId}`,
                ),
            ],
        });
    },
};
