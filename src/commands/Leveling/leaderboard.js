import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getLeaderboard, getLevelingConfig, getXpForLevel } from '../../services/leveling/leveling.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription("Muestra la clasificación de niveles del servidor")
    .setDMPermission(false),
  category: 'Niveles',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);

    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription('El sistema de niveles está desactivado en este servidor.')
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const leaderboard = await getLeaderboard(client, interaction.guildId, 10);

    if (leaderboard.length === 0) {
      throw new TitanBotError(
        'No leaderboard data found',
        ErrorTypes.DATABASE,
        'Aún no hay datos de nivel. ¡Participa en el chat para ganar XP!'
      );
    }

    const embed = new EmbedBuilder()
      .setTitle('Clasificación de niveles')
      .setColor('#2ecc71')
      .setDescription("Los 10 miembros más activos de este servidor:")
      .setTimestamp();

    const leaderboardText = await Promise.all(
      leaderboard.map(async (user, index) => {
        try {
          const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
          const userMention = member?.user.toString() || `<@${user.userId}>`;
          const xpForNextLevel = getXpForLevel(user.level + 1);

          let rankPrefix = `${index + 1}.`;
          if (index === 0) rankPrefix = '🥇';
          else if (index === 1) rankPrefix = '🥈';
          else if (index === 2) rankPrefix = '🥉';
          else rankPrefix = `**${index + 1}.**`;

          return `${rankPrefix} ${userMention} - Level ${user.level} (${user.xp}/${xpForNextLevel} XP)`;
        } catch {
          return `**${index + 1}.** Error loading user ${user.userId}`;
        }
      })
    );

    embed.addFields({
      name: 'Rankings',
      value: leaderboardText.join('\n')
    });

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Leaderboard displayed for guild ${interaction.guildId}`);
  }
};