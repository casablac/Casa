import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/leaks-apply.json');

const PANEL_BTN = 'leaks_apply_open';
const ACCEPT_PREFIX = 'leaks_apply_accept:';
const REJECT_PREFIX = 'leaks_apply_reject:';
const MODAL_ID = 'leaks_apply_modal';

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

export function getLeaksApplyConfig(guildId) {
  const config = readConfig();
  return config[guildId] || null;
}

export function setLeaksApplyConfig(guildId, data) {
  const config = readConfig();
  config[guildId] = { ...(config[guildId] || {}), ...data };
  writeConfig(config);
}

function buildPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_BTN)
      .setLabel('Postular')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
  );
}

export async function sendLeaksApplyPanel(channel, imageUrl = null) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: 'XF L' })
    .setTitle('Postulación — Rol Leaks')
    .setDescription(
      '¿Quieres subir videos/clips en el servidor?\n\n' +
        'Haz clic en **Postular**, responde las preguntas y espera la revisión del staff.\n' +
        'Si eres aceptado recibirás el rol **leaks** y podrás subir contenido.'
    )
    .setColor(0x9b59b6)
    .setFooter({ text: 'Powered by Casa' });

  if (imageUrl) embed.setImage(imageUrl);

  await channel.send({
    embeds: [embed],
    components: [buildPanelButtons()],
  });
}

function buildApplyModal() {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Postulación Leaks');

  const q1 = new TextInputBuilder()
    .setCustomId('q_why')
    .setLabel('¿Por qué quieres el rol leaks?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Cuéntanos en pocas líneas...')
    .setRequired(true)
    .setMaxLength(500);

  const q2 = new TextInputBuilder()
    .setCustomId('q_content')
    .setLabel('¿Qué tipo de videos subes?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ej: clips FiveM, drifts, roleplay...')
    .setRequired(true)
    .setMaxLength(400);

  const q3 = new TextInputBuilder()
    .setCustomId('q_rules')
    .setLabel('¿Aceptas no subir spam ni basura? (Sí/No)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Sí')
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder().addComponents(q1),
    new ActionRowBuilder().addComponents(q2),
    new ActionRowBuilder().addComponents(q3)
  );

  return modal;
}

export function isLeaksApplyInteraction(interaction) {
  if (interaction.isButton()) {
    const id = interaction.customId;
    return (
      id === PANEL_BTN ||
      id.startsWith(ACCEPT_PREFIX) ||
      id.startsWith(REJECT_PREFIX)
    );
  }
  if (interaction.isModalSubmit()) {
    return interaction.customId === MODAL_ID;
  }
  return false;
}

export async function handleLeaksApplyInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === PANEL_BTN) {
    return openApplyModal(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
    return submitApplication(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith(ACCEPT_PREFIX)) {
    return reviewApplication(interaction, true);
  }
  if (interaction.isButton() && interaction.customId.startsWith(REJECT_PREFIX)) {
    return reviewApplication(interaction, false);
  }
  return false;
}

async function openApplyModal(interaction) {
  const cfg = getLeaksApplyConfig(interaction.guild.id);
  if (!cfg?.logsChannelId || !cfg?.roleId) {
    await interaction.reply({
      content: '❌ El sistema de postulación no está configurado. Usa `/leakssetup`.',
      ephemeral: true,
    });
    return true;
  }

  if (interaction.member.roles.cache.has(cfg.roleId)) {
    await interaction.reply({
      content: '✅ Ya tienes el rol **leaks**.',
      ephemeral: true,
    });
    return true;
  }

  await interaction.showModal(buildApplyModal());
  return true;
}

async function submitApplication(interaction) {
  const cfg = getLeaksApplyConfig(interaction.guild.id);
  if (!cfg?.logsChannelId || !cfg?.roleId) {
    await interaction.reply({
      content: '❌ Sistema no configurado.',
      ephemeral: true,
    });
    return true;
  }

  const why = interaction.fields.getTextInputValue('q_why');
  const content = interaction.fields.getTextInputValue('q_content');
  const rules = interaction.fields.getTextInputValue('q_rules');

  const logsChannel =
    interaction.guild.channels.cache.get(cfg.logsChannelId) ||
    (await interaction.guild.channels.fetch(cfg.logsChannelId).catch(() => null));

  if (!logsChannel) {
    await interaction.reply({
      content: '❌ No encuentro el canal de logs de postulación.',
      ephemeral: true,
    });
    return true;
  }

  const user = interaction.user;
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${user.tag}`,
      iconURL: user.displayAvatarURL({ size: 128 }),
    })
    .setTitle('Nueva postulación — Leaks')
    .setColor(0xfee75c)
    .addFields(
      { name: 'Usuario', value: `${user} (\`${user.id}\`)`, inline: false },
      { name: '¿Por qué quiere el rol?', value: why.slice(0, 1024) || '-' },
      { name: 'Tipo de contenido', value: content.slice(0, 1024) || '-' },
      { name: 'Acepta reglas', value: rules.slice(0, 1024) || '-', inline: true },
      { name: 'Estado', value: '🟡 Pendiente', inline: true }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setTimestamp()
    .setFooter({ text: `ID: ${user.id}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACCEPT_PREFIX}${user.id}`)
      .setLabel('Aceptar')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`${REJECT_PREFIX}${user.id}`)
      .setLabel('Rechazar')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  await logsChannel.send({ embeds: [embed], components: [row] });

  await interaction.reply({
    content:
      '✅ Postulación enviada. El staff la revisará. Te avisaremos cuando haya respuesta.',
    ephemeral: true,
  });

  return true;
}

async function reviewApplication(interaction, accept) {
  if (
    !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) &&
    !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({
      content: '❌ Solo el staff puede aceptar o rechazar.',
      ephemeral: true,
    });
    return true;
  }

  const cfg = getLeaksApplyConfig(interaction.guild.id);
  if (!cfg?.roleId) {
    await interaction.reply({
      content: '❌ Sistema no configurado.',
      ephemeral: true,
    });
    return true;
  }

  const userId = interaction.customId.split(':')[1];
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  const old = interaction.message.embeds[0];
  const embed = EmbedBuilder.from(old || {});

  const fields = (old?.fields || []).filter((f) => f.name !== 'Estado');
  fields.push({
    name: 'Estado',
    value: accept
      ? `🟢 Aceptado por ${interaction.user} — dale el rol manualmente`
      : `🔴 Rechazado por ${interaction.user}`,
    inline: true,
  });
  embed.setFields(fields);
  embed.setColor(accept ? 0x57f287 : 0xed4245);

  await interaction.update({
    embeds: [embed],
    components: [],
  });

  // NO se da el rol automático — tú se lo das a mano
  if (member) {
    if (accept) {
      await member
        .send(
          `✅ Tu postulación en **${interaction.guild.name}** fue **aceptada**.\nUn staff te dará el rol **leaks** pronto.`
        )
        .catch(() => {});
    } else {
      await member
        .send(
          `❌ Tu postulación en **${interaction.guild.name}** fue **rechazada**. Puedes volver a intentarlo más adelante.`
        )
        .catch(() => {});
    }
  }

  return true;
}
