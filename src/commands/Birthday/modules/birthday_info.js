import { EmbedBuilder } from 'discord.js';
import { getUsarBirthday } from '../../../services/cumpleanosService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';
export default {
    async execute(interaction, config, client) {
        await InteractionAyudaer.safeDefer(interaction);

        const targetUsar = interaction.options.getUsar("usuario") || interaction.user;
        const userId = targetUsar.id;
        const guildId = interaction.guildId;

        const birthdayData = await getUsarBirthday(client, guildId, userId);

        if (!birthdayData) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('No se encontró cumpleaños')
                .setDescription(targetUsar.id === interaction.user.id 
                    ? "Aún no has establecido tu cumpleaños. ¡Usa `/cumpleaños establecer` para agregarlo!"
                    : `${targetUsar.username} aún no ha establecido su cumpleaños.`);
            return await InteractionAyudaer.safeEditReply(interaction, {
                embeds: [embed]
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Información de cumpleaños')
            .setDescription(`**Fecha:** ${birthdayData.monthName} ${birthdayData.day}\n**Usuario:** ${targetUsar.toString()}`);

        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [embed]
        });

        logger.info('Birthday info retrieved successfully', {
            userId: interaction.user.id,
            targetUsarId: targetUsar.id,
            guildId,
            commandName: 'birthday_info'
        });
    }
};