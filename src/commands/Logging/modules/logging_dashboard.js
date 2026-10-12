import { EmbedBuilder, MessageFlags, PermissionsBitField } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { getLoggingStatus } from '../../../services/loggingService.js';
import {
  createLoggingDashboardComponents,
  createLoggingCategoryViewComponents,
  createLoggingFilterComponents,
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  EVENT_TYPES_BY_CATEGORY,
} from '../../../utils/logging/loggingUi.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
export function getCategoryStatus(enabledEvents, category, auditEnabled) {
  if (!auditEnabled) return false;
  const events = enabledEvents || {};
  if (events[`${category}.*`] === false) return false;
  const categoryEvents = EVENT_TYPES_BY_CATEGORY[category] || [];
  if (categoryEvents.length === 0) return true;
  return categoryEvents.every((eventType) => events[eventType] !== false);
}

async function formatChannelMention(guild, id) {
  if (!id) return '`Sin configurar`';
  const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
  return channel ? channel.toString() : `⚠️ No encontrado (${id})`;
}

function countEnabledCategories(enabledEvents, auditEnabled) {
  const enabled = DASHBOARD_CATEGORIES.filter((key) =>
    getCategoryStatus(enabledEvents, key, auditEnabled),
  ).length;
  return { enabled, total: DASHBOARD_CATEGORIES.length };
}

export async function buildLoggingDashboardView(interaction, client) {
  const guildConfig = await getGuildConfig(client, interaction.guildId);
  const loggingStatus = await getLoggingStatus(client, interaction.guildId);

  const auditEnabled = Boolean(loggingStatus.enabled);
  const channels = loggingStatus.channels || {};

  const auditChannel = await formatChannelMention(interaction.guild, channels.audit);
  const applicationsChannel = await formatChannelMention(interaction.guild, channels.applications);
  const reportsChannel = await formatChannelMention(interaction.guild, channels.reports);
  const lifecycleChannel = await formatChannelMention(interaction.guild, guildConfig.ticketLogsChannelId);
  const transcriptChannel = await formatChannelMention(interaction.guild, guildConfig.ticketTranscriptChannelId);

  const ignore = loggingStatus.ignore || { users: [], channels: [] };
  const { enabled: enabledCount, total } = countEnabledCategories(loggingStatus.enabledEvents, auditEnabled);

  const embed = new EmbedBuilder()
    .setTitle('📝 Panel de registros')
    .setDescription(`Administra los registros de **${interaction.guild.name}**. Usa el menú para configurar canales, categorías y filtros.`)
    .setColor(auditEnabled ? getColor('success') : getColor('warning'))
    .addFields(
      {
        name: 'Estado de los registros',
        value: auditEnabled ? '✅ Activados' : '❌ Desactivados',
        inline: true,
      },
      {
        name: 'Categorías de eventos',
        value: auditEnabled ? `${enabledCount}/${total} activadas` : '`Registros desactivados`',
        inline: true,
      },
      {
        name: 'Filtros de exclusión',
        value: `${ignore.users?.length || 0} usuarios · ${ignore.channels?.length || 0} canales`,
        inline: true,
      },
      {
        name: 'Canales de registro',
        value: [
          `**Auditoría:** ${auditChannel}`,
          `**Solicitudes:** ${applicationsChannel}`,
          `**Reportes:** ${reportsChannel}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Canales de tickets (solo lectura)',
        value: [
          `**Registros de tickets:** ${lifecycleChannel}`,
          `**Transcripciones:** ${transcriptChannel}`,
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Configura los canales de tickets con /ticket dashboard' })
    .setTimestamp();

  const components = createLoggingDashboardComponents(loggingStatus.enabledEvents, auditEnabled);
  return { embed, components };
}

export async function buildLoggingCategoriesView(interaction, client) {
  const loggingStatus = await getLoggingStatus(client, interaction.guildId);
  const auditEnabled = Boolean(loggingStatus.enabled);

  const categoryLines = DASHBOARD_CATEGORIES.map((key) => {
    const on = getCategoryStatus(loggingStatus.enabledEvents, key, auditEnabled);
    const label = DASHBOARD_CATEGORY_LABELS[key] || key;
    return `${on ? '✅' : '❌'} ${label}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📋 Categorías de eventos')
    .setDescription(
      auditEnabled
        ? 'Activa o desactiva los tipos de eventos que se registran en el canal de auditoría.'
        : '⚠️ Los registros están desactivados. Actívalos desde el panel principal para enviar registros.',
    )
    .setColor(getColor('info'))
    .addFields({ name: 'Estado de las categorías', value: categoryLines, inline: false })
    .setFooter({ text: 'Verde = registros activados · Rojo = registros desactivados' })
    .setTimestamp();

  const components = createLoggingCategoryViewComponents(loggingStatus.enabledEvents, auditEnabled);
  return { embed, components };
}

export async function buildLoggingFilterView(interaction, client) {
  const loggingStatus = await getLoggingStatus(client, interaction.guildId);
  const ignore = loggingStatus.ignore || { users: [], channels: [] };

  const userLines = (ignore.users || []).length
    ? ignore.users.map((id) => `• Usuario \`${id}\``).join('\n')
    : '*No hay usuarios excluidos*';

  const channelLines = (ignore.channels || []).length
    ? ignore.channels.map((id) => `• Canal \`${id}\``).join('\n')
    : '*No hay canales excluidos*';

  const embed = new EmbedBuilder()
    .setTitle('🔇 Filtros de exclusión de registros')
    .setDescription('Se omitirán los usuarios y canales de esta lista al enviar los registros de auditoría.')
    .setColor(getColor('info'))
    .addFields(
      { name: 'Usuarios excluidos', value: userLines.slice(0, 1024), inline: false },
      { name: 'Canales ignorados', value: channelLines.slice(0, 1024), inline: false },
    )
    .setFooter({ text: 'Usa los botones para añadir o quitar filtros' })
    .setTimestamp();

  const components = createLoggingFilterComponents();
  return { embed, components };
}

export function isCategoriesView(interaction) {
  return interaction.message?.embeds?.[0]?.title === '📋 Categorías de eventos';
}

export function isFilterView(interaction) {
  return interaction.message?.embeds?.[0]?.title === '🔇 Filtros de exclusión de registros';
}

export async function refreshDashboardMessage(interaction, client) {
  let view;
  if (isCategoriesView(interaction)) {
    view = await buildLoggingCategoriesView(interaction, client);
  } else if (isFilterView(interaction)) {
    view = await buildLoggingFilterView(interaction, client);
  } else {
    view = await buildLoggingDashboardView(interaction, client);
  }

  await interaction.message.edit({
    embeds: [view.embed],
    components: view.components,
    content: null,
  }).catch(() => {});
}

export default {
  prefixOnly: false,
  async execute(interaction, config, client) {
    try {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso **Gestionar servidor** para ver el panel de registros.' });
      }

      await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      const { embed, components } = await buildLoggingDashboardView(interaction, client);
      await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components });
    } catch (error) {
      logger.error('logging_dashboard error:', error);
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo cargar el panel de registros.' });
    }
  },
};
