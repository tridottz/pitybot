import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
    LabelBuilder,
    FileUploadBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getWelcomeConfig, saveWelcomeConfig } from '../../../utils/database.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';

async function deferComponent(interaction) {
    if (interaction.deferred || interaction.replied) {
        return true;
    }

    try {
        await interaction.deferUpdate();
        return true;
    } catch (error) {
        logger.debug('Component interaction expired or already acknowledged:', error.message);
        return false;
    }
}

async function sendEphemeralFollowUp(interaction, payload) {
    try {
        await interaction.followUp({
            ...payload,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logger.debug('Failed to send ephemeral follow-up:', error.message);
    }
}

function buildDashboardEmbed(cfg, guild) {
    const welcomeChannel = cfg.channelId ? `<#${cfg.channelId}>` : '`Sin configurar`';
    const goodbyeChannel = cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : '`Sin configurar`';

    const rawWelcome = cfg.welcomeMessage || '¡Te damos la bienvenida, {user}, a {server}!';
    const rawGoodbye = cfg.leaveMessage || '{user.tag} ha salido del servidor.';
    const welcomePreview = `\`${rawWelcome.length > 55 ? rawWelcome.substring(0, 55) + '…' : rawWelcome}\``;
    const goodbyePreview = `\`${rawGoodbye.length > 55 ? rawGoodbye.substring(0, 55) + '…' : rawGoodbye}\``;

    return new EmbedBuilder()
        .setTitle('👋 Panel de saludos')
        .setDescription(
            `Administra la configuración de bienvenida y despedida de **${guild.name}**.\nActiva o desactiva cada sistema con los botones y selecciona una opción para editarlo.`,
        )
        .setColor(getColor('info'))
        .addFields(
            { name: 'Canal de bienvenida', value: welcomeChannel, inline: true },
            { name: 'Estado de bienvenida', value: cfg.enabled ? 'Activado' : 'Desactivado', inline: true },
            { name: 'Mención en bienvenida', value: cfg.welcomePing ? 'Activada' : 'Desactivada', inline: true },
            { name: 'Canal de despedida', value: goodbyeChannel, inline: true },
            { name: 'Estado de despedida', value: cfg.goodbyeEnabled ? 'Activado' : 'Desactivado', inline: true },
            { name: 'Mención en despedida', value: cfg.goodbyePing ? 'Activada' : 'Desactivada', inline: true },
            { name: 'Mensaje de bienvenida', value: welcomePreview, inline: false },
            { name: 'Mensaje de despedida', value: goodbyePreview, inline: false },
        )
        .setFooter({ text: 'El panel se cierra tras 10 minutos de inactividad' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`greet_cfg_${guildId}`)
        .setPlaceholder('Selecciona una opción para configurar...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Canal de bienvenida')
                .setDescription('Establece el canal donde se enviarán los mensajes de bienvenida')
                .setValue('welcome_channel')
                .setEmoji('🟢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Mensaje de bienvenida')
                .setDescription('Edita el texto que aparece cuando entra un miembro')
                .setValue('welcome_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Imagen de bienvenida')
                .setDescription('Establece la imagen de los mensajes de bienvenida')
                .setValue('welcome_image')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Canal de despedida')
                .setDescription('Establece el canal donde se enviarán los mensajes de despedida')
                .setValue('goodbye_channel')
                .setEmoji('🔴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Mensaje de despedida')
                .setDescription('Edita el texto que aparece cuando se va un miembro')
                .setValue('goodbye_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Imagen de despedida')
                .setDescription('Establece la imagen de los mensajes de despedida')
                .setValue('goodbye_image')
                .setEmoji('🖼️'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    const welcomeOn = cfg.enabled === true;
    const goodbyeOn = cfg.goodbyeEnabled === true;
    const welcomePingOn = cfg.welcomePing === true;
    const goodbyePingOn = cfg.goodbyePing === true;
    
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_welcome_${guildId}`)
                .setLabel('Bienvenida')
                .setStyle(welcomeOn ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🟢')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_goodbye_${guildId}`)
                .setLabel('Despedida')
                .setStyle(goodbyeOn ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🔴')
                .setDisabled(disabled),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_welcome_${guildId}`)
                .setLabel('Mencionar bienvenida')
                .setStyle(welcomePingOn ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_goodbye_${guildId}`)
                .setLabel('Mencionar despedida')
                .setStyle(goodbyePingOn ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
        ),
    ];
}

async function refreshDashboard(rootInteraction, cfg, guildId) {
    try {
        const selectMenu = buildSelectMenu(guildId);
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [buildDashboardEmbed(cfg, rootInteraction.guild)],
            components: [
                ...buildButtonRow(cfg, guildId),
                new ActionRowBuilder().addComponents(selectMenu),
            ],
        });
    } catch (error) {
        logger.debug('Could not refresh greet dashboard (interaction may have expired):', error.message);
    }
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const cfg = await getWelcomeConfig(client, guildId);

            if (!cfg.channelId && !cfg.goodbyeChannelId) {
                throw new TitanBotError(
                    'Sistema de saludos sin configurar',
                    ErrorTypes.CONFIGURATION,
                    'Todavía no has configurado la bienvenida ni la despedida. Ejecuta `/bienvenida configurar` o `/despedida configurar` primero.',
                );
            }

            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!interaction.deferred) {
                return;
            }

            const selectMenu = buildSelectMenu(guildId);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildDashboardEmbed(cfg, interaction.guild)],
                components: [
                    ...buildButtonRow(cfg, guildId),
                    new ActionRowBuilder().addComponents(selectMenu),
                ],
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i =>
                    i.user.id === interaction.user.id && i.customId === `greet_cfg_${guildId}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const selectedOption = selectInteraction.values[0];
                try {
                    switch (selectedOption) {
                        case 'welcome_channel':
                            await handleWelcomeChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_message':
                            await handleWelcomeMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_image':
                            await handleWelcomeImage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_channel':
                            await handleGoodbyeChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_message':
                            await handleGoodbyeMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_image':
                            await handleGoodbyeImage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                    }
                } catch (error) {
                    if (error instanceof TitanBotError) {
                        logger.debug(`Greet config validation error: ${error.message}`);
                    } else {
                        logger.error('Unexpected greet dashboard error:', error);
                    }

                    const errorMessage =
                        error instanceof TitanBotError
                            ? error.userMessage || 'Ocurrió un error al procesar tu selección.'
                            : 'Ocurrió un error inesperado al actualizar la configuración.';

                    if (!selectInteraction.replied && !selectInteraction.deferred) {
                        await selectInteraction.deferUpdate().catch(() => {});
                    }

                    await replyUserError(selectInteraction, {
                        type: ErrorTypes.CONFIGURATION,
                        message: errorMessage,
                    }).catch(() => {});
                }
            });

            const btnCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i =>
                    i.user.id === interaction.user.id &&
                    (i.customId === `greet_cfg_toggle_welcome_${guildId}` ||
                        i.customId === `greet_cfg_toggle_goodbye_${guildId}` ||
                        i.customId === `greet_cfg_ping_welcome_${guildId}` ||
                        i.customId === `greet_cfg_ping_goodbye_${guildId}`),
                time: 600_000,
            });

            btnCollector.on('collect', async btnInteraction => {
                try {
                    if (!await deferComponent(btnInteraction)) {
                        return;
                    }

                    const customId = btnInteraction.customId;

                    if (customId === `greet_cfg_toggle_welcome_${guildId}`) {
                        cfg.enabled = !cfg.enabled;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Bienvenida actualizada',
                                    `Los mensajes de bienvenida ahora están **${cfg.enabled ? 'activados' : 'desactivados'}**.`,
                                ),
                            ],
                        });
                    } else if (customId === `greet_cfg_toggle_goodbye_${guildId}`) {
                        cfg.goodbyeEnabled = !cfg.goodbyeEnabled;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Despedida actualizada',
                                    `Los mensajes de despedida ahora están **${cfg.goodbyeEnabled ? 'activados' : 'desactivados'}**.`,
                                ),
                            ],
                        });
                    } else if (customId === `greet_cfg_ping_welcome_${guildId}`) {
                        cfg.welcomePing = !cfg.welcomePing;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Mención en bienvenida actualizada',
                                    `Los usuarios que se unan ${cfg.welcomePing ? 'recibirán una mención' : 'no recibirán una mención'} en el mensaje de bienvenida.`,
                                ),
                            ],
                        });
                    } else if (customId === `greet_cfg_ping_goodbye_${guildId}`) {
                        cfg.goodbyePing = !cfg.goodbyePing;
                        await saveWelcomeConfig(client, guildId, cfg);
                        await sendEphemeralFollowUp(btnInteraction, {
                            embeds: [
                                successEmbed(
                                    '✅ Mención en despedida actualizada',
                                    `Los usuarios que se vayan ${cfg.goodbyePing ? 'recibirán una mención' : 'no recibirán una mención'} en el mensaje de despedida.`,
                                ),
                            ],
                        });
                    }

                    await refreshDashboard(interaction, cfg, guildId);
                } catch (error) {
                    logger.error('Error handling greet dashboard button:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    btnCollector.stop();
                    try {
                        await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('El panel ha caducado')
                                    .setDescription('Este panel se cerró por inactividad. Ejecuta el comando de nuevo para continuar.')
                                    .setColor(getColor('error'))
                            ],
                            components: [],
                        });
                    } catch (error) {
                        logger.debug('Could not update dashboard on timeout:', error.message);
                    }
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in greet_dashboard:', error);
            throw new TitanBotError(
                `Greet dashboard failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'No se pudo abrir el panel de saludos.',
            );
        }
    },
};

