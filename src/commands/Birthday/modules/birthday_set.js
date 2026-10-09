import { EmbedBuilder } from 'discord.js';
import { setBirthday } from '../../../services/cumpleanosService.js';

import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';
export default {
    async execute(interaction, config, client) {
        await InteractionAyudaer.safeDefer(interaction);

        const month = interaction.options.getInteger("mes");
        const day = interaction.options.getInteger("día");
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const result = await setBirthday(client, guildId, userId, month, day);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('¡Cumpleaños establecido!')
            .setDescription(`Tu cumpleaños se estableció el **${result.data.monthName} ${result.data.day}**.`);

        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [embed]
        });
    }
};