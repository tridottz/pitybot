import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import {
  getCountingGameConfig,
  activateCountingGame,
  disableCountingGame,
  resetCountingGame,
  buildCountingLeaderboard,
  getCountingSystemChoices,
  getCountingSystemLabel,
  getExpectedCountValue,
} from '../../services/contaringGameService.js';
import { logger } from '../../utils/logger.js';

import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
  data: new SlashCommandBuilder()
    .setName('contar')
    .setDescription('Administra el juego de contar del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Inicia el juego de contar en un canal de texto')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('El canal donde se jugará a contar')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('system')
            .setDescription('El sistema de conteo que se utilizará')
            .setRequired(true)
            .addChoices(...getCountingSystemChoices()),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Desactiva el juego de contar en este servidor'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Muestra el estado actual del juego de contar'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Reinicia la secuencia de conteo actual')
        .addIntegerOption((option) =>
          option
            .setName('start')
            .setDescription('El número desde el que se comenzará después de reiniciar')
            .setMinValue(1),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Muestra la clasificación del juego de contar'),
    ),
  category: 'Fun',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionAyudaer.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Count command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the **Manage Server** permission to use this command.' });
      }

      const guildId = interaction.guildId;
      const subcommand = interaction.options.getSubcommand();
      const config = await getCountingGameConfig(interaction.client, guildId);

      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const system = interaction.options.getString('system');
        if (!channel || channel.type !== ChannelType.GuildText) {
          return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please choose a text channel for the counting game.' });
        }

        if (config.enabled && config.channelId && config.channelId !== channel.id) {
          return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: `This server already has an active counting channel configured: <#${config.channelId}>. Disable the current counting game first, or use that existing channel.` });
        }

        await activateCountingGame(interaction.client, guildId, channel.id, system);
        return await InteractionAyudaer.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Counting Game Enabled',
              `The counting game is now active in ${channel} using the **${getCountingSystemLabel(system)}** system. Players must count up from **1** and may not post two numbers in a row.`,
            ),
          ],
        });
      }

      if (subcommand === 'disable') {
        if (!config.enabled) {
          return await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [infoEmbed('Counting Game Disabled', 'The counting game is already disabled for this server.')],
          });
        }

        await disableCountingGame(interaction.client, guildId);
        return await InteractionAyudaer.safeEditReply(interaction, {
          embeds: [successEmbed('Counting Game Disabled', 'The counting game has been disabled.')],
        });
      }

      if (subcommand === 'status') {
        const fields = [
          { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not configured', inline: true },
          { name: 'System', value: getCountingSystemLabel(config.system), inline: true },
          { name: 'Next count', value: getExpectedCountValue(config), inline: true },
          { name: 'Current streak', value: `${config.currentStreak}`, inline: true },
          { name: 'Best streak', value: `${config.bestStreak || 0}`, inline: true },
          { name: 'Last counter', value: config.lastUsarId ? `<@${config.lastUsarId}>` : 'None', inline: true },
        ];

        return await InteractionAyudaer.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Counting Game Status',
              description: 'Overview of the currently configured counting game.',
              fields,
              color: 'primary',
            }),
          ],
        });
      }

      if (subcommand === 'reset') {
        if (!config.enabled) {
          return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Enable the counting game first with `/contar setup`.' });
        }

        const startNumber = interaction.options.getInteger('start') || 1;
        await resetCountingGame(interaction.client, guildId, startNumber);

        return await InteractionAyudaer.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Counting Game Reset',
              `The counting sequence has been reset. Start again with **${startNumber}** in <#${config.channelId}>.`,
            ),
          ],
        });
      }

      if (subcommand === 'leaderboard') {
        const leaderboard = buildCountingLeaderboard(config, interaction.guild);

        return await InteractionAyudaer.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Counting Game Leaderboard',
              description: leaderboard.length > 0 ? leaderboard.join('\n') : 'No counts have been recorded yet.',
              color: 'primary',
            }),
          ],
        });
      }

      return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please choose a valid counting game action.' });
    } catch (error) {
      logger.error('Count command error:', error);
      return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Something went wrong while managing the counting game.' });
    }
  },
};
