import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { 
    getJoinToCreateConfig, 
    updateJoinToCreateConfig,
    removeJoinToCreateTrigger,
    addJoinToCreateTrigger
} from '../../../utils/database.js';

export default {
    async execute(interaction, config, client) {
        try {
            const triggerChannel = interaction.options.getChannel('trigger_channel');
        const guildId = interaction.guild.id;

        const currentConfig = await getJoinToCreateConfig(client, guildId);

        if (!currentConfig.triggerChannels.includes(triggerChannel.id)) {
            throw new TitanBotError(
                `Channel ${triggerChannel.id} is not a Join to Create trigger`,
                ErrorTypes.VALIDATION,
                `${triggerChannel} no está configurado como canal activador de «Unirse para crear».`
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('Configuración de «Unirse para crear»')
            .setDescription(`Configura los ajustes de ${triggerChannel}`)
            .setColor(getColor('info'))
            .addFields(
                {
                    name: 'Current Channel Name Template',
                    value: `\`${currentConfig.channelOptions?.[triggerChannel.id]?.nameTemplate || currentConfig.channelNameTemplate}\``,
                    inline: false
                },
                {
                    name: 'Current User Limit',
                    value: `${currentConfig.channelOptions?.[triggerChannel.id]?.userLimit || currentConfig.userLimit === 0 ? 'Sin límite' : currentConfig.userLimit + ' usuarios'}`,
                    inline: true
                },
                {
                    name: 'Current Bitrate',
                    value: `${(currentConfig.channelOptions?.[triggerChannel.id]?.bitrate || currentConfig.bitrate) / 1000} kbps`,
                    inline: true
                }
            )
            .setFooter({ text: 'Select an option to configure below' })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`jointocreate_config_${triggerChannel.id}`)
            .setPlaceholder('Selecciona una opción de configuración')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Cambiar plantilla del nombre del canal')
                    .setDescription('Modifica la plantilla de nombres de los canales temporales')
                    .setValue('name_template'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Cambiar límite de usuarios')
                    .setDescription('Establece el máximo de usuarios por canal temporal')
                    .setValue('user_limit'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Cambiar tasa de bits')
                    .setDescription('Ajusta la calidad de audio de los canales temporales')
                    .setValue('bitrate'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Quitar este canal activador')
                    .setDescription('Quita este canal del sistema «Unirse para crear»')
                    .setValue('remove_trigger'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ver ajustes actuales')
                    .setDescription('Muestra todos los detalles de la configuración actual')
                    .setValue('view_settings')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            components: [row],
        }).catch(error => {
            logger.error('Failed to edit reply in config_setup:', error);
        });

        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === interaction.user.id && i.customId === `jointocreate_config_${triggerChannel.id}`,
time: 60000
        });

        collector.on('collect', async (selectInteraction) => {
            await selectInteraction.deferUpdate();

            const selectedOption = selectInteraction.values[0];

            try {
                switch (selectedOption) {
                    case 'name_template':
                        await handleNameTemplateChange(selectInteraction, triggerChannel, currentConfig, client);
                        break;
                    case 'user_limit':
                        await handleUserLimitChange(selectInteraction, triggerChannel, currentConfig, client);
                        break;
                    case 'bitrate':
                        await handleBitrateChange(selectInteraction, triggerChannel, currentConfig, client);
                        break;
                    case 'remove_trigger':
                        await handleRemoveTrigger(selectInteraction, triggerChannel, currentConfig, client);
                        break;
                    case 'view_settings':
                        await handleViewSettings(selectInteraction, triggerChannel, currentConfig, client);
                        break;
                }
            } catch (error) {
                if (error instanceof TitanBotError) {
                    logger.debug(`Configuration validation error: ${error.message}`, error.context || {});
                } else {
                    logger.error('Unexpected configuration menu error:', error);
                }
                
                const errorMessage = error instanceof TitanBotError 
                    ? error.userMessage || 'Ocurrió un error al procesar tu selección.'
                    : 'Ocurrió un error al procesar tu selección.';
                    
                await replyUserError(selectInteraction, {
                    type: ErrorTypes.CONFIGURATION,
                    message: errorMessage
                }).catch(() => {});
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const disabledRow = new ActionRowBuilder().addComponents(
                    selectMenu.setDisabled(true)
                );
                
                await InteractionHelper.safeEditReply(interaction, {
                    components: [disabledRow],
                }).catch(() => {});
            }
        });
            } catch (error) {
            if (error instanceof TitanBotError) {
                throw error;
            }
            logger.error('Unexpected error in config_setup:', error);
            throw new TitanBotError(
                `Config setup failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'No se pudo configurar el sistema «Unirse para crear».'
            );
        }
    }
};

async function handleNameTemplateChange(interaction, triggerChannel, currentConfig, client) {
    const embed = new EmbedBuilder()
        .setTitle('Configuración de la plantilla del nombre del canal')
        .setDescription('Introduce la nueva plantilla para los nombres de canales.')
        .addFields(
            {
                name: 'Available Variables',
                value: '• `{username}` - User\'s username\n• `{display_name}` - User\'s display name\n• `{user_tag}` - User\'s tag (User#1234)\n• `{guild_name}` - Server name',
                inline: false
            },
            {
                name: 'Current Template',
                value: `\`${currentConfig.channelOptions?.[triggerChannel.id]?.nameTemplate || currentConfig.channelNameTemplate}\``,
                inline: false
            }
        )
        .setColor(getColor('info'))
        .setFooter({ text: 'Type your new template in the chat below' });

    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });

    const collector = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id,
time: 600_000,
        max: 1
    });

    collector.on('collect', async (message) => {
        try {
            const newTemplate = message.content.trim();
            
            if (!newTemplate || newTemplate.length > 100) {
                await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'La plantilla debe tener entre 1 y 100 caracteres.'
                });
                return;
            }

            const channelOptions = currentConfig.channelOptions || {};
            channelOptions[triggerChannel.id] = {
                ...channelOptions[triggerChannel.id],
                nameTemplate: newTemplate
            };

            await updateJoinToCreateConfig(client, interaction.guild.id, {
                channelOptions: channelOptions
            });

            await interaction.followUp({
                embeds: [successEmbed('Plantilla actualizada', `La plantilla del nombre del canal cambió a \`${newTemplate}\``)],
                flags: MessageFlags.Ephemeral,
            });

            await message.delete().catch(() => {});
        } catch (error) {
            if (error instanceof TitanBotError) {
                logger.debug(`Template validation error: ${error.message}`);
            } else {
                logger.error('Template update error:', error);
            }
            
            const errorMessage = error instanceof TitanBotError
                ? error.userMessage || 'No se pudo actualizar la plantilla del nombre del canal.'
                : 'No se pudo actualizar la plantilla del nombre del canal.';
                
            await replyUserError(interaction, {
                type: ErrorTypes.CONFIGURATION,
                message: errorMessage
            }).catch(() => {});
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            replyUserError(interaction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se recibió respuesta. Se canceló el cambio de plantilla.'
            }).catch(() => {});
        }
    });
}

