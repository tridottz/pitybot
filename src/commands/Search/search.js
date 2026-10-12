import { SlashCommandBuilder } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import searchDefine from './modules/search_define.js';
import searchGoogle from './modules/search_google.js';
import searchUrban from './modules/search_urban.js';

export default {
    data: new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Busca en la web y en diccionarios')
        .addSubcommand(subcommand =>
            subcommand
                .setName('definir')
                .setDescription('Busca la definición de una palabra')
                .addStringOption(option =>
                    option.setName('palabra')
                        .setDescription('Palabra cuya definición quieres consultar')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('google')
                .setDescription('Busca en Google')
                .addStringOption(option =>
                    option.setName('busqueda')
                        .setDescription('¿Qué quieres buscar?')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('urban')
                .setDescription('Busca definiciones en Urban Dictionary')
                .addStringOption(option =>
                    option.setName('termino')
                        .setDescription('Término que quieres buscar en Urban Dictionary')
                        .setRequired(true))
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'definir':
                return await searchDefine.execute(interaction, config, client);
            case 'google':
                return await searchGoogle.execute(interaction, config, client);
            case 'urban':
                return await searchUrban.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Subcomando desconocido' });
        }
    }
};
