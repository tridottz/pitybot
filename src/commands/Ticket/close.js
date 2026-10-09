import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';
export default {
    data: new SlashCommandBuilder()
        .setName("cerrar")
        .setDescription("Closes the current ticket.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("The reason for closing the ticket.")
                .setRequired(false),
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionAyudaer.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'This command can only be used in a valid ticket channel.' });
        }

        if (!permissionContext.canCloseTicket) {
            return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the `Manage Channels` permission, the configured `Ticket Staff Role`, or be the ticket creator to close this ticket.' });
        }

        const reason =
            interaction.options?.getString("reason") ||
            "Closed via command without a specific reason.";

        await closeTicket(interaction.channel, interaction.user, reason);

        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Ticket Closed!",
                    "This ticket has been closed successfully.",
                ),
            ],
        });

        logger.info('Ticket closed successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId,
            reason: reason,
            commandName: 'close'
        });
    },
};
