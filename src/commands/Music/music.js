import { SlashCommandBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    skipTrack,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    shuffleQueue,
    setLoopMode,
    setVolume,
    seekTrack,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    setTwentyFourSeven,
    leaveVoiceChannel,
    replyMusicSuccess,
} from '../../services/music/musicActions.js';
import { deferMusicCommand } from '../../services/music/prefixSupport.js';

export default {
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Administra la reproducción, la cola y los ajustes de la sesión de voz')
        .addSubcommand((sub) =>
            sub.setName('pause').setDescription('Pausa la reproducción'),
        )
        .addSubcommand((sub) =>
            sub.setName('resume').setDescription('Reanuda la reproducción'),
        )
        .addSubcommand((sub) =>
            sub.setName('skip').setDescription('Salta la canción actual'),
        )
        .addSubcommand((sub) =>
            sub.setName('stop').setDescription('Detén la reproducción y vacía la cola'),
        )
        .addSubcommand((sub) =>
            sub.setName('shuffle').setDescription('Mezcla el orden de la cola'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('loop')
                .setDescription('Configura el modo de repetición')
                .addStringOption((opt) =>
                    opt
                        .setName('mode')
                        .setDescription('Modo de repetición')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Desactivado', value: 'none' },
                            { name: 'Canción', value: 'track' },
                            { name: 'Cola', value: 'queue' },
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('volume')
                .setDescription('Ajusta el volumen de reproducción')
                .addIntegerOption((opt) =>
                    opt.setName('level').setDescription('Volumen (0-100)').setRequired(true).setMinValue(0).setMaxValue(100),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('seek')
                .setDescription('Salta a una posición de la canción actual')
                .addIntegerOption((opt) =>
                    opt.setName('seconds').setDescription('Posición en segundos').setRequired(true).setMinValue(0),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Quita una canción de la cola')
                .addIntegerOption((opt) =>
                    opt.setName('position').setDescription('Posición en la cola').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('move')
                .setDescription('Mueve una canción dentro de la cola')
                .addIntegerOption((opt) =>
                    opt.setName('from').setDescription('Posición actual').setRequired(true).setMinValue(1),
                )
                .addIntegerOption((opt) =>
                    opt.setName('to').setDescription('Nueva posición').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub.setName('clear').setDescription('Vacía la cola'),
        )
        .addSubcommand((sub) =>
            sub.setName('leave').setDescription('Desconecta al bot del canal de voz'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('247')
                .setDescription('Activa o desactiva el modo 24/7 (permanece en el canal de voz cuando está inactivo)')
                .addBooleanOption((opt) =>
                    opt.setName('enabled').setDescription('Activa o desactiva el modo 24/7').setRequired(true),
                ),
        ),

    async execute(interaction, config, client) {
        await deferMusicCommand(interaction);
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'pause': {
                const embed = await pausePlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'resume': {
                const embed = await resumePlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'skip': {
                const embed = await skipTrack(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'stop': {
                const embed = await stopPlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'shuffle': {
                const embed = await shuffleQueue(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'loop': {
                const embed = await setLoopMode(client, interaction, interaction.options.getString('mode'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'volume': {
                const embed = await setVolume(client, interaction, interaction.options.getInteger('level'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'seek': {
                const embed = await seekTrack(client, interaction, interaction.options.getInteger('seconds'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'remove': {
                const embed = await removeFromQueue(client, interaction, interaction.options.getInteger('position'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'move': {
                const embed = await moveInQueue(
                    client,
                    interaction,
                    interaction.options.getInteger('from'),
                    interaction.options.getInteger('to'),
                );
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'clear': {
                const embed = await clearQueue(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'leave': {
                const embed = await leaveVoiceChannel(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case '247': {
                const embed = await setTwentyFourSeven(client, interaction, interaction.options.getBoolean('enabled'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            default:
                await InteractionHelper.safeEditReply(interaction, {
                    content: 'Subcomando de música desconocido.',
                });
        }
    },
};
