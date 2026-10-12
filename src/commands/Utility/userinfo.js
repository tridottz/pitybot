import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("infousuario")
    .setDescription("Obtén información detallada de un usuario")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuario que quieres consultar (por defecto, tú)"),
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn(`UserInfo interaction defer failed`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'userinfo'
      });
      return;
    }

    const user = interaction.options.getUser("usuario") || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const createdTimestamp = Math.floor(user.createdAt.getTime() / 1000);
    const joinedTimestamp = member?.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;

    const embed = createEmbed({ title: `Información del usuario: ${user.username}` })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Bot", value: user.bot ? "Sí" : "No", inline: true },
        {
          name: "Roles",
          value:
            member && member.roles.cache.size > 1
              ? member.roles.cache
                  .map((r) => r.name)
                  .slice(0, 5)
                  .join(",")
              : "None",
          inline: true,
        },
        {
          name: "Account Created",
          value: `<t:${createdTimestamp}:R>`,
          inline: false,
        },
        {
          name: "Se unió al servidor",
          value: joinedTimestamp ? `<t:${joinedTimestamp}:R>` : "No está en el servidor",
          inline: false,
        },
        {
          name: "Rol más alto",
          value: member?.roles?.highest?.name || "None",
          inline: true,
        },
      );

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.info(`UserInfo command executed`, {
      userId: interaction.user.id,
      targetUserId: user.id,
      guildId: interaction.guildId
    });
  },
};
