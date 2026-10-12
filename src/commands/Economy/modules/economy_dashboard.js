import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    LabelBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { getColor, BotConfig } from '../../../config/bot.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getEconomyPrefix } from '../../../utils/database.js';
import { getEconomyData, addMoney, removeMoney, getMaxBankCapacity } from '../../../utils/economy.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildDashboardEmbed(guild, client) {
    const currencySymbol = BotConfig.economy.currency.symbol;
    const currencyName = BotConfig.economy.currency.name;

    let totalInCirculation = 0;
    let userCount = 0;

    try {
        const economyKeys = await client.db.list(getEconomyPrefix(guild.id));

        if (economyKeys && economyKeys.length > 0) {
            for (const key of economyKeys) {
                const userId = key.split(':').pop();

                const member = await guild.members.fetch(userId).catch(() => null);
                if (member?.user?.bot) continue;

                const userData = await client.db.get(key, {});
                if (userData) {
                    totalInCirculation += (userData.wallet || 0) + (userData.bank || 0);
                    userCount++;
                }
            }
        }
    } catch (error) {
        logger.error('Error calculating economy stats:', error);
    }

    const avgBalance = userCount > 0 ? Math.floor(totalInCirculation / userCount) : 0;

    return new EmbedBuilder()
        .setTitle('💰 Panel de economía')
        .setDescription(`Administra la economía de **${guild.name}**.\nSelecciona una opción para realizar una acción.`)
        .setColor(getColor('economy'))
        .addFields(
            { name: '💰 Total en circulación', value: `\`${currencySymbol}${totalInCirculation.toLocaleString()}\``, inline: true },
            { name: '👥 Usuarios activos', value: `\`${userCount.toLocaleString()}\``, inline: true },
            { name: '📊 Saldo promedio', value: `\`${currencySymbol}${avgBalance.toLocaleString()}\``, inline: true },
            { name: '💱 Símbolo de moneda', value: `\`${currencySymbol}\``, inline: true },
            { name: '📝 Nombre de la moneda', value: `\`${currencyName}\``, inline: true },
        )
        .setFooter({ text: 'El panel se cierra tras 10 minutos de inactividad' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`economy_dashboard_${guildId}`)
        .setPlaceholder('Selecciona una acción...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Añadir dinero')
                .setDescription('Añade dinero a la cartera o al banco de un usuario')
                .setValue('add_currency')
                .setEmoji('💰'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Quitar dinero')
                .setDescription('Quita dinero de la cartera o del banco de un usuario')
                .setValue('remove_currency')
                .setEmoji('💸'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar símbolo de moneda')
                .setDescription('Cambia el símbolo de la moneda (por ejemplo, $, €, £)')
                .setValue('change_currency')
                .setEmoji('💱'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Cambiar nombre de moneda')
                .setDescription('Cambia el nombre de la moneda (por ejemplo, monedas o créditos)')
                .setValue('change_name')
                .setEmoji('📝'),
        );
}

async function refreshDashboard(rootInteraction, guild, client) {
    const selectMenu = buildSelectMenu(guild.id);
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [await buildDashboardEmbed(guild, client)],
        components: [
            new ActionRowBuilder().addComponents(selectMenu),
        ],
    }).catch(() => {});
}

async function updateConfigFile(currencySymbol, currencyName) {
    try {
        const configPath = path.join(__dirname, '../../../config/bot.js');
        let configContent = await fs.readFile(configPath, 'utf-8');

        configContent = configContent.replace(
            /symbol:\s*"[^"]*"/,
            `symbol: "${currencySymbol}"`
        );

        configContent = configContent.replace(
            /name:\s*"[^"]*",\s*\/\/\s*Currency display name/,
            `name: "${currencyName}", // Currency display name`
        );

        configContent = configContent.replace(
            /namePlural:\s*"[^"]*",\s*\/\/\s*Plural display name/,
            `namePlural: "${currencyName}s", // Plural display name`
        );
        
        await fs.writeFile(configPath, configContent, 'utf-8');
        logger.info('Config file updated successfully');
        return true;
    } catch (error) {
        logger.error('Error updating config file:', error);
        return false;
    }
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guild = interaction.guild;
            const selectMenu = buildSelectMenu(guild.id);
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [await buildDashboardEmbed(guild, client)],
                components: [selectRow],
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i =>
                    i.user.id === interaction.user.id && i.customId === `economy_dashboard_${guild.id}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const selectedOption = selectInteraction.values[0];
                try {
                    switch (selectedOption) {
                        case 'add_currency':
                            await handleAddCurrency(selectInteraction, interaction, guild, client);
                            break;
                        case 'remove_currency':
                            await handleRemoveCurrency(selectInteraction, interaction, guild, client);
                            break;
                        case 'change_currency':
                            await handleChangeCurrency(selectInteraction, interaction, guild);
                            break;
                        case 'change_name':
                            await handleChangeName(selectInteraction, interaction, guild);
                            break;
                    }
                } catch (error) {
                    if (error instanceof TitanBotError) {
                        logger.debug(`Economy dashboard validation error: ${error.message}`);
                    } else {
                        logger.error('Unexpected economy dashboard error:', error);
                    }

                    const errorMessage =
                        error instanceof TitanBotError
                            ? error.userMessage || 'An error occurred while processing your selection.'
                            : 'An unexpected error occurred while processing your request.';

                    if (!selectInteraction.replied && !selectInteraction.deferred) {
                        await selectInteraction.deferUpdate().catch(() => {});
                    }

                    await replyUserError(selectInteraction, {
                        type: ErrorTypes.UNKNOWN,
                        message: errorMessage,
                    }).catch(() => {});
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('Panel cerrado por inactividad')
                        .setDescription('Este panel se cerró por inactividad. Ejecuta el comando de nuevo para continuar.')
                        .setColor(getColor('error'));
                    
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [timeoutEmbed],
                        components: [],
                    }).catch(() => {});
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in economy_dashboard:', error);
            throw new TitanBotError(
                `Economy dashboard failed: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'Failed to open the economy dashboard.',
            );
        }
    },
};

