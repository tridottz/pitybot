import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';

export default {
    data: new SlashCommandBuilder()
        .setName("quitar-silencio")
        .setDescription("Remove timeout from a user")
        .addUsarOption((option) =>
            option
                .setName("target")
                .setDescription("Usar to untimeout")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionAyudaer.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Untimeout interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'untimeout',
            });
            return;
        }

        const targetUsar = interaction.options.getUsar("target");
        const member = interaction.options.getMember("target");

        if (!targetUsar) {
            throw new TitanBotError(
                'Falta el usuario de destino',
                ErrorTypes.USER_INPUT,
                'You must specify a user to untimeout.',
                { subtype: 'invalid_user' },
            );
        }

        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "The target user is not currently in this server.",
            );
        }

        await ModerationService.removeTimeoutUsar({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
        });

        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `🔓 **Removed timeout** from ${targetUsar.tag}`,
                ),
            ],
        });
    },
};
