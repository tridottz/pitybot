import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage, truncateForEmbedField } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('despedida')
        .setDescription('Configura el sistema de mensajes de despedida')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('configurar')
                .setDescription('Configura el mensaje de despedida')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Canal donde se enviarán los mensajes de despedida')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('mensaje')
                        .setDescription('Mensaje de despedida. Variables disponibles: {user}, {username}, {server}, {memberCount}')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('imagen')
                        .setDescription('URL de la imagen que se incluirá en el mensaje de despedida')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('mencionar')
                        .setDescription('Indica si se debe mencionar al usuario en el mensaje de despedida')
                        .setRequired(false))),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Goodbye interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'goodbye'
            });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar servidor** para usar `/despedida`.' });
        }

        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('canal');
            const message = options.getString('mensaje');
            const image = options.getString('imagen');
            const ping = options.getBoolean('mencionar') ?? false;

            const existingConfig = await getWelcomeConfig(client, guild.id);
            if (existingConfig?.goodbyeChannelId) {
                logger.info(`[Goodbye] Setup blocked because config already exists in channel ${existingConfig.goodbyeChannelId} for guild ${guild.id}`);
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `La despedida ya está configurada en <#${existingConfig.goodbyeChannelId}>. Usa **/saludos panel** para personalizar el canal, el mensaje, la mención o la imagen.` });
            }

            if (!message || message.trim().length === 0) {
                logger.warn(`[Goodbye] Empty message provided by ${interaction.user.tag} in ${guild.name}`);
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'El mensaje de despedida no puede estar vacío' });
            }

            if (image) {
                try {
                    new URL(image);
                } catch (e) {
                    logger.warn(`[Goodbye] Invalid image URL provided by ${interaction.user.tag}: ${image}`);
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Proporciona una URL de imagen válida que comience con http:// o https://' });
                }
            }

            try {
                await updateWelcomeConfig(client, guild.id, {
                    goodbyeActivado: true,
                    goodbyeChannelId: channel.id,
                    leaveMessage: message,
                    goodbyePing: ping,
                    leaveEmbed: {
                        title: "Hasta pronto, {user.tag}",
                        description: message,
                        color: getColor('error'),
                        footer: `¡Hasta pronto, desde ${guild.name}!`,
                        ...(image && { image: { url: image } })
                    }
                });

                logger.info(`[Goodbye] Setup configured by ${interaction.user.tag} for guild ${guild.name} (${guild.id})`);

                const previewMessage = formatWelcomeMessage(message, {
                    user: interaction.user,
                    guild
                });

                const embed = new EmbedBuilder()
                    .setColor(getColor('success'))
                    .setTitle('Sistema de despedida configurado')
                    .setDescription(`Los mensajes de despedida se enviarán a ${channel}`)
                    .addFields(
                        { name: 'Vista previa del mensaje', value: truncateForEmbedField(previewMessage) },
                        { name: 'Mencionar al usuario', value: ping ? 'Sí' : 'No' },
                        { name: 'Estado', value: 'Activado' }
                    )
                    .setFooter({ text: 'Consejo: usa /saludos panel para personalizar la despedida' });

                if (image) {
                    embed.setImage(image);
                }

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                logger.error(`[Goodbye] Failed to setup goodbye system for guild ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al configurar el sistema de despedida. Inténtalo de nuevo.' });
            }
        }
    },
};
