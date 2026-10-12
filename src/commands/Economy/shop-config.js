import { SlashCommandBuilder } from 'discord.js';
import shopConfigSetrole from './modules/shop_config_setrole.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('shop-config')
        .setDescription('Configura la tienda. (Se requiere el permiso Administrar servidor)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setrole')
                .setDescription('Establece el rol de Discord que se otorgará al comprar el artículo «Rol prémium».')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rol que se otorgará al comprar el artículo «Rol prémium».')
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
