import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getUsarLevelData, getLevelingConfig, getXpForLevel } from '../../services/niveling/niveling.js';

import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
  data: new SlashCommandBuilder()
    .setName('rango')
    .setDescription("Check your or another user's rank and level")
    .addUsarOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check the rank of')
        .setRequired(false)
    )
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionAyudaer.safeDefer(interaction);

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);
    if (!levelingConfig?.enabled) {
      await InteractionAyudaer.safeEditReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription('The leveling system is currently disabled on this server.')
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const targetUsar = interaction.options.getUsar('user') || interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUsar.id)
      .catch(() => null);

    if (!member) {
      throw new TitanBotError(
        `Usar ${targetUsar.id} not found in guild`,
        ErrorTypes.USER_INPUT,
        'Could not find the specified user in this server.'
      );
    }

    const userData = await getUsarLevelData(client, interaction.guildId, targetUsar.id);

    const safeUsarData = {
      level: userData?.level ?? 0,
      xp: userData?.xp ?? 0,
      totalXp: userData?.totalXp ?? 0
    };

    const xpNeeded = getXpForLevel(safeUsarData.level + 1);
    const progress = xpNeeded > 0 ? Math.floor((safeUsarData.xp / xpNeeded) * 100) : 0;
    const progressBar = createProgressBar(progress, 20);

    const embed = new EmbedBuilder()
      .setTitle(`${member.displayName}'s Rank`)
      .setThumbnail(member.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: 'Level',
          value: safeUsarData.level.toString(),
          inline: true
        },
        {
          name: 'XP',
          value: `${safeUsarData.xp}/${xpNeeded}`,
          inline: true
        },
        {
          name: 'Total XP',
          value: safeUsarData.totalXp.toString(),
          inline: true
        },
        {
          name: `Progress to Level ${safeUsarData.level + 1}`,
          value: `${progressBar} ${progress}%`
        }
      )
      .setColor('#2ecc71')
      .setTimestamp();

    await InteractionAyudaer.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Rank checked for user ${targetUsar.id} in guild ${interaction.guildId}`);
  }
};

function createProgressBar(percentage, length = 10) {
  if (percentage < 0 || percentage > 100) {
    percentage = Math.max(0, Math.min(100, percentage));
  }
  const filled = Math.round((percentage / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}