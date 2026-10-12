import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError, replyUserError } from '../utils/errorHandler.js';
import { 
    getGuildGiveaways, 
    saveGiveaway, 
    isGiveawayEnded 
} from '../utils/giveaways.js';
import { Mutex } from '../utils/mutex.js';
import { 
    selectWinners,
    isUserRateLimited,
    recordUserInteraction,
    createGiveawayEmbed,
    createGiveawayButtons
} from '../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';

export const giveawayJoinHandler = {
    customId: 'giveaway_join',
    async execute(interaction, client) {
        try {
            
            if (isUserRateLimited(interaction.user.id, interaction.message.id)) {
                return replyUserError(interaction, { type: ErrorTypes.RATE_LIMIT, message: 'Espera un momento antes de volver a interactuar con este sorteo.' });
            }

            await recordUserInteraction(interaction.user.id, interaction.message.id);

            const lockKey = `giveaway:${interaction.message.id}`;
            await Mutex.runExclusive(lockKey, async () => {
                const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
                const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

                if (!giveaway) {
                    throw new TitanBotError(
                        'Giveaway not found in database',
                        ErrorTypes.VALIDATION,
                        'This giveaway is no longer active.',
                        { messageId: interaction.message.id, guildId: interaction.guildId }
                    );
                }

                const endedByTime = isGiveawayEnded(giveaway);
                const endedByFlag = giveaway.ended || giveaway.isEnded;

                if (endedByTime || endedByFlag) {
                    return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Este sorteo ya finalizó.' });
                }

                const participants = giveaway.participants || [];
                const userId = interaction.user.id;

                if (participants.includes(userId)) {
                    return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: '¡Ya estás participando en este sorteo! 🎉' });
                }

                participants.push(userId);
                giveaway.participants = participants;

                await saveGiveaway(client, interaction.guildId, giveaway);

                logger.debug(`User ${interaction.user.tag} joined giveaway ${interaction.message.id}`);

                const updatedEmbed = createGiveawayEmbed(giveaway, 'active');
                const updatedRow = createGiveawayButtons(false);

                await interaction.message.edit({
                    embeds: [updatedEmbed],
                    components: [updatedRow]
                });

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            'Success! You have entered the giveaway! 🎉',
                            `¡Mucha suerte! Ahora hay ${participants.length} participante(s).`
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
            });
        } catch (error) {
            logger.error('Error in giveaway join handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_join',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayEndHandler = {
    customId: 'giveaway_end',
    async execute(interaction, client) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso \'Gestionar servidor\' para finalizar un sorteo.' });
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway is no longer active.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (giveaway.ended || giveaway.isEnded || isGiveawayEnded(giveaway)) {
                throw new TitanBotError(
                    'Giveaway already ended',
                    ErrorTypes.VALIDATION,
                    'Este sorteo ya terminó.',
                    { messageId: interaction.message.id }
                );
            }

            const participants = giveaway.participants || [];
            const winners = selectWinners(participants, giveaway.winnerCount);

            giveaway.ended = true;
            giveaway.isEnded = true;
            giveaway.winnerIds = winners;
            giveaway.endedAt = new Date().toISOString();
            giveaway.endedBy = interaction.user.id;

            await saveGiveaway(client, interaction.guildId, giveaway);

            logger.info(`Giveaway ended via button by ${interaction.user.tag}: ${interaction.message.id}`);

            const updatedEmbed = createGiveawayEmbed(giveaway, 'ended', winners);
            const updatedRow = createGiveawayButtons(true);

            await interaction.message.edit({
                content: '🎉 **SORTEO FINALIZADO** 🎉',
                embeds: [updatedEmbed],
                components: [updatedRow]
            });

            try {
                await logEvent({
                    client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                    data: {
                        description: `Sorteo finalizado con ${winners.length} ganador(es)`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Premio',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 Ganadores',
                                value: winners.length > 0 
                                    ? winners.map(id => `<@${id}>`).join(', ')
                                    : 'No valid entries',
                                inline: false
                            },
                            {
                                name: '👥 Total de participantes',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway end event:', logError);
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Giveaway Ended ✅`,
                        `El sorteo terminó y se seleccionaron ${winners.length} ganador(es).`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in giveaway end handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_end',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayRerollHandler = {
    customId: 'giveaway_reroll',
    async execute(interaction, client) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso \'Gestionar servidor\' para volver a elegir ganadores.' });
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway is no longer active.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (!giveaway.ended && !giveaway.isEnded) {
                throw new TitanBotError(
                    'Giveaway still active',
                    ErrorTypes.VALIDATION,
                    'Este sorteo aún no termina. Finalízalo primero.',
                    { messageId: interaction.message.id }
                );
            }

            const participants = giveaway.participants || [];
            
            if (participants.length === 0) {
                throw new TitanBotError(
                    'No participants to reroll',
                    ErrorTypes.VALIDATION,
                    'No hay participantes para volver a sortear.',
                    { messageId: interaction.message.id }
                );
            }

            const newWinners = selectWinners(participants, giveaway.winnerCount);

            giveaway.winnerIds = newWinners;
            giveaway.rerolledAt = new Date().toISOString();
            giveaway.rerolledBy = interaction.user.id;

            await saveGiveaway(client, interaction.guildId, giveaway);

            logger.info(`Giveaway rerolled via button by ${interaction.user.tag}: ${interaction.message.id}`);

            const updatedEmbed = createGiveawayEmbed(giveaway, 'reroll', newWinners);
            const updatedRow = createGiveawayButtons(true);

            await interaction.message.edit({
                content: '🔄 **NUEVOS GANADORES DEL SORTEO** 🔄',
                embeds: [updatedEmbed],
                components: [updatedRow]
            });

            try {
                await logEvent({
                    client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Se volvieron a elegir ganadores del sorteo`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Premio',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 Nuevos ganadores',
                                value: newWinners.map(id => `<@${id}>`).join(', '),
                                inline: false
                            },
                            {
                                name: '👥 Total de participantes',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway reroll event:', logError);
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        'Giveaway Rerolled ✅',
                        `New winner(s) have been selected!`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in giveaway reroll handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_reroll',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayViewHandler = {
    customId: 'giveaway_view',
    async execute(interaction, client) {
        try {
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway could not be found.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (!giveaway.ended && !giveaway.isEnded && !isGiveawayEnded(giveaway)) {
                return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Este sorteo todavía no termina, así que aún no hay ganadores.' });
            }

            const winnerIds = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];
            const winnerMentions = winnerIds.length > 0
                ? winnerIds.map(id => `<@${id}>`).join(', ')
                : 'No valid winners were selected for this giveaway.';

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Winners for ${giveaway.prize || 'this giveaway'} 🎉`,
                        winnerMentions
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            logger.error('Error in giveaway view handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_view',
                handler: 'giveaway'
            });
        }
    }
};
