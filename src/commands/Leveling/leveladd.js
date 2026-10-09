import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkUsarPermissions } from '../../utils/permissionGuard.js';
import { addLevels, getLevelingConfig } from '../../services/niveling/niveling.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
  data: new SlashCommandBuilder()
    .setName('sumar-nivel')
    .setDescription('Add levels to a user')
    .addUsarOption((option) =>
      option
        .setName('user')
        .setDescription('The user to add levels to')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('Number of levels to add')
        .setRequired(true)
        .setMinValue(1)
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
    const levelsToAdd = interaction.options.getInteger('levels');

    const member = await interaction.guild.members.fetch(targetUsar.id).catch(() => null);
    if (!member) {
      throw new TitanBotError(
        `Usar ${targetUsar.id} not found in this guild`,
        ErrorTypes.USER_INPUT,
        'The specified user is not in this server.'
      );
    }

    const userData = await addLevels(client, interaction.guildId, targetUsar.id, levelsToAdd);

    await InteractionAyudaer.safeEditReply(interaction, {
      embeds: [
        createEmbed({
          title: 'Levels Added',
          description: `Successfully added ${levelsToAdd} levels to ${targetUsar.tag}.\n**New Level:** ${userData.level}`,
          color: 'success'
        })
      ]
    });

    logger.info(
      `[ADMIN] Usar ${interaction.user.tag} added ${levelsToAdd} levels to ${targetUsar.tag} in guild ${interaction.guildId}`
    );
  }
};