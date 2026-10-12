import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed, infoEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { getGuildTicketStats } from '../../../utils/database/tickets.js';
import { getUserTicketCount } from '../../../services/ticket.js';
import {
    getTicketPanelStatus,
    messageHasButtonCustomId,
    formatPanelStatusField,
} from '../../../utils/panelStatus.js';
import { startDashboardSession } from '../../../utils/dashboardSession.js';

function buildButtonRow(guildConfig, guildId, disabled = false, panelStatus = null) {
    const dmEnabled = guildConfig.dmOnClose !== false;
    const showRepost = panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';

    const buttons = [];

    if (showRepost) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`ticket_cfg_repost_${guildId}`)
                .setLabel('Volver a publicar panel')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌')
                .setDisabled(disabled),
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_dm_toggle_${guildId}`)
            .setLabel('Mensaje privado al cerrar')
            .setStyle(dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji(dmEnabled ? '📬' : '📭')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_staff_role_btn_${guildId}`)
            .setLabel('Rol del equipo')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛡️')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_delete_${guildId}`)
            .setLabel('Eliminar sistema')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(disabled),
    );

    return new ActionRowBuilder().addComponents(buttons);
}

async function persistPanelMessageId(client, guildId, guildConfig, messageId) {
    if (!messageId || guildConfig.ticketPanelMessageId === messageId) return;
    guildConfig.ticketPanelMessageId = messageId;
    if (client.db) {
        await setGuildConfig(client, guildId, guildConfig);
    }
}

function buildPanelEmbed(config) {
    return new EmbedBuilder()
        .setTitle('Tickets de soporte')
        .setDescription(config.ticketPanelMessage || 'Haz clic en el botón para crear un ticket de soporte.')
        .setColor(getColor('info'));
}

function buildPanelButtonRow(config) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel(config.ticketButtonLabel || 'Crear ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩'),
    );
}

async function repostTicketPanel(client, guild, guildConfig, guildId) {
    const channel = await guild.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
    if (!channel) {
        throw new TitanBotError(
            'Panel channel missing',
            ErrorTypes.CONFIGURATION,
            'El canal configurado para el panel de tickets ya no existe. Elige otro canal desde el panel de configuración.',
        );
    }

    const sentPanel = await channel.send({
        embeds: [buildPanelEmbed(guildConfig)],
        components: [buildPanelButtonRow(guildConfig)],
    });

    await persistPanelMessageId(client, guildId, guildConfig, sentPanel.id);
    return sentPanel;
}

function formatCloseDuration(ms) {
    if (ms == null) return '`N/A`';
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function buildDashboardEmbed(config, guild, panelStatus = null, ticketStats = null) {
    const panelChannel = config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : '`Sin configurar`';
    const staffRole = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : '`Sin configurar`';
    const ticketLogsChannel = config.ticketLogsChannelId ? `<#${config.ticketLogsChannelId}>` : '`Sin configurar`';
    const transcriptChannel = config.ticketTranscriptChannelId ? `<#${config.ticketTranscriptChannelId}>` : '`Sin configurar`';

    const openCategoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId) : null;
    const openCategory = openCategoryChannel ? openCategoryChannel.toString() : '`Sin configurar`';
    
    const closedCategoryChannel = config.ticketClosedCategoryId ? guild.channels.cache.get(config.ticketClosedCategoryId) : null;
    const closedCategory = closedCategoryChannel ? closedCategoryChannel.toString() : '`Sin configurar`';

    const rawMsg = config.ticketPanelMessage || 'Haz clic en el botón para crear un ticket de soporte.';
    const panelMsg = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
    const btnLabel = `\`${config.ticketButtonLabel || 'Crear ticket'}\``;

    let panelStatusValue = formatPanelStatusField(panelStatus);

    const openTickets = ticketStats ? String(ticketStats.openCount) : '`—`';
    const avgCloseTime = ticketStats ? formatCloseDuration(ticketStats.avgCloseTimeMs) : '`—`';
    const feedbackSummary = ticketStats?.feedbackCount
        ? `${ticketStats.avgRating}/5 (${ticketStats.feedbackCount} rating${ticketStats.feedbackCount !== 1 ? 's' : ''})`
        : '`Aún no hay valoraciones`';

    return new EmbedBuilder()
        .setTitle('🎫 Panel del sistema de tickets')
        .setDescription(`Administra la configuración de tickets de **${guild.name}**.\nSelecciona una opción para cambiar un ajuste.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'Estado del panel', value: panelStatusValue, inline: false },
            { name: 'Canal del panel', value: panelChannel, inline: true },
            { name: 'Rol del equipo', value: staffRole, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Categoría de tickets abiertos', value: openCategory, inline: true },
            { name: 'Categoría de tickets cerrados', value: closedCategory, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Mensaje del panel', value: panelMsg, inline: false },
            { name: 'Texto del botón', value: btnLabel, inline: true },
            { name: 'Máximo de tickets por usuario', value: String(config.maxTicketsPerUser || 3), inline: true },
            { name: 'Mensaje privado al cerrar', value: config.dmOnClose !== false ? 'Activado' : 'Desactivado', inline: true },
            { name: 'Canal de registros', value: ticketLogsChannel, inline: true },
            { name: 'Canal de transcripciones', value: transcriptChannel, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Tickets abiertos', value: openTickets, inline: true },
            { name: 'Tiempo promedio de cierre', value: avgCloseTime, inline: true },
            { name: 'Valoración', value: feedbackSummary, inline: true },
        )
        .setFooter({ text: 'Selecciona una opción • El panel se cierra tras 10 minutos de inactividad' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`ticket_config_${guildId}`)
        .setPlaceholder('Selecciona una opción para configurar...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Editar mensaje del panel')
                .setDescription('Cambia el mensaje que aparece en el panel de creación de tickets')
                .setValue('panel_message')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Editar texto del botón')
                .setDescription('Cambia el texto del botón para crear tickets')
                .setValue('button_label')
                .setEmoji('🏷️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar categoría de tickets abiertos')
                .setDescription('Categoría donde se crearán los tickets nuevos')
                .setValue('open_category')
                .setEmoji('📁'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar categoría de tickets cerrados')
                .setDescription('Categoría a la que se moverán los tickets cerrados')
                .setValue('closed_category')
                .setEmoji('📂'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Definir máximo de tickets por usuario')
                .setDescription('Limita cuántos tickets abiertos puede tener un usuario a la vez')
                .setValue('max_tickets')
                .setEmoji('🔢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Configurar canal de registros')
                .setDescription('Canal que recibirá comentarios, eventos y registros de tickets')
                .setValue('logs_channel')
                .setEmoji('🎫'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Configurar canal de transcripciones')
                .setDescription('Canal que recibirá las transcripciones automáticas al eliminar tickets')
                .setValue('transcript_channel')
                .setEmoji('📜'),
        );
}

async function refreshDashboard(rootInteraction, guildConfig, guildId, client) {
    const panelStatus = client
        ? await getTicketPanelStatus(client, rootInteraction.guild, guildConfig)
        : null;
    const ticketStats = client ? await getGuildTicketStats(guildId) : null;

    if (panelStatus?.recoveredId) {
        await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId);
    }

    const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);
    const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(guildConfig, rootInteraction.guild, panelStatus, ticketStats)],
        components: [buttonRow, selectRow],
    }).catch(() => {});
}

async function updateLivePanel(client, guild, config, guildId) {
    if (!config.ticketPanelChannelId) return false;
    try {
        const panelStatus = await getTicketPanelStatus(client, guild, config);
        if (panelStatus.recoveredId) {
            await persistPanelMessageId(client, guildId, config, panelStatus.recoveredId);
        }
        if (!panelStatus.exists || !panelStatus.message) return false;

        await panelStatus.message.edit({
            embeds: [buildPanelEmbed(config)],
            components: [buildPanelButtonRow(config)],
        });
        return true;
    } catch (error) {
        logger.warn('Failed to update live ticket panel:', error.message);
        return false;
    }
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const guildConfig = await getGuildConfig(client, guildId);

            if (!guildConfig.ticketPanelChannelId) {
                throw new TitanBotError(
                    'Ticket system not configured',
                    ErrorTypes.CONFIGURATION,
                    'El sistema de tickets aún no está configurado. Ejecuta `/ticket setup` primero.',
                );
            }

            const panelStatus = await getTicketPanelStatus(client, interaction.guild, guildConfig);
            if (panelStatus.recoveredId) {
                await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId);
            }

            const ticketStats = await getGuildTicketStats(guildId);

            const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
            const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);

            await startDashboardSession({
                interaction,
                embeds: [buildDashboardEmbed(guildConfig, interaction.guild, panelStatus, ticketStats)],
                components: [buttonRow, selectRow],
                selectMenuId: `ticket_config_${guildId}`,
                buttonMatcher: (customId) =>
                    customId === `ticket_cfg_repost_${guildId}` ||
                    customId === `ticket_cfg_dm_toggle_${guildId}` ||
                    customId === `ticket_cfg_staff_role_btn_${guildId}` ||
                    customId === `ticket_cfg_delete_${guildId}`,
                onSelect: async (selectInteraction) => {
                    const selectedOption = selectInteraction.values[0];
                    switch (selectedOption) {
                        case 'panel_message':
                            await handlePanelMessage(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'button_label':
                            await handleButtonLabel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'staff_role':
                            await handleStaffRole(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'open_category':
                            await handleOpenCategory(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'closed_category':
                            await handleClosedCategory(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'max_tickets':
                            await handleMaxTickets(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'logs_channel':
                            await handleLogsChannel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'transcript_channel':
                            await handleTranscriptChannel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                    }
                },
                onButton: async (btnInteraction) => {
                    if (btnInteraction.customId === `ticket_cfg_repost_${guildId}`) {
                        await handleRepostPanel(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_dm_toggle_${guildId}`) {
                        await handleDmOnClose(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_staff_role_btn_${guildId}`) {
                        await handleStaffRole(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_delete_${guildId}`) {
                        await handleDeleteSystem(btnInteraction, interaction, guildConfig, guildId, client);
                    }
                },
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in ticket_config:', error);
            throw new TitanBotError(
                `Ticket config failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'No se pudo abrir el panel de configuración de tickets.',
            );
        }
    },
};

async function handlePanelMessage(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_panel_msg')
        .setTitle('📝 Editar mensaje del panel')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('panel_msg_input')
                    .setLabel('Mensaje del panel')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(
                        guildConfig.ticketPanelMessage ||
                            'Haz clic en el botón para crear un ticket de soporte.',
                    )
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('Haz clic en el botón para crear un ticket de soporte.'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_panel_msg' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newMessage = submitted.fields.getTextInputValue('panel_msg_input').trim();
    guildConfig.ticketPanelMessage = newMessage;
    await setGuildConfig(client, guildId, guildConfig);

    const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildId);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Mensaje del panel actualizado',
                `Se actualizó el mensaje del panel.${
                    panelUpdated
                        ? '\nTambién se actualizó el panel de tickets publicado.'
                        : '\n> **Nota:** No se encontró el panel publicado. Usa **Volver a publicar panel** en el panel de configuración para restaurarlo.'
                }`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleButtonLabel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_btn_label')
        .setTitle('🏷️ Editar texto del botón')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('btn_label_input')
                    .setLabel('Texto del botón (máximo 80 caracteres)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(guildConfig.ticketButtonLabel || 'Crear ticket')
                    .setMaxLength(80)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('Crear ticket'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_btn_label' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newLabel = submitted.fields.getTextInputValue('btn_label_input').trim();
    guildConfig.ticketButtonLabel = newLabel;
    await setGuildConfig(client, guildId, guildConfig);

    const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildId);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Texto del botón actualizado',
                `El texto del botón cambió a \`${newLabel}\`.${
                    panelUpdated
                        ? '\nTambién se actualizó el botón del panel publicado.'
                        : '\n> **Nota:** No se encontró el panel publicado. Usa **Volver a publicar panel** en el panel de configuración para restaurarlo.'
                }`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleStaffRole(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('ticket_cfg_staff_role')
        .setPlaceholder('Selecciona el rol del equipo...')
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🛡️ Cambiar rol del equipo')
                .setDescription(
                    `**Actual:** ${guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '`Sin configurar`'}\n\nSelecciona el rol que tendrá acceso para administrar los tickets.`,
                )
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_staff_role',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        await roleInteraction.deferUpdate();
        const role = roleInteraction.roles.first();

        guildConfig.ticketStaffRoleId = role.id;
        await setGuildConfig(client, guildId, guildConfig);

        await roleInteraction.followUp({
            embeds: [successEmbed('Rol del equipo actualizado', `El rol del equipo se estableció en ${role}.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún rol. No se cambió el rol del equipo.',
            }).catch(() => {});
        }
    });
}

async function handleOpenCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_open_cat')
        .setPlaceholder('Selecciona una categoría...')
        .addChannelTypes(ChannelType.GuildCategory)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📁 Cambiar categoría de tickets abiertos')
                .setDescription(
                    `**Actual:** ${guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '`Sin configurar`'}\n\nSelecciona la categoría donde se crearán los tickets nuevos.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const catCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_open_cat',
        time: 60_000,
        max: 1,
    });

    catCollector.on('collect', async catInteraction => {
        await catInteraction.deferUpdate();
        const category = catInteraction.channels.first();

        guildConfig.ticketCategoryId = category.id;
        await setGuildConfig(client, guildId, guildConfig);

        await catInteraction.followUp({
            embeds: [
                successEmbed(
                    'Categoría de tickets abiertos actualizada',
                    `Los tickets nuevos ahora se crearán en **${category.name}**.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    catCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ninguna categoría. No se cambió la configuración.',
            }).catch(() => {});
        }
    });
}

async function handleClosedCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_closed_cat')
        .setPlaceholder('Selecciona una categoría...')
        .addChannelTypes(ChannelType.GuildCategory)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📂 Cambiar categoría de tickets cerrados')
                .setDescription(
                    `**Actual:** ${guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '`Sin configurar`'}\n\nSelecciona la categoría a la que se moverán los tickets cerrados.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const catCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_closed_cat',
        time: 60_000,
        max: 1,
    });

    catCollector.on('collect', async catInteraction => {
        await catInteraction.deferUpdate();
        const category = catInteraction.channels.first();

        guildConfig.ticketClosedCategoryId = category.id;
        await setGuildConfig(client, guildId, guildConfig);

        await catInteraction.followUp({
            embeds: [
                successEmbed(
                    'Categoría de tickets cerrados actualizada',
                    `Los tickets cerrados ahora se moverán a **${category.name}**.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    catCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ninguna categoría. No se cambió la configuración.',
            }).catch(() => {});
        }
    });
}

async function handleMaxTickets(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_max_tickets')
        .setTitle('Definir máximo de tickets por usuario')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('max_tickets_input')
                    .setLabel('Máximo de tickets abiertos (1–10)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(guildConfig.maxTicketsPerUser || 3))
                    .setMaxLength(2)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('3'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_max_tickets' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const raw = submitted.fields.getTextInputValue('max_tickets_input').trim();
    const newMax = parseInt(raw, 10);

    if (Number.isNaN(newMax) || newMax < 1 || newMax > 10) {
        await replyUserError(submitted, {
            type: ErrorTypes.VALIDATION,
            message: 'El máximo de tickets debe ser un número entero entre **1** y **10**.',
        });
        return;
    }

    guildConfig.maxTicketsPerUser = newMax;
    await setGuildConfig(client, guildId, guildConfig);

    await submitted.reply({
        embeds: [
            successEmbed(
                'Máximo de tickets actualizado',
                `Cada usuario puede tener hasta **${newMax}** ticket${newMax !== 1 ? 's' : ''} abierto${newMax !== 1 ? 's' : ''} a la vez.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleDmOnClose(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    await btnInteraction.deferUpdate();

    const newState = guildConfig.dmOnClose === false;
    guildConfig.dmOnClose = newState;
    await setGuildConfig(client, guildId, guildConfig);

    await btnInteraction.followUp({
        embeds: [
            successEmbed(
                'Mensajes privados al cerrar actualizados',
                `Los usuarios **${newState ? 'recibirán' : 'dejarán de recibir'}** un mensaje privado cuando se cierre su ticket.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleLogsChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_logs_channel')
        .setPlaceholder('Selecciona un canal...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🎫 Seleccionar canal de registros de tickets')
                .setDescription('Elige dónde se enviarán los comentarios, eventos (apertura, cierre, reclamación, etc.) y otros registros de tickets.')
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const collector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_logs_channel',
        time: 60_000,
        max: 1,
    });

    collector.on('collect', async channelInteraction => {
        await channelInteraction.deferUpdate();
        const channel = channelInteraction.channels.first();

        guildConfig.ticketLogsChannelId = channel.id;
        await setGuildConfig(client, guildId, guildConfig);

        await channelInteraction.followUp({
            embeds: [successEmbed('Canal de registros actualizado', `Los registros de tickets se enviarán a ${channel}`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún canal. No se realizaron cambios.',
            }).catch(() => {});
        }
    });
}

async function handleTranscriptChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_transcript_channel')
        .setPlaceholder('Selecciona un canal...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📜 Seleccionar canal de transcripciones')
                .setDescription('Elige dónde se enviarán las transcripciones automáticas al eliminar tickets.')
                .setColor(getColor('info'))
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral
    });

    const collector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_transcript_channel',
        time: 60_000,
        max: 1
    });

    collector.on('collect', async channelInteraction => {
        await channelInteraction.deferUpdate();
        const channel = channelInteraction.channels.first();

        guildConfig.ticketTranscriptChannelId = channel.id;
        await setGuildConfig(client, guildId, guildConfig);

        await channelInteraction.followUp({
            embeds: [successEmbed('Canal de transcripciones actualizado', `Las transcripciones se enviarán a ${channel}`)],
            flags: MessageFlags.Ephemeral
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún canal. No se realizaron cambios.',
            }).catch(() => {});
        }
    });
}

async function handleCheckUser(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('ticket_cfg_check_user')
        .setPlaceholder('Selecciona un usuario para consultar...')
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Consultar tickets de usuario')
                .setDescription('Selecciona un usuario para ver cuántos tickets tiene abiertos.')
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const userCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.UserSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_check_user',
        time: 60_000,
        max: 1,
    });

    userCollector.on('collect', async userInteraction => {
        await userInteraction.deferUpdate();
        const targetUser = userInteraction.users.first();
        const maxTickets = guildConfig.maxTicketsPerUser || 3;
        const openCount = await getUserTicketCount(guildId, targetUser.id);
        const atLimit = openCount >= maxTickets;

        await userInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`Consulta de tickets — ${targetUser.username}`)
                    .setDescription(
                        `**Tickets abiertos:** ${openCount} / ${maxTickets}\n` +
                            `**Disponibles:** ${Math.max(0, maxTickets - openCount)}\n\n` +
                            (atLimit
                                ? '⚠️ Este usuario alcanzó el límite de tickets.'
                                : '✅ Este usuario todavía puede abrir más tickets.'),
                    )
                    .setColor(atLimit ? getColor('error') : getColor('success'))
                    .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
                    .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
        });
    });

    userCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún usuario.',
            }).catch(() => {});
        }
    });
}

async function handleRepostPanel(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    await btnInteraction.deferUpdate();

    const panelStatus = await getTicketPanelStatus(client, rootInteraction.guild, guildConfig);
    if (panelStatus.exists) {
        await btnInteraction.followUp({
            embeds: [infoEmbed('Panel ya publicado', 'El panel de tickets ya está publicado en el canal configurado.')],
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
        return;
    }

    const sentPanel = await repostTicketPanel(client, rootInteraction.guild, guildConfig, guildId);

    await btnInteraction.followUp({
        embeds: [
            successEmbed(
                'Panel publicado de nuevo',
                `Se publicó un nuevo panel de tickets en <#${guildConfig.ticketPanelChannelId}>.${
                    sentPanel.url ? `\n[Abrir mensaje del panel](${sentPanel.url})` : ''
                }`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    }).catch(() => {});

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleDeleteSystem(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    const deleteModal = new ModalBuilder()
        .setCustomId('ticket_delete_confirm_modal')
        .setTitle('Eliminar sistema de tickets')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('delete_confirmation')
                    .setLabel('Escribe "DELETE" para confirmar')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('DELETE')
                    .setMaxLength(6)
                    .setMinLength(6)
                    .setRequired(true)
            )
        );

    await btnInteraction.showModal(deleteModal);

    const submitted = await btnInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'ticket_delete_confirm_modal' && i.user.id === btnInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) {
        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
        return;
    }

    const confirmation = submitted.fields.getTextInputValue('delete_confirmation').trim();

    if (confirmation !== 'DELETE') {
        await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message: 'Debes escribir exactamente "DELETE" para confirmar la eliminación.' });
        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
        return;
    }

    await submitted.deferUpdate();

    const keysToDelete = [
        'ticketPanelChannelId',
        'ticketPanelMessageId',
        'ticketStaffRoleId',
        'ticketCategoryId',
        'ticketClosedCategoryId',
        'ticketPanelMessage',
        'ticketButtonLabel',
        'maxTicketsPerUser',
        'dmOnClose',
    ];

    if (guildConfig.ticketPanelChannelId) {
        try {
            const panelChannel = await client.guilds.cache.get(guildId)?.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
            if (panelChannel) {
                if (guildConfig.ticketPanelMessageId) {
                    const panelMessage = await panelChannel.messages.fetch(guildConfig.ticketPanelMessageId).catch(() => null);
                    if (panelMessage) await panelMessage.delete().catch(() => {});
                } else {
                    
                    const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
                    if (messages) {
                        const found = messages.find(
                            m => m.author.id === client.user.id && messageHasButtonCustomId(m, 'create_ticket'),
                        );
                        if (found) await found.delete().catch(() => {});
                    }
                }
            }
        } catch (panelDeleteError) {
            logger.warn('Could not delete ticket panel message:', panelDeleteError.message);
        }
    }

    try {
        const { pgConfig } = await import('../../../config/database/postgres.js');
        if (client.db?.db?.pool && typeof client.db.db.isAvailable === 'function' && client.db.db.isAvailable()) {
            await client.db.db.pool.query(
                `DELETE FROM ${pgConfig.tables.tickets} WHERE guild_id = $1`,
                [guildId]
            );
        }
    } catch (ticketDeleteError) {
        logger.warn('Could not clear ticket records from database:', ticketDeleteError.message);
    }

    for (const key of keysToDelete) {
        delete guildConfig[key];
    }
    await setGuildConfig(client, guildId, guildConfig);

    await submitted.followUp({
        embeds: [
            successEmbed(
                '✅ Sistema de tickets eliminado',
                'Se borró toda la configuración del sistema de tickets. Ejecuta `/ticket setup` para volver a configurarlo.',
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('Sistema de tickets eliminado')
                .setDescription('Se ha borrado la configuración del sistema de tickets.')
                .setColor(getColor('error'))
                .setTimestamp(),
        ],
        components: [],
    }).catch(() => {});
}
