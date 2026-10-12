// loggingUi.js

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { EVENT_TYPES } from '../../services/loggingService.js';

const EVENT_TYPES_BY_CATEGORY = Object.values(EVENT_TYPES).reduce((accumulator, eventType) => {
  const [category] = eventType.split('.');
  if (!accumulator[category]) {
    accumulator[category] = [];
  }
  accumulator[category].push(eventType);
  return accumulator;
}, {});

export const DASHBOARD_CATEGORIES = [
  'moderation',
  'message',
  'role',
  'member',
  'leveling',
  'reactionrole',
  'giveaway',
  'counter',
  'application',
  'report',
];

const DASHBOARD_CATEGORY_EMOJIS = {
  moderation: '🔨',
  message: '✉️',
  role: '🏷️',
  member: '👥',
  leveling: '📈',
  reactionrole: '🎭',
  giveaway: '🎁',
  counter: '📊',
  application: '📝',
  report: '🚨',
};

export const DASHBOARD_CATEGORY_LABELS = {
  moderation: 'Moderación',
  message: 'Mensajes',
  role: 'Roles',
  member: 'Miembros',
  leveling: 'Niveles',
  reactionrole: 'Roles por reacción',
  giveaway: 'Sorteos',
  counter: 'Contadores',
  application: 'Postulaciones',
  report: 'Reportes',
};

function createBackButton() {
  return new ButtonBuilder()
    .setCustomId('log_dash_back')
    .setLabel('Volver al panel')
    .setStyle(ButtonStyle.Secondary);
}

function createCategoryToggleButtons(enabledEvents = {}, loggingEnabled = false) {
  const buttons = DASHBOARD_CATEGORIES.map((category) => {
    const wildcardDisabled = enabledEvents[`${category}.*`] === false;
    const categoryEvents = EVENT_TYPES_BY_CATEGORY[category] || [];
    const allEnabled = categoryEvents.length === 0
      ? true
      : categoryEvents.every((t) => enabledEvents[t] !== false);
    const isEnabled = loggingEnabled && !wildcardDisabled && allEnabled;
    const emoji = DASHBOARD_CATEGORY_EMOJIS[category] || '📌';
    const label = DASHBOARD_CATEGORY_LABELS[category] || category;

    return new ButtonBuilder()
      .setCustomId(`log_dash_toggle:${category}.*`)
      .setLabel(`${emoji} ${label}`)
      .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger);
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

export function createLoggingMainMenuSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('log_dash_menu')
      .setPlaceholder('Elige un ajuste para configurar…')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Configurar canal de registros')
          .setDescription('Moderación, mensajes, miembros, roles, etc.')
          .setValue('set:audit')
          .setEmoji('🧾'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Configurar canal de postulaciones')
          .setDescription('Nuevas postulaciones y actualizaciones de revisión')
          .setValue('set:applications')
          .setEmoji('📝'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Configurar canal de reportes')
          .setDescription('Reportes de usuarios enviados con /report')
          .setValue('set:reports')
          .setEmoji('🚨'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Quitar canal de registros')
          .setValue('clear:audit')
          .setEmoji('🗑️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Quitar canal de postulaciones')
          .setValue('clear:applications')
          .setEmoji('🗑️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Quitar canal de reportes')
          .setValue('clear:reports')
          .setEmoji('🗑️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Categorías de eventos')
          .setDescription('Activa o desactiva los tipos de registro que se envían')
          .setValue('view:categories')
          .setEmoji('📋'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Administrar filtros de exclusión')
          .setDescription('Excluye del registro a usuarios o canales específicos')
          .setValue('view:filters')
          .setEmoji('🔇'),
      ),
  );
}

export function createLoggingMainActionRow(loggingEnabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('log_dash_toggle:audit_enabled')
      .setLabel('Registros de auditoría')
      .setStyle(loggingEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('log_dash_refresh')
      .setLabel('Actualizar')
      .setStyle(ButtonStyle.Primary),
  );
}

export function createLoggingDashboardComponents(_enabledEvents, loggingEnabled = false) {
  return [
    createLoggingMainMenuSelect(),
    createLoggingMainActionRow(loggingEnabled),
  ];
}

export function createLoggingCategoryViewComponents(enabledEvents, loggingEnabled = false) {
  const categoryRows = createCategoryToggleButtons(enabledEvents, loggingEnabled);

  const actionRow = new ActionRowBuilder().addComponents(
    createBackButton(),
    new ButtonBuilder()
      .setCustomId('log_dash_toggle:all')
      .setLabel('Alternar todas las categorías')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('log_dash_refresh')
      .setLabel('Actualizar')
      .setStyle(ButtonStyle.Primary),
  );

  return [...categoryRows, actionRow];
}

export function createLoggingFilterComponents() {
  return [
    new ActionRowBuilder().addComponents(
      createBackButton(),
      new ButtonBuilder()
        .setCustomId('log_dash_add_filter:user')
        .setLabel('Añadir filtro de usuario')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('log_dash_add_filter:channel')
        .setLabel('Añadir filtro de canal')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('log_dash_remove_filter')
        .setLabel('Quitar filtro')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export { EVENT_TYPES_BY_CATEGORY };
