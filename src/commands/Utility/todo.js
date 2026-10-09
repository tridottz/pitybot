import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import crypto from 'crypto';

function generateShareId() {
    return crypto.randomBytes(16).toString('hex');
}

export default {
    data: new SlashCommandBuilder()
        .setName("pendientes")
        .setDescription("Administra tu lista personal de tareas")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Agrega una tarea a tu lista")
                .addStringOption(option =>
                    option
                        .setName("task")
                        .setDescription("La tarea que quieres agregar")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Muestra tu lista de tareas")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("complete")
                .setDescription("Marca una tarea como completada")
                .addIntegerOption(option =>
                    option
                        .setName("number")
                        .setDescription("El número de la tarea que quieres completar")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Elimina una tarea de tu lista")
                .addIntegerOption(option =>
                    option
                        .setName("number")
                        .setDescription("El número de la tarea que quieres eliminar")
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
                        .setDescription("Agrega un miembro a una lista compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                        .addUsarOption(option =>
                            option
                                .setName("user")
                                .setDescription("Usar to add to the list")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("view")
                        .setDescription("Muestra una lista de tareas compartida")
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
                        .setDescription("Agrega una tarea a una lista compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName("task")
                                .setDescription("La tarea que quieres agregar")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("remove")
                        .setDescription("Elimina una tarea de una lista compartida")
                        .addStringOption(option =>
                            option
                                .setName("list_id")
                                .setDescription("ID de la lista compartida")
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option
                                .setName("number")
                                .setDescription("El número de la tarea que quieres eliminar")
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

        const deferSuccess = await InteractionAyudaer.safeDefer(interaction);
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

                    return await InteractionAyudaer.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Shared List Created",
                                `Created shared list "${listName}" with ID: \`${listId}\`\n` +
                                `Usa \`/pendientes share add list_id:${listId} user:@username\` to add members.`
                            )
                        ]
                    });
                }

                case 'add': {
                    const listId = interaction.options.getString('list_id');
                    const memberToAdd = interaction.options.getUsar('user');

                    const listData = await getOrCreateSharedList(listId);
                    if (!listData) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Shared list not found.' });
                    }

                    if (listData.creatorId !== userId) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Only the list creator can add members.' });
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

                        return await InteractionAyudaer.safeEditReply(interaction, {
                            embeds: [
                                successEmbed('Member Added', 
                                    `Added ${memberToAdd.username} to the shared list "${listData.name}"`
                                )
                            ]
                        });
                    } else {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Usar is already a member of this list.' });
                    }
                }

                case 'view': {
                    const listId = interaction.options.getString('list_id');
                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Shared list not found.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You don\'t have access to this list.' });
                    }

                    if (listData.tasks.length === 0) {
                        const memberList = listData.members.map(memberId => {
                            const member = interaction.guild.members.cache.get(memberId);
                            return member ? member.user.username : `<@${memberId}>`;
                        }).join(',');

                        const owner = interaction.guild.members.cache.get(listData.creatorId);
                        const ownerName = owner ? owner.user.username : `<@${listData.creatorId}>`;

                        return await InteractionAyudaer.safeEditReply(interaction, {
                                embeds: [
                                    successEmbed(
                                        `📋 **${listData.name}**\n\n` +
                                        `👑 **Owner:** ${ownerName}\n` +
                                        `👥 **Members:** ${memberList}\n\n` +
                                        `*This list is currently empty. Usa the "Add Task" button to add tasks!*`,
                                        `Shared List (ID: \`${listId}\`)`
                                    )
                                ],
                                components: [
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`shared_todo_add_${listId}`)
                                            .setLabel('Add Task')
                                            .setStyle(ButtonStyle.Primary),
                                        new ButtonBuilder()
                                            .setCustomId(`shared_todo_complete_${listId}`)
                                            .setLabel('Complete Task')
                                            .setStyle(ButtonStyle.Success),
                                        new ButtonBuilder()
                                            .setCustomId(`shared_todo_remove_${listId}`)
                                            .setLabel('Remove Task')
                                            .setStyle(ButtonStyle.Danger)
                                    )
                                ]
                            });
                    }

                    const taskList = listData.tasks
                        .map(task => 
                            `${task.completed ? '✅' : '📝'} #${task.id} ${task.text}` +
                            `\`[${new Date(task.createdAt).toLocaleDateString()}]` +
                            (task.completed ? `• Completed by ${task.completedBy}` : '') + '`'
                        )
                        .join('\n');

                    const memberList = listData.members.map(memberId => {
                        const member = interaction.guild.members.cache.get(memberId);
                        return member ? member.user.username : `<@${memberId}>`;
                    }).join(',');

                    const owner = interaction.guild.members.cache.get(listData.creatorId);
                    const ownerName = owner ? owner.user.username : `<@${listData.creatorId}>`;

                    const fullListDisplay = `📋 **${listData.name}**\n\n` +
                        `👑 **Owner:** ${ownerName}\n` +
                        `👥 **Members:** ${memberList}\n\n` +
                        `**Tasks:**\n${taskList}`;

                    return await InteractionAyudaer.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(`Shared List (ID: \`${listId}\`)`, fullListDisplay)
                        ],
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_add_${listId}`)
                                    .setLabel('Add Task')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_complete_${listId}`)
                                    .setLabel('Complete Task')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_remove_${listId}`)
                                    .setLabel('Remove Task')
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
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Shared list not found.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You don\'t have access to this list.' });
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

                    return await InteractionAyudaer.safeEditReply(interaction, {
                        embeds: [
                            successEmbed('Task Added', `Added "${taskText}" to the shared list "${listData.name}"`)
                        ]
                    });
                }

                case 'remove': {
                    const listId = interaction.options.getString('list_id');
                    const taskNumber = interaction.options.getInteger('number');

                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Shared list not found.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You don\'t have access to this list.' });
                    }

                    const taskIndex = listData.tasks.findIndex(task => task.id === taskNumber);
                    if (taskIndex === -1) {
                        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Task not found.' });
                    }

                    const [removedTask] = listData.tasks.splice(taskIndex, 1);
                    await setInDb(`shared_todo_${listId}`, listData);

                    return await InteractionAyudaer.safeEditReply(interaction, {
                        embeds: [
                            successEmbed('Task Removed', `Removed "${removedTask.text}" from the shared list "${listData.name}".`)
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

                return await InteractionAyudaer.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Task Added",
                            `Added "${taskText}" to your to-do list.`
                        ),
                    ],
                });
            }

            case 'list': {
                if (userData.tasks.length === 0) {
                    return await InteractionAyudaer.safeEditReply(interaction, {
                        embeds: [successEmbed('Your to-do list is empty!', "Your To-Do List")],
                    });
                }

                const taskList = userData.tasks
                    .map(task => 
                        `${task.completed ? '✅' : '📝'} #${task.id} ${task.text}` +
                        `\`[${new Date(task.createdAt).toLocaleDateString()}\``
                    )
                    .join('\n');

                return await InteractionAyudaer.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Your To-Do List', taskList)
                    ],
                });
            }

            case 'complete': {
                const taskNumber = interaction.options.getInteger('number');
                const task = userData.tasks.find(t => t.id === taskNumber);

                if (!task) {
                    return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Task not found.' });
                }

                if (task.completed) {
                    return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: `Task #${task.id} is already completed.` });
                }

                task.completed = true;
                await setInDb(`todo_${userId}`, userData);

                return await InteractionAyudaer.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Task Completed', `Marked "${task.text}" as complete!`)
                    ],
                });
            }

            case 'remove': {
                const taskNumber = interaction.options.getInteger('number');
                const taskIndex = userData.tasks.findIndex(t => t.id === taskNumber);

                if (taskIndex === -1) {
                    return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Task not found.' });
                }

                const [removedTask] = userData.tasks.splice(taskIndex, 1);
                await setInDb(`todo_${userId}`, userData);

                return await InteractionAyudaer.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Task Removed', `Removed "${removedTask.text}" from your to-do list.`)
                    ],
                });
            }

            default:
                return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Invalid subcommand.' });
        }
    },
};