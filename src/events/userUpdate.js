import { Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/registrosService.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.UsarUpdate,
  once: false,

  async execute(oldUsar, newUsar) {
    try {
      if (oldUsar.bot) return;

      const usernameChanged = oldUsar.username !== newUsar.username;
      const discriminatorChanged = oldUsar.discriminator !== newUsar.discriminator;

      if (!usernameChanged && !discriminatorChanged) return;

      const fields = [];

      if (usernameChanged) {
        fields.push({
          name: '🏷️ Old Usarname',
          value: oldUsar.username,
          inline: true
        });
        fields.push({
          name: '🏷️ New Usarname',
          value: newUsar.username,
          inline: true
        });
      }

      if (discriminatorChanged) {
        fields.push({
          name: '🔢 Old Tag',
          value: `#${oldUsar.discriminator}`,
          inline: true
        });
        fields.push({
          name: '🔢 New Tag',
          value: `#${newUsar.discriminator}`,
          inline: true
        });
      }

      const guilds = [...newUsar.client.guilds.cache.values()];
      for (const guild of guilds) {
        if (!guild.members.cache.has(newUsar.id)) continue;

        await logEvent({
          client: newUsar.client,
          guildId: guild.id,
          eventType: EVENT_TYPES.MEMBER_NAME_CHANGE,
          data: {
            description: `${newUsar.tag} updated their username`,
            userId: newUsar.id,
            fields: [
              {
                name: '👤 Usar',
                value: `${newUsar.tag} (${newUsar.id})`,
                inline: true
              },
              ...fields
            ]
          }
        });
      }

      logger.debug(`Processed userUpdate for ${newUsar.id} across ${guilds.length} guild(s)`);
    } catch (error) {
      logger.error('Error in userUpdate event:', error);
    }
  }
};