async function handleAddCurrency(selectInteraction, rootInteraction, guild, client) {
    const modal = new ModalBuilder()
        .setCustomId(`economy_add_currency_${guild.id}`)
        .setTitle('Añadir moneda');

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('target_user')
        .setPlaceholder('Selecciona un usuario...')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

    const userLabel = new LabelBuilder()
        .setLabel('Usuario destinatario')
        .setDescription('Usuario al que se añadirá moneda')
        .setUserSelectMenuComponent(userSelect);

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Cantidad que se añadirá')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('100')
        .setMinLength(1)
        .setMaxLength(10)
        .setRequired(true);

    const typeInput = new TextInputBuilder()
        .setCustomId('type')
        .setLabel('Type (wallet or bank)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('wallet')
        .setMinLength(1)
        .setMaxLength(5)
        .setRequired(true);

    modal.addLabelComponents(userLabel);
    modal.addComponents(
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(typeInput),
    );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `economy_add_currency_${guild.id}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const userId = submitted.fields.getField('target_user').values[0];
    const amount = parseInt(submitted.fields.getTextInputValue('amount').trim(), 10);
    const type = submitted.fields.getTextInputValue('type').trim().toLowerCase();

    if (isNaN(amount) || amount <= 0) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'La cantidad debe ser un número positivo.' });
        return;
    }

    if (type !== 'wallet' && type !== 'bank') {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El tipo debe ser `wallet` o `bank`.' });
        return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
        await replyUserError(submitted, { type: ErrorTypes.USER_INPUT, message: 'El usuario indicado no está en este servidor.' });
        return;
    }

    if (member.user.bot) {
        await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message: 'Los bots no tienen cuentas de economía.' });
        return;
    }

    const { newBalance } = await addMoney(client, guild.id, userId, amount, type);

    const currencySymbol = BotConfig.economy.currency.symbol;

    await submitted.reply({
        embeds: [successEmbed('Moneda añadida', `Se añadieron ${currencySymbol}${amount.toLocaleString()} al ${type === 'wallet' ? 'monedero' : 'banco'} de ${member.user.tag}.\n**Nuevo saldo:** ${currencySymbol}${newBalance.toLocaleString()}`)],
        flags: MessageFlags.Ephemeral,
    });

    logger.info(`[ECONOMY_DASHBOARD] Currency added`, {
        adminId: submitted.user.id,
        targetUserId: userId,
        amount,
        type,
        newBalance,
    });

    await refreshDashboard(rootInteraction, guild, client);
}

async function handleRemoveCurrency(selectInteraction, rootInteraction, guild, client) {
    const modal = new ModalBuilder()
        .setCustomId(`economy_remove_currency_${guild.id}`)
        .setTitle('Quitar moneda');

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('target_user')
        .setPlaceholder('Selecciona un usuario...')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

    const userLabel = new LabelBuilder()
        .setLabel('Usuario destinatario')
        .setDescription('Usuario al que se quitará moneda')
        .setUserSelectMenuComponent(userSelect);

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Cantidad que se quitará')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('100')
        .setMinLength(1)
        .setMaxLength(10)
        .setRequired(true);

    const typeInput = new TextInputBuilder()
        .setCustomId('type')
        .setLabel('Type (wallet or bank)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('wallet')
        .setMinLength(1)
        .setMaxLength(5)
        .setRequired(true);

    modal.addLabelComponents(userLabel);
    modal.addComponents(
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(typeInput),
    );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `economy_remove_currency_${guild.id}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const userId = submitted.fields.getField('target_user').values[0];
    const amount = parseInt(submitted.fields.getTextInputValue('amount').trim(), 10);
    const type = submitted.fields.getTextInputValue('type').trim().toLowerCase();

    if (isNaN(amount) || amount <= 0) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'La cantidad debe ser un número positivo.' });
        return;
    }

    if (type !== 'wallet' && type !== 'bank') {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El tipo debe ser `wallet` o `bank`.' });
        return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
        await replyUserError(submitted, { type: ErrorTypes.USER_INPUT, message: 'El usuario indicado no está en este servidor.' });
        return;
    }

    if (member.user.bot) {
        await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message: 'Los bots no tienen cuentas de economía.' });
        return;
    }

    const { newBalance } = await removeMoney(client, guild.id, userId, amount, type);

    const currencySymbol = BotConfig.economy.currency.symbol;

    await submitted.reply({
        embeds: [successEmbed('Moneda quitada', `Se quitaron ${currencySymbol}${amount.toLocaleString()} del ${type === 'wallet' ? 'monedero' : 'banco'} de ${member.user.tag}.\n**Nuevo saldo:** ${currencySymbol}${newBalance.toLocaleString()}`)],
        flags: MessageFlags.Ephemeral,
    });

    logger.info(`[ECONOMY_DASHBOARD] Currency removed`, {
        adminId: submitted.user.id,
        targetUserId: userId,
        amount,
        type,
        newBalance,
    });

    await refreshDashboard(rootInteraction, guild, client);
}

