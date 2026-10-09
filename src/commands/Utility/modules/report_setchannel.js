import { PermissionsBitField } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { setLogChannel } from '../../../services/registrosService.js';
import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';
import { logger } from '../../../utils/logger.js';

import { replyUsarError, ErrorTypes } from '../../../utils/errorHandler.js';
export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permissions to set the report channel.' });
        }

        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        try {
            await setLogChannel(client, guildId, 'reports', channel.id);

            return InteractionAyudaer.safeReply(interaction, {
                embeds: [successEmbed(
                    'Report Channel Set',
                    `All new reports will now be sent to ${channel}.\nYou can also manage this from \`/registros dashboard\`.`,
                )],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('report_setchannel error:', error);
            return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Could not save the channel configuration.' });
        }
    },
};
