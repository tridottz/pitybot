import { SlashCommandBuilder } from 'discord.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { buildNowPlayingReply } from '../../services/musica/musicaActions.js';
import { deferMusicCommand } from '../../services/musica/prefixSupport.js';

export default {
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('sonando')
        .setDescription('Show the currently playing track'),

    async execute(interaction, config, client) {
        await deferMusicCommand(interaction);
        const payload = buildNowPlayingReply(client, interaction.guild.id);
        await InteractionAyudaer.safeEditReply(interaction, payload);
    },
};
