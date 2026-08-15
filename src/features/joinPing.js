import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/join-ping.json');

function ensureConfigFile() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, '{}', 'utf8');
}

function readConfig() {
  try {
    ensureConfigFile();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function writeConfig(data) {
  ensureConfigFile();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getJoinPingConfig(guildId) {
  return readConfig()[guildId] || null;
}

export function setJoinPingConfig(guildId, data) {
  const config = readConfig();
  config[guildId] = { ...(config[guildId] || {}), ...data };
  writeConfig(config);
}

export async function handleJoinPing(member) {
  const cfg = getJoinPingConfig(member.guild.id);

  // 1) config del comando  2) si no, variable de entorno
  const channelId =
    (cfg?.enabled !== false && cfg?.channelId) ||
    process.env.JOIN_PING_CHANNEL_ID ||
    null;

  if (!channelId) return;

  const channel =
    member.guild.channels.cache.get(channelId) ||
    (await member.guild.channels.fetch(channelId).catch(() => null));

  if (!channel?.isTextBased?.()) return;

  try {
    const msg = await channel.send(`${member}`);
    setTimeout(() => {
      msg.delete().catch(() => {});
    }, 2000);
  } catch (err) {
    console.error('[joinPing]', err.message);
  }
}
