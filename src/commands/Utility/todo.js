import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import crypto from 'crypto';

function generateShareId() {
    return crypto.randomBytes(16).toString('hex');
}

export default {
    data: new SlashCommandBuilder()
        .setName("todo")
        .setDescription("Administra tu lista personal de tareas")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Añade una tarea a tu lista")
                .addStringOption(option =>
                    option
                        .setName("task")
                        .setDescription("Tarea que quieres añadir")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Consulta tu lista de tareas")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("complete")
                .setDescription("Marca una tarea como completada")
                .addIntegerOption(option =>
                    option
                        .setName("number")
                        .setDescription("Número de la tarea que quieres completar")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Quita una tarea de tu lista")
                .addIntegerOption(option =>
                    option
                        .setName("number")
                        .setDescription("Número de la tarea que quieres quitar")
                        .setRequired(true)
                )
        )
        .addSubcommandGroup(group => 
            group
                .setName("share")
                .setDescription("Administra listas de tareas compartidas")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("create")
                        .setDescription("Crea una nueva lista de tareas compartida")
                        .addStringOption(option =>
                            option
                                .setName("name")
                                .setDescription("Nombre de la lista compartida")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("add")
                        .setDescription("Añade un miembro a una lista compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                        .addUserOption(option =>
                            option
                                .setName("user")
                                .setDescription("Usuario que quieres añadir a la lista")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("view")
                        .setDescription("Consulta una lista de tareas compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("addtask")
                        .setDescription("Añade una tarea a una lista compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName("task")
                                .setDescription("Tarea que quieres añadir")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("remove")
                        .setDescription("Quita una tarea de una lista compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option
                                .setName("number")
                                .setDescription("Número de la tarea que quieres quitar")
                                .setRequired(true)
                        )
                )
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
    category: "Utility",

    async execute(interaction, config, client) {
        const userId = interaction.user.id;
                const subcommand = interaction.options.getSubcommand();
                const shareSubcommand = interaction.options.getSubcommandGroup() === 'share' ? interaction.options.getSubcommand() : null;

        async function getOrCreateSharedList(listId, creatorId = null, listName = null) {
            const listKey = `shared_todo_${listId}`;
            let listData = await getFromDb(listKey, null);
            
            if (!listData || (listData.ok === false && listData.error)) {
                if (creatorId) {
                    listData = {
                        id: listId,
                        name: listName,
                        creatorId,
                        members: [creatorId],
                        tasks: [],
                        nextId: 1,
                        createdAt: new Date().toISOString()
                    };
                    await setInDb(listKey, listData);
                } else {
                    return null;
                }
            }
            
            if (listData) {
                if (!Array.isArray(listData.tasks)) listData.tasks = [];
                if (!listData.nextId) listData.nextId = 1;
                if (!Array.isArray(listData.members)) listData.members = [];
            }
            
            return listData;
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Todo interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'todo'
            });
            return;
        }

        if (shareSubcommand) {
            switch (shareSubcommand) {
                case 'create': {
                    const listName = interaction.options.getString('name');
                    const listId = generateShareId();

                    await getOrCreateSharedList(listId, userId, listName);

                    const userSharedLists = await getFromDb(`user_shared_lists_${userId}`, []);
                    const sharedListsArray = Array.isArray(userSharedLists) ? userSharedLists : [];
                    if (!sharedListsArray.includes(listId)) {
                        sharedListsArray.push(listId);
                        await setInDb(`user_shared_lists_${userId}`, sharedListsArray);
                    }

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Lista compartida creada",
                                `Se creó la lista compartida "${listName}" con el ID: \`${listId}\`\n` +
                                `Usa \`/todo share add list_id:${listId} user:@username\` para añadir miembros.`
                            )
                        ]
                    });
                }

                case 'add': {
                    const listId = interaction.options.getString('list_id');
                    const memberToAdd = interaction.options.getUser('user');

                    const listData = await getOrCreateSharedList(listId);
                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la lista compartida.' });
                    }

                    if (listData.creatorId !== userId) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Solo quien creó la lista puede añadir miembros.' });
                    }

                    if (!listData.members.includes(memberToAdd.id)) {
                        listData.members.push(memberToAdd.id);
                        await setInDb(`shared_todo_${listId}`, listData);

                        const memberLists = await getFromDb(`user_shared_lists_${memberToAdd.id}`, []);
                        const memberListsArray = Array.isArray(memberLists) ? memberLists : [];
                        if (!memberListsArray.includes(listId)) {
                            memberListsArray.push(listId);
                            await setInDb(`user_shared_lists_${memberToAdd.id}`, memberListsArray);
                        }

                        return await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                successEmbed('Miembro añadido', 
                                    `Se añadió a ${memberToAdd.username} a la lista compartida "${listData.name}"`
                                )
                            ]
                        });
                    } else {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Este usuario ya es miembro de la lista.' });
                    }
                }

                case 'view': {
                    const listId = interaction.options.getString('list_id');
                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la lista compartida.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No tienes acceso a esta lista.' });
                    }

                    if (listData.tasks.length === 0) {
                        const memberList = listData.members.map(memberId => {
                            const member = interaction.guild.members.cache.get(memberId);
                            return member ? member.user.username : `<@${memberId}>`;
                        }).join(',');

                        const owner = interaction.guild.members.cache.get(listData.creatorId);
                        const ownerName = owner ? owner.user.username : `<@${listData.creatorId}>`;

                        return await InteractionHelper.safeEditReply(interaction, {
                                embeds: [
                                    successEmbed(
                                        `📋 **${listData.name}**\n\n` +
                                        `👑 **Creador:** ${ownerName}\n` +
                                        `👥 **Miembros:** ${memberList}\n\n` +
                                        `*Esta lista está vacía. ¡Usa el botón "Añadir tarea" para agregar tareas!*`,
                                        `Lista compartida (ID: \`${listId}\`)`
                                    )
                                ],
                                components: [
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`shared_todo_add_${listId}`)
                                            .setLabel('Añadir tarea')
                                            .setStyle(ButtonStyle.Primary),
                                        new ButtonBuilder()
                                            .setCustomId(`shared_todo_complete_${listId}`)
                                            .setLabel('Completar tarea')
                                            .setStyle(ButtonStyle.Success),
                                        new ButtonBuilder()
                                            .setCustomId(`shared_todo_remove_${listId}`)
                                            .setLabel('Quitar tarea')
                                            .setStyle(ButtonStyle.Danger)
                                    )
                                ]
                            });
                    }

                    const taskList = listData.tasks
                        .map(task => 
                            `${task.completed ? '✅' : '📝'} #${task.id} ${task.text}` +
                            `\`[${new Date(task.createdAt).toLocaleDateString()}]` +
                            (task.completed ? `• Completada por ${task.completedBy}` : '') + '`'
                        )
                        .join('\n');

                    const memberList = listData.members.map(memberId => {
                        const member = interaction.guild.members.cache.get(memberId);
                        return member ? member.user.username : `<@${memberId}>`;
                    }).join(',');

                    const owner = interaction.guild.members.cache.get(listData.creatorId);
                    const ownerName = owner ? owner.user.username : `<@${listData.creatorId}>`;

                    const fullListDisplay = `📋 **${listData.name}**\n\n` +
                        `👑 **Creador:** ${ownerName}\n` +
                        `👥 **Miembros:** ${memberList}\n\n` +
                        `**Tareas:**\n${taskList}`;

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(`Lista compartida (ID: \`${listId}\`)`, fullListDisplay)
                        ],
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_add_${listId}`)
                                    .setLabel('Añadir tarea')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_complete_${listId}`)
                                    .setLabel('Completar tarea')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_remove_${listId}`)
                                    .setLabel('Quitar tarea')
                                    .setStyle(ButtonStyle.Danger)
                            )
                        ]
                    });
                }

                case 'addtask': {
                    const listId = interaction.options.getString('list_id');
                    const taskText = interaction.options.getString('task');

                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la lista compartida.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No tienes acceso a esta lista.' });
                    }

                    const newTask = {
                        id: listData.nextId++,
                        text: taskText,
                        completed: false,
                        createdAt: new Date().toISOString(),
                        createdBy: userId
                    };

                    listData.tasks.push(newTask);
                    await setInDb(`shared_todo_${listId}`, listData);

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed('Tarea añadida', `Se añadió "${taskText}" a la lista compartida "${listData.name}"`)
                        ]
                    });
                }

                case 'remove': {
                    const listId = interaction.options.getString('list_id');
                    const taskNumber = interaction.options.getInteger('number');

                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la lista compartida.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No tienes acceso a esta lista.' });
                    }

                    const taskIndex = listData.tasks.findIndex(task => task.id === taskNumber);
                    if (taskIndex === -1) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la tarea.' });
                    }

                    const [removedTask] = listData.tasks.splice(taskIndex, 1);
                    await setInDb(`shared_todo_${listId}`, listData);

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed('Tarea eliminada', `Se eliminó "${removedTask.text}" de la lista compartida "${listData.name}".`)
                        ]
                    });
                }
            }
            return;
        }

        const dbKey = `todo_${userId}`;

        const userData = await getFromDb(dbKey, {
            tasks: [],
            nextId: 1
        });

        if (!userData.tasks) userData.tasks = [];
        if (!userData.nextId) userData.nextId = 1;

        switch (subcommand) {
            case 'add': {
                const taskText = interaction.options.getString('task');

                const newTask = {
                    id: userData.nextId++,
                    text: taskText,
                    completed: false,
                    createdAt: new Date().toISOString()
                };

                userData.tasks.push(newTask);
                await setInDb(dbKey, userData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Tarea añadida",
                            `Se añadió "${taskText}" a tu lista de tareas.`
                        ),
                    ],
                });
            }

            case 'list': {
                if (userData.tasks.length === 0) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [successEmbed('Tu lista de tareas está vacía', "Tu lista de tareas")],
                    });
                }

                const taskList = userData.tasks
                    .map(task => 
                        `${task.completed ? '✅' : '📝'} #${task.id} ${task.text}` +
                        `\`[${new Date(task.createdAt).toLocaleDateString()}\``
                    )
                    .join('\n');

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Tu lista de tareas', taskList)
                    ],
                });
            }

            case 'complete': {
                const taskNumber = interaction.options.getInteger('number');
                const task = userData.tasks.find(t => t.id === taskNumber);

                if (!task) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la tarea.' });
                }

                if (task.completed) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `La tarea n.º ${task.id} ya está completada.` });
                }

                task.completed = true;
                await setInDb(`todo_${userId}`, userData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Tarea completada', `¡Se marcó "${task.text}" como completada!`)
                    ],
                });
            }

            case 'remove': {
                const taskNumber = interaction.options.getInteger('number');
                const taskIndex = userData.tasks.findIndex(t => t.id === taskNumber);

                if (taskIndex === -1) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se encontró la tarea.' });
                }

                const [removedTask] = userData.tasks.splice(taskIndex, 1);
                await setInDb(`todo_${userId}`, userData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Tarea eliminada', `Se eliminó "${removedTask.text}" de tu lista de tareas.`)
                    ],
                });
            }

            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Subcomando no válido.' });
        }
    },
};
