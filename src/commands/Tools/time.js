import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
    data: new SlashCommandBuilder()
        .setName('hora')
        .setDescription('Muestra la hora actual en distintas zonas horarias')
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('La zona horaria que quieres mostrar (por ejemplo, UTC, America/Mexico_City)')
                .setRequired(false)),

    async execute(interaction) {
        await InteractionAyudaer.safeExecute(
            interaction,
            async () => {
                const timezone = interaction.options.getString('timezone') || 'UTC';

                let timeString;
                try {
                    timeString = new Date().toLocaleString('en-US', {
                        timeZone: timezone,
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    });
                } catch (error) {
                    logger.warn(`Invalid timezone requested: ${timezone}`);
                    await replyUsarError(interaction, {
                        type: ErrorTypes.VALIDATION,
                        message: 'Invalid timezone. Please use a valid timezone identifier (e.g., UTC, America/New_York, Europe/London)',
                    });
                    return;
                }

                const now = new Date();
                const unixTimestamp = Math.floor(now.getTime() / 1000);

                const embed = successEmbed(
                    '🕒 Current Time',
                    `**${timezone}:** ${timeString}\n` +
                    `**Unix Timestamp:** \`${unixTimestamp}\`\n` +
                    `**ISO String:** \`${now.toISOString()}\``
                );

                await InteractionAyudaer.safeEditReply(interaction, { embeds: [embed] });
            },
            'Failed to get current time. Please try again.',
            {
                autoDefer: true,
                deferOptions: { flags: MessageFlags.Ephemeral }
            }
        );
    },
};