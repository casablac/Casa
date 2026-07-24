import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  sendTicketPanel,
  setTicketFeedbackChannel,
} from '../../features/wisxoTicket.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Configura el panel de tickets y el canal de calificaciones')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('panel')
        .setDescription('Canal donde se enviará el embed para abrir tickets')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('feedback')
        .setDescription('Canal donde llegarán las calificaciones (estrellas)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  category: 'Ticket',

  async execute(interaction) {
    const panelChannel = interaction.options.getChannel('panel');
    const feedbackChannel = interaction.options.getChannel('feedback');

    await setTicketFeedbackChannel(interaction.guild.id, feedbackChannel.id);
    await sendTicketPanel(panelChannel);

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setAuthor({ name: 'Envenenado RP' })
      .setTitle('Tickets configurados')
      .setDescription('El sistema de tickets quedó listo.')
      .addFields(
        { name: '📌 Panel de tickets', value: `${panelChannel}`, inline: true },
        { name: '⭐ Canal de feedback', value: `${feedbackChannel}`, inline: true }
      )
      .setFooter({ text: 'Powered by Bandido' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
