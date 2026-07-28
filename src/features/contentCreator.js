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
const CONFIG_PATH = path.join(__dirname, '../../data/content-creator.json');

const OPEN_ID = 'cc_open_modal';
const APPROVE_ID = 'cc_approve';
const REJECT_ID = 'cc_reject';
const MODAL_ID = 'cc_submit_modal';

const DEFAULT_BANNER = 'https://i.imgur.com/CHwoiQX.gif';
const DEFAULT_COLOR = 0x9b59b6;

function ensureConfig() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
  }
}

function readConfig() {
  try {
    ensureConfig();
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8') || '{}');
  } catch {
    return { guilds: {} };
  }
}

function writeConfig(data) {
  ensureConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getCCConfig(guildId) {
  const all = readConfig();
  return all.guilds?.[guildId] || {};
}

export async function setCCConfig(guildId, patch) {
  const all = readConfig();
  if (!all.guilds) all.guilds = {};
  all.guilds[guildId] = { ...(all.guilds[guildId] || {}), ...patch };
  writeConfig(all);
}

function canReview(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const cfg = getCCConfig(member.guild.id);
  if (cfg.staffRoleId && member.roles.cache.has(cfg.staffRoleId)) return true;
  return false;
}

export function buildPanelEmbed(guildId) {
  const cfg = getCCConfig(guildId);
  const embed = new EmbedBuilder()
    .setColor(cfg.color ?? DEFAULT_COLOR)
    .setTitle('🎥 Creadores de Contenido')
    .setDescription(
      cfg.description ||
        'Haz clic abajo para postularte como **Creador de Contenido**.\n' +
          'Recuerda leer los requisitos antes de abrir la solicitud.'
    )
    .setFooter({ text: 'Envenenado RP • Creadores de Contenido' });

  if (cfg.banner) embed.setImage(cfg.banner);
  else embed.setImage(DEFAULT_BANNER);

  return embed;
}

export function buildPanelButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPEN_ID)
      .setLabel('Postularme')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
  );
}

export async function sendCCPanel(channel) {
  await channel.send({
    embeds: [buildPanelEmbed(channel.guildId)],
    components: [buildPanelButton()],
  });
}

function buildReviewButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${APPROVE_ID}:${userId}`)
      .setLabel('Aceptar')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`${REJECT_ID}:${userId}`)
      .setLabel('Rechazar')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );
}

function buildDisabledButtons(approved) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cc_done_approve')
      .setLabel(approved ? 'Aceptado' : 'Aceptar')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('cc_done_reject')
      .setLabel(approved ? 'Rechazar' : 'Rechazado')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true)
  );
}

export async function handleCCInteraction(interaction, client) {
  // Abrir modal
  if (interaction.isButton() && interaction.customId === OPEN_ID) {
    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle('Postulación Creador de Contenido')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('cc_platform')
            .setLabel('Plataforma (Twitch / YouTube / TikTok...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('cc_link')
            .setLabel('Link de tu canal')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('cc_followers')
            .setLabel('Seguidores / suscriptores aprox.')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(30)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('cc_reason')
            .setLabel('¿Por qué quieres el rol?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(800)
        )
      );

    await interaction.showModal(modal);
    return true;
  }

  // Enviar postulación
  if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
    const cfg = getCCConfig(interaction.guild.id);
    if (!cfg.reviewChannelId) {
      await interaction.reply({
        content: 'El sistema no está configurado. Un admin debe usar `/creador setup`.',
        ephemeral: true,
      });
      return true;
    }

    const platform = interaction.fields.getTextInputValue('cc_platform').trim();
    const link = interaction.fields.getTextInputValue('cc_link').trim();
    const followers = interaction.fields.getTextInputValue('cc_followers').trim();
    const reason = interaction.fields.getTextInputValue('cc_reason').trim();

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('📝 Nueva postulación — Creador de Contenido')
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👤 Usuario', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: false },
        { name: '📺 Plataforma', value: platform, inline: true },
        { name: '🔗 Link', value: link, inline: true },
        { name: '📊 Seguidores', value: followers, inline: true },
        { name: '💬 Motivo', value: reason.slice(0, 1024), inline: false },
        { name: '📍 Estado', value: '🟡 Pendiente', inline: true }
      )
      .setFooter({ text: 'Envenenado RP • Creadores de Contenido' })
      .setTimestamp();

    const reviewChannel = await interaction.guild.channels
      .fetch(cfg.reviewChannelId)
      .catch(() => null);

    if (!reviewChannel) {
      await interaction.reply({
        content: 'No encontré el canal de revisión. Reconfigura con `/creador setup`.',
        ephemeral: true,
      });
      return true;
    }

    await reviewChannel.send({
      embeds: [embed],
      components: [buildReviewButtons(interaction.user.id)],
    });

    await interaction.reply({
      content: '✅ Tu postulación fue enviada. Te avisaremos por DM cuando sea revisada.',
      ephemeral: true,
    });
    return true;
  }

  // Aceptar / Rechazar
  if (
    interaction.isButton() &&
    (interaction.customId.startsWith(`${APPROVE_ID}:`) ||
      interaction.customId.startsWith(`${REJECT_ID}:`))
  ) {
    if (!canReview(interaction.member)) {
      await interaction.reply({
        content: 'No tienes permiso para revisar postulaciones.',
        ephemeral: true,
      });
      return true;
    }

    const isApprove = interaction.customId.startsWith(APPROVE_ID);
    const userId = interaction.customId.split(':')[1];
    const cfg = getCCConfig(interaction.guild.id);
    const statusColor = isApprove ? 0x57f287 : 0xed4245;
    const statusText = isApprove
      ? `🟢 Aceptado por ${interaction.user}`
      : `🔴 Rechazado por ${interaction.user}`;

    // Actualizar embed
    const original = interaction.message.embeds[0];
    const updated = EmbedBuilder.from(original)
      .setColor(statusColor)
      .setFields(
        ...(original.fields || []).map((f) => {
          if (f.name?.includes('Estado')) {
            return { name: f.name, value: statusText, inline: f.inline };
          }
          return f;
        })
      )
      .setTimestamp();

    await interaction.message.edit({
      embeds: [updated],
      components: [buildDisabledButtons(isApprove)],
    });

    // Rol (si está configurado y aceptado)
    let roleMsg = '';
    if (isApprove && cfg.roleId) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(cfg.roleId);
        roleMsg = `\nSe te asignó el rol de **Creador de Contenido**.`;
      } catch {
        roleMsg = '\n(No se pudo asignar el rol automáticamente.)';
      }
    }

    // DM al usuario
    try {
      const user = await client.users.fetch(userId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(statusColor)
            .setTitle(isApprove ? '✅ Postulación aceptada' : '❌ Postulación rechazada')
            .setDescription(
              isApprove
                ? `Tu postulación como **Creador de Contenido** en **${interaction.guild.name}** fue **aceptada**.${roleMsg}`
                : `Tu postulación como **Creador de Contenido** en **${interaction.guild.name}** fue **rechazada**.`
            )
            .setFooter({ text: 'Envenenado RP' })
            .setTimestamp(),
        ],
      });
    } catch {
      // DMs cerrados
    }

    // Log opcional
    if (cfg.logChannelId) {
      const logCh = await interaction.guild.channels.fetch(cfg.logChannelId).catch(() => null);
      if (logCh) {
        await logCh.send({
          embeds: [
            new EmbedBuilder()
              .setColor(statusColor)
              .setTitle(isApprove ? 'Creador aceptado' : 'Creador rechazado')
              .addFields(
                { name: 'Usuario', value: `<@${userId}>`, inline: true },
                { name: 'Staff', value: `${interaction.user}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      }
    }

    await interaction.reply({
      content: isApprove
        ? `✅ Se aceptó a <@${userId}>.`
        : `❌ Se rechazó a <@${userId}>.`,
      ephemeral: true,
    });
    return true;
  }

  return false;
}

export function isCCInteraction(interaction) {
  if (interaction.isButton()) {
    const id = interaction.customId;
    return (
      id === OPEN_ID ||
      id.startsWith(`${APPROVE_ID}:`) ||
      id.startsWith(`${REJECT_ID}:`) ||
      id === 'cc_done_approve' ||
      id === 'cc_done_reject'
    );
  }
  if (interaction.isModalSubmit()) {
    return interaction.customId === MODAL_ID;
  }
  return false;
}
