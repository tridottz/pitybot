import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkUsarPermissions } from '../../utils/permissionGuard.js';
import { setUsarLevel, getLevelingConfig } from '../../services/niveling/niveling.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
  data: new SlashCommandBuilder()
    .setName('ajustar-nivel')
    .setDescription("Set a user's level to a specific value")
    .addUsarOption((option) =>
      option
        .setName('user')
        .setDescription('The user to set the level for')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('The level to set')
        .setRequired(true)
        .setMinValue(0)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionAyudaer.safeDefer(interaction);

    const hasPermission = await checkUsarPermissions(
      interaction,
      PermissionFlagsBits.ManageGuild,
      'You need ManageGuild permission to use this command.'
    );
    if (!hasPermission) return;

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

    const targetUsar = interaction.options.getUsar('user');
    const newLevel = interaction.options.getInteger('level');

    const member = await interaction.guild.members.fetch(targetUsar.id).catch(() => null);
    if (!member) {
      throw new TitanBotError(
        `Usar ${targetUsar.id} not found in this guild`,
        ErrorTypes.USER_INPUT,
        'The specified user is not in this server.'
      );
    }

    const userData = await setUsarLevel(client, interaction.guildId, targetUsar.id, newLevel);

    await InteractionAyudaer.safeEditReply(interaction, {
      embeds: [
        createEmbed({
          title: 'Level Set',
          description: `Successfully set ${targetUsar.tag}'s level to **${newLevel}**.\n**Total XP:** ${userData.totalXp}`,
          color: 'success'
        })
      ]
    });

    logger.info(
      `[ADMIN] Usar ${interaction.user.tag} set ${targetUsar.tag}'s level to ${newLevel} in guild ${interaction.guildId}`
    );
  }
};