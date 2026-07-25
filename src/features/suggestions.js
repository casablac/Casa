import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/suggestions.json');

const OPEN_MODAL_ID = 'sug_open_modal';
const MODAL_ID = 'sug_submit_modal';
const UP_ID = 'sug_upvote';
const DOWN_ID = 'sug_downvote';

// Defaults
const DEFAULT_BANNER =
  'https://media.discordapp.net/attachments/1243043552972247110/1530369578008444949/generated.gif';
const DEFAULT_COLOR = 0x9B59B6; // morado (cámbialo si quieres)
const UP_EMOJI = { id: '1530371857583177778', name: 'up' };
const DOWN_EMOJI = { id: '1530372010822074483', name: 'down' };

function ensureConfig() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ channels: {}, votes: {}, emojis: {}, settings: {} }, null, 2),
      'utf8'
    );
  }
}

function readConfig() {
  try {
    ensureConfig();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
  } catch {
    return { channels: {}, votes: {}, emojis: {}, settings: {} };
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

export async function setSuggestionSettings(guildId, { color, banner }) {
  const config = readConfig();
  if (!config.settings) config.settings = {};
  const prev = config.settings[guildId] || {};
  config.settings[guildId] = {
    ...prev,
    ...(color !== undefined ? { color } : {}),
    ...(banner !== undefined ? { banner } : {}),
  };
  writeConfig(config);
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

function buildVoteRow(guildId, upCount = 0, downCount = 0) {
  const { up, down } = getGuildEmojis(guildId);

  const upBtn = new ButtonBuilder()
    .setCustomId(UP_ID)
    .setLabel(String(upCount))
    .setStyle(ButtonStyle.Secondary);

  const downBtn = new ButtonBuilder()
    .setCustomId(DOWN_ID)
    .setLabel(String(downCount))
    .setStyle(ButtonStyle.Secondary);

  try {
    const upEmoji = parseEmoji(up);
    if (upEmoji) upBtn.setEmoji(upEmoji);
  } catch {
    upBtn.setEmoji('👍');
  }

  try {
    const downEmoji = parseEmoji(down);
    if (downEmoji) downBtn.setEmoji(downEmoji);
  } catch {
    downBtn.setEmoji('👎');
  }

  return new ActionRowBuilder().addComponents(upBtn, downBtn);
}

export function buildPanelEmbed(guildId) {
  const { color, banner } = getSettings(guildId);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('💡 Panel de Sugerencias')
    .setDescription(
      '**¿Cómo funciona?**\n' +
        '• 1. Presiona el botón de abajo\n' +
        '• 2. Ingresa el título y detalles de tu sugerencia\n' +
        '• 3. Envíala y deja que la comunidad vote\n\n' +
        '> Las sugerencias ayudan a mejorar el servidor y a tomar decisiones basadas en la opinión de todos.'
    )
    .setFooter({ text: 'Envenenado RP • Sugerencias' });

  if (banner) embed.setImage(banner);
  return embed;
}

export function buildPanelButton() {
  // Primary = morado/azul Discord (como Verificarme)
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPEN_MODAL_ID)
      .setLabel('Publicar Sugerencia')
      .setEmoji('📣')
      .setStyle(ButtonStyle.Primary)
  );
}

export async function sendSuggestionPanel(channel) {
  await channel.send({
    embeds: [buildPanelEmbed(channel.guildId)],
    components: [buildPanelButton()],
  });
}

function buildSuggestionEmbed(guildId, user, title, details) {
  const { color } = getSettings(guildId);
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`💡 ${title}`)
    .setDescription(details)
    .addFields({
      name: '\u200b',
      value: `» **Sugerido por:** ${user}`,
    })
    .setFooter({ text: 'Envenenado RP • Sugerencias' })
    .setTimestamp();
}

export async function handleSuggestionInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === OPEN_MODAL_ID) {
    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle('Nueva sugerencia')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('sug_title')
            .setLabel('Título')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ej: Armas VIP')
            .setRequired(true)
            .setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('sug_details')
            .setLabel('Detalles')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Explica tu sugerencia...')
            .setRequired(true)
            .setMaxLength(1500)
        )
      );
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
    const title = interaction.fields.getTextInputValue('sug_title').trim();
    const details = interaction.fields.getTextInputValue('sug_details').trim();

    // Siempre al final del canal
    const embed = buildSuggestionEmbed(interaction.guildId, interaction.user, title, details);
    const row = buildVoteRow(interaction.guildId, 0, 0);

    const msg = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    saveVotes(msg.id, {
      up: [],
      down: [],
      authorId: interaction.user.id,
      title,
      details,
    });

    await interaction.reply({
      content: '✅ Tu sugerencia fue publicada.',
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isButton() && (interaction.customId === UP_ID || interaction.customId === DOWN_ID)) {
    const votes = getVotes(interaction.message.id);
    const userId = interaction.user.id;
    votes.up = (votes.up || []).filter((id) => id !== userId);
    votes.down = (votes.down || []).filter((id) => id !== userId);
    if (interaction.customId === UP_ID) votes.up.push(userId);
    else votes.down.push(userId);
    saveVotes(interaction.message.id, votes);
    await interaction.update({
      components: [buildVoteRow(interaction.guildId, votes.up.length, votes.down.length)],
    });
    return true;
  }

  return false;
}

export function isSuggestionInteraction(interaction) {
  if (interaction.isButton()) {
    return (
      interaction.customId === OPEN_MODAL_ID ||
      interaction.customId === UP_ID ||
      interaction.customId === DOWN_ID
    );
  }
  if (interaction.isModalSubmit()) return interaction.customId === MODAL_ID;
  return false;
}
