import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import {
    createSelectMenu,
} from "../../utils/components.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const BUG_REPORT_BUTTON_ID = "help-bug-report";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
    Core: "ℹ️",
    Moderation: "🛡️",
    Economy: "💰",
    Music: "🎵",
    Fun: "🎮",
    Leveling: "📊",
    Utility: "🔧",
    Ticket: "🎫",
    Welcome: "👋",
    Giveaway: "🎉",
    Counter: "🔢",
    Tools: "🛠️",
    Search: "🔍",
    "Reaction Roles": "🎭",
    Community: "👥",
    Birthday: "🎂",
    "Join To Create": "🔌",
    Verification: "✅",
};

function formatCategoryName(rawCategory) {
    return rawCategory
        .replace(/_/g, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function createInitialHelpMenu(client) {
    const commandsPath = path.join(__dirname, "../../commands");
    const categoryDirs = (
        await fs.readdir(commandsPath, { withFileTypes: true })
    )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();

    const options = [
        {
            label: "📋 Todos los comandos",
            description: "Consulta todos los comandos disponibles en una sola lista",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName = formatCategoryName(category);
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${categoryName}`,
                description: `Consulta los comandos de la categoría ${categoryName}`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({
        title: `📖 Ayuda de ${botName}`,
        description: 'Configura tu servidor, elige qué funciones activar y consulta los comandos a continuación.',
        color: 'primary',
        thumbnail: client.user?.displayAvatarURL?.({ size: 1024 }),
        fields: [
            {
                name: '🚀 Primeros pasos',
                value: [
                    '**1. Inicia la configuración** — Ejecuta `/configwizard` para configurar el prefijo, el rol de moderación y los registros.',
                    '**2. Activa funciones** — Usa `/commands dashboard` para activar o desactivar categorías.',                    '**3. Consulta los comandos** — Usa el menú para ver las categorías y sus comandos.',
                ].join('\n'),
                inline: false,
            },
            {
                name: 'ℹ️ Cómo funciona',
                value: [
                    '• Los paneles te permiten administrar visualmente cada función',
                    '• La configuración se guarda por servidor',
                    '• Al activarlos, puedes usar comandos de barra y prefijos',
                ].join('\n'),
                inline: false,
            },
            {
                name: '\u200B',
                value: `-# ${botName} is [open source](https://youtu.be/1jCZX8s3bJE?si=NPOYx-vxVE1I5vJK)`,
                inline: false,
            },
        ],
    });

    embed.setFooter({ 
        text: "Hecho con ❤️" 
    });
    embed.setTimestamp();

    const bugReportButton = new ButtonBuilder()
        .setCustomId(BUG_REPORT_BUTTON_ID)
        .setLabel("Reportar un error")
        .setStyle(ButtonStyle.Danger);

    const supportButton = new ButtonBuilder()
        .setLabel("Servidor de soporte")
        .setURL("https://discord.gg/QnWNz2dKCE")
        .setStyle(ButtonStyle.Link);

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Selecciona una categoría para ver sus comandos",
        options,
    );

    const buttonRow = new ActionRowBuilder().addComponents([
        bugReportButton,
        supportButton,
    ]);

    return {
        embeds: [embed],
        components: [buttonRow, selectRow],
    };
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Muestra el menú de ayuda con todos los comandos disponibles"),

    async execute(interaction, guildConfig, client) {
        
        const { MessageFlags } = await import('discord.js');
        await InteractionHelper.safeDefer(interaction);
        
        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                if (!InteractionHelper.isInteractionValid(interaction)) {
                    return;
                }

                const closedEmbed = createEmbed({
                    title: "Menú de ayuda cerrado",
                    description: "El menú de ayuda se cerró. Usa /help para abrirlo de nuevo.",
                    color: "secondary",
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {
                logger.debug('Help menu close edit failed (interaction may have expired):', error?.message);
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};
