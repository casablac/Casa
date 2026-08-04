// videoQueueService.js
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const QUEUE_KEY = (guildId) => `guild:${guildId}:video_queue`;
const CONFIG_KEY = (guildId) => `guild:${guildId}:video_config`;

export async function getVideoQueue(guildId) {
  const data = await getFromDb(QUEUE_KEY(guildId));
  return Array.isArray(data) ? data : [];
}

export async function saveVideoQueue(guildId, queue) {
  await setInDb(QUEUE_KEY(guildId), queue);
}

export async function addVideo(guildId, link, addedBy) {
  const queue = await getVideoQueue(guildId);
  queue.push({
    link,
    addedBy,
    addedAt: new Date().toISOString(),
  });
  await saveVideoQueue(guildId, queue);
  return queue.length;
}

export async function getVideoConfig(guildId) {
  const data = await getFromDb(CONFIG_KEY(guildId));
  return data || { channelId: null, enabled: false };
}

export async function setVideoConfig(guildId, config) {
  await setInDb(CONFIG_KEY(guildId), config);
}

/**
 * Envía el siguiente video de la cola al canal configurado.
 * Devuelve true si envió algo, false si no había videos o no hay canal.
 */
export async function sendNextVideo(client, guildId) {
  const config = await getVideoConfig(guildId);
  if (!config.enabled || !config.channelId) {
    return { sent: false, reason: 'not_configured' };
  }

  const queue = await getVideoQueue(guildId);
  if (queue.length === 0) {
    return { sent: false, reason: 'empty' };
  }

  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel) {
    logger.warn(`[VideoQueue] Canal no encontrado: ${config.channelId}`);
    return { sent: false, reason: 'channel_not_found' };
  }

  const video = queue.shift();
  await saveVideoQueue(guildId, queue);

  try {
    await channel.send(video.link);
    logger.info(`[VideoQueue] Video enviado en guild ${guildId}. Quedan ${queue.length}`);
    return { sent: true, remaining: queue.length, link: video.link };
  } catch (err) {
    // Si falla, lo volvemos a poner al principio
    queue.unshift(video);
    await saveVideoQueue(guildId, queue);
    logger.error(`[VideoQueue] Error al enviar:`, err);
    return { sent: false, reason: 'send_error', error: err.message };
  }
}

/**
 * Revisa todos los servidores y envía un video donde esté activado.
 */
export async function processAllVideoQueues(client) {
  for (const [guildId] of client.guilds.cache) {
    try {
      const config = await getVideoConfig(guildId);
      if (config.enabled && config.channelId) {
        await sendNextVideo(client, guildId);
      }
    } catch (err) {
      logger.error(`[VideoQueue] Error en guild ${guildId}:`, err);
    }
  }
}
