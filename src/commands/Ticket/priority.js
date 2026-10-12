import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { updateTicketPriority } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("priority")
        .setDescription("Establece la prioridad del ticket de soporte actual.")
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Nivel de prioridad del ticket.")
                .setRequired(true)
                .addChoices(
                    { name: "Urgent", value: "urgent" },
                    { name: "High", value: "high" },
                    { name: "Medium", value: "medium" },
                    { name: "Low", value: "low" },
                    { name: "None", value: "none" },
                ),
            )
        .setDMPermission(false),
    category: "Ticket",

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Este comando solo se puede usar en un canal de ticket válido.' });
        }

        if (!permissionContext.canManageTicket) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso `Gestionar canales` o el `Rol del equipo de tickets` configurado para cambiar la prioridad.' });
        }

        const priorityLevel = interaction.options.getString("level");
        await updateTicketPriority(interaction.channel, priorityLevel, interaction.user);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Priority Updated",
                    `Ticket priority set to **${priorityLevel.toUpperCase()}**.`,
                ),
            ],
        });

        logger.info('Ticket priority updated successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId,
            priority: priorityLevel,
            commandName: 'priority'
        });
    },
};
