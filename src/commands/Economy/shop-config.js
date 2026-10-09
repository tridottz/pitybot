import { SlashCommandBuilder } from 'discord.js';
import shopConfigSetrole from './modules/tienda_config_setrole.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('config-tienda')
        .setDescription('Configura la tienda (requiere Administrar servidor).')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setrole')
                .setDescription('Establece el rol de Discord que se otorgará al comprar el artículo de rol prémium.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('El rol que se otorgará al comprar el rol prémium.')
                        .setRequired(true),
                ),
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setrole') {
            return shopConfigSetrole.execute(interaction, config, client);
        }
    },
};
