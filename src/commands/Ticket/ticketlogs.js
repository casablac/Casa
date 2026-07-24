import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { setTicketLogsChannel, getTicketLogsChannelId } from '../../features/wisxoTicket.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticketlogs')
    .setDescription('Configura el canal de logs de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('canal')
        .setDescription('Canal donde se enviarán los logs de tickets')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  category: 'Ticket',

  async execute(interaction) {
    const channel = interaction.options.getChannel('canal');

    await setTicketLogsChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('Logs de tickets configurados')
      .setDescription(`Los logs se enviarán a ${channel}`)
      .setFooter({ text: 'Envenenado RP • Powered by Bandido' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
