import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, warningEmbed } from '../../utils/embeds.js';
import { getConfirmationButtons } from '../../utils/components.js';
import { logger } from '../../utils/logger.js';

import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('borrar-datos')
        .setDescription('Elimina todos tus datos personales del bot (acción irreversible)'),

    async execute(interaction, guildConfig, client) {
        const warningMessage = 
            `⚠️ **THIS ACTION IS IRREVERSIBLE!** ⚠️\n\n` +
            `This will permanently delete **ALL** your data from this server including:\n` +
            `• 💰 Economy balance (wallet & bank)\n` +
            `• 📊 Levels and XP\n` +
            `• 🎒 Inventory items\n` +
            `• 🛍️ Shop purchases\n` +
            `• 🎂 Birthday information\n` +
            `• 🔢 Counter data\n` +
            `• 📋 All other personal data\n\n` +
            `**This cannot be undone. Are you absolutely sure?**`;

        const embed = warningEmbed('Wipe All Data', warningMessage);

        const confirmButtons = getConfirmationButtons('wipedata');

        await InteractionAyudaer.safeReply(interaction, {
            embeds: [embed],
            components: [confirmButtons],
            flags: MessageFlags.Ephemeral
        });

        logger.info(`Wipedata command executed - confirmation prompt shown`, {
            userId: interaction.user.id,
            guildId: interaction.guildId
        });
    }
};