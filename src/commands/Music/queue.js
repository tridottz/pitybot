import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { buildQueueReply } from '../../services/musica/musicaActions.js';

export default {
    slashOnly: true,
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('cola')
        .setDescription('Show the current music queue')
        .addIntegerOption((opt) =>
            opt.setName('page').setDescription('Page number').setMinValue(1),
        ),

    async execute(interaction, config, client) {
        await InteractionAyudaer.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        const page = (interaction.options.getInteger('page') || 1) - 1;
        const payload = buildQueueReply(client, interaction.guild.id, page);
        await InteractionAyudaer.safeEditReply(interaction, {
            embeds: payload.embeds,
            components: payload.components,
        });
    },
};
