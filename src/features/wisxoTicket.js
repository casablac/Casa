import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

const SELECT_ID = 'wisxo_ticket_select';
const CLAIM_ID = 'wisxo_claim_ticket_btn';
const CLOSE_ID = 'wisxo_close_ticket_btn';

const BANNER_URL = 'https://media.discordapp.net/attachments/1529542705343102987/1529551027680841808/envenenado_rp.gif';

const TICKET_OPTIONS = [
  { label: 'Soporte', description: 'Soporte', emoji: '💜', value: 'soporte' },
  { label: 'Reportar Staff', description: 'Reportar Miembro De Staff', emoji: '🔴', value: 'reportar' },
  { label: 'Donacion', description: 'Para Donacion', emoji: '💳', value: 'donacion' },
  { label: 'Apelar Ban', description: 'Apelar Tu Ban', emoji: '🔨', value: 'apelacion' },
  { label: 'Organizaciones', description: 'Para Crar Org', emoji: '🔫', value: 'organizaciones' },
];

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

function welcomeMessage(value, member) {
  switch (value) {
    case 'soporte':
      return `Bienvenid@ ${member} a Tickets de soporte. Por favor, describe tu problema.`;
    case 'reportar':
      return `Bienvenid@ ${member} al informe del staff. Por favor, proporciona los detalles del reporte.`;
    case 'donacion':
      return `Bienvenid@ ${member}. ¡Gracias por considerar hacer una donación! ¿Cómo podemos ayudar?`;
    case 'apelacion':
      return `Bienvenid@ ${member}. Por favor, proporciona detalles para tu apelación de baneo.`;
    case 'org':
      return `Bienvenid@ ${member}. Aqui es para crear tu organizacion.`;
  }
}

function canManageTickets(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const roleId = process.env.SUPPORT_ROLE_ID;
  if (roleId && member.roles.cache.has(roleId)) return true;
  return false;
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
    await interaction.reply({ content: `Ya tienes un ticket abierto: ${existing}`, ephemeral: true });
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
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  }

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
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
      .setAuthor({ name: 'Envenenado RP' })
      .setTitle(`Ticket abierto - ${value.charAt(0).toUpperCase()}${value.slice(1)}`)
      .setDescription(welcomeMessage(value, member))
      .setColor(0x9B59B6)
      .setImage(BANNER_URL)
      .setFooter({ text: 'Powered by Bandido' });

    await channel.send({
      content: `${member}`,
      embeds: [embed],
      components: [buildActionView()],
    });

    await interaction.reply({ content: `¡Ticket creado! ${channel}`, ephemeral: true });
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Hubo un error al crear tu ticket.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Hubo un error al crear tu ticket.', ephemeral: true });
    }
  }
  return true;
}

async function claimTicket(interaction) {
  if (!canManageTickets(interaction.member)) {
    await interaction.reply({ content: 'No tienes permiso para reclamar este ticket.', ephemeral: true });
    return true;
  }
  await interaction.update({ components: [buildActionView(interaction.user.displayName)] });
  await interaction.channel.send(`El ticket ha sido reclamado por ${interaction.user}.`);
  return true;
}

async function closeTicket(interaction) {
  const isStaff = canManageTickets(interaction.member);
  const isCreator = interaction.channel.topic?.includes(interaction.user.id);
  if (!isStaff && !isCreator) {
    await interaction.reply({ content: 'Solo el personal o quien creó el ticket puede cerrarlo.', ephemeral: true });
    return true;
  }
  await interaction.reply({ content: 'Cerrando el ticket en 5 segundos...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
  return true;
}

export async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: 'Envenenado RP' })
    .setTitle('Ayuda y Soporte')
    .setDescription('Abre un ticket interactuando con el menú de abajo. Recuerda que si abres ticket sin una razón podrás ser sancionado.')
    .setColor(0x9B59B6)
    .setImage(BANNER_URL)
    .setFooter({ text: 'Powered by Bandido' });

  await channel.send({ embeds: [embed], components: [buildPanelView()] });
}

export function isWisxoTicketInteraction(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) return true;
  if (interaction.isButton() && (interaction.customId === CLAIM_ID || interaction.customId === CLOSE_ID)) return true;
  return false;
}
