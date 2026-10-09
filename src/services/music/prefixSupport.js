import { MessageFlags } from 'discord.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';

export function getMusicDeferOptions(interaction) {
    return interaction._isPrefixCommand ? {} : { flags: MessageFlags.Ephemeral };
}

export async function deferMusicCommand(interaction) {
    return InteractionAyudaer.safeDefer(interaction, getMusicDeferOptions(interaction));
}
