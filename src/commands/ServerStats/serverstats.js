import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { handleCreate } from './modules/serverstats_create.js';
import { handleList } from './modules/serverstats_list.js';
import { handleUpdate } from './modules/serverstats_update.js';
import { handleDelete } from './modules/serverstats_delete.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("serverstats")
        .setDescription("Administra las estadísticas del servidor, como la cantidad de miembros y los datos de canales")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Crea un canal de seguimiento de estadísticas dentro de una categoría")
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Tipo de estadística que quieres seguir")
                        .setRequired(true)
                        .addChoices(
                            { name: "Miembros y bots", value: "members" },
                            { name: "Solo miembros", value: "members_only" },
                            { name: "Solo bots", value: "bots" }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("channel_type")
                        .setDescription("Tipo de canal que se creará para este seguimiento")
                        .setRequired(true)
                        .addChoices(
                            { name: "Canal de voz (recomendado)", value: "voice" },
                            { name: "Canal de texto", value: "text" }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName("category")
                        .setDescription("Categoría donde se creará el canal de seguimiento de estadísticas")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Muestra todos los seguimientos de estadísticas de este servidor")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("update")
                .setDescription("Actualiza un seguimiento de estadísticas existente")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("ID del seguimiento que quieres actualizar")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Nuevo tipo de seguimiento")
                        .setRequired(false)
                        .addChoices(
                            { name: "Miembros y bots", value: "members" },
                            { name: "Solo miembros", value: "members_only" },
                            { name: "Solo bots", value: "bots" }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Elimina un seguimiento de estadísticas existente")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("ID del seguimiento que quieres eliminar")
                        .setRequired(true)
                )
        ),

    async execute(interaction, guildConfig, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case "create":
                await handleCreate(interaction, client);
                break;
            case "list":
                await handleList(interaction, client);
                break;
            case "update":
                await handleUpdate(interaction, client);
                break;
            case "delete":
                await handleDelete(interaction, client);
                break;
            default:
                await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Subcomando desconocido.' });
        }
    }
};
