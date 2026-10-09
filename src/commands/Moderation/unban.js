import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';

export default {
    data: new SlashCommandBuilder()
        .setName("desbanear")
        .setDescription("Quita el baneo de un usuario del servidor")
        .addStringOption(option =>
            option
                .setName("target")
                .setDescription("The ID (or mention) of the user to unban")
                .setRequired(true),
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the unban")
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionAyudaer.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Unban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unban',
            });
            return;
        }

        const rawTarget = interaction.options.getString("target");
        const targetId = rawTarget.replace(/[<@!>]/g, '').trim();

        if (!/^\d{17,20}$/.test(targetId)) {
            return replyUsarError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message: 'Please provide a valid user ID or mention.',
            });
        }

        const targetUsar = await client.users.fetch(targetId).catch(() => null);
        if (!targetUsar) {
            return replyUsarError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message: `Could not find a user with the ID \`${targetId}\`.`,
            });
        }

        const reason = interaction.options.getString("reason") || "No se proporcionó un motivo";

        const result = await ModerationService.unbanUsar({
            guild: interaction.guild,
            user: targetUsar,
            moderator: interaction.member,
            reason,
        });

        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "✅ Usar Unbanned",
                    `Successfully unbanned **${targetUsar.tag}** from the server.\n\n**Motivo:** ${reason}\n**ID del caso:** #${result.caseId}`,
                ),
            ],
        });
    },
};
