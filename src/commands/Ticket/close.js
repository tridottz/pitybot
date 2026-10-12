import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';
export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Cierra el ticket actual.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Motivo del cierre del ticket.")
                .setRequired(false),
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Este comando solo se puede usar en un canal de ticket válido.' });
        }

        if (!permissionContext.canCloseTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso `Gestionar canales`, el `Rol del equipo de tickets` configurado o ser quien creó el ticket para cerrarlo.' });
        }

        const reason =
            interaction.options?.getString("reason") ||
            "Closed via command without a specific reason.";

        await closeTicket(interaction.channel, interaction.user, reason);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Ticket Closed!",
                    "El ticket se cerró correctamente.",
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
