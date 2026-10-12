import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed, buildUserErrorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { BotConfig } from '../../config/bot.js';

const ROB_COOLDOWN = BotConfig.economy?.cooldowns?.rob ?? 4 * 60 * 60 * 1000;
const BASE_ROB_SUCCESS_CHANCE = BotConfig.economy?.robSuccessRate ?? 0.4;
const ROB_PERCENTAGE = 0.15;
const FINE_PERCENTAGE = 0.1;

export default {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Intenta robar a otro usuario (muy arriesgado)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Usuario al que quieres robar')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const robberId = interaction.user.id;
            const victimUser = interaction.options.getUser("user");
            const guildId = interaction.guildId;
            const now = Date.now();

            if (robberId === victimUser.id) {
                throw createError(
                    "Cannot rob self",
                    ErrorTypes.VALIDATION,
                    "No puedes robarte a ti mismo.",
                    { robberId, victimId: victimUser.id }
                );
            }
            
            if (victimUser.bot) {
                throw createError(
                    "Cannot rob bot",
                    ErrorTypes.VALIDATION,
                    "No puedes robar a un bot.",
                    { victimId: victimUser.id, isBot: true }
                );
            }

            const robberData = await getEconomyData(client, guildId, robberId);
            const victimData = await getEconomyData(client, guildId, victimUser.id);
            
            if (!robberData || !victimData) {
                throw createError(
                    "Failed to load economy data",
                    ErrorTypes.DATABASE,
                    "No se pudieron cargar los datos de economía. Inténtalo más tarde.",
                    { robberId: !!robberData, victimId: !!victimData, guildId }
                );
            }
            
            const lastRob = robberData.lastRob || 0;

            if (now < lastRob + ROB_COOLDOWN) {
                const remaining = lastRob + ROB_COOLDOWN - now;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

                throw createError(
                    "Robbery cooldown active",
                    ErrorTypes.RATE_LIMIT,
                    `Debes pasar desapercibido. Espera **${hours} h ${minutes} min** antes de intentar otro robo.`,
                    { remaining, hours, minutes, cooldownType: 'rob' }
                );
            }

            if (victimData.wallet < 500) {
                throw createError(
                    "Victim too poor",
                    ErrorTypes.VALIDATION,
                    `${victimUser.username} is too poor. They need at least $500 cash to be worth robbing.`,
                    { victimWallet: victimData.wallet, required: 500 }
                );
            }

            const hasSafe = victimData.inventory["personal_safe"] || 0;

            if (hasSafe > 0) {
                robberData.lastRob = now;
                await setEconomyData(client, guildId, robberId, robberData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        warningEmbed(
                            'Robo bloqueado',
                            `¡${victimUser.username} estaba preparado! Tu intento falló porque tiene una **caja fuerte personal**. Saliste ileso, pero no obtuviste nada.`
                        )
                    ],
                });
            }

            const isSuccessful = Math.random() < BASE_ROB_SUCCESS_CHANCE;
            let resultEmbed;

            if (isSuccessful) {
                const amountStolen = Math.floor(victimData.wallet * ROB_PERCENTAGE);

                robberData.wallet = (robberData.wallet || 0) + amountStolen;
                victimData.wallet = (victimData.wallet || 0) - amountStolen;

                resultEmbed = successEmbed(
                    'Robo exitoso',
                    `Le robaste **$${amountStolen.toLocaleString()}** a ${victimUser.username}.`
                );
            } else {
                const fineAmount = Math.floor((robberData.wallet || 0) * FINE_PERCENTAGE);

                if ((robberData.wallet || 0) < fineAmount) {
                    robberData.wallet = 0;
                } else {
                    robberData.wallet = (robberData.wallet || 0) - fineAmount;
                }

                resultEmbed = buildUserErrorEmbed(
                    'unknown',
                    `Falló el robo y te atraparon. Recibiste una multa de **$${fineAmount.toLocaleString()}** de tu propio efectivo.`,
                    { titleOverride: 'Robo fallido' }
                );
            }

            robberData.lastRob = now;

            await setEconomyData(client, guildId, robberId, robberData);
            await setEconomyData(client, guildId, victimUser.id, victimData);

            resultEmbed
                .addFields(
                    {
                        name: `Tu nuevo efectivo (${interaction.user.username})`,
                        value: `$${robberData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: `Nuevo efectivo de ${victimUser.username}`,
                        value: `$${victimData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                )
                .setFooter({ text: `Podrás volver a robar en ${Math.ceil(ROB_COOLDOWN / (60 * 60 * 1000))} horas.` });

            await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'rob' })
};
