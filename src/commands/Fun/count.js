import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
  getCountingGameConfig,
  activateCountingGame,
  disableCountingGame,
  resetCountingGame,
  buildCountingLeaderboard,
  getCountingSystemChoices,
  getCountingSystemLabel,
  getExpectedCountValue,
} from '../../services/countingGameService.js';
import { logger } from '../../utils/logger.js';

import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
  data: new SlashCommandBuilder()
    .setName('count')
    .setDescription('Administra el juego de conteo del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Inicia un juego de conteo en un canal de texto')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Canal donde se llevará a cabo el conteo')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('system')
            .setDescription('Sistema de conteo que se utilizará')
            .setRequired(true)
            .addChoices(...getCountingSystemChoices()),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Desactiva el juego de conteo de este servidor'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Consulta el estado actual del juego de conteo'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Reinicia la secuencia de conteo actual')
        .addIntegerOption((option) =>
          option
            .setName('start')
            .setDescription('Número desde el que se empezará después del reinicio')
            .setMinValue(1),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Muestra la clasificación del juego de conteo'),
    ),
  category: 'Fun',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Count command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Administrar servidor** para usar este comando.' });
      }

      const guildId = interaction.guildId;
      const subcommand = interaction.options.getSubcommand();
      const config = await getCountingGameConfig(interaction.client, guildId);

      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const system = interaction.options.getString('system');
        if (!channel || channel.type !== ChannelType.GuildText) {
          return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Selecciona un canal de texto para el juego de conteo.' });
        }

        if (config.enabled && config.channelId && config.channelId !== channel.id) {
          return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Este servidor ya tiene configurado un canal de conteo activo: <#${config.channelId}>. Desactiva primero el juego actual o usa ese canal.` });
        }

        await activateCountingGame(interaction.client, guildId, channel.id, system);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Juego de conteo activado',
              `El juego de conteo está activo en ${channel} con el sistema **${getCountingSystemLabel(system)}**. El conteo empieza en **1** y nadie puede publicar dos números seguidos.`,
            ),
          ],
        });
      }

      if (subcommand === 'disable') {
        if (!config.enabled) {
          return await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed('Juego de conteo desactivado', 'El juego de conteo ya está desactivado en este servidor.')],
          });
        }

        await disableCountingGame(interaction.client, guildId);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [successEmbed('Juego de conteo desactivado', 'Se desactivó el juego de conteo.')],
        });
      }

      if (subcommand === 'status') {
        const fields = [
          { name: 'Activado', value: config.enabled ? 'Sí' : 'No', inline: true },
          { name: 'Canal', value: config.channelId ? `<#${config.channelId}>` : 'Sin configurar', inline: true },
          { name: 'Sistema', value: getCountingSystemLabel(config.system), inline: true },
          { name: 'Siguiente número', value: getExpectedCountValue(config), inline: true },
          { name: 'Racha actual', value: `${config.currentStreak}`, inline: true },
          { name: 'Mejor racha', value: `${config.bestStreak || 0}`, inline: true },
          { name: 'Último participante', value: config.lastUserId ? `<@${config.lastUserId}>` : 'Nadie', inline: true },
        ];

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Estado del juego de conteo',
              description: 'Resumen del juego de conteo configurado.',
              fields,
              color: 'primary',
            }),
          ],
        });
      }

      if (subcommand === 'reset') {
        if (!config.enabled) {
          return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Primero activa el juego de conteo con `/count setup`.' });
        }

        const startNumber = interaction.options.getInteger('start') || 1;
        await resetCountingGame(interaction.client, guildId, startNumber);

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Juego de conteo reiniciado',
              `Se reinició la secuencia. Vuelve a empezar desde **${startNumber}** en <#${config.channelId}>.`,
            ),
          ],
        });
      }

      if (subcommand === 'leaderboard') {
        const leaderboard = buildCountingLeaderboard(config, interaction.guild);

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Clasificación del juego de conteo',
              description: leaderboard.length > 0 ? leaderboard.join('\n') : 'Todavía no hay números registrados.',
              color: 'primary',
            }),
          ],
        });
      }

      return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Selecciona una acción válida para el juego de conteo.' });
    } catch (error) {
      logger.error('Count command error:', error);
      return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al administrar el juego de conteo.' });
    }
  },
};
