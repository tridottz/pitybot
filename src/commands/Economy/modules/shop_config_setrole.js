import { PermissionsBitField } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionAyudaer } from '../../../utils/interactionAyudaer.js';
import { logger } from '../../../utils/logger.js';

import { replyUsarError, ErrorTypes } from '../../../utils/errorHandler.js';
export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permissions to set the premium role.' });
        }

        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        try {
            const currentConfig = await getGuildConfig(client, guildId);
            currentConfig.premiumRoleId = role.id;
            await setGuildConfig(client, guildId, currentConfig);

            return InteractionAyudaer.safeReply(interaction, {
                embeds: [successEmbed('Premium Role Set', `The **Premium Shop Role** has been set to ${role.toString()}. Members who purchase the Premium Role item will be granted this role.`)],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('shop_config_setrole error:', error);
            return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Could not save the guild configuration.' });
        }
    },
};