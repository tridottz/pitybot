import { SlashCommandBuilder } from 'discord.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';

import searchDefine from './modules/buscar_define.js';
import searchGoogle from './modules/buscar_google.js';
import searchUrban from './modules/buscar_urban.js';

export default {
    data: new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Search the web and dictionaries')
        .addSubcommand(subcommand =>
            subcommand
                .setName('define')
                .setDescription('Look up a word definition')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to look up')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('google')
                .setDescription('Search Google')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('What would you like to search for?')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('urban')
                .setDescription('Search Urban Dictionary for definitions')
                .addStringOption(option =>
                    option.setName('term')
                        .setDescription('The term to look up on Urban Dictionary')
                        .setRequired(true))
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'define':
                return await searchDefine.execute(interaction, config, client);
            case 'google':
                return await searchGoogle.execute(interaction, config, client);
            case 'urban':
                return await searchUrban.execute(interaction, config, client);
            default:
                return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
        }
    }
};
