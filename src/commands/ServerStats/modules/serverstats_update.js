import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, successEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, updateCounter, getCounterEmoji, getCounterTypeLabel } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
export async function handleUpdate(interaction, client) {
    const guild = interaction.guild;
    const counterId = interaction.options.getString("counter-id");
    const newType = interaction.options.getString("type");

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar canales** para actualizar contadores.' }).catch(logger.error);
        return;
    }

    if (!newType) {
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Debes indicar el nuevo tipo de contador.' }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);

        const counterIndex = counters.findIndex(c => c.id === counterId);
        if (counterIndex === -1) {
            await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `No se encontró el contador con ID \`${counterId}\`. Usa \`/serverstats list\` para ver todos los contadores.` }).catch(logger.error);
            return;
        }

        const counter = counters[counterIndex];
        const oldChannel = guild.channels.cache.get(counter.channelId);

        if (!oldChannel) {
            await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: 'El canal de este contador ya no existe. No puedes actualizar un contador de un canal eliminado.' }).catch(logger.error);
            return;
        }

        if (newType !== counter.type) {
            const existingTypeCounter = counters.find(c => c.type === newType && c.id !== counter.id);
            if (existingTypeCounter) {
                const existingChannel = guild.channels.cache.get(existingTypeCounter.channelId);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Ya existe un contador **${getCounterTypeLabel(newType)}** en este servidor${existingChannel ? ` en ${existingChannel}` : ''}. Elimínalo antes de volver a usar ese tipo.` }).catch(logger.error);
                return;
            }
        }

        const oldType = counter.type;

        counter.type = newType;
        counter.updatedAt = new Date().toISOString();

        const saved = await saveServerCounters(client, guild.id, counters);
        if (!saved) {
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudieron guardar los datos actualizados. Inténtalo de nuevo.' }).catch(logger.error);
            return;
        }

        const updatedCounter = counters[counterIndex];
        const updated = await updateCounter(client, guild, updatedCounter);
        if (!updated) {
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Se actualizó el contador, pero no el nombre del canal. Se actualizará en la próxima ejecución programada.' }).catch(logger.error);
            return;
        }

        const finalChannel = guild.channels.cache.get(updatedCounter.channelId);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(`**¡Contador actualizado correctamente!**\n\n**ID del contador:** \`${counterId}\`\n**Tipo cambiado:** ${getCounterEmoji(oldType)} ${getCounterTypeLabel(oldType)} → ${getCounterEmoji(newType)} ${getCounterTypeLabel(newType)}\n\n**Ajustes actuales:**\n**Tipo:** ${getCounterEmoji(updatedCounter.type)} ${getCounterTypeLabel(updatedCounter.type)}\n**Canal:** ${finalChannel}\n**Nombre del canal:** ${finalChannel.name}\n\nEl contador se actualizará automáticamente cada 15 minutos.`)]
        }).catch(logger.error);

    } catch (error) {
        logger.error("Error updating counter:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al actualizar el contador. Inténtalo de nuevo.' }).catch(logger.error);
    }
}