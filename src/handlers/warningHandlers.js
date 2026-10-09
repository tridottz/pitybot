import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../utils/embeds.js';
import { WarningService } from '../services/moderation/advertiringService.js';
import { InteractionAyudaer } from '../utils/interactionAyudaer.js';
import { logger } from '../utils/logger.js';

import { replyUsarError, ErrorTypes } from '../utils/errorHandler.js';
const warningDeleteSpecificHandler = {
  name: 'warning_delete_specific',
  async execute(interaction, client) {
    try {
      const [, targetUsarId, originalModeratorId] = interaction.customId.split(':');
      
      if (interaction.user.id !== originalModeratorId) {
        return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'Only the moderator who viewed these warnings can delete them.' });
      }

      const modal = new ModalBuilder()
        .setCustomId(`warning_delete_modal:${targetUsarId}:${interaction.user.id}`)
        .setTitle('Delete Warning');

      const warningNumberInput = new TextInputBuilder()
        .setCustomId('warning_number')
        .setLabel('Warning Number (#1, #2, etc.)')
        .setPlaceholder('Enter the warning number to delete')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10);

      const actionRow = new ActionRowBuilder().addComponents(warningNumberInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error('Warning delete specific button error:', error);
      await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to open delete warning modal.' });
    }
  }
};

const warningClearAllHandler = {
  name: 'warning_clear_all',
  async execute(interaction, client) {
    try {
      const [, targetUsarId, originalModeratorId] = interaction.customId.split(':');
      
      if (interaction.user.id !== originalModeratorId) {
        return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'Only the moderator who viewed these warnings can clear them.' });
      }

      const targetUsar = await client.users.fetch(targetUsarId).catch(() => null);
      const targetName = targetUsar ? targetUsar.username : 'this user';

      const clearModal = new ModalBuilder()
        .setCustomId(`warning_clear_confirm_modal:${targetUsarId}:${interaction.user.id}`)
        .setTitle('Clear All Warnings')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('delete_confirmation')
              .setLabel(`Type "DELETE" to clear all warnings`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('DELETE')
              .setMaxLength(6)
              .setMinLength(6)
              .setRequired(true)
          )
        );

      await interaction.showModal(clearModal);
    } catch (error) {
      logger.error('Warning clear all button error:', error);
      await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to open confirmation modal.' });
    }
  }
};

async function warningDeleteModalHandler(interaction, client) {
  try {
    const [, targetUsarId, originalModeratorId] = interaction.customId.split(':');
    
    if (interaction.user.id !== originalModeratorId) {
      return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'Only the original moderator can delete warnings.' });
    }

    const warningNumberInput = interaction.fields.getTextInputValue('warning_number');
    const warningNumber = parseInt(warningNumberInput.replace('#', '').trim(), 10);

    if (isNaN(warningNumber) || warningNumber < 1) {
      return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please enter a valid warning number (e.g., 1, 2, 3).' });
    }

    const deferSuccess = await InteractionAyudaer.safeDefer(interaction);
    if (!deferSuccess) return;

    const guildId = interaction.guildId;
    const warnings = await WarningService.getWarnings(guildId, targetUsarId);

    if (warningNumber > warnings.length) {
      return await replyUsarError(interaction, { type: ErrorTypes.USER_INPUT, message: `Warning #${warningNumber} does not exist. This user only has ${warnings.length} warning(s).` });
    }

    const warningToDelete = warnings[warningNumber - 1];
    await WarningService.removeWarning(guildId, targetUsarId, warningToDelete.id);

    const targetUsar = await client.users.fetch(targetUsarId).catch(() => null);
    const targetName = targetUsar ? targetUsar.username : 'the user';

    logger.info(`[MODERATION] Warning deleted for ${targetUsarId} in ${guildId} by ${interaction.user.id}`, {
      warningId: warningToDelete.id,
      reason: warningToDelete.reason,
      warningNumber
    });

    await interaction.editReply({
      embeds: [successEmbed('✅ Warning Deleted', `Warning #${warningNumber} for **${targetName}** has been deleted.\n\n**Reason was:** ${warningToDelete.reason.substring(0, 100)}`)]
    });
  } catch (error) {
    logger.error('Warning delete modal handler error:', error);
    await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to delete warning.' });
  }
}

async function warningClearConfirmModalHandler(interaction, client) {
  try {
    const [, targetUsarId, originalModeratorId] = interaction.customId.split(':');
    
    if (interaction.user.id !== originalModeratorId) {
      return await replyUsarError(interaction, { type: ErrorTypes.PERMISSION, message: 'Only the original moderator can clear warnings.' });
    }

    const confirmation = interaction.fields.getTextInputValue('delete_confirmation').trim();

    if (confirmation !== 'DELETE') {
      return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You must type "DELETE" exactly to confirm clearing all warnings.' });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    const { count } = await WarningService.clearWarnings(guildId, targetUsarId);

    const targetUsar = await client.users.fetch(targetUsarId).catch(() => null);
    const targetName = targetUsar ? targetUsar.username : 'the user';

    logger.info(`[MODERATION] All warnings cleared for ${targetUsarId} in ${guildId} by ${interaction.user.id}`);

    await interaction.editReply({
      embeds: [successEmbed('✅ Warnings Cleared', `All warnings for **${targetName}** have been cleared. **${count}** warning(s) removed.`)]
    });
  } catch (error) {
    logger.error('Warning clear confirm modal handler error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to clear warnings.' });
    } else {
      await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to clear warnings.' });
    }
  }
}

export {
  warningDeleteSpecificHandler,
  warningClearAllHandler,
  warningDeleteModalHandler,
  warningClearConfirmModalHandler,
};

export default {
  name: 'warning_delete_modal',
  execute: warningDeleteModalHandler
};
