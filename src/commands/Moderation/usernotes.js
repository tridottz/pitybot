import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getFromDb, setInDb, deleteFromDb, getUsarNotesKey, getUsarNotesListKey } from '../../utils/database.js';
import { sanitizeInput } from '../../utils/validation.js';

import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
import { replyUsarError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("notas-usuario")
        .setDescription("Manage user notes for moderation purposes")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Add a note to a user")
                .addUsarOption(option =>
                    option
                        .setName("target")
                        .setDescription("The user to add a note for")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("note")
                        .setDescription("The note to add")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Type of note")
                        .addChoices(
                            { name: "Warning", value: "warning" },
                            { name: "Positive", value: "positive" },
                            { name: "Neutral", value: "neutral" },
                            { name: "Alert", value: "alert" }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("View notes for a user")
                .addUsarOption(option =>
                    option
                        .setName("target")
                        .setDescription("The user to view notes for")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Remove a specific note from a user")
                .addUsarOption(option =>
                    option
                        .setName("target")
                        .setDescription("The user to remove a note from")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("index")
                        .setDescription("The index of the note to remove")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("clear")
                .setDescription("Clear all notes for a user")
                .addUsarOption(option =>
                    option
                        .setName("target")
                        .setDescription("The user to clear notes for")
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    category: "moderation",

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();
        const targetUsar = interaction.options.getUsar("target");
        const guildId = interaction.guild.id;

        if (subcommand !== "view" && subcommand !== "remove" && subcommand !== "clear" && subcommand !== "add") {
            return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please select a valid subcommand.' });
        }

        let notes = [];
        if (targetUsar) {
            const notesKey = getUsarNotesKey(guildId, targetUsar.id);
            notes = await getFromDb(notesKey, []);
        }

        try {
            switch (subcommand) {
                case "add":
                    return await handleAddNote(interaction, targetUsar, notes, guildId);
                case "view":
                    return await handleViewNotes(interaction, targetUsar, notes);
                case "remove":
                    return await handleRemoveNote(interaction, targetUsar, notes, guildId);
                case "clear":
                    return await handleClearNotes(interaction, targetUsar, notes, guildId);
                default:
                    return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please select a valid subcommand.' });
            }
        } catch (error) {
            logger.error(`Error in usernotes command (${subcommand}):`, error);
            return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred while processing your request. Please try again later.' });
        }
    }
};

async function handleAddNote(interaction, targetUsar, notes, guildId) {
    let note = interaction.options.getString("note").trim();
    const type = interaction.options.getString("type") || "neutral";

    if (note.length > 1000) {
        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Notes must be 1000 characters or less.' });
    }

    if (note.length === 0) {
        return await replyUsarError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Note cannot be empty.' });
    }

    note = sanitizeInput(note);

    const noteData = {
        id: Date.now(),
        content: note,
        type: type,
        author: interaction.user.tag,
        authorId: interaction.user.id,
        timestamp: new Date().toISOString()
    };

    notes.push(noteData);

    const notesKey = getUsarNotesKey(guildId, targetUsar.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(type);

    return InteractionAyudaer.safeReply(interaction, {
        embeds: [
            successEmbed(
                `${typeInfo.emoji} Note Added`,
                `Added a **${type}** note for **${targetUsar.tag}**:\n\n` +
                `> ${note}\n\n` +
                `**Moderator:** ${interaction.user.tag}\n` +
                `**Total Notes:** ${notes.length}`
            )
        ]
    });
}

async function handleViewNotes(interaction, targetUsar, notes) {
    if (notes.length === 0) {
        return InteractionAyudaer.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "📝 No Notes",
                    `There are no notes for **${targetUsar.tag}**.`
                ),
            ],
        });
    }

    const sortedNotes = [...notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let description = `**Notes for ${targetUsar.tag} (${targetUsar.id}):**\n\n`;
    
    sortedNotes.forEach((note, index) => {
        const typeInfo = getNoteTypeInfo(note.type);
        const date = new Date(note.timestamp).toLocaleDateString();
        description += `${typeInfo.emoji} **Note #${index + 1}** (${note.type}) - ${date}\n`;
        description += `> ${note.content}\n`;
        description += `*Added by ${note.author}*\n\n`;
    });

    if (description.length > 4000) {
        description = description.substring(0, 3900) + "\n... *(truncated)*";
    }

    return InteractionAyudaer.safeReply(interaction, {
        embeds: [
            infoEmbed(
                `📝 Usar Notes (${notes.length})`,
                description
            )
        ]
    });
}

async function handleRemoveNote(interaction, targetUsar, notes, guildId) {
    const index = interaction.options.getInteger("index") - 1;

    if (index < 0 || index >= notes.length) {
        return await replyUsarError(interaction, { type: ErrorTypes.VALIDATION, message: `Please provide a valid note index (1-${notes.length}).` });
    }

    // The view command displays notes sorted newest-first, so resolve the index
    // against the same ordering to delete the note the user actually sees.
    const sortedNotes = [...notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const removedNote = sortedNotes[index];
    const originalIndex = notes.indexOf(removedNote);
    notes.splice(originalIndex, 1);

    const notesKey = getUsarNotesKey(guildId, targetUsar.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(removedNote.type);

    return InteractionAyudaer.safeReply(interaction, {
        embeds: [
            successEmbed(
                `${typeInfo.emoji} Note Removed`,
                `Removed note #${index + 1} from **${targetUsar.tag}**:\n\n` +
                `> ${removedNote.content}\n\n` +
                `**Remaining Notes:** ${notes.length}`
            )
        ]
    });
}

async function handleClearNotes(interaction, targetUsar, notes, guildId) {
    const noteCount = notes.length;
    
    if (noteCount === 0) {
        return InteractionAyudaer.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "No Notes to Clear",
                    `There are no notes for **${targetUsar.tag}** to clear.`
                ),
            ],
        });
    }

    notes.length = 0;

    const notesKey = getUsarNotesKey(guildId, targetUsar.id);
    await setInDb(notesKey, notes);

    return InteractionAyudaer.safeReply(interaction, {
        embeds: [
            successEmbed(
                "🗑️ Notes Cleared",
                `Cleared **${noteCount}** notes from **${targetUsar.tag}**.`
            )
        ]
    });
}

function getNoteTypeInfo(type) {
    const types = {
        warning: { emoji: "⚠️", color: "#FF6B6B" },
        positive: { emoji: "✅", color: "#51CF66" },
        neutral: { emoji: "📝", color: "#74C0FC" },
        alert: { emoji: "🚨", color: "#FFD43B" }
    };
    
    return types[type] || types.neutral;
}