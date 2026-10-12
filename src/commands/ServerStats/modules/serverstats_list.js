import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, getCounterEmoji as getCounterTypeEmoji, getCounterTypeLabel, getGuildCounterStats } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
export async function handleList(interaction, client) {
    const guild = interaction.guild;

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar canales** para ver los contadores.' }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);
        const stats = await getGuildCounterStats(guild);

        const validCounters = [];
        const orphanedCounters = [];
        
        for (const counter of counters) {
            const channel = guild.channels.cache.get(counter.channelId);
            if (channel) {
                validCounters.push(counter);
            } else {
                orphanedCounters.push(counter);
                logger.info(`Removing orphaned counter ${counter.id} (type: ${counter.type}, deleted channel: ${counter.channelId}) from guild ${guild.id}`);
            }
        }

        if (orphanedCounters.length > 0) {
            await saveServerCounters(client, guild.id, validCounters);
            logger.info(`Cleaned up ${orphanedCounters.length} orphaned counter(s) from guild ${guild.id}`);
        }

        if (validCounters.length === 0) {
            const embed = createEmbed({
                title: "Contadores del servidor",
                description: "Aún no hay contadores configurados en este servidor.\n\nUsa `/serverstats create` para crear el primero.",
                color: getColor('warning')
            });

            embed.addFields({
                name: "**Tipos de contadores disponibles**",
                value: "**Miembros y bots** - Total de miembros\n **Solo miembros** - Usuarios humanos\n **Solo bots** - Cuentas de bot",
                inline: false
            });

            embed.addFields({
                name: "**Ejemplos de uso**",
                value: "`/serverstats create type:members channel_type:voice category:Estadísticas`\n`/serverstats create type:bots channel_type:text category:Información del servidor`\n`/serverstats list`",
                inline: false
            });

            embed.setFooter({ 
                text: "Sistema de contadores • Actualización automática cada 15 minutos" 
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);
            return;
        }

        const embed = createEmbed({
            title: `Contadores del servidor (${validCounters.length})`,
            description: "Estos son los contadores activos del servidor.\n\nSe actualizan automáticamente cada 15 minutos.",
            color: getColor('info')
        });

        for (let i = 0; i < validCounters.length; i++) {
            const counter = validCounters[i];
            const channel = guild.channels.cache.get(counter.channelId);
            
            if (!channel) {
                
                logger.warn(`Counter ${counter.id} still has missing channel after cleanup`);
                continue;
            }

            const currentCount = getCurrentCount(stats, counter.type);
            const status = channel.name.includes(':') ? '✅ Activo' : '⚠️ Sin actualizar';
            
            embed.addFields({
                name: `${getCounterTypeEmoji(counter.type)} Contador n.º ${i + 1} - ${channel.name}`,
                value: `**ID:** \`${counter.id}\`\n**Tipo:** ${getCounterTypeDisplay(counter.type)}\n**Canal:** ${channel}\n**Conteo actual:** ${currentCount}\n**Estado:** ${status}\n**Creado:** ${new Date(counter.createdAt).toLocaleDateString()}`,
                inline: false
            });
        }

        embed.addFields({
            name: "**Estadísticas**",
            value: `**Total de contadores:** ${validCounters.length}\n**Contadores activos:** ${validCounters.filter(c => {
                const channel = guild.channels.cache.get(c.channelId);
                return channel && channel.name.includes(':');
            }).length}\n**Próxima actualización:** <t:${Math.floor(Date.now() / 1000) + 900}:R>`,
            inline: false
        });

        embed.addFields({
            name: "**Comandos de administración**",
            value: "`/serverstats create` - Crear un contador\n`/serverstats update` - Actualizar un contador\n`/serverstats delete` - Eliminar un contador",
            inline: false
        });

        embed.setFooter({ 
            text: "Sistema de contadores • Actualización automática cada 15 minutos" 
        });
        embed.setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);

    } catch (error) {
        logger.error("Error displaying counters:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al obtener los contadores. Inténtalo de nuevo.' }).catch(logger.error);
    }
}

function getCounterTypeDisplay(type) {
    return `${getCounterTypeEmoji(type)} ${getCounterTypeLabel(type)}`;
}

function getCounterEmoji(type) {
    return getCounterTypeEmoji(type);
}

function getCurrentCount(stats, type) {
    switch (type) {
        case "members":
            return stats.totalCount;
        case "bots":
            return stats.botCount;
        case "members_only":
            return stats.humanCount;
        default:
            return 0;
    }
}