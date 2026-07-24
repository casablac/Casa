import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { sendTicketPanel } from '../../features/wisxoTicket.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Set up the Wisxo ticket panel (creates #create-ticket if needed)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'Ticket',

  async execute(interaction) {
    const guild = interaction.guild;
    let channel = guild.channels.cache.find(
      (c) => c.name === 'create-ticket' && c.type === ChannelType.GuildText
    );

    if (!channel) {
      try {
        channel = await guild.channels.create({
          name: 'create-ticket',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionFlagsBits.ViewChannel],
              deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
            },
            {
              id: guild.members.me.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
          ],
        });
      } catch (error) {
        await interaction.reply({
          content: `Failed to create channel: ${error.message}`,
          ephemeral: true,
        });
        return;
      }
    }

    await sendTicketPanel(channel);
    await interaction.reply({
      content: `Ticket panel setup successfully in ${channel}!`,
      ephemeral: true,
    });
  },
};
