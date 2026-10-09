import { PermissionsBitField, ChannelType } from 'discord.js';
import { setLogChannel } from '../../../services/registrosService.js';
import { successEmbed } from '../../../utils/embeds.js';
import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';
import { logger } from '../../../utils/logger.js';

import { replyUsarError, ErrorTypes } from '../../../utils/errorHandler.js';
const DESTINATION_LABELS = {
  audit: 'Audit Log',
  applications: 'Applications',
  reports: 'Reports',
};

export default {
  prefixOnly: false,
  async execute(interaction, config, client) {
    try {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permissions to configure logging channels.' });
      }

      await InteractionAyudaer.safeDefer(interaction, { ephemeral: true });

      const destination = interaction.options.getString('destination');
      const channel = interaction.options.getChannel('channel');
      const disable = interaction.options.getBoolean('disable') ?? false;

      if (disable) {
        await setLogChannel(client, interaction.guildId, destination, null);
        return InteractionAyudaer.safeEditReply(interaction, {
          embeds: [successEmbed(
            'Channel Cleared',
            `The **${DESTINATION_LABELS[destination]}** channel has been removed.`,
          )],
        });
      }

      if (!channel || channel.type !== ChannelType.GuildText) {
        return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please provide a valid text channel.' });
      }

      const botPerms = channel.permissionsFor(interaction.guild.members.me);
      if (!botPerms?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: `I need **View Channel**, **Send Messages**, and **Embed Links** in ${channel}.` });
      }

      await setLogChannel(client, interaction.guildId, destination, channel.id);

      return InteractionAyudaer.safeEditReply(interaction, {
        embeds: [successEmbed(
          'Channel Updated',
          `**${DESTINATION_LABELS[destination]}** logs will be sent to ${channel}.\nUsa \`/registros dashboard\` to toggle event categories.`,
        )],
      });
    } catch (error) {
      logger.error('logging_channel error:', error);
      await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to update the log channel.' });
    }
  },
};
