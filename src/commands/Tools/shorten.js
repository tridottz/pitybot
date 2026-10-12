import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("shorten")
        .setDescription("Acorta una URL con is.gd")
        .addStringOption(option =>
            option
                .setName("url")
                .setDescription("URL que quieres acortar")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("custom")
                .setDescription("Final personalizado de la URL (opcional)")
                .setRequired(false)
        )
        .setDMPermission(false),
    category: "Tools",

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });
        if (!deferSuccess) {
            logger.warn(`Shorten interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'shorten'
            });
            return;
        }

        const url = interaction.options.getString("url");
        const custom = interaction.options.getString("custom");

        try {
            new URL(url);
        } catch (e) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'El formato del enlace no es válido. Incluye http:// o https://',
            });
        }

        if (custom && !/^[a-zA-Z0-9_-]+$/.test(custom)) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Custom URL can only contain letters, numbers, underscores, and hyphens.',
            });
        }

        let apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
        if (custom) {
            apiUrl += `&shorturl=${encodeURIComponent(custom)}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response;
        try {
            response = await fetch(apiUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'TitanBot URL Shortener/1.0'
                }
            });
        } catch (networkError) {
            const message = networkError?.name === 'AbortError'
                ? 'El acortador de enlaces tardó demasiado. Inténtalo de nuevo en un momento.'
                : 'No se pudo acceder al servicio para acortar enlaces. Inténtalo más tarde.';
            return replyUserError(interaction, {
                type: ErrorTypes.NETWORK,
                message,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                    message: `El servicio de enlaces cortos respondió con HTTP ${response.status}. Inténtalo de nuevo más tarde.`,
            });
        }

        const shortUrl = await response.text();

        try {
            new URL(shortUrl);
        } catch (e) {
            if (shortUrl.includes("already exists")) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Ese enlace personalizado ya está en uso. Prueba con otro.',
                });
            } else if (shortUrl.includes("invalid")) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'El enlace no es válido. Incluye http:// o https://',
                });
            }
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `No se pudo acortar el enlace: ${shortUrl}`,
            });
        }

        const embed = successEmbed('Enlace acortado', `Este es tu enlace corto: ${shortUrl}`);
        embed.setColor(getColor('success'));
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
        });
    },
};
