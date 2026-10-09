import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { playQuery, replyMusicSuccess } from '../../services/musica/musicaActions.js';

export default {
    slashOnly: true,
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('reproducir')
        .setDescription('Play a song or add it to the queue')
        .addStringOption((opt) =>
            opt.setName('query').setDescription('Song name or URL').setRequired(true),
        ),

    async execute(interaction, config, client) {
        const deferred = await InteractionAyudaer.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const result = await playQuery(client, interaction, interaction.options.getString('query'));
        await replyMusicSuccess(interaction, result.embed);
    },
};
