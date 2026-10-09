import { SlashCommandBuilder, version, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
    data: new SlashCommandBuilder()
    .setName("estadisticas")
    .setDescription("Muestra las estadísticas del bot"),

  async execute(interaction) {
    try {
      await InteractionAyudaer.safeDefer(interaction);
      
      const totalGuilds = interaction.client.guilds.cache.size;
      const totalMembers = interaction.client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0,
      );
      const nodeVersion = process.version;

      const embed = createEmbed({ title: "System Statistics", description: "Real-time performance metrics." }).addFields(
        { name: "Servers", value: `${totalGuilds}`, inline: true },
        { name: "Usars", value: `${totalMembers}`, inline: true },
        { name: "Node.js", value: `${nodeVersion}`, inline: true },
        { name: "Discord.js", value: `v${version}`, inline: true },
        {
          name: "Memory Usage",
          value: `${(process.memoryUsage().heapUsad / 1024 / 1024).toFixed(2)} MB`,
          inline: true,
        },
      );

      await InteractionAyudaer.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Stats command error:', error);
      return InteractionAyudaer.safeEditReply(interaction, {
        embeds: [createEmbed({ title: 'System Error', description: 'Could not fetch system statistics.', color: 'error' })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};