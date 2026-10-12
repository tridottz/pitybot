import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Envía un mensaje privado a un usuario (solo para el equipo de moderación)")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Usuario al que quieres enviar un mensaje privado")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Mensaje que quieres enviar")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("anonymous")
                .setDescription("Enviar el mensaje de forma anónima (predeterminado: no)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`DM interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm'
            });
            return;
        }

    const targetUser = interaction.options.getUser("user");
        const message = interaction.options.getString("message");
        const anonymous = interaction.options.getBoolean("anonymous") || false;

        try {
            
            if (message.length > 2000) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'El mensaje debe tener menos de 2000 caracteres.' });
            }

            if (targetUser.bot) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No puedes enviar mensajes privados a cuentas de bots.' });
            }

            const sanitized = sanitizeMarkdown(message);

            const dmChannel = await targetUser.createDM();
            
            await dmChannel.send({
                embeds: [
                    successEmbed(
                        anonymous ? "Message from the Staff Team" : `Message from ${interaction.user.tag}`,
                        sanitized
                    ).setFooter({
                        text: `No puedes responder a este mensaje. | ID del registro: ${interaction.id}`
                    })
                ]
            });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: "DM Sent",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonymous: ${anonymous ? 'Yes' : 'No'}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        messageLength: sanitized.length
                    }
                }
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "DM Sent",
                        `Se envió un mensaje a ${targetUser.tag}`
                    ),
                ],
            });
        } catch (error) {
            logger.error('DM command error:', error);
            
if (error.code === 50007) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `No se pudo enviar un mensaje privado a ${targetUser.tag}. Es posible que tenga desactivados los mensajes directos.` });
            }
            
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `No se pudo enviar el mensaje privado: ${error.message}` });
        }
    }
};
