import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import economyDashboard from './modules/economy_dashboard.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Comandos de administración de la economía')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Abre el panel de administración de la economía')
        ),
    category: 'Economy',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dashboard') {
            await economyDashboard.execute(interaction, config, client);
        }
    }
};