async function handleUserLimitChange(interaction, triggerChannel, currentConfig, client) {
    const embed = new EmbedBuilder()
        .setTitle('Configuración del límite de usuarios')
        .setDescription('Introduce el nuevo límite de usuarios (0-99; 0 significa sin límite).')
        .addFields(
            {
                name: 'Current Limit',
                value: `${currentConfig.channelOptions?.[triggerChannel.id]?.userLimit || currentConfig.userLimit === 0 ? 'Sin límite' : currentConfig.userLimit + ' usuarios'}`,
                inline: false
            }
        )
        .setColor(getColor('info'))
        .setFooter({ text: 'Type the new limit in the chat below' });

    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });

    const collector = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id && /^\d+$/.test(m.content.trim()),
        time: 600_000,
        max: 1
    });

    collector.on('collect', async (message) => {
        try {
            const newLimit = parseInt(message.content.trim());
            
            if (newLimit < 0 || newLimit > 99) {
                await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'El límite de usuarios debe estar entre 0 y 99.'
                });
                return;
            }

            const channelOptions = currentConfig.channelOptions || {};
            channelOptions[triggerChannel.id] = {
                ...channelOptions[triggerChannel.id],
                userLimit: newLimit
            };

            await updateJoinToCreateConfig(client, interaction.guild.id, {
                channelOptions: channelOptions
            });

            await interaction.followUp({
                embeds: [successEmbed('Límite actualizado', `El límite de usuarios cambió a ${newLimit === 0 ? 'Sin límite' : newLimit + ' usuarios'}`)],
                flags: MessageFlags.Ephemeral,
            });

            await message.delete().catch(() => {});
        } catch (error) {
            if (error instanceof TitanBotError) {
                logger.debug(`User limit validation error: ${error.message}`);
            } else {
                logger.error('User limit update error:', error);
            }
            
            const errorMessage = error instanceof TitanBotError
                ? error.userMessage || 'No se pudo actualizar el límite de usuarios.'
                : 'No se pudo actualizar el límite de usuarios.';
                
            await replyUserError(interaction, {
                type: ErrorTypes.CONFIGURATION,
                message: errorMessage
            }).catch(() => {});
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            replyUserError(interaction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se recibió una respuesta válida. Se canceló la actualización.'
            }).catch(() => {});
        }
    });
}

