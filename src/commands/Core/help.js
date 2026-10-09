import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
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

const CATEGORY_LABELS = { Core: 'General', Moderation: 'Moderación', Economy: 'Economía', Fun: 'Diversión', Leveling: 'Niveles', Utility: 'Utilidades', Ticket: 'Tickets', Welcome: 'Bienvenida', Giveaway: 'Sorteos', Counter: 'Contador', Tools: 'Herramientas', Search: 'Búsqueda', 'Reaction Roles': 'Roles por reacción', Community: 'Comunidad', Birthday: 'Cumpleaños', 'Join To Create': 'Crear canal al entrar', Verification: 'Verificación' };


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

export async function createInitialAyudaMenu(client) {
    const commandsPath = path.join(__dirname, "../../comandos");
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
            const categoryName = CATEGORY_LABELS[category] || formatCategoryName(category);
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${categoryName}`,
                description: `Ver los comandos de la categoría ${categoryName} category`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({
        title: `📖 ${botName} Ayuda`,
        description: 'Set up your server, pick what to enable, then browse commands below.',
        color: 'primary',
        thumbnail: client.user?.displayAvatarURL?.({ size: 1024 }),
        fields: [
            {
                name: '🚀 Primeros pasos',
                value: [
                    '**1. Iniciar configuración** — Ejecuta `/configurar` para configurar el prefijo, el rol de moderación y los registros.',
                    '**2. Activar funciones** — Usa `/comandos dashboard` para activar o desactivar categorías.',                    '**3. Explorar comandos** — Usa the menu below to view categories and commands.',
                ].join('\n'),
                inline: false,
            },
            {
                name: 'ℹ️ Cómo funciona',
                value: [
                    '• Los comandos del panel permiten administrar cada función visualmente',
                    '• La configuración se guarda por servidor',
                    '• Los comandos de barra y los prefijos funcionan una vez activados',
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
        .setLabel("Reportar error")
        .setStyle(ButtonStyle.Danger);

    const supportButton = new ButtonBuilder()
        .setLabel("Servidor de soporte")
        .setURL("https://discord.gg/QnWNz2dKCE")
        .setStyle(ButtonStyle.Link);

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Selecciona para ver los comandos",
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
        .setName("ayuda")
        .setDescription("Muestra el menú de ayuda con todos los comandos disponibles"),

    async execute(interaction, guildConfig, client) {
        
        const { MessageFlags } = await import('discord.js');
        await InteractionAyudaer.safeDefer(interaction);
        
        const { embeds, components } = await createInitialAyudaMenu(client);

        await InteractionAyudaer.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                if (!InteractionAyudaer.isInteractionValid(interaction)) {
                    return;
                }

                const closedEmbed = createEmbed({
                    title: "Ayuda menu closed",
                    description: "Ayuda menu has been closed, use /ayuda again.",
                    color: "secondary",
                });

                await InteractionAyudaer.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {
                logger.debug('Ayuda menu close edit failed (interaction may have expired):', error?.message);
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};