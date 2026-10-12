import { botConfig, getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
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
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { getWelcomeConfig } from '../../../utils/database.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';
import {
    getVerificationPanelStatus,
    formatPanelStatusField,
} from '../../../utils/panelStatus.js';
import { startDashboardSession } from '../../../utils/dashboardSession.js';

async function updateLivePanel(guild, cfg) {
    if (!cfg.channelId || !cfg.messageId) return;
    try {
        const channel = guild.channels.cache.get(cfg.channelId);
        if (!channel) return;
        const msg = await channel.messages.fetch(cfg.messageId).catch(() => null);
        if (!msg) return;

        const verifyEmbed = new EmbedBuilder()
            .setTitle('Verificación del servidor')
            .setDescription(cfg.message || botConfig.verification.defaultMessage)
            .setColor(getColor('success'));

        const verifyButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_user')
                .setLabel(cfg.buttonText || botConfig.verification.defaultButtonText)
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
        );

        await msg.edit({ embeds: [verifyEmbed], components: [verifyButton] });
    } catch (error) {
        logger.warn('Could not update live verification panel:', error.message);
    }
}

function buildDashboardEmbed(cfg, guild, verifiedUserCount = 0, conflictSummary = '', panelStatus = null) {
    const channel = cfg.channelId ? `<#${cfg.channelId}>` : '`Sin configurar`';
    const role = cfg.roleId ? `<@&${cfg.roleId}>` : '`Sin configurar`';
    const rawMsg = cfg.message || botConfig.verification.defaultMessage;
    const msgPreview = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
    const buttonText = cfg.buttonText || botConfig.verification.defaultButtonText;
    const panelStatusValue = cfg.channelId ? formatPanelStatusField(panelStatus) : '`Sin configurar`';

    const embed = new EmbedBuilder()
        .setTitle('✅ Panel del sistema de verificación')
        .setDescription(`Administra la verificación de **${guild.name}**.\nSelecciona una opción para cambiar la configuración.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'Estado del panel', value: panelStatusValue, inline: false },
            { name: 'Canal de verificación', value: channel, inline: true },
            { name: 'Rol de verificado', value: role, inline: true },
            { name: 'Estado del sistema', value: cfg.enabled !== false ? 'Activado' : 'Desactivado', inline: true },
            { name: 'Texto del botón', value: `\`${buttonText}\``, inline: true },
            { name: 'Usuarios verificados', value: `${verifiedUserCount} usuarios`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Mensaje de verificación', value: msgPreview, inline: false },
        );

    if (conflictSummary) {
        embed.addFields({ name: 'Conflictos de configuración', value: conflictSummary, inline: false });
    }

    return embed
        .setFooter({ text: 'El panel se cierra tras 10 minutos de inactividad' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`verif_cfg_${guildId}`)
        .setPlaceholder('Selecciona una opción para configurar...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar canal de verificación')
                .setDescription('Establece el canal donde se publicará el panel de verificación')
                .setValue('channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar rol de verificado')
                .setDescription('Establece el rol que se asignará cuando un usuario se verifique')
                .setValue('role')
                .setEmoji('🏷️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Editar mensaje de verificación')
                .setDescription('Personaliza el mensaje que aparece en el embed del panel de verificación')
                .setValue('message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Editar texto del botón')
                .setDescription('Cambia el texto del botón de verificación')
                .setValue('button_text')
                .setEmoji('🔘'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false, panelStatus = null) {
    const systemOn = cfg.enabled !== false;
    const showRepost =
        systemOn && panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';

    const buttons = [];

    if (showRepost) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`verif_cfg_repost_${guildId}`)
                .setLabel('Volver a publicar panel')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌')
                .setDisabled(disabled),
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`verif_cfg_toggle_${guildId}`)
            .setLabel('Verificación')
            .setStyle(systemOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('🔒')
            .setDisabled(disabled),
    );

    return new ActionRowBuilder().addComponents(buttons);
}

async function repostVerificationPanel(guild, cfg) {
    const channel = await guild.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel) {
        throw new TitanBotError(
            'Panel channel missing',
            ErrorTypes.CONFIGURATION,
            'The configured verification channel no longer exists. Set a new channel from the dashboard.',
        );
    }

    const verifyEmbed = new EmbedBuilder()
        .setTitle('Verificación del servidor')
        .setDescription(cfg.message || botConfig.verification.defaultMessage)
        .setColor(getColor('success'));

    const verifyButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('verify_user')
            .setLabel(cfg.buttonText || botConfig.verification.defaultButtonText)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
    );

    return channel.send({ embeds: [verifyEmbed], components: [verifyButton] });
}

