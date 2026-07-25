import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/suggestions.json');

const UP_ID = 'sug_upvote';
const DOWN_ID = 'sug_downvote';

const DEFAULT_COLOR = 0x9b59b6;
const DEFAULT_BANNER = 'https://i.imgur.com/CHwoiQX.gif';
const UP_EMOJI = { id: '1530371857583177778', name: 'up' };
const DOWN_EMOJI = { id: '1530372010822074483', name: 'down' };

function ensureConfig() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ channels: {}, votes: {}, emojis: {}, settings: {}, panels: {} }, null, 2),
      'utf8'
    );
  }
}

function readConfig() {
  try {
    ensureConfig();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
  } catch {
    return { channels: {}, votes: {}, emojis: {}, settings: {}, panels: {} };
  }
}

function writeConfig(data) {
  ensureConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getSuggestionChannelId(guildId) {
  return readConfig().channels?.[guildId] || null;
}

export async function setSuggestionChannel(guildId, channelId) {
  const config = readConfig();
  if (!config.channels) config.channels = {};
  config.channels[guildId] = channelId;
  writeConfig(config);
}

function getSettings(guildId) {
  const config = readConfig();
  const s = config.settings?.[guildId] || {};
  return {
    color: s.color ?? DEFAULT_COLOR,
    banner: s.banner || DEFAULT_BANNER,
  };
}

export function getGuildEmojis(guildId) {
  const config = readConfig();
  const e = config.emojis?.[guildId];
  return {
    up: e?.up || UP_EMOJI,
    down: e?.down || DOWN_EMOJI,
  };
}

export async function setGuildEmojis(guildId, up, down) {
  const config = readConfig();
  if (!config.emojis) config.emojis = {};
  config.emojis[guildId] = { up, down };
  writeConfig(config);
}

function getVotes(messageId) {
  const config = readConfig();
  return config.votes?.[messageId] || { up: [], down: [] };
}

function saveVotes(messageId, votes) {
  const config = readConfig();
  if (!config.votes) config.votes = {};
  config.votes[messageId] = votes;
  writeConfig(config);
}

function parseEmoji(input) {
  if (!input) return undefined;
  if (typeof input === 'object' && input.id) {
    return {
      id: String(input.id),
      name: input.name || 'emoji',
      animated: Boolean(input.animated),
    };
  }
  const raw = String(input).trim();
  if (!raw.includes('<') && !raw.includes(':') && !/^\d+$/.test(raw)) return raw;
  const full = raw.match(/<(a)?:([a-zA-Z0-9_]+):(\d+)>/);
  if (full) return { animated: Boolean(full[1]), name: full[2], id: full[3] };
  const short = raw.match(/^([a-zA-Z0-9_]+):(\d+)$/);
  if (short) return { name: short[1], id: short[2] };
  if (/^\d+$/.test(raw)) return { id: raw, name: 'emoji' };
  return raw;
}

function buildVoteRow(guildId, upCount = 0, downCount = 0, forceUnicode = false) {
  const upBtn = new ButtonBuilder()
    .setCustomId(UP_ID)
    .setLabel(String(upCount))
    .setStyle(ButtonStyle.Secondary);
  const downBtn = new ButtonBuilder()
    .setCustomId(DOWN_ID)
    .setLabel(String(downCount))
    .setStyle(ButtonStyle.Secondary);

  if (forceUnicode) {
    upBtn.setEmoji('👍');
    downBtn.setEmoji('👎');
    return new ActionRowBuilder().addComponents(upBtn, downBtn);
  }

  const { up, down } = getGuildEmojis(guildId);

  try {
    const e = parseEmoji(up);
    if (e) upBtn.setEmoji(e);
    else upBtn.setEmoji('👍');
  } catch {
    upBtn.setEmoji('👍');
  }

  try {
    const e = parseEmoji(down);
    if (e) downBtn.setEmoji(e);
    else downBtn.setEmoji('👎');
  } catch {
    downBtn.setEmoji('👎');
  }

  return new ActionRowBuilder().addComponents(upBtn, downBtn);
}

/** Un solo mensaje: solo el texto, sin título duplicado */
function buildSuggestionEmbed(guildId, user, text) {
  const { color } = getSettings(guildId);
  return new EmbedBuilder()
    .setColor(color)
    .setDescription(text)
    .addFields({ name: '\u200b', value: `» **Sugerido por:** ${user}` })
    .setFooter({ text: 'Envenenado RP • Sugerencias' })
    .setTimestamp();
}

export function buildPanelEmbed(guildId) {
  const { color, banner } = getSettings(guildId);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('💡 Panel de Sugerencias')
    .setDescription(
      '**¿Cómo funciona?**\n' +
        '• Escribe tu sugerencia en este canal\n' +
        '• El bot la convertirá en un embed con votos\n' +
        '• La comunidad podrá votar a favor o en contra'
    )
    .setFooter({ text: 'Envenenado RP • Sugerencias' });
  if (banner) embed.setImage(banner);
  return embed;
}

export async function sendSuggestionPanel(channel) {
  return channel.send({
    embeds: [buildPanelEmbed(channel.guildId)],
  });
}

/** Cuando alguien escribe en el canal de sugerencias */
export async function handleSuggestionMessage(message) {
  if (message.author.bot || !message.guild) return false;

  const channelId = getSuggestionChannelId(message.guild.id);
  if (!channelId || message.channel.id !== channelId) return false;

  const text = message.content?.trim();
  if (!text || text.length < 2) return false;

  try {
    await message.delete().catch(() => {});

    const embed = buildSuggestionEmbed(message.guild.id, message.author, text);

    let msg;
    try {
      const row = buildVoteRow(message.guild.id, 0, 0, false);
      msg = await message.channel.send({ embeds: [embed], components: [row] });
    } catch {
      const row = buildVoteRow(message.guild.id, 0, 0, true);
      msg = await message.channel.send({ embeds: [embed], components: [row] });
    }

    saveVotes(msg.id, {
      up: [],
      down: [],
      authorId: message.author.id,
      details: text,
    });

    return true;
  } catch (err) {
    console.error('Error en sugerencia por mensaje:', err);
    return false;
  }
}

/** Clicks en votos */
export async function handleSuggestionInteraction(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId !== UP_ID && interaction.customId !== DOWN_ID) return false;

  const votes = getVotes(interaction.message.id);
  const userId = interaction.user.id;

  votes.up = (votes.up || []).filter((id) => id !== userId);
  votes.down = (votes.down || []).filter((id) => id !== userId);

  if (interaction.customId === UP_ID) votes.up.push(userId);
  else votes.down.push(userId);

  saveVotes(interaction.message.id, votes);

  try {
    await interaction.update({
      components: [buildVoteRow(interaction.guildId, votes.up.length, votes.down.length, false)],
    });
  } catch {
    await interaction.update({
      components: [buildVoteRow(interaction.guildId, votes.up.length, votes.down.length, true)],
    });
  }

  return true;
}

export function isSuggestionInteraction(interaction) {
  return (
    interaction.isButton() &&
    (interaction.customId === UP_ID || interaction.customId === DOWN_ID)
  );
}
