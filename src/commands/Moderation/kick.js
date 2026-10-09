import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("expulsar")
        .setDescription("Expulsa a un usuario del servidor")
        .addUsarOption((option) =>
            option
                .setName("target")
                .setDescription("The user to kick")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason for the kick"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const targetUsar = interaction.options.getUsar("target");
        const member = interaction.options.getMember("target");
        const reason = interaction.options.getString("reason") || "No se proporcionó un motivo";

        if (!targetUsar) {
            throw new TitanBotError(
                'Falta el usuario de destino',
                ErrorTypes.USER_INPUT,
                'You must specify a user to kick.',
                { subtype: 'invalid_user' },
            );
        }

        if (targetUsar.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot kick self",
                ErrorTypes.VALIDATION,
                "You cannot kick yourself.",
            );
        }

        if (targetUsar.id === client.user.id) {
            throw new TitanBotError(
                "Cannot kick bot",
                ErrorTypes.VALIDATION,
                "You cannot kick the bot.",
            );
        }

        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "The target user is not currently in this server.",
                { subtype: 'user_not_found' },
            );
        }

        const result = await ModerationService.kickUsar({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
            reason,
        });

        await InteractionAyudaer.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `👢 **Kicked** ${targetUsar.tag}`,
                    `**Motivo:** ${reason}\n**ID del caso:** #${result.caseId}`,
                ),
            ],
        });
    },
};
