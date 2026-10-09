import { createEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';

export default {
    async execute(interaction) {
        const query = interaction.options.getString('query');
        const searchUrl = `https://www.google.com/buscar?q=${encodeURIComponent(query)}`;

        const embed = createEmbed({
            title: 'Google Search',
            description: `[Search for "${query}"](${searchUrl})`,
            color: 'info'
        })
        .setFooter({ text: 'Google Search Results' });

        await InteractionAyudaer.safeReply(interaction, { embeds: [embed] });

        logger.info('Google search link generated', {
            userId: interaction.user.id,
            query: query,
            guildId: interaction.guildId,
            commandName: 'google'
        });
    },
};