async function handleWelcomeChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_cfg_welcome_channel')
        .setPlaceholder('Selecciona un canal de texto...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🟢 Canal de bienvenida')
                .setDescription(
                    `**Actual:** ${cfg.channelId ?`<#${cfg.channelId}>`: '`Sin configurar`'}\n\nSelecciona el canal donde se enviarán los mensajes de bienvenida.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'greet_cfg_welcome_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        if (!await deferComponent(chanInteraction)) {
            return;
        }
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            await replyUserError(chanInteraction, {
                type: ErrorTypes.PERMISSION,
                message: `Necesito los permisos **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ${channel}.`,
            });
            return;
        }

        cfg.channelId = channel.id;
        await saveWelcomeConfig(client, guildId, cfg);

        await sendEphemeralFollowUp(chanInteraction, {
            embeds: [successEmbed('Canal actualizado', `Los mensajes de bienvenida se enviarán en ${channel}.`)],
        });

        await refreshDashboard(rootInteraction, cfg, guildId);
    });

    chanCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún canal. No se cambió la configuración.',
            }).catch(() => {});
        }
    });
}

async function handleWelcomeMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_message')
        .setTitle('Editar mensaje de bienvenida')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
        .setLabel('Mensaje (variables: {user}, {server}, etc.)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.welcomeMessage || '¡Te damos la bienvenida, {user}, a {server}!')
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_welcome_message' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    cfg.welcomeMessage = submitted.fields.getTextInputValue('message_input').trim();
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
    embeds: [successEmbed('Mensaje de bienvenida actualizado', 'Se guardó el mensaje de bienvenida.')],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleWelcomeImage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_image')
        .setTitle('Configurar imagen de bienvenida');

    const imageHint = new TextDisplayBuilder()
        .setContent('Proporciona un enlace directo a una imagen **o** sube un archivo a continuación. Si proporcionas ambos, se usará el archivo. Deja el enlace vacío y no subas ningún archivo para quitar la imagen.');

    const urlLabel = new LabelBuilder()
        .setLabel('Enlace de la imagen (opcional)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('image_input')
                .setPlaceholder('https://example.com/welcome.png')
                .setStyle(TextInputStyle.Short)
                .setValue(cfg.welcomeImage || '')
                .setRequired(false),
        );

    const uploadLabel = new LabelBuilder()
        .setLabel('O sube un archivo de imagen (opcional)')
        .setFileUploadComponent(
            new FileUploadBuilder()
                .setCustomId('image_upload')
                .setRequired(false),
        );

    modal
        .addTextDisplayComponents(imageHint)
        .addLabelComponents(urlLabel, uploadLabel);

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_welcome_image' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const uploadedFiles = submitted.fields.getUploadedFiles('image_upload');
    let imageUrl = uploadedFiles?.at(0)?.url ?? submitted.fields.getTextInputValue('image_input').trim();

    if (imageUrl) {
        try {
            new URL(imageUrl);
            if (!['http:', 'https:'].includes(new URL(imageUrl).protocol)) {
                await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El enlace de la imagen debe comenzar con `http://` o `https://`.' });
                return;
            }
        } catch {
            await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Proporciona un enlace de imagen válido.' });
            return;
        }
    }

    cfg.welcomeImage = imageUrl || null;
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
    embeds: [successEmbed('Imagen de bienvenida actualizada', `La imagen se ${imageUrl ? 'actualizó' : 'quitó'} correctamente.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleWelcomePing(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    cfg.welcomePing = !cfg.welcomePing;
    await saveWelcomeConfig(client, guildId, cfg);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            successEmbed(
                '✅ Mención en bienvenida actualizada',
                `Los usuarios que se unan ${cfg.welcomePing ? 'recibirán una mención' : 'no recibirán una mención'} en el mensaje de bienvenida.`,
            ),
        ],
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyeChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_cfg_goodbye_channel')
        .setPlaceholder('Selecciona un canal de texto...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🔴 Canal de despedida')
                .setDescription(
                    `**Actual:** ${cfg.goodbyeChannelId ?`<#${cfg.goodbyeChannelId}>`: '`Sin configurar`'}\n\nSelecciona el canal donde se enviarán los mensajes de despedida.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'greet_cfg_goodbye_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        if (!await deferComponent(chanInteraction)) {
            return;
        }
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            await replyUserError(chanInteraction, {
                type: ErrorTypes.PERMISSION,
                message: `Necesito los permisos **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ${channel}.`,
            });
            return;
        }

        cfg.goodbyeChannelId = channel.id;
        await saveWelcomeConfig(client, guildId, cfg);

        await sendEphemeralFollowUp(chanInteraction, {
            embeds: [successEmbed('Canal actualizado', `Los mensajes de despedida se enviarán en ${channel}.`)],
        });

        await refreshDashboard(rootInteraction, cfg, guildId);
    });

    chanCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún canal. No se cambió la configuración.',
            }).catch(() => {});
        }
    });
}

