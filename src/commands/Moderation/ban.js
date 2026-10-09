import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("banear")
        .setDescription("Expulsa permanentemente a un usuario del servidor")
        .addUsarOption((option) =>
            option
                .setName("target")
                .setDescription("El usuario que quieres banear")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Motivo del baneo"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const user = interaction.options.getUsar("target");
        const reason = interaction.options.getString("reason") || "No se proporcionó un motivo";

        if (!user) {
            throw new TitanBotError(
                'Falta el usuario de destino',
                ErrorTypes.USER_INPUT,
                'Debes especificar a un usuario para banearlo.',
                { subtype: 'invalid_user' },
            );
        }

        if (user.id === interaction.user.id) {
            throw new TitanBotError(
                'No puedes banearte a ti mismo',
                ErrorTypes.VALIDATION,
                'No puedes banearte a ti mismo.',
            );
        }
        if (user.id === client.user.id) {
            throw new TitanBotError(
                'No puedes banear al bot',
                ErrorTypes.VALIDATION,
                'No puedes banear al bot.',
            );
        }

        const result = await ModerationService.banUsar({
            guild: interaction.guild,
            user,
            moderator: interaction.member,
            reason,
        });

        await InteractionAyudaer.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `🚫 **Baneado** ${user.tag}`,
                    `**Motivo:** ${reason}\n**ID del caso:** #${result.caseId}`,
                ),
            ],
        });
    },
};
