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

const TICKET_OPTIONS = [
  { label: 'Support Tickets', description: 'For Support Assistance', emoji: '💜', value: 'support' },
  { label: 'Staff Report', description: 'Report a Staff Member', emoji: '🔴', value: 'report' },
  { label: 'Donation', description: 'For Donations', emoji: '💳', value: 'donation' },
  { label: 'Ban Appeal', description: 'Appeal a Ban', emoji: '🔨', value: 'appeal' },
];

function buildPanelView() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('Make a selection')
    .addOptions(TICKET_OPTIONS);

  return new ActionRowBuilder().addComponents(select);
}

function buildActionView(claimedBy = null) {
  const claimBtn = new ButtonBuilder()
    .setCustomId(CLAIM_ID)
    .setLabel(claimedBy ? `Claimed by ${claimedBy}` : 'Claim Ticket')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🙋')
    .setDisabled(Boolean(claimedBy));

  const closeBtn = new ButtonBuilder()
    .setCustomId(CLOSE_ID)
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔒');

  return new ActionRowBuilder().addComponents(claimBtn, closeBtn);
}

function welcomeMessage(value, member) {
  switch (value) {
    case 'support':
      return `Welcome ${member} to Support Tickets. Please describe your issue.`;
    case 'report':
      return `Welcome ${member} to Staff Report. Please provide the details of the report.`;
    case 'donation':
      return `Welcome ${member}. Thank you for considering a donation! How can we help?`;
    case 'appeal':
      return `Welcome ${member}. Please provide details for your ban appeal.`;
    default:
      return `Welcome ${member}. Please describe your request.`;
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
    await interaction.reply({ content: `You already have a ticket open: ${existing}`, ephemeral: true });
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
      .setTitle(`Ticket Opened - ${value.charAt(0).toUpperCase()}${value.slice(1)}`)
      .setDescription(welcomeMessage(value, member))
      .setColor(0x2b2d31);

    await channel.send({
      content: `${member}`,
      embeds: [embed],
      components: [buildActionView()],
    });

    await interaction.reply({ content: `Ticket created! ${channel}`, ephemeral: true });
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error creating your ticket.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error creating your ticket.', ephemeral: true });
    }
  }
  return true;
}

async function claimTicket(interaction) {
  if (!canManageTickets(interaction.member)) {
    await interaction.reply({ content: "You don't have permission to claim this ticket.", ephemeral: true });
    return true;
  }
  await interaction.update({ components: [buildActionView(interaction.user.displayName)] });
  await interaction.channel.send(`Ticket has been claimed by ${interaction.user}.`);
  return true;
}

async function closeTicket(interaction) {
  const isStaff = canManageTickets(interaction.member);
  const isCreator = interaction.channel.topic?.includes(interaction.user.id);
  if (!isStaff && !isCreator) {
    await interaction.reply({ content: 'Only staff or the ticket creator can close this ticket.', ephemeral: true });
    return true;
  }
  await interaction.reply({ content: 'Closing ticket in 5 seconds...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
  return true;
}

export async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('Wisxo Nvr Tickets')
    .setDescription('To create a ticket use the dropdown below')
    .setColor(0x2b2d31)
    .setFooter({ text: 'TicketTool.xyz - Ticketing without clutter' });

  await channel.send({ embeds: [embed], components: [buildPanelView()] });
}

export function isWisxoTicketInteraction(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) return true;
  if (interaction.isButton() && (interaction.customId === CLAIM_ID || interaction.customId === CLOSE_ID)) return true;
  return false;
}
