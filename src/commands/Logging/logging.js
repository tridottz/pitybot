import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import channel from './modules/logging_channel.js';

import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Administra los registros del servidor: canales, filtros y categorías de eventos.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Abre el panel de registros para configurar canales, filtros y categorías de eventos.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('channel')
                .setDescription('Configura rápidamente un canal de registros sin abrir el panel.')
                .addStringOption((option) =>
                    option
                        .setName('destination')
                        .setDescription('Destino de registro que quieres configurar.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Audit (moderation, messages, members…)', value: 'audit' },
                            { name: 'Applications', value: 'applications' },
                            { name: 'Reports', value: 'reports' },
                        ),
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Canal de texto para los registros.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Actívalo para borrar este canal de registros.')
                        .setRequired(false),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            if (subcommand === 'channel') {
                return await channel.execute(interaction, config, client);
            }

            await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'This subcommand is not recognised.' });
        } catch (error) {
            logger.error('logging command error:', error);
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An unexpected error occurred.' }).catch(() => {});
        }
    },
};
