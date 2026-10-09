import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
    data: new SlashCommandBuilder()
        .setName('hora-unix')
        .setDescription('Obtiene la marca de tiempo Unix actual'),

    async execute(interaction) {
        await InteractionAyudaer.safeExecute(
            interaction,
            async () => {
                const now = new Date();
                const unixTimestamp = Math.floor(now.getTime() / 1000);

                const embed = successEmbed(
                    '⏱️ Current Unix Timestamp',
                    `**Seconds since Unix Epoch:** \`${unixTimestamp}\`\n` +
                    `**Milliseconds since Unix Epoch:** \`${now.getTime()}\`\n\n` +
                    `**Human-readable (UTC):** ${now.toUTCString()}\n` +
                    `**ISO String:** ${now.toISOString()}`
                );
                embed.setColor(getColor('success'));

                await InteractionAyudaer.safeEditReply(interaction, {
                    embeds: [embed],
                });
            },
            'Failed to get unix timestamp. Please try again.',
            {
                autoDefer: true,
                deferOptions: { flags: MessageFlags.Ephemeral }
            }
        );
    },
};