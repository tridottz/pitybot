import { successEmbed } from '../../../utils/embeds.js';

import ConfigService from '../../../services/config/configService.js';
import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';

function extractId(value) {
    if (!value || typeof value !== 'string') return null;

    const channelMention = value.match(/^<#(\d+)>$/);
    if (channelMention) return channelMention[1];

    const roleMention = value.match(/^<@&(\d+)>$/);
    if (roleMention) return roleMention[1];

    const digits = value.match(/^(\d{17,19})$/);
    if (digits) return digits[1];

    return null;
}

function parseValue(key, rawValue) {
    const value = rawValue.trim();

    if (['modRole', 'adminRole', 'autoRole', 'logChannelId'].includes(key)) {
        if (value.toLowerCase() === 'none') {
            return null;
        }
        const id = extractId(value);
        if (!id) {
            throw new Error('Proporciona una mención o un ID válidos.');
        }
        return id;
    }

    if (key === 'dmOnClose') {
        if (['yes', 'true', 'enabled', 'enable'].includes(value.toLowerCase())) {
            return true;
        }
        if (['no', 'false', 'disabled', 'disable'].includes(value.toLowerCase())) {
            return false;
        }
        throw new Error('Escribe yes o no.');
    }

    if (key === 'prefix') {
        if (value.length < 1 || value.length > 10 || /\s/.test(value)) {
            throw new Error('El prefijo debe tener entre 1 y 10 caracteres y no incluir espacios.');
        }
        return value;
    }

    return value;
}

function resolveModalValue(key, interaction) {
    if (key === 'logChannelId') {
        const channelId = interaction.fields.getField('log_channel')?.values?.[0];
        if (!channelId) {
            throw new Error('Selecciona un canal de registros.');
        }
        return channelId;
    }

    if (key === 'modRole') {
        const roleId = interaction.fields.getField('mod_role')?.values?.[0];
        if (!roleId) {
            throw new Error('Selecciona un rol de moderación.');
        }
        return roleId;
    }

    const rawValue = interaction.fields.getTextInputValue('value');
    return parseValue(key, rawValue);
}

function buildSuccessMessage(key, value, guild) {
    if (key === 'logChannelId') {
        const channel = guild?.channels?.cache?.get(value);
        return `El canal de registros se estableció en ${channel ?? `<#${value}>`}.`;
    }

    if (key === 'modRole') {
        const role = guild?.roles?.cache?.get(value);
        return `El rol de moderación se estableció en ${role ?? `<@&${value}>`}.`;
    }

    return `El ajuste \`${key}\` se actualizó correctamente.`;
}

export default {
    name: 'config_modal',
    async execute(interaction) {
        const [key, guildId] = interaction.customId.split(':').slice(1);

        try {
            const value = resolveModalValue(key, interaction);
            await ConfigService.updateSetting(interaction.client, guildId, key, value, interaction.user.id);

            await interaction.reply({
                embeds: [successEmbed('Configuración actualizada', buildSuccessMessage(key, value, interaction.guild))],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('Config modal handler error:', error);
            await replyUserError(interaction, { type: ErrorTypes.CONFIGURATION, message: error.message || 'Inténtalo de nuevo.' });
        }
    },
};
