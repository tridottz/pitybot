import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Muestra el avatar de un usuario")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription(
          "The user whose avatar you want to see (defaults to you)",
        ),
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("target") || interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 2048, dynamic: true });

    const embed = createEmbed({ 
      title: `Avatar de ${user.username}`,
      description: `[Enlace de descarga](${avatarUrl})`
    })
      .setImage(avatarUrl);

    await InteractionHelper.safeReply(interaction, { embeds: [embed] });
    logger.info(`Avatar command executed`, {
      userId: interaction.user.id,
      targetUserId: user.id,
      guildId: interaction.guildId
    });
  }
};
