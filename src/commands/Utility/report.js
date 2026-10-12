import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import report from './modules/report.js';
import reportSetchannel from './modules/report_setchannel.js';

export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Reporta a un usuario al equipo de moderación o configura dónde se envían los reportes.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('Reporta a un usuario al equipo de moderación del servidor.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Usuario al que quieres reportar.')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Motivo del reporte (da todos los detalles posibles).')
                        .setRequired(true)
                        .setMaxLength(500),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Establece el canal donde se enviarán los reportes. (Se requiere el permiso Administrar servidor)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Canal de texto que recibirá los reportes.')
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

        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Subcomando desconocido.' });
    },
};
