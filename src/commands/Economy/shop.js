import { SlashCommandBuilder } from 'discord.js';
import shopBrowse from './modules/tienda_browse.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('Explora la tienda de economía.'),

    async execute(interaction, config, client) {
        return shopBrowse.execute(interaction, config, client);
    },
};