async function handleChangeCurrency(selectInteraction, rootInteraction, guild) {
    const modal = new ModalBuilder()
        .setCustomId(`economy_change_currency_${guild.id}`)
        .setTitle('Cambiar símbolo de moneda');

    const symbolInput = new TextInputBuilder()
        .setCustomId('currency_symbol')
        .setLabel('Nuevo símbolo de moneda')
        .setStyle(TextInputStyle.Short)
        .setValue(BotConfig.economy.currency.symbol)
        .setPlaceholder('$')
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(symbolInput));

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `economy_change_currency_${guild.id}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newSymbol = submitted.fields.getTextInputValue('currency_symbol').trim();

    if (newSymbol.length === 0 || newSymbol.length > 3) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El símbolo de moneda debe tener entre 1 y 3 caracteres.' });
        return;
    }

    const success = await updateConfigFile(newSymbol, BotConfig.economy.currency.name);

    if (!success) {
        await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message: 'No se pudo actualizar el archivo de configuración. Consulta los registros.' });
        return;
    }

    await submitted.reply({
        embeds: [successEmbed('Símbolo de moneda actualizado', `El símbolo de moneda cambió a **${newSymbol}**.\n\n**Nota:** Debes reiniciar el bot para aplicar los cambios.`)],
        flags: MessageFlags.Ephemeral,
    });

    logger.info(`[ECONOMY_DASHBOARD] Currency symbol changed`, {
        adminId: submitted.user.id,
        oldSymbol: BotConfig.economy.currency.symbol,
        newSymbol
    });
}

async function handleChangeName(selectInteraction, rootInteraction, guild) {
    const modal = new ModalBuilder()
        .setCustomId(`economy_change_name_${guild.id}`)
        .setTitle('Cambiar nombre de la moneda');

    const nameInput = new TextInputBuilder()
        .setCustomId('currency_name')
        .setLabel('Nuevo nombre de la moneda')
        .setStyle(TextInputStyle.Short)
        .setValue(BotConfig.economy.currency.name)
        .setPlaceholder('coins')
        .setMinLength(1)
        .setMaxLength(20)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === `economy_change_name_${guild.id}` && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newName = submitted.fields.getTextInputValue('currency_name').trim();

    if (newName.length === 0 || newName.length > 20) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'El nombre de la moneda debe tener entre 1 y 20 caracteres.' });
        return;
    }

    const success = await updateConfigFile(BotConfig.economy.currency.symbol, newName);

    if (!success) {
        await replyUserError(submitted, { type: ErrorTypes.UNKNOWN, message: 'No se pudo actualizar el archivo de configuración. Consulta los registros.' });
        return;
    }

    await submitted.reply({
        embeds: [successEmbed('Nombre de moneda actualizado', `El nombre de la moneda cambió a **${newName}**.\n\n**Nota:** Debes reiniciar el bot para aplicar los cambios.`)],
        flags: MessageFlags.Ephemeral,
    });

    logger.info(`[ECONOMY_DASHBOARD] Currency name changed`, {
        adminId: submitted.user.id,
        oldName: BotConfig.economy.currency.name,
        newName
    });
}
