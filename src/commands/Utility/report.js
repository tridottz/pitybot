import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';

import report from './modules/reportarar.js';
import reportSetchannel from './modules/reportarar_setchannel.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reportar')
        .setDescription('Reporta a un usuario al equipo del servidor o configura dónde se envían los reportes.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('Reporta a un usuario al equipo de moderación del servidor.')
                .addUsarOption(option =>
                    option
                        .setName('user')
                        .setDescription('El usuario que quieres reportar.')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('El motivo del reporte (sé detallado).')
                        .setRequired(true)
                        .setMaxLength(500),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Establece el canal donde se enviarán los reportes (requiere Administrar servidor).')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('El canal de texto que recibirá los reportes.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                ),
        ),
    category: 'Utility',

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'file') {
            return await report.execute(interaction, config, client);
        }

        if (subcommand === 'setchannel') {
            return await reportSetchannel.execute(interaction, config, client);
        }

        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand.' });
    },
};