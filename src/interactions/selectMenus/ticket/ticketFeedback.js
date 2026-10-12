import { EmbedBuilder } from 'discord.js';
import { getTicketData, saveTicketData } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';

const STAR_LABELS = {
    '1': '⭐ 1 — Muy mala',
    '2': '⭐ 2 — Mala',
    '3': '⭐ 3 — Regular',
    '4': '⭐ 4 — Buena',
    '5': '⭐ 5 — Excelente',
};

export default {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Enlace de opinión no válido')
                        .setDescription('El enlace de opinión no tiene un formato válido.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        let ticketData;
        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load ticket data', { guildId, channelId, error: err.message });
        }

        if (!ticketData) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Ticket no encontrado')
                        .setDescription('No se encontró el ticket asociado a esta encuesta.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ No autorizado')
                        .setDescription('Solo quien creó el ticket puede enviar una opinión.')
                        .setColor(getColor('error')),
                ],
                ephemeral: true,
            });
            return;
        }

        if (ticketData.feedback?.rating) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Ya enviada')
                        .setDescription(`Ya calificaste este ticket con **${STAR_LABELS[String(ticketData.feedback.rating)]}**.\n¡Gracias por tu opinión!`)
                        .setColor(getColor('success')),
                ],
                components: [],
            });
            return;
        }

        const rating = parseInt(interaction.values[0], 10);
        const ratingLabel = STAR_LABELS[String(rating)] ?? `${rating} estrellas`;

        try {
            ticketData.feedback = {
                rating,
                submittedAt: new Date().toISOString(),
            };
            await saveTicketData(guildId, channelId, ticketData);
        } catch (err) {
            logger.error('ticketFeedback: failed to save feedback', { guildId, channelId, rating, error: err.message });
        }

        try {
            await logTicketFeedback({
                client: interaction.client,
                guildId,
                ticketNumber: ticketData.id,
                ticketChannelId: channelId,
                userId: interaction.user.id,
                rating,
            });
        } catch (err) {
            logger.warn('ticketFeedback: failed to send log', { guildId, channelId, error: err.message });
        }

        const thankYouEmbed = new EmbedBuilder()
            .setTitle('✅ ¡Gracias por tu opinión!')
            .setDescription(`Calificaste tu experiencia de soporte con **${ratingLabel}**.\n\n¡Tu opinión quedó registrada y nos ayuda a mejorar!`)
            .setColor(getColor('success'))
            .setFooter({ text: 'Gracias por usar nuestro sistema de soporte.' })
            .setTimestamp();

        await interaction.update({
            embeds: [thankYouEmbed],
            components: [],
        });

        logger.info('Ticket feedback submitted', {
            guildId,
            channelId,
            userId: interaction.user.id,
            rating,
        });
    },
};