import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/ticket-logs.json');

const SELECT_ID = 'wisxo_ticket_select';
const CLAIM_ID = 'wisxo_claim_ticket_btn';
const CLOSE_ID = 'wisxo_close_ticket_btn';
const RATE_PREFIX = 'wisxo_rate_';

const BANNER_URL =
  'https://cdn.discordapp.com/icons/1416544949083836458/05914d2317db529643e65275bd5cfe62.webp?size=1024';

const TICKET_OPTIONS = [
  {
    label: 'Soporte',
    description: 'Soporte general del servidor',
    emoji: '💜',
    value: 'soporte',
  },
  {
    label: 'PartnerShip',
    description: 'Solicitudes de partnership / alianza',
    emoji: '🤝',
    value: 'partnership',
  },
];

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

export function getTicketLogsChannelId(guildId) {
  const config = readConfig();
  return (
    config[`${guildId}_logs`] ||
    config[guildId] ||
    process.env.TICKET_LOGS_CHANNEL_ID ||
    null
  );
}

export function getTicketFeedbackChannelId(guildId) {
  const config = readConfig();
  return (
    config[`${guildId}_feedback`] ||
    process.env.TICKET_FEEDBACK_CHANNEL_ID ||
    null
  );
}

export async function setTicketLogsChannel(guildId, channelId) {
  const config = readConfig();
  config[`${guildId}_logs`] = channelId;
  config[guildId] = channelId;
  writeConfig(config);
}

export async function setTicketFeedbackChannel(guildId, channelId) {
  const config = readConfig();
  config[`${guildId}_feedback`] = channelId;
  writeConfig(config);
}

function buildPanelView() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('Haz una selección')
    .addOptions(TICKET_OPTIONS);
  return new ActionRowBuilder().addComponents(select);
}

function buildActionView(claimedBy = null) {
  const claimBtn = new ButtonBuilder()
    .setCustomId(CLAIM_ID)
    .setLabel(claimedBy ? `Reclamo por ${claimedBy}` : 'Reclamar Ticket')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🙋')
    .setDisabled(Boolean(claimedBy));

  const closeBtn = new ButtonBuilder()
    .setCustomId(CLOSE_ID)
    .setLabel('Cerrar Ticket')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔒');

  return new ActionRowBuilder().addComponents(claimBtn, closeBtn);
}

function buildRatingView() {
  const row = new ActionRowBuilder();
  for (let i = 1; i <= 5; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${RATE_PREFIX}${i}`)
        .setLabel(`${i}`)
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return row;
}

function starsText(n) {
  return '⭐'.repeat(n) + '☆'.repeat(5 - n);
}

function welcomeMessage(value, member) {
  switch (value) {
    case 'soporte':
      return `Bienvenid@ ${member} a Tickets de soporte. Por favor, describe tu problema.`;
    case 'partnership':
      return `Bienvenid@ ${member} aqui en este ticket puedes hacer alianza con nosotros.`;
    default:
      return `Bienvenid@ ${member}. Describe tu solicitud.`;
  }
}

function canManageTickets(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const roleId = process.env.SUPPORT_ROLE_ID;
  if (roleId && member.roles.cache.has(roleId)) return true;
  return false;
}

async function sendTicketLog(guild, { title, color, fields, user }) {
  const channelId = getTicketLogsChannelId(guild.id);
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'CasaB • Logs de Tickets' })
    .setTitle(title)
    .setColor(color)
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: 'Powered by CasaB' });

  if (user) embed.setThumbnail(user.displayAvatarURL({ size: 256 }));
  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function sendTicketFeedback(guild, { user, stars, channelName }) {
  const channelId = getTicketFeedbackChannelId(guild.id);
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'XF L • Calificación de Ticket' })
    .setTitle('Nueva calificación')
    .setColor(0xfee75c)
    .addFields(
      { name: 'Usuario', value: `${user} (\`${user.id}\`)`, inline: true },
      {
        name: 'Calificación',
        value: `${starsText(stars)} (${stars}/5)`,
        inline: true,
      },
      { name: 'Ticket', value: `\`${channelName}\``, inline: true }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setTimestamp()
    .setFooter({ text: 'Powered by Casa' });

  await channel.send({ embeds: [embed] }).catch(() => {});
}

export async function handleWisxoTicketInteraction(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
    return createTicket(interaction);
  }
  if (interaction.isButton() && interaction.customId === CLAIM_ID) {
    return claimTicket(interaction);
  }
  if (interaction.isButton() && interaction.customId === CLOSE_ID) {
    return closeTicket(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith(RATE_PREFIX)) {
    return rateTicket(interaction);
  }
  return false;
}

async function createTicket(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const value = interaction.values[0];

  const ticketName = `${value}-${member.user.username}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 90);

  const existing = guild.channels.cache.find(
    (c) => c.name === ticketName && c.type === ChannelType.GuildText
  );

  if (existing) {
    await interaction.reply({
      content: `Ya tienes un ticket abierto: ${existing}`,
      ephemeral: true,
    });
    return true;
  }

  const categoryName = `${value.charAt(0).toUpperCase()}${value.slice(1)} Tickets`;
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === categoryName
  );

  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: guild.members.me.id,
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
  }

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  const supportRoleId = process.env.SUPPORT_ROLE_ID;
  if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
    overwrites.push({
      id: supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  try {
    const channel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: overwrites,
      topic: `Ticket ${value} — opened by ${member.user.tag} (${member.id})`,
    });

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'XF L' })
      .setTitle(
        `Ticket abierto - ${value.charAt(0).toUpperCase()}${value.slice(1)}`
      )
      .setDescription(welcomeMessage(value, member))
      .setColor(0x9b59b6)
      .setImage(BANNER_URL)
      .setFooter({ text: 'Powered by Casa' });

    await channel.send({
      content: `${member}`,
      embeds: [embed],
      components: [buildActionView()],
    });

    await interaction.reply({
      content: `¡Ticket creado! ${channel}`,
      ephemeral: true,
    });

    await sendTicketLog(guild, {
      title: '🎫 Ticket creado',
      color: 0x57f287,
      user: member.user,
      fields: [
        {
          name: 'Usuario',
          value: `${member} (\`${member.id}\`)`,
          inline: true,
        },
        { name: 'Categoría', value: value, inline: true },
        { name: 'Canal', value: `${channel}`, inline: true },
      ],
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Hubo un error al crear tu ticket.',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'Hubo un error al crear tu ticket.',
        ephemeral: true,
      });
    }
  }

  return true;
}

