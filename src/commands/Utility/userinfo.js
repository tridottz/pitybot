import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
export default {
    data: new SlashCommandBuilder()
    .setName("info-usuario")
    .setDescription("Muestra información detallada de un usuario")
    .addUsarOption((option) =>
      option
        .setName("target")
        .setDescription("El usuario que quieres consultar (por defecto, tú)"),
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionAyudaer.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn(`UsarInfo interaction defer failed`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'userinfo'
      });
      return;
    }

    const user = interaction.options.getUsar("target") || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const createdTimestamp = Math.floor(user.createdAt.getTime() / 1000);
    const joinedTimestamp = member?.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;

    const embed = createEmbed({ title: `Usar Info: ${user.username}` })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
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
          name: "Joined Server",
          value: joinedTimestamp ? `<t:${joinedTimestamp}:R>` : "Not in server",
          inline: false,
        },
        {
          name: "Highest Role",
          value: member?.roles?.highest?.name || "None",
          inline: true,
        },
      );

    await InteractionAyudaer.safeEditReply(interaction, { embeds: [embed] });
    logger.info(`UsarInfo command executed`, {
      userId: interaction.user.id,
      targetUsarId: user.id,
      guildId: interaction.guildId
    });
  },
};