async function handleBitrateChange(interaction, triggerChannel, currentConfig, client) {
    const embed = new EmbedBuilder()
        .setTitle('Configuración de la tasa de bits')
        .setDescription('Introduce la nueva tasa de bits en kbps (8-384).')
        .addFields(
            {
                name: 'Current Bitrate',
                value: `${(currentConfig.channelOptions?.[triggerChannel.id]?.bitrate || currentConfig.bitrate) / 1000} kbps`,
                inline: false
            },
            {
                name: 'Common Values',
                value: '• 64 kbps - Normal quality\n• 96 kbps - Good quality\n• 128 kbps - High quality\n• 256 kbps - Very high quality',
                inline: false
            }
        )
        .setColor(getColor('info'))
        .setFooter({ text: 'Type the new bitrate in the chat below' });

    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });

    const collector = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === interaction.user.id && /^\d+$/.test(m.content.trim()),
        time: 600_000,
        max: 1
    });

    collector.on('collect', async (message) => {
        try {
            const newBitrate = parseInt(message.content.trim());
            
            if (newBitrate < 8 || newBitrate > 384) {
                await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'La tasa de bits debe estar entre 8 y 384 kbps.'
                });
                return;
            }

            const channelOptions = currentConfig.channelOptions || {};
            channelOptions[triggerChannel.id] = {
                ...channelOptions[triggerChannel.id],
                bitrate: newBitrate * 1000
            };

            await updateJoinToCreateConfig(client, interaction.guild.id, {
                channelOptions: channelOptions
            });

            await interaction.followUp({
                embeds: [successEmbed('Tasa de bits actualizada', `La tasa de bits cambió a ${newBitrate} kbps`)],
                flags: MessageFlags.Ephemeral,
            });

            await message.delete().catch(() => {});
        } catch (error) {
            if (error instanceof TitanBotError) {
                logger.debug(`Bitrate validation error: ${error.message}`);
            } else {
                logger.error('Bitrate update error:', error);
            }
            
            const errorMessage = error instanceof TitanBotError
                ? error.userMessage || 'No se pudo actualizar la tasa de bits.'
                : 'No se pudo actualizar la tasa de bits.';
                
            await replyUserError(interaction, {
                type: ErrorTypes.CONFIGURATION,
                message: errorMessage
            }).catch(() => {});
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            replyUserError(interaction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se recibió una respuesta válida. Se canceló la actualización.'
            }).catch(() => {});
        }
    });
}