async function refreshDashboard(rootInteraction, cfg, guildId, client) {
    try {
        const selectMenu = buildSelectMenu(guildId);

        let verifiedUserCount = 0;
        let conflictSummary = '';
        let panelStatus = null;

        if (cfg.channelId && cfg.enabled !== false) {
            panelStatus = await getVerificationPanelStatus(client, rootInteraction.guild, cfg);
            if (panelStatus.recoveredId) {
                cfg.messageId = panelStatus.recoveredId;
                const latestConfig = await getGuildConfig(client, guildId);
                latestConfig.verification = cfg;
                await setGuildConfig(client, guildId, latestConfig);
            }
        }
        
        try {
            const verifiedRole = rootInteraction.guild.roles.cache.get(cfg.roleId);
            if (verifiedRole) {
                verifiedUserCount = verifiedRole.members.size;
            }
            
            const guildConfig = await getGuildConfig(client, guildId);
            const welcomeConfig = await getWelcomeConfig(client, guildId);
            const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);
            const autoRoleConfigured = Boolean(guildConfig.autoRole) || (Array.isArray(welcomeConfig.roleIds) && welcomeConfig.roleIds.length > 0);
            
            const conflicts = [
                autoVerifyEnabled ? 'AutoVerify is enabled' : null,
                autoRoleConfigured ? 'AutoRole is configured' : null
            ].filter(Boolean);
            
            if (conflicts.length > 0) {
                conflictSummary = conflicts.join('\n');
            }
        } catch (error) {
            logger.warn('Could not fetch verification dashboard details:', error.message);
        }
        
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [buildDashboardEmbed(cfg, rootInteraction.guild, verifiedUserCount, conflictSummary, panelStatus)],
            components: [
                buildButtonRow(cfg, guildId, false, panelStatus),
                new ActionRowBuilder().addComponents(selectMenu),
            ],
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logger.debug('Could not refresh verification dashboard (interaction may have expired):', error.message);
    }
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const guildConfig = await getGuildConfig(client, guildId);
            const cfg = guildConfig.verification;

            if (!cfg?.channelId) {
                throw new TitanBotError(
                    'Verification not configured',
                    ErrorTypes.CONFIGURATION,
                    'El sistema de verificación aún no está configurado. Ejecuta `/verification setup` primero.',
                );
            }

            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            let verifiedUserCount = 0;
            let conflictSummary = '';
            let panelStatus = null;

            if (cfg.channelId && cfg.enabled !== false) {
                panelStatus = await getVerificationPanelStatus(client, interaction.guild, cfg);
                if (panelStatus.recoveredId) {
                    cfg.messageId = panelStatus.recoveredId;
                    guildConfig.verification = cfg;
                    await setGuildConfig(client, guildId, guildConfig);
                }
            }
            
            try {
                const verifiedRole = interaction.guild.roles.cache.get(cfg.roleId);
                if (verifiedRole) {
                    verifiedUserCount = verifiedRole.members.size;
                }
                
                const welcomeConfig = await getWelcomeConfig(client, guildId);
                const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);
                const autoRoleConfigured = Boolean(guildConfig.autoRole) || (Array.isArray(welcomeConfig.roleIds) && welcomeConfig.roleIds.length > 0);
                
                const conflicts = [
                    autoVerifyEnabled ? 'AutoVerify is enabled' : null,
                    autoRoleConfigured ? 'AutoRole is configured' : null
                ].filter(Boolean);
                
                if (conflicts.length > 0) {
                    conflictSummary = conflicts.join('\n');
                }
            } catch (error) {
                logger.warn('Could not fetch verification dashboard details:', error.message);
            }

            await startDashboardSession({
                interaction,
                embeds: [buildDashboardEmbed(cfg, interaction.guild, verifiedUserCount, conflictSummary, panelStatus)],
                components: [
                    buildButtonRow(cfg, guildId, false, panelStatus),
                    new ActionRowBuilder().addComponents(buildSelectMenu(guildId)),
                ],
                flags: MessageFlags.Ephemeral,
                selectMenuId: `verif_cfg_${guildId}`,
                buttonMatcher: (customId) =>
                    customId === `verif_cfg_toggle_${guildId}` || customId === `verif_cfg_repost_${guildId}`,
                onSelect: async (selectInteraction) => {
                    const selectedOption = selectInteraction.values[0];
                    switch (selectedOption) {
                        case 'channel':
                            await handleChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'role':
                            await handleRole(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'message':
                            await handleMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'button_text':
                            await handleButtonText(selectInteraction, interaction, cfg, guildId, client);
                            break;
                    }
                },
                onButton: async (btnInteraction) => {
                    if (btnInteraction.customId === `verif_cfg_repost_${guildId}`) {
                        await btnInteraction.deferUpdate();
                        const newMsg = await repostVerificationPanel(interaction.guild, cfg);
                        cfg.messageId = newMsg.id;
                        const latestConfig = await getGuildConfig(client, guildId);
                        latestConfig.verification = cfg;
                        await setGuildConfig(client, guildId, latestConfig);
                        await btnInteraction.followUp({
                            embeds: [successEmbed('Panel publicado de nuevo', `Se restauró el panel de verificación en ${newMsg.channel}.`)],
                            flags: MessageFlags.Ephemeral,
                        });
                        await refreshDashboard(interaction, cfg, guildId, client);
                        return;
                    }

                    await btnInteraction.deferUpdate().catch(() => null);

                    const wasEnabled = cfg.enabled !== false;
                    const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);

                    if (!wasEnabled && autoVerifyEnabled) {
                        await replyUserError(btnInteraction, {
                            type: ErrorTypes.CONFIGURATION,
                            message: 'La verificación automática está activada. Desactívala antes de activar el sistema de verificación manual.\n\nEjecuta `/autoverify` para abrir su panel de configuración.',
                        });
                        return;
                    }

                    cfg.enabled = !wasEnabled;

                    if (!cfg.enabled && cfg.channelId && cfg.messageId) {
                        const channel = interaction.guild.channels.cache.get(cfg.channelId);
                        if (channel) {
                            const msg = await channel.messages.fetch(cfg.messageId).catch(() => null);
                            if (msg) await msg.delete().catch(() => {});
                        }
                    }

                    if (cfg.enabled && cfg.channelId) {
                        try {
                            const newMsg = await repostVerificationPanel(interaction.guild, cfg);
                            cfg.messageId = newMsg.id;
                        } catch (error) {
                            logger.warn('Could not re-post verification panel on re-enable:', error.message);
                        }
                    }

                    const latestConfig = await getGuildConfig(client, guildId);
                    latestConfig.verification = cfg;
                    await setGuildConfig(client, guildId, latestConfig);

                    await btnInteraction.followUp({
                        embeds: [
                            successEmbed(
                                '✅ System Updated',
                                `The verification system is now **${cfg.enabled ? 'enabled' : 'disabled'}**.`,
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });

                    await refreshDashboard(interaction, cfg, guildId, client);
                },
                onTimeout: async (rootInteraction) => {
                    await InteractionHelper.safeEditReply(rootInteraction, {
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('El panel ha caducado')
                                .setDescription('Este panel se cerró por inactividad. Ejecuta el comando de nuevo para continuar.')
                                .setColor(getColor('error')),
                        ],
                        components: [],
                        flags: MessageFlags.Ephemeral,
                    });
                },
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in verification_dashboard:', error);
            throw new TitanBotError(
                `Verification dashboard failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'No se pudo abrir el panel de verificación.',
            );
        }
    },
};

async function handleChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('verif_cfg_channel')
        .setPlaceholder('Selecciona un canal de texto...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Cambiar canal de verificación')
                .setDescription(
                    `**Actual:** ${cfg.channelId ?`<#${cfg.channelId}>`: '`Sin configurar`'}\n\nSelecciona el canal donde se publicará el panel de verificación.\n\n> ⚠️ El panel actual se eliminará y se volverá a publicar en el canal nuevo.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'verif_cfg_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        await chanInteraction.deferUpdate();
        const newChannel = chanInteraction.channels.first();

        if (!botHasPermission(newChannel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            await replyUserError(chanInteraction, {
                type: ErrorTypes.PERMISSION,
                message: `Necesito los permisos **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ${newChannel}.`,
            });
            return;
        }

        if (cfg.channelId && cfg.messageId) {
            const oldChannel = rootInteraction.guild.channels.cache.get(cfg.channelId);
            if (oldChannel) {
                try {
                    const oldMsg = await oldChannel.messages.fetch(cfg.messageId).catch(() => null);
                    if (oldMsg) await oldMsg.delete();
                } catch {
                    
                }
            }
        }

        if (cfg.enabled !== false) {
            try {
                const verifyEmbed = new EmbedBuilder()
                    .setTitle('Verificación del servidor')
                    .setDescription(cfg.message || botConfig.verification.defaultMessage)
                    .setColor(getColor('success'));

                const verifyButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('verify_user')
                        .setLabel(cfg.buttonText || botConfig.verification.defaultButtonText)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                );

                const newMsg = await newChannel.send({ embeds: [verifyEmbed], components: [verifyButton] });
                cfg.messageId = newMsg.id;
            } catch (error) {
                logger.warn('Could not post verification panel in new channel:', error.message);
            }
        }

        cfg.channelId = newChannel.id;
        const latestConfig = await getGuildConfig(client, guildId);
        latestConfig.verification = cfg;
        await setGuildConfig(client, guildId, latestConfig);

        await chanInteraction.followUp({
            embeds: [successEmbed('Canal actualizado', `El panel de verificación se movió a ${newChannel}.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, cfg, guildId, client);
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

async function handleRole(selectInteraction, rootInteraction, cfg, guildId, client) {
    await selectInteraction.deferUpdate();

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('verif_cfg_role')
        .setPlaceholder('Selecciona un rol...')
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Cambiar rol de verificado')
                .setDescription(
                    `**Actual:** ${cfg.roleId ?`<@&${cfg.roleId}>`: '`Sin configurar`'}\n\nSelecciona el rol que se asignará cuando un usuario se verifique.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(roleSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'verif_cfg_role',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        await roleInteraction.deferUpdate();
        const role = roleInteraction.roles.first();
        const guild = rootInteraction.guild;
        const botMember = guild.members.me;

        if (role.id === guild.id || role.managed) {
            await replyUserError(roleInteraction, {
                type: ErrorTypes.VALIDATION,
                message: 'Elige un rol asignable (no puede ser @everyone ni un rol administrado por un bot).',
            });
            return;
        }

        if (role.position >= botMember.roles.highest.position) {
            await replyUserError(roleInteraction, {
                type: ErrorTypes.PERMISSION,
                message: 'El rol de verificado debe estar por debajo de mi rol más alto en la jerarquía del servidor.',
            });
            return;
        }

        cfg.roleId = role.id;
        const latestConfig = await getGuildConfig(client, guildId);
        latestConfig.verification = cfg;
        await setGuildConfig(client, guildId, latestConfig);

        await roleInteraction.followUp({
            embeds: [successEmbed('Rol actualizado', `El rol de verificado ahora es ${role}.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, cfg, guildId, client);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'No se seleccionó ningún rol. No se cambió la configuración.',
            }).catch(() => {});
        }
    });
}

async function handleMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('verif_cfg_message')
            .setTitle('Editar mensaje de verificación')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('message_input')
                        .setLabel('Mensaje que aparecerá en el panel de verificación')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(cfg.message || botConfig.verification.defaultMessage)
                        .setMaxLength(2000)
                        .setMinLength(1)
                        .setRequired(true),
                ),
            );

        await selectInteraction.showModal(modal);

        const submitted = await selectInteraction
            .awaitModalSubmit({
                filter: i =>
                    i.customId === 'verif_cfg_message' && i.user.id === selectInteraction.user.id,
                time: 120_000,
            })
            .catch(() => null);

        if (!submitted) return;

        cfg.message = submitted.fields.getTextInputValue('message_input').trim();

        const latestConfig = await getGuildConfig(client, guildId);
        latestConfig.verification = cfg;
        await setGuildConfig(client, guildId, latestConfig);

        await updateLivePanel(rootInteraction.guild, cfg);

        await submitted.reply({
            embeds: [successEmbed('Mensaje actualizado', 'Se actualizó el panel de verificación con el nuevo mensaje.')],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, cfg, guildId, client);
    } catch (error) {
        logger.error('Error in handleMessage:', error);
        
    }
}

async function handleButtonText(selectInteraction, rootInteraction, cfg, guildId, client) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('verif_cfg_button_text')
            .setTitle('Editar texto del botón')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('button_text_input')
                        .setLabel('Texto del botón (máximo 80 caracteres)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(cfg.buttonText || botConfig.verification.defaultButtonText)
                        .setMaxLength(80)
                        .setMinLength(1)
                        .setRequired(true),
                ),
            );

        await selectInteraction.showModal(modal);

        const submitted = await selectInteraction
            .awaitModalSubmit({
                filter: i =>
                    i.customId === 'verif_cfg_button_text' && i.user.id === selectInteraction.user.id,
                time: 120_000,
            })
            .catch(() => null);

        if (!submitted) return;

        cfg.buttonText = submitted.fields.getTextInputValue('button_text_input').trim();

        const latestConfig = await getGuildConfig(client, guildId);
        latestConfig.verification = cfg;
        await setGuildConfig(client, guildId, latestConfig);

        await updateLivePanel(rootInteraction.guild, cfg);

        await submitted.reply({
            embeds: [successEmbed('Texto del botón actualizado', `El botón de verificación ahora dice **${cfg.buttonText}**.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, cfg, guildId, client);
    } catch (error) {
        logger.error('Error in handleButtonText:', error);
        
    }
}
