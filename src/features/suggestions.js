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

// ====== PERSONALIZA AQUÍ ======
const PANEL_BANNER =
  'https://media.discordapp.net/attachments/1243043552972247110/1530369578008444949/generated.gif?ex=6a65533c&is=6a6401bc&hm=fd06cc615111feb050a31aa31811b5ad0ed5339e7c682fe728936f25cfbf841d&=&width=400&height=99';
const PANEL_FOOTER_IMAGE =
  'https://media.discordapp.net/attachments/1522044644140126290/1530370815919394866/image__2_-removebg-preview.png?ex=6a655463&is=6a6402e3&hm=cd74e7f0b1ede85cd85d49eac201a662b9e34cb64d12801d75885585ea189621&=&format=webp&quality=lossless';
const UP_EMOJI = '👍';
const DOWN_EMOJI = '👎';
const COLOR = 0xF5A623;
// ==============================

function ensureConfig() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ channels: {}, votes: {}, emojis: {} }, null, 2),
      'utf8'
    );
  }
}

function readConfig() {
  try {
    ensureConfig();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
  } catch {
    return { channels: {}, votes: {}, emojis: {} };
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

/** Acepta: 👍 | <:name:id> | <a:name:id> | solo id numérico */
function parseEmoji(input) {
  if (!input) return undefined;
  const raw = String(input).trim();

  // Unicode (👍, 🔥, etc.)
  if (!raw.includes('<') && !/^\d+$/.test(raw)) {
    return raw;
  }

  // <:name:123456> o <a:name:123456>
  const match = raw.match(/<?(a)?:?(\w+):(\d+)>?/);
  if (match) {
    return {
      animated: Boolean(match[1]),
      name: match[2],
      id: match[3],
    };
  }

  // Solo ID
  if (/^\d+$/.test(raw)) {
    return { id: raw };
  }

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

  const upEmoji = parseEmoji(up);
  const downEmoji = parseEmoji(down);

  if (upEmoji) upBtn.setEmoji(upEmoji);
  if (downEmoji) downBtn.setEmoji(downEmoji);

  return new ActionRowBuilder().addComponents(upBtn, downBtn);
}

export function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setImage(PANEL_BANNER)
    .setTitle('💡 Panel de Sugerencias')
    .setDescription(
      '**¿Cómo funciona?**\n' +
        '• 1. Presiona el botón de abajo\n' +
        '• 2. Ingresa el título y detalles de tu sugerencia\n' +
        '• 3. Envíala y deja que la comunidad vote\n\n' +
        '> Las sugerencias ayudan a mejorar el servidor y a tomar decisiones basadas en la opinión de todos.'
    )
    .setFooter({ text: 'Envenenado RP • Sugerencias' });
}

export function buildPanelButton() {
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
    embeds: [buildPanelEmbed()],
    components: [buildPanelButton()],
  });
}

function buildSuggestionEmbed(user, title, details) {
  return new EmbedBuilder()
    .setColor(COLOR)
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
  // Abrir modal
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

  // Enviar sugerencia (modal)
  if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
    const title = interaction.fields.getTextInputValue('sug_title').trim();
    const details = interaction.fields.getTextInputValue('sug_details').trim();

    const embed = buildSuggestionEmbed(interaction.user, title, details);
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

  // Votos
  if (interaction.isButton() && (interaction.customId === UP_ID || interaction.customId === DOWN_ID)) {
    const votes = getVotes(interaction.message.id);
    const userId = interaction.user.id;

    votes.up = (votes.up || []).filter((id) => id !== userId);
    votes.down = (votes.down || []).filter((id) => id !== userId);

    if (interaction.customId === UP_ID) votes.up.push(userId);
    else votes.down.push(userId);

    saveVotes(interaction.message.id, votes);

    await interaction.update({
      components: [
        buildVoteRow(interaction.guildId, votes.up.length, votes.down.length),
      ],
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
  if (interaction.isModalSubmit()) {
    return interaction.customId === MODAL_ID;
  }
  return false;
}
