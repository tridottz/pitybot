import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { infoEmbed, successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { verifyUser } from '../../services/verificationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verifícate para obtener acceso al servidor'),

    async execute(interaction, config, client) {
        const guild = interaction.guild;

        const result = await verifyUser(client, guild.id, interaction.user.id, {
            source: 'command_self',
            moderatorId: null
        });

        if (result.status === 'already_verified') {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [infoEmbed('Ya estás verificado', "Ya tienes la verificación." )],
                flags: MessageFlags.Ephemeral
            });
        }

        await InteractionHelper.safeReply(interaction, {
            embeds: [successEmbed(
                "Verificación completada",
                `Tu cuenta está verificada y recibiste el rol **${result.roleName}**. ¡Te damos la bienvenida al servidor! 🎉`
            )],
            flags: MessageFlags.Ephemeral
        });
    }
};
