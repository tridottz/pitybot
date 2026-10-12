import { PermissionsBitField } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar servidor** para configurar el rol prémium.' });
        }

        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        try {
            const currentConfig = await getGuildConfig(client, guildId);
            currentConfig.premiumRoleId = role.id;
            await setGuildConfig(client, guildId, currentConfig);

            return InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed('Rol prémium configurado', `El **rol prémium de la tienda** ahora es ${role.toString()}. Quienes compren el artículo de rol prémium recibirán este rol.`)],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('shop_config_setrole error:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo guardar la configuración del servidor.' });
        }
    },
};
