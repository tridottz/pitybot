import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, getCounterEmoji, getCounterTypeLabel } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes, createError, wrapServiceBoundary } from '../../../utils/errorHandler.js';
export async function handleDelete(interaction, client) {
    const guild = interaction.guild;
    const counterId = interaction.options.getString("counter-id");

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar canales** para eliminar contadores.' }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);

        if (counters.length === 0) {
            await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: 'No se encontraron contadores para eliminar.' }).catch(logger.error);
            return;
        }

        const counterToDelete = counters.find(c => c.id === counterId);
        if (!counterToDelete) {
            await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `No se encontró el contador con ID \`${counterId}\`. Usa \`/serverstats list\` para ver todos los contadores.` }).catch(logger.error);
            return;
        }

        const channel = guild.channels.cache.get(counterToDelete.channelId);

        const embed = createEmbed({
            title: "Eliminar contador y canal",
            description: `¿Seguro que quieres eliminar este contador y su canal?\n\n**ID:** \`${counterToDelete.id}\`\n**Tipo:** ${getCounterTypeDisplay(counterToDelete.type)}\n**Canal:** ${channel || 'Canal eliminado'}\n\n **¡El canal se eliminará permanentemente!**`,
            color: getColor('error')
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`counter-delete:confirm:${counterToDelete.id}:${interaction.user.id}`)
                .setLabel("Confirmar eliminación")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`counter-delete:cancel:${counterToDelete.id}:${interaction.user.id}`)
                .setLabel("Cancelar")
                .setStyle(ButtonStyle.Secondary)
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components: [row] }).catch(logger.error);

    } catch (error) {
        logger.error("Error in handleDelete:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al obtener los contadores. Inténtalo de nuevo.' }).catch(logger.error);
    }
}

export const performDeletionByCounterId = wrapServiceBoundary(async function performDeletionByCounterId(client, guild, counterId) {
    const counters = await getServerCounters(client, guild.id);

    const counter = counters.find(c => c.id === counterId);
    if (!counter) {
        throw createError(
            'Contador no encontrado',
            ErrorTypes.USER_INPUT,
            `No se encontró el contador con ID \`${counterId}\`.`,
            { guildId: guild.id, counterId, operation: 'performDeletionByCounterId' }
        );
    }

    const updatedCounters = counters.filter(c => c.id !== counter.id);

    const saved = await saveServerCounters(client, guild.id, updatedCounters);
    if (!saved) {
        throw createError(
            'Counter delete failed',
            ErrorTypes.DATABASE,
            'No se pudo eliminar el contador. Inténtalo de nuevo.',
            { guildId: guild.id, counterId, operation: 'performDeletionByCounterId' }
        );
    }

    const channel = guild.channels.cache.get(counter.channelId);
    let channelDeleted = false;

    if (channel) {
        try {
            await channel.delete(`Counter deleted - removing channel: ${counter.id}`);
            channelDeleted = true;
        } catch (error) {
            logger.error("Error deleting channel:", error);
        }
    }

    let message = `✅ **Counter Deleted Successfully!**\n\n**ID:** \`${counter.id}\`\n**Tipo:** ${getCounterTypeDisplay(counter.type)}`;

    if (channelDeleted) {
        message += `\n**Canal:** ${channel.name} (deleted)`;
    } else if (channel) {
        message += `\n**Canal:** ${channel.name} (failed to delete)`;
    } else {
        message += `\n**Canal:** Already deleted`;
    }

    return { message };
}, {
    service: 'serverstats',
    operation: 'performDeletionByCounterId',
    userMessage: 'Ocurrió un error al eliminar el contador. Inténtalo de nuevo.',
});

function getCounterTypeDisplay(type) {
    return `${getCounterEmoji(type)} ${getCounterTypeLabel(type)}`;
}