async function handleGoodbyeMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_goodbye_message')
        .setTitle('Editar mensaje de despedida')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Mensaje (variables: {user}, {server}, etc.)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.leaveMessage || '{user.tag} ha salido del servidor.')
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_goodbye_message' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    cfg.leaveMessage = submitted.fields.getTextInputValue('message_input').trim();
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
    embeds: [successEmbed('Mensaje de despedida actualizado', 'Se guardó el mensaje de despedida.')],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyeImage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_goodbye_image')
        .setTitle('Configurar imagen de despedida');

    const imageHint = new TextDisplayBuilder()
        .setContent('Proporciona un enlace directo a una imagen **o** sube un archivo a continuación. Si proporcionas ambos, se usará el archivo. Deja el enlace vacío y no subas ningún archivo para quitar la imagen.');

    const urlLabel = new LabelBuilder()
        .setLabel('Enlace de la imagen (opcional)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('image_input')
                .setPlaceholder('https://example.com/goodbye.png')
                .setStyle(TextInputStyle.Short)
                .setValue(
                    typeof cfg.leaveEmbed?.image === 'string'
                        ? cfg.leaveEmbed.image
                        : cfg.leaveEmbed?.image?.url || ''
                )
                .setRequired(false),
        );

    const uploadLabel = new LabelBuilder()
        .setLabel('O sube un archivo de imagen (opcional)')
        .setFileUploadComponent(
            new FileUploadBuilder()
                .setCustomId('image_upload')
                .setRequired(false),
        );

    modal
        .addTextDisplayComponents(imageHint)
        .addLabelComponents(urlLabel, uploadLabel);

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'greet_cfg_goodbye_image' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const uploadedFiles = submitted.fields.getUploadedFiles('image_upload');
    let imageUrl = uploadedFiles?.at(0)?.url ?? submitted.fields.getTextInputValue('image_input').trim();

    if (imageUrl) {
        try {
            new URL(imageUrl);
            if (!['http:', 'https:'].includes(new URL(imageUrl).protocol)) {
                await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El enlace de la imagen debe comenzar con `http://` o `https://`.' });
                return;
            }
        } catch {
            await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Proporciona un enlace de imagen válido.' });
            return;
        }
    }

    const nextLeaveEmbed = { ...(cfg.leaveEmbed || {}) };
    if (imageUrl) {
        nextLeaveEmbed.image = imageUrl;
    } else {
        delete nextLeaveEmbed.image;
    }

    cfg.leaveEmbed = nextLeaveEmbed;
    await saveWelcomeConfig(client, guildId, cfg);

    await submitted.reply({
    embeds: [successEmbed('Imagen de despedida actualizada', `La imagen se ${imageUrl ? 'actualizó' : 'quitó'} correctamente.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyePing(selectInteraction, rootInteraction, cfg, guildId, client) {
    if (!await deferComponent(selectInteraction)) {
        return;
    }

    cfg.goodbyePing = !cfg.goodbyePing;
    await saveWelcomeConfig(client, guildId, cfg);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            successEmbed(
                '✅ Mención en despedida actualizada',
                `Los usuarios que se vayan ${cfg.goodbyePing ? 'recibirán una mención' : 'no recibirán una mención'} en el mensaje de despedida.`,
            ),
        ],
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}