async function claimTicket(interaction) {
  if (!canManageTickets(interaction.member)) {
    await interaction.reply({
      content: 'No tienes permiso para reclamar este ticket.',
      ephemeral: true,
    });
    return true;
  }

  await interaction.update({
    components: [buildActionView(interaction.user.displayName)],
  });

  await interaction.channel.send(
    `El ticket ha sido reclamado por ${interaction.user}.`
  );

  await sendTicketLog(interaction.guild, {
    title: '🙋 Ticket reclamado',
    color: 0x5865f2,
    user: interaction.user,
    fields: [
      {
        name: 'Staff',
        value: `${interaction.user} (\`${interaction.user.id}\`)`,
        inline: true,
      },
      { name: 'Canal', value: `${interaction.channel}`, inline: true },
    ],
  });

  return true;
}

async function closeTicket(interaction) {
  const isStaff = canManageTickets(interaction.member);
  const isCreator = interaction.channel.topic?.includes(interaction.user.id);

  if (!isStaff && !isCreator) {
    await interaction.reply({
      content: 'Solo el personal o quien creó el ticket puede cerrarlo.',
      ephemeral: true,
    });
    return true;
  }

  await sendTicketLog(interaction.guild, {
    title: '🔒 Ticket cerrado',
    color: 0xed4245,
    user: interaction.user,
    fields: [
      {
        name: 'Cerrado por',
        value: `${interaction.user} (\`${interaction.user.id}\`)`,
        inline: true,
      },
      {
        name: 'Canal',
        value: `\`${interaction.channel.name}\``,
        inline: true,
      },
    ],
  });

  const rateEmbed = new EmbedBuilder()
    .setAuthor({ name: 'XF L' })
    .setTitle('¿Cómo calificas la atención?')
    .setDescription(
      'Selecciona de **1 a 5 estrellas**.\nEl ticket se cerrará al votar (o en 60 segundos).'
    )
    .setColor(0xfee75c)
    .setFooter({ text: 'Powered by Casa' });

  await interaction.reply({
    embeds: [rateEmbed],
    components: [buildRatingView()],
  });

  const channel = interaction.channel;
  setTimeout(() => {
    if (channel) channel.delete().catch(() => {});
  }, 60000);

  return true;
}

async function rateTicket(interaction) {
  const stars = Number(interaction.customId.replace(RATE_PREFIX, ''));
  if (!stars || stars < 1 || stars > 5) {
    await interaction.reply({
      content: 'Calificación inválida.',
      ephemeral: true,
    });
    return true;
  }

  const channelName = interaction.channel.name;

  await sendTicketFeedback(interaction.guild, {
    user: interaction.user,
    stars,
    channelName,
  });

  const thanks = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('¡Gracias por tu calificación!')
    .setDescription(
      `Tu voto: **${starsText(stars)}** (${stars}/5)\nCerrando el ticket...`
    )
    .setFooter({ text: 'Powered by Casa' });

  await interaction.update({
    embeds: [thanks],
    components: [],
  });

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 3000);

  return true;
}

export async function sendTicketPanel(channel, imageUrl = null) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: 'XF L' })
    .setTitle('Ayuda y Soporte')
    .setDescription('Abre un ticket interactuando con el menú de abajo.')
    .setColor(0x000000)
    .setFooter({ text: 'Powered by Casa' });

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  await channel.send({ embeds: [embed], components: [buildPanelView()] });
}

export function isWisxoTicketInteraction(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
    return true;
  }
  if (
    interaction.isButton() &&
    (interaction.customId === CLAIM_ID ||
      interaction.customId === CLOSE_ID ||
      interaction.customId.startsWith(RATE_PREFIX))
  ) {
    return true;
  }
  return false;
}
