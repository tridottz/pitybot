import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    LabelBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getLevelingConfig, saveLevelingConfig } from '../../../services/leveling/leveling.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';
import { startDashboardSession } from '../../../utils/dashboardSession.js';

function buildDashboardEmbed(cfg, guild) {
    const channel = cfg.levelUpChannel ? `<#${cfg.levelUpChannel}>` : '`Sin configurar`';
    const xpMin = cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15;
    const xpMax = cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25;
    const cooldown = cfg.xpCooldown ?? 60;
    const rawMsg = cfg.levelUpMessage || '¡{user} ha subido al nivel {level}!';
    const msgPreview = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;

    const rewards = cfg.roleRewards ?? {};
    const rewardEntries = Object.entries(rewards).sort(([a], [b]) => Number(a) - Number(b));
    const rewardsValue = rewardEntries.length > 0
        ? rewardEntries.map(([lvl, roleId]) => `Nivel **${lvl}** → <@&${roleId}>`).join('\n')
        : '`None configured`';

    const ignoredChannels = cfg.ignoredChannels ?? [];
    const ignoredRoles = cfg.ignoredRoles ?? [];
    const ignoredChValue = ignoredChannels.length > 0 ? ignoredChannels.map(id => `<#${id}>`).join(',') : '`None`';
    const ignoredRoValue = ignoredRoles.length > 0 ? ignoredRoles.map(id => `<@&${id}>`).join(',') : '`None`';

    return new EmbedBuilder()
        .setTitle('⚡ Panel del sistema de niveles')
        .setDescription(`Administra los ajustes de niveles de **${guild.name}**.\nSelecciona una opción para modificar un ajuste.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'Canal de subida de nivel', value: channel, inline: true },
            { name: 'System Status', value: cfg.enabled ? '**Enabled**' : '**Disabled**', inline: true },
            { name: 'Anuncios', value: cfg.announceLevelUp !== false ? '**Enabled**' : '**Disabled**', inline: true },
            { name: 'XP per Message', value: `\`${xpMin} – ${xpMax}\``, inline: true },
            { name: 'XP Cooldown', value: `\`${cooldown}s\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Mensaje de subida de nivel', value: msgPreview, inline: false },
            { name: 'Recompensas por nivel', value: rewardsValue, inline: false },
            { name: 'Canales ignorados', value: ignoredChValue, inline: true },
            { name: 'Roles ignorados', value: ignoredRoValue, inline: true },
        )
        .setFooter({ text: 'Dashboard closes after 10 minutes of inactivity' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`level_cfg_${guildId}`)
        .setPlaceholder('Selecciona una opción para configurar...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar canal de subida de nivel')
                .setDescription('Establece el canal donde se enviarán los avisos de subida de nivel')
                .setValue('channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Editar mensaje de subida de nivel')
                .setDescription('Personaliza el mensaje que aparece cuando un usuario sube de nivel')
                .setValue('message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Configurar rango de XP')
                .setDescription('Establece la XP mínima y máxima otorgada por mensaje')
                .setValue('xp_range')
                .setEmoji('🎲'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Configurar espera de XP')
                .setDescription('Segundos entre asignaciones de XP para el mismo usuario')
                .setValue('xp_cooldown')
                .setEmoji('⏱️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Añadir recompensa de rol')
                .setDescription('Otorga un rol cuando un usuario alcanza un nivel específico')
                .setValue('role_reward_add')
                .setEmoji('🏆'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Quitar recompensa de rol')
                .setDescription('Quita una recompensa de rol de un nivel específico')
                .setValue('role_reward_remove')
                .setEmoji('\ud83d\uddd1\ufe0f'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Canales ignorados')
                .setDescription('Activa o desactiva los canales donde no se otorgará XP')
                .setValue('ignore_channels')
                .setEmoji('\ud83d\udeab'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Roles ignorados')
                .setDescription('Activa o desactiva los roles cuyos miembros no recibirán XP')
                .setValue('ignore_roles')
                .setEmoji('\ud83d\udeab'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    const announceOn = cfg.announceLevelUp !== false;
    const systemOn = cfg.enabled !== false;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_announce_${guildId}`)
            .setLabel('Avisos')
            .setStyle(announceOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('📣')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_system_${guildId}`)
            .setLabel('Niveles')
            .setStyle(systemOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('⚡')
            .setDisabled(disabled),
    );
}

async function refreshDashboard(rootInteraction, cfg, guildId) {
    const selectMenu = buildSelectMenu(guildId);
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(cfg, rootInteraction.guild)],
        components: [
            buildButtonRow(cfg, guildId),
            new ActionRowBuilder().addComponents(selectMenu),
        ],
    }).catch(() => {});
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const cfg = await getLevelingConfig(client, guildId);

            if (!cfg.configured) {
                throw new TitanBotError(
                    'Leveling system not configured',
                    ErrorTypes.CONFIGURATION,
                    'El sistema de niveles aún no está configurado. Ejecuta `/level setup` primero.',
                );
            }

            await startDashboardSession({
                interaction,
                embeds: [buildDashboardEmbed(cfg, interaction.guild)],
                components: [
                    buildButtonRow(cfg, guildId),
                    new ActionRowBuilder().addComponents(buildSelectMenu(guildId)),
                ],
                selectMenuId: `level_cfg_${guildId}`,
                buttonMatcher: (customId) =>
                    customId === `level_cfg_toggle_announce_${guildId}` ||
                    customId === `level_cfg_toggle_system_${guildId}`,
                onSelect: async (selectInteraction) => {
                    const selectedOption = selectInteraction.values[0];
                    switch (selectedOption) {
                        case 'channel':
                            await handleChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'message':
                            await handleMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'xp_range':
                            await handleXpRange(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'xp_cooldown':
                            await handleXpCooldown(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'role_reward_add':
                            await handleRoleRewardAdd(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'role_reward_remove':
                            await handleRoleRewardRemove(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'ignore_channels':
                            await handleIgnoreChannels(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'ignore_roles':
                            await handleIgnoreRoles(selectInteraction, interaction, cfg, guildId, client);
                            break;
                    }
                },
                onButton: async (btnInteraction) => {
                    await btnInteraction.deferUpdate().catch(() => null);
                    const isAnnounce = btnInteraction.customId === `level_cfg_toggle_announce_${guildId}`;

                    if (isAnnounce) {
                        cfg.announceLevelUp = cfg.announceLevelUp === false;
                        await saveLevelingConfig(client, guildId, cfg);
                        await btnInteraction.followUp({
                            embeds: [
                                successEmbed(
                                    '✅ Avisos actualizados',
                                    `Los avisos de subida de nivel están **${cfg.announceLevelUp ? 'activados' : 'desactivados'}**.`,
                                ),
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        const wasEnabled = cfg.enabled !== false;
                        cfg.enabled = !wasEnabled;
                        await saveLevelingConfig(client, guildId, cfg);
                        await btnInteraction.followUp({
                            embeds: [
                                successEmbed(
                                    '✅ Sistema actualizado',
                                    `El sistema de niveles está **${cfg.enabled ? 'activado' : 'desactivado'}**.${!cfg.enabled ? '\nLos usuarios no recibirán XP hasta que se vuelva a activar.' : ''}`,
                                ),
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    await refreshDashboard(interaction, cfg, guildId);
                },
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in level_dashboard:', error);
            throw new TitanBotError(
                `Falló el panel de niveles: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'No se pudo abrir el panel de niveles.',
            );
        }
    },
};

