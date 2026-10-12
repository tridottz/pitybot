import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario del servidor")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Usuario que quieres banear")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Motivo del baneo"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const user = interaction.options.getUser("target");
        const reason = interaction.options.getString("reason") || "No reason provided";

        if (!user) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Debes indicar un usuario para vetar.',
                { subtype: 'invalid_user' },
            );
        }

        if (user.id === interaction.user.id) {
            throw new TitanBotError(
                'Cannot ban self',
                ErrorTypes.VALIDATION,
                'No puedes vetarte a ti mismo.',
            );
        }
        if (user.id === client.user.id) {
            throw new TitanBotError(
                'Cannot ban bot',
                ErrorTypes.VALIDATION,
                'No puedes vetar al bot.',
            );
        }

        const result = await ModerationService.banUser({
            guild: interaction.guild,
            user,
            moderator: interaction.member,
            reason,
        });

        await InteractionHelper.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `🚫 **Baneado** ${user.tag}`,
                    `**Motivo:** ${reason}\n**ID del caso:** #${result.caseId}`,
                ),
            ],
        });
    },
};
