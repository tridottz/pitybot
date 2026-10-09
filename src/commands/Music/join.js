import { SlashCommandBuilder } from 'discord.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { joinVoiceChannel, replyMusicSuccess } from '../../services/musica/musicaActions.js';
import { deferMusicCommand } from '../../services/musica/prefixSupport.js';

export default {
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('entrar')
        .setDescription('Entra a tu canal de voz without starting playback'),

    async execute(interaction, config, client) {
        const deferred = await deferMusicCommand(interaction);
        if (!deferred) {
            return;
        }

        const embed = await joinVoiceChannel(client, interaction);
        await replyMusicSuccess(interaction, embed);
    },
};
