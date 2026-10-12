import { EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getTicketData, saveTicketData } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

const STAR_LABELS = {
    '1': '⭐ 1 — Muy mala',
    '2': '⭐ 2 — Mala',
    '3': '⭐ 3 — Regular',
    '4': '⭐ 4 — Buena',
    '5': '⭐ 5 — Excelente',
};

const feedbackHandler = {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        
        const [guildId, channelId, ratingStr] = args;

        if (!guildId || !channelId || !ratingStr) {
            await InteractionHelper.safeReply(interaction, {
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

        try {
            await interaction.deferUpdate();
        } catch (err) {
            logger.warn('ticketFeedback: interaction expired before deferUpdate', { guildId, channelId, error: err.message });
            return;
        }

        let ticketData;
        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load ticket data', { guildId, channelId, error: err.message });
        }

        if (!ticketData) {
            await InteractionHelper.safeEditReply(interaction, {
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
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ No autorizado')
                        .setDescription('Solo quien creó el ticket puede enviar una opinión.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        if (ticketData.feedback?.rating) {
            await InteractionHelper.safeEditReply(interaction, {
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

        const rating = parseInt(ratingStr, 10);
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

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('✅ ¡Gracias por tu opinión!')
                    .setDescription(`Calificaste tu experiencia de soporte con **${ratingLabel}**.\n\n¡Tu opinión quedó registrada y nos ayuda a mejorar!`)
                    .setColor(getColor('success'))
                    .setFooter({ text: 'Gracias por usar nuestro sistema de soporte.' })
                    .setTimestamp(),
            ],
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

const commentHandler = {
    name: 'ticket_feedback_comment',

    async execute(interaction, client, args) {
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Enlace de opinión no válido')
                        .setDescription('Esta acción de opinión no tiene un formato válido.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket_feedback_comment_modal:${guildId}:${channelId}`)
            .setTitle('Añadir opinión sobre el ticket');

        const commentInput = new TextInputBuilder()
            .setCustomId('feedback_comment')
            .setLabel('Tu opinión')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Cuéntanos qué salió bien o cómo podemos mejorar...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));

        await interaction.showModal(modal);
    },
};

const declineHandler = {
    name: 'ticket_feedback_decline',

    async execute(interaction) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('👋 ¡No hay problema!')
                    .setDescription('Puedes volver a contactarnos si necesitas ayuda.')
                    .setColor(getColor('default')),
            ],
            components: [],
        });
    },
};

export default [feedbackHandler, commentHandler, declineHandler];