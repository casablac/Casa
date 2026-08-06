import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  sendTicketPanel,
  setTicketFeedbackChannel,
  setTicketLogsChannel,
} from '../../features/wisxoTicket.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Configura panel, feedback y logs de tickets')
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
    )
    .addChannelOption((opt) =>
      opt
        .setName('logs')
        .setDescription('Canal de logs (quién creó / reclamó / cerró el ticket)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  category: 'Ticket',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const panelChannel = interaction.options.getChannel('panel');
      const feedbackChannel = interaction.options.getChannel('feedback');
      const logsChannel = interaction.options.getChannel('logs');

      const me = interaction.guild.members.me;
      const perms = panelChannel.permissionsFor(me);
      if (!perms?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return interaction.editReply({
          content:
            '❌ No tengo permisos en el canal del **panel**.\n' +
            'Necesito: Ver canal, Enviar mensajes e Insertar enlaces.',
        });
      }

      await setTicketFeedbackChannel(interaction.guild.id, feedbackChannel.id);
      await setTicketLogsChannel(interaction.guild.id, logsChannel.id);
      await sendTicketPanel(panelChannel);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({ name: 'Tu Servidor RP' }) // ← cambia el nombre aquí
        .setTitle('Tickets configurados')
        .setDescription('El sistema de tickets quedó listo.')
        .addFields(
          { name: '📌 Panel de tickets', value: `${panelChannel}`, inline: true },
          { name: '⭐ Canal de feedback', value: `${feedbackChannel}`, inline: true },
          { name: '📋 Canal de logs', value: `${logsChannel}`, inline: true }
        )
        .setFooter({ text: 'Powered by Bandido' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ticketsetup] Error:', error);
      await interaction
        .editReply({
          content: `❌ Error:\n\`\`\`${error?.message || error}\`\`\``,
        })
        .catch(() => {});
    }
  },
};
