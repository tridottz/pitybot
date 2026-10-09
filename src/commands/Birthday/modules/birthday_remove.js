import { EmbedBuilder } from 'discord.js';
import { deleteBirthday } from '../../../services/cumpleanosService.js';

import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';
export default {
    async execute(interaction, config, client) {
        await InteractionAyudaer.safeDefer(interaction);

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const result = await deleteBirthday(client, guildId, userId);

        if (result.status === 'not_found') {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('No se encontró cumpleaños')
                .setDescription('No tienes ningún cumpleaños establecido para quitar.');
            await InteractionAyudaer.safeEditReply(interaction, {
                embeds: [embed]
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Cumpleaños eliminado')
            .setDescription('Tu cumpleaños se eliminó correctamente del servidor.');
        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};