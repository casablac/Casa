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
        .setName('logs')
        .setDescription('Canal de logs (quién creó / reclamó / cerró el ticket)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('feedback')
        .setDescription('Canal de calificaciones (estrellas) — opcional')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
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

      await setTicketLogsChannel(interaction.guild.id, logsChannel.id);

      if (feedbackChannel) {
        await setTicketFeedbackChannel(interaction.guild.id, feedbackChannel.id);
      }

      await sendTicketPanel(panelChannel);

      const fields = [
        { name: '📌 Panel de tickets', value: `${panelChannel}`, inline: true },
        { name: '📋 Canal de logs', value: `${logsChannel}`, inline: true },
      ];

      if (feedbackChannel) {
        fields.push({
          name: '⭐ Canal de feedback',
          value: `${feedbackChannel}`,
          inline: true,
        });
      } else {
        fields.push({
          name: '⭐ Canal de feedback',
          value: '`No configurado (opcional)`',
          inline: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({ name: 'Tu Servidor RP' })
        .setTitle('Tickets configurados')
        .setDescription('El sistema de tickets quedó listo.')
        .addFields(fields)
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