async function handleRemoveTrigger(interaction, triggerChannel, currentConfig, client) {
    const embed = new EmbedBuilder()
        .setTitle('Quitar canal activador')
        .setDescription(`¿Seguro que quieres quitar ${triggerChannel} del sistema «Unirse para crear»?`)
        .setColor('#ff6600')
        .setFooter({ text: 'This action cannot be undone' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirm_remove_${triggerChannel.id}`)
            .setLabel('Quitar canal')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`cancel_remove_${triggerChannel.id}`)
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.followUp({ 
        embeds: [embed], 
        components: [row],
        flags: MessageFlags.Ephemeral 
    });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id && 
                     (i.customId === `confirm_remove_${triggerChannel.id}` || i.customId === `cancel_remove_${triggerChannel.id}`),
        time: 600_000,
        max: 1
    });

    collector.on('collect', async (buttonInteraction) => {
        await buttonInteraction.deferUpdate();

        if (buttonInteraction.customId === `confirm_remove_${triggerChannel.id}`) {
            try {
                const success = await removeJoinToCreateTrigger(client, interaction.guild.id, triggerChannel.id);
                
                if (success) {
                    await buttonInteraction.followUp({
                        embeds: [successEmbed('Canal eliminado', `Se quitó ${triggerChannel} del sistema «Unirse para crear».`)],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await replyUserError(buttonInteraction, {
                        type: ErrorTypes.CONFIGURATION,
                        message: 'No se pudo quitar el canal activador.'
                    });
                }
            } catch (error) {
                if (error instanceof TitanBotError) {
                    logger.debug(`Trigger removal validation error: ${error.message}`);
                } else {
                    logger.error('Remove trigger error:', error);
                }
                
                const errorMessage = error instanceof TitanBotError
                    ? error.userMessage || 'An error occurred while removing the trigger channel.'
                    : 'An error occurred while removing the trigger channel.';
                    
                await replyUserError(buttonInteraction, {
                    type: ErrorTypes.CONFIGURATION,
                    message: errorMessage
                }).catch(() => {});
            }
        } else {
            await buttonInteraction.followUp({
                embeds: [successEmbed('Cancelado', 'Se canceló la eliminación del canal.')],
                flags: MessageFlags.Ephemeral,
            });
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            replyUserError(interaction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se recibió respuesta. Se canceló la eliminación.'
            }).catch(() => {});
        }
    });
}

async function handleViewSettings(interaction, triggerChannel, currentConfig, client) {
    const channelConfig = currentConfig.channelOptions?.[triggerChannel.id] || {};
    
    const embed = new EmbedBuilder()
        .setTitle('Ajustes actuales')
        .setDescription(`Configuración de ${triggerChannel}`)
        .setColor(getColor('info'))
        .addFields(
            {
                name: 'Trigger Channel',
                value: `${triggerChannel} (${triggerChannel.id})`,
                inline: false
            },
            {
                name: 'Channel Name Template',
                value: `\`${channelConfig.nameTemplate || currentConfig.channelNameTemplate}\``,
                inline: false
            },
            {
                name: 'Límite de usuarios',
                value: `${channelConfig.userLimit || currentConfig.userLimit === 0 ? 'Sin límite' : (channelConfig.userLimit || currentConfig.userLimit) + ' usuarios'}`,
                inline: true
            },
            {
                name: 'Tasa de bits',
                value: `${(channelConfig.bitrate || currentConfig.bitrate) / 1000} kbps`,
                inline: true
            },
            {
                name: 'Categoría',
                value: currentConfig.categoryId ? `<#${currentConfig.categoryId}>` : 'Sin configurar',
                inline: true
            },
            {
                name: 'Estado del sistema',
                value: currentConfig.enabled ? '✅ Activado' : '❌ Desactivado',
                inline: true
            },
            {
                name: 'Canales temporales activos',
                value: Object.keys(currentConfig.temporaryChannels || {}).length.toString(),
                inline: true
            }
        )
        .setTimestamp();

    await interaction.followUp({ 
        embeds: [embed], 
        flags: MessageFlags.Ephemeral 
    });
}
