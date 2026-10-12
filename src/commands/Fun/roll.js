import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Lanza dados con la notación habitual (por ejemplo, 2d20 o 1d6 + 5).")
    .addStringOption((option) =>
      option
        .setName("notation")
        .setDescription("Notación de los dados (por ejemplo, 2d6 o 1d20 + 4)")
        .setRequired(true)
        .setMaxLength(50),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const notation = interaction.options
      .getString("notation")
      .toLowerCase()
      .replace(/\s/g, "");

    const match = notation.match(/^(\d*)d(\d+)([\+\-]\d+)?$/);

    if (!match) {
      throw new TitanBotError(
        `Invalid dice notation: ${notation}`,
        ErrorTypes.USER_INPUT,
        'La notación no es válida. Usa un formato como `1d20` o `3d6+5`.'
      );
    }

    const numDice = parseInt(match[1] || "1", 10);
    const numSides = parseInt(match[2], 10);
    const modifier = parseInt(match[3] || "0", 10);

    if (numDice < 1 || numDice > 20) {
      throw new TitanBotError(
        `Too many dice requested: ${numDice}`,
        ErrorTypes.VALIDATION,
        'Usa entre 1 y 20 dados.'
      );
    }

    if (numSides < 1 || numSides > 1000) {
      throw new TitanBotError(
        `Invalid number of sides: ${numSides}`,
        ErrorTypes.VALIDATION,
        'Usa dados con entre 1 y 1000 caras.'
      );
    }

    let rolls = [];
    let totalRoll = 0;

    for (let i = 0; i < numDice; i++) {
      const roll = Math.floor(Math.random() * numSides) + 1;
      rolls.push(roll);
      totalRoll += roll;
    }

    const finalTotal = totalRoll + modifier;

    const resultsDetail =
      numDice > 1 ? `**Tiradas:** ${rolls.join(" + ")}\n` : "";
    const modifierText = modifier !== 0 ? `+ (${modifier})` : "";

    const embed = successEmbed(
      `🎲 Tirada de ${numDice}d${numSides}${modifier !== 0 ? match[3] : ""}`,
      `${resultsDetail}**Total de las tiradas:** ${totalRoll}${modifierText} = **${finalTotal}**`,
    );

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Roll command executed by user ${interaction.user.id} with notation ${notation} in guild ${interaction.guildId}`);
  },
};