async function handleRoleRewardAdd(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_role_reward_add_${guildId}`)
        .setTitle('🏆 Añadir recompensa por nivel');

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('reward_role')
        .setPlaceholder('Selecciona el rol que se otorgará...')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

    const roleLabel = new LabelBuilder()
        .setLabel('Rol que se otorgará')
        .setDescription('Este rol se otorgará cuando el usuario alcance el nivel indicado')
        .setRoleSelectMenuComponent(roleSelect);

    const levelInput = new TextInputBuilder()
        .setCustomId('reward_level')
        .setLabel('Nivel necesario (1–500)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('10')
        .setMaxLength(3)
        .setMinLength(1)
        .setRequired(true);

    modal.addLabelComponents(roleLabel);
    modal.addComponents(new ActionRowBuilder().addComponents(levelInput));

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_role_reward_add_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const rawLevel = submitted.fields.getTextInputValue('reward_level').trim();
    const level = parseInt(rawLevel, 10);

    if (isNaN(level) || level < 1 || level > 500) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El nivel debe ser un número entero entre **1** y **500**.' });
        return;
    }

    const roleId = submitted.fields.getField('reward_role').values[0];

    cfg.roleRewards = cfg.roleRewards ?? {};
    cfg.roleRewards[level] = roleId;
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Recompensa por nivel añadida', `<@&${roleId}> se otorgará al alcanzar el nivel **${level}**.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleRoleRewardRemove(selectInteraction, rootInteraction, cfg, guildId, client) {
    const rewards = cfg.roleRewards ?? {};
    const entries = Object.entries(rewards).sort(([a], [b]) => Number(a) - Number(b));

    if (entries.length === 0) {
        await selectInteraction.deferUpdate();
        await replyUserError(selectInteraction, {
            type: ErrorTypes.USER_INPUT,
            message: 'No hay recompensas por nivel configuradas para quitar.',
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_role_reward_remove_${guildId}`)
        .setTitle('🗑️ Quitar recompensa por nivel');

    const infoInput = new TextInputBuilder()
        .setCustomId('current_rewards')
        .setLabel('Recompensas actuales (solo lectura)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(entries.map(([lvl, roleId]) => `Nivel ${lvl}: <@&${roleId}>`).join('\n'))
        .setRequired(false);

    const levelInput = new TextInputBuilder()
        .setCustomId('remove_level')
        .setLabel('Nivel del que se quitará la recompensa')
        .setStyle(TextInputStyle.Short)
        .setValue(entries[0][0])
        .setMaxLength(3)
        .setMinLength(1)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(infoInput),
        new ActionRowBuilder().addComponents(levelInput),
    );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_role_reward_remove_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const rawLevel = submitted.fields.getTextInputValue('remove_level').trim();
    const level = parseInt(rawLevel, 10);

    if (isNaN(level) || !cfg.roleRewards?.[level]) {
        await replyUserError(submitted, { type: ErrorTypes.USER_INPUT, message: `No hay una recompensa configurada para el nivel **${rawLevel}**.` });
        return;
    }

    delete cfg.roleRewards[level];
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('Recompensa por nivel quitada', `Se quitó la recompensa del nivel **${level}**.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_channel_modal_${guildId}`)
        .setTitle('\ud83d\udce2 Cambiar canal de avisos de nivel');

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('levelup_channel')
        .setPlaceholder('Selecciona un canal de texto...')
        .setMinValues(1)
        .setMaxValues(1)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);

    const channelLabel = new LabelBuilder()
        .setLabel('Canal de subida de nivel')
        .setDescription('Canal donde se enviarán los avisos de subida de nivel')
        .setChannelSelectMenuComponent(channelSelect);

    modal.addLabelComponents(channelLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_channel_modal_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const channelId = submitted.fields.getField('levelup_channel').values[0];
    const channel = selectInteraction.guild.channels.cache.get(channelId);

    if (channel && !botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
        await replyUserError(submitted, { type: ErrorTypes.PERMISSION, message: `Necesito los permisos **Enviar mensajes** e **Insertar enlaces** en ${channel} para enviar avisos de nivel.` });
        return;
    }

    cfg.levelUpChannel = channelId;
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [successEmbed('\u2705 Canal actualizado', `Los avisos de subida de nivel se enviarán en ${channel ??`<#${channelId}>`}.`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleIgnoreChannels(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_ignore_channels_${guildId}`)
        .setTitle('\ud83d\udeab Canales excluidos');

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ignore_channel')
        .setPlaceholder('Selecciona los canales que quieras alternar...')
        .setMinValues(1)
        .setMaxValues(10)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);

    const channelLabel = new LabelBuilder()
        .setLabel('Activar/desactivar canales ignorados')
        .setDescription('Los canales seleccionados se activarán o desactivarán; no se otorgará XP en ellos')
        .setChannelSelectMenuComponent(channelSelect);

    modal.addLabelComponents(channelLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_ignore_channels_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const selectedIds = submitted.fields.getField('ignore_channel').values;
    const ignoreSet = new Set(cfg.ignoredChannels ?? []);

    for (const id of selectedIds) {
        if (ignoreSet.has(id)) {
            ignoreSet.delete(id);
        } else {
            ignoreSet.add(id);
        }
    }

    cfg.ignoredChannels = Array.from(ignoreSet);
    await saveLevelingConfig(client, guildId, cfg);

    const list = cfg.ignoredChannels.length > 0
        ? cfg.ignoredChannels.map(id => `<#${id}>`).join(',')
        : '`Ninguno`';

    await submitted.reply({
        embeds: [successEmbed('✅ Canales excluidos actualizados', `No se otorgará XP en: ${list}`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleIgnoreRoles(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId(`level_cfg_ignore_roles_${guildId}`)
        .setTitle('🚫 Roles excluidos');

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('ignore_role')
        .setPlaceholder('Selecciona los roles que quieras alternar...')
        .setMinValues(1)
        .setMaxValues(10)
        .setRequired(true);

    const roleLabel = new LabelBuilder()
        .setLabel('Activar/desactivar roles ignorados')
        .setDescription('Los roles seleccionados se activarán o desactivarán; sus miembros no ganarán XP')
        .setRoleSelectMenuComponent(roleSelect);

    modal.addLabelComponents(roleLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `level_cfg_ignore_roles_${guildId}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const selectedIds = submitted.fields.getField('ignore_role').values;
    const ignoreSet = new Set(cfg.ignoredRoles ?? []);

    for (const id of selectedIds) {
        if (ignoreSet.has(id)) {
            ignoreSet.delete(id);
        } else {
            ignoreSet.add(id);
        }
    }

    cfg.ignoredRoles = Array.from(ignoreSet);
    await saveLevelingConfig(client, guildId, cfg);

    const list = cfg.ignoredRoles.length > 0
        ? cfg.ignoredRoles.map(id => `<@&${id}>`).join(',')
        : '`Ninguno`';

    await submitted.reply({
        embeds: [successEmbed('✅ Roles excluidos actualizados', `Estos roles no recibirán XP: ${list}`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('level_cfg_message')
        .setTitle('💬 Editar mensaje de subida de nivel')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Mensaje ({user} y {level} están disponibles)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.levelUpMessage || '¡{user} ha subido al nivel {level}!')
                    .setMaxLength(500)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('¡{user} ha subido al nivel {level}!'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'level_cfg_message' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newMessage = submitted.fields.getTextInputValue('message_input').trim();

    if (!newMessage.includes('{user}') && !newMessage.includes('{level}')) {
        logger.warn(
            `Level-up message set without {user} or {level} placeholders in guild ${guildId}`,
        );
    }

    cfg.levelUpMessage = newMessage;
    await saveLevelingConfig(client, guildId, cfg);

    const preview = newMessage.replace('{user}', '@User').replace('{level}', '5');

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Message Updated',
                `Level-up message saved.\n**Preview:** ${preview}`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleXpRange(selectInteraction, rootInteraction, cfg, guildId, client) {
    const currentMin = cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15;
    const currentMax = cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25;

    const modal = new ModalBuilder()
        .setCustomId('level_cfg_xp_range')
        .setTitle('Configurar rango de XP por mensaje')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('xp_min_input')
                    .setLabel('XP mínima (1–500)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(currentMin))
                    .setMaxLength(3)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('15'),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('xp_max_input')
                    .setLabel('XP máxima (1–500)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(currentMax))
                    .setMaxLength(3)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('25'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'level_cfg_xp_range' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const rawMin = submitted.fields.getTextInputValue('xp_min_input').trim();
    const rawMax = submitted.fields.getTextInputValue('xp_max_input').trim();
    const newMin = parseInt(rawMin, 10);
    const newMax = parseInt(rawMax, 10);

    if (isNaN(newMin) || isNaN(newMax) || newMin < 1 || newMax < 1 || newMin > 500 || newMax > 500) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Ambos valores de XP deben ser números enteros entre **1** y **500**.' });
        return;
    }

    if (newMin > newMax) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'La XP mínima no puede ser mayor que la XP máxima.' });
        return;
    }

    cfg.xpRange = { min: newMin, max: newMax };
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ XP Range Updated',
                `Los usuarios recibirán entre **${newMin}** y **${newMax}** XP por mensaje.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleXpCooldown(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('level_cfg_cooldown')
        .setTitle('⏱️ Configurar tiempo de espera de XP')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('cooldown_input')
                    .setLabel('Tiempo de espera en segundos (0–3600)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(cfg.xpCooldown ?? 60))
                    .setMaxLength(4)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('60'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'level_cfg_cooldown' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const raw = submitted.fields.getTextInputValue('cooldown_input').trim();
    const newCooldown = parseInt(raw, 10);

    if (isNaN(newCooldown) || newCooldown < 0 || newCooldown > 3600) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El tiempo de espera debe ser un número entero entre **0** y **3600** segundos.' });
        return;
    }

    cfg.xpCooldown = newCooldown;
    await saveLevelingConfig(client, guildId, cfg);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Cooldown Updated',
                `XP cooldown set to **${newCooldown} second${newCooldown !== 1 ? 's' : ''}**.${newCooldown === 0 ? '\n> ⚠️ A cooldown of 0 means XP is granted on every message.' : ''}`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, guildId);
}
