import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/suggestions.json');

const UP_ID = 'sug_upvote';
const DOWN_ID = 'sug_downvote';

function ensureConfigFile() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ channels: {}, votes: {} }, null, 2), 'utf8');
  }
}

function readConfig() {
  try {
    ensureConfigFile();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
  } catch {
    return { channels: {}, votes: {} };
  }
}

function writeConfig(data) {
  ensureConfigFile();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getSuggestionChannelId(guildId) {
  const config = readConfig();
  return config.channels?.[guildId] || null;
}

export async function setSuggestionChannel(guildId, channelId) {
  const config = readConfig();
  if (!config.channels) config.channels = {};
  config.channels[guildId] = channelId;
  writeConfig(config);
}

function getVoteKey(messageId) {
  return messageId;
}

function getVotes(messageId) {
  const config = readConfig();
  const key = getVoteKey(messageId);
  return config.votes?.[key] || { up: [], down: [] };
}

function saveVotes(messageId, votes) {
  const config = readConfig();
  if (!config.votes) config.votes = {};
  config.votes[getVoteKey(messageId)] = votes;
  writeConfig(config);
}

function buildVoteRow(upCount = 0, downCount = 0) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(UP_ID)
      .setLabel(`👍 ${upCount}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(DOWN_ID)
      .setLabel(`👎 ${downCount}`)
      .setStyle(ButtonStyle.Danger),
  );
}

export async function postSuggestion(channel, user, text) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL({ size: 256 }),
    })
    .setTitle('💡 Nueva sugerencia')
    .setDescription(text)
    .setColor(0x9B59B6)
    .addFields(
      { name: 'Estado', value: '⏳ Pendiente', inline: true },
      { name: 'Votos', value: '👍 0 | 👎 0', inline: true },
    )
    .setFooter({ text: 'Envenenado RP • Sistema de Sugerencias' })
    .setTimestamp();

  const msg = await channel.send({
    embeds: [embed],
    components: [buildVoteRow(0, 0)],
  });

  saveVotes(msg.id, { up: [], down: [], authorId: user.id, text });
  return msg;
}

export async function handleSuggestionInteraction(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId !== UP_ID && interaction.customId !== DOWN_ID) return false;

  const message = interaction.message;
  const votes = getVotes(message.id);
  const userId = interaction.user.id;

  // Un solo voto por persona (si cambia, se mueve al otro)
  votes.up = votes.up.filter((id) => id !== userId);
  votes.down = votes.down.filter((id) => id !== userId);

  if (interaction.customId === UP_ID) {
    votes.up.push(userId);
  } else {
    votes.down.push(userId);
  }

  saveVotes(message.id, votes);

  const upCount = votes.up.length;
  const downCount = votes.down.length;

  const oldEmbed = message.embeds[0];
  const embed = EmbedBuilder.from(oldEmbed)
    .setFields(
      ...(oldEmbed.fields || []).map((field) => {
        if (field.name === 'Votos') {
          return {
            name: 'Votos',
            value: `👍 ${upCount} | 👎 ${downCount}`,
            inline: true,
          };
        }
        return field;
      }),
    );

  // Si no había campo Votos, lo agregamos
  if (!(oldEmbed.fields || []).some((f) => f.name === 'Votos')) {
    embed.addFields({ name: 'Votos', value: `👍 ${upCount} | 👎 ${downCount}`, inline: true });
  }

  await interaction.update({
    embeds: [embed],
    components: [buildVoteRow(upCount, downCount)],
  });

  return true;
}

export function isSuggestionInteraction(interaction) {
  return (
    interaction.isButton() &&
    (interaction.customId === UP_ID || interaction.customId === DOWN_ID)
  );
}
