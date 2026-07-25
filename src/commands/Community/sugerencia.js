import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  setSuggestionChannel,
  sendSuggestionPanel,
  setSuggestionSettings,
} from '../../features/suggestions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription('Sistema de sugerencias')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Poner el panel de sugerencias en un canal')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal del panel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Color hex sin # (ej: 9B59B6)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('imagen')
            .setDescription('URL de la imagen del panel')
            .setRequired(false)
        )
    ),

  category: 'Community',

  async execute(interaction) {
    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: 'Solo administradores.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('canal');
      const colorRaw = interaction.options.getString('imagen') ? null : interaction.options.getString('color');
      // color
      const colorText = interaction.options.getString('color');
      const imagen = interaction.options.getString('imagen');

      if (colorText) {
        const hex = colorText.replace('#', '');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
          return interaction.reply({
            content: 'Color inválido. Ejemplo: `9B59B6`',
            ephemeral: true,
          });
        }
        await setSuggestionSettings(interaction.guild.id, {
          color: parseInt(hex, 16),
        });
      }

      if (imagen) {
        if (!imagen.startsWith('http')) {
          return interaction.reply({
            content: 'La imagen debe ser un link `https://...`',
            ephemeral: true,
          });
        }
        await setSuggestionSettings(interaction.guild.id, { banner: imagen });
      }

      await setSuggestionChannel(interaction.guild.id, channel.id);
      await sendSuggestionPanel(channel);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Panel listo')
            .setDescription(`Panel enviado a ${channel}`),
        ],
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error en /sugerencia:', error);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({
          content: `Error: ${error.message}`,
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: `Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
