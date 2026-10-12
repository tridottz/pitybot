import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../utils/embeds.js';
import { WarningService } from '../services/moderation/warningService.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { logger } from '../utils/logger.js';

import { replyUserError, ErrorTypes } from '../utils/errorHandler.js';
const warningDeleteSpecificHandler = {
  name: 'warning_delete_specific',
  async execute(interaction, client) {
    try {
      const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
      
      if (interaction.user.id !== originalModeratorId) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Solo el moderador que consultó estas advertencias puede eliminarlas.' });
      }

      const modal = new ModalBuilder()
        .setCustomId(`warning_delete_modal:${targetUserId}:${interaction.user.id}`)
        .setTitle('Eliminar advertencia');

      const warningNumberInput = new TextInputBuilder()
        .setCustomId('warning_number')
        .setLabel('Número de advertencia (#1, #2, etc.)')
        .setPlaceholder('Escribe el número de la advertencia que quieres eliminar')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10);

      const actionRow = new ActionRowBuilder().addComponents(warningNumberInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error('Warning delete specific button error:', error);
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo abrir el formulario para eliminar la advertencia.' });
    }
  }
};

const warningClearAllHandler = {
  name: 'warning_clear_all',
  async execute(interaction, client) {
    try {
      const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
      
      if (interaction.user.id !== originalModeratorId) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Solo el moderador que consultó estas advertencias puede borrarlas.' });
      }

      const targetUser = await client.users.fetch(targetUserId).catch(() => null);
      const targetName = targetUser ? targetUser.username : 'this user';

      const clearModal = new ModalBuilder()
        .setCustomId(`warning_clear_confirm_modal:${targetUserId}:${interaction.user.id}`)
        .setTitle('Borrar todas las advertencias')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('delete_confirmation')
              .setLabel(`Escribe "DELETE" para borrar todas las advertencias`)
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
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo abrir el formulario de confirmación.' });
    }
  }
};

async function warningDeleteModalHandler(interaction, client) {
  try {
    const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
    
    if (interaction.user.id !== originalModeratorId) {
      return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Solo el moderador original puede eliminar advertencias.' });
    }

    const warningNumberInput = interaction.fields.getTextInputValue('warning_number');
    const warningNumber = parseInt(warningNumberInput.replace('#', '').trim(), 10);

    if (isNaN(warningNumber) || warningNumber < 1) {
      return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Escribe un número de advertencia válido (por ejemplo: 1, 2, 3).' });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const guildId = interaction.guildId;
    const warnings = await WarningService.getWarnings(guildId, targetUserId);

    if (warningNumber > warnings.length) {
      return await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `La advertencia n.º ${warningNumber} no existe. Este usuario solo tiene ${warnings.length} advertencia(s).` });
    }

    const warningToDelete = warnings[warningNumber - 1];
    await WarningService.removeWarning(guildId, targetUserId, warningToDelete.id);

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    const targetName = targetUser ? targetUser.username : 'the user';

    logger.info(`[MODERATION] Warning deleted for ${targetUserId} in ${guildId} by ${interaction.user.id}`, {
      warningId: warningToDelete.id,
      reason: warningToDelete.reason,
      warningNumber
    });

    await interaction.editReply({
      embeds: [successEmbed('✅ Advertencia eliminada', `Se eliminó la advertencia n.º ${warningNumber} de **${targetName}**.\n\n**Motivo:** ${warningToDelete.reason.substring(0, 100)}`)]
    });
  } catch (error) {
    logger.error('Warning delete modal handler error:', error);
    await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo eliminar la advertencia.' });
  }
}

async function warningClearConfirmModalHandler(interaction, client) {
  try {
    const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
    
    if (interaction.user.id !== originalModeratorId) {
      return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Solo el moderador original puede borrar las advertencias.' });
    }

    const confirmation = interaction.fields.getTextInputValue('delete_confirmation').trim();

    if (confirmation !== 'DELETE') {
      return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Debes escribir exactamente "DELETE" para confirmar que quieres borrar todas las advertencias.' });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    const { count } = await WarningService.clearWarnings(guildId, targetUserId);

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    const targetName = targetUser ? targetUser.username : 'the user';

    logger.info(`[MODERATION] All warnings cleared for ${targetUserId} in ${guildId} by ${interaction.user.id}`);

    await interaction.editReply({
      embeds: [successEmbed('✅ Advertencias borradas', `Se borraron todas las advertencias de **${targetName}**. Se quitaron **${count}** advertencia(s).`)]
    });
  } catch (error) {
    logger.error('Warning clear confirm modal handler error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudieron borrar las advertencias.' });
    } else {
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudieron borrar las advertencias.' });
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
