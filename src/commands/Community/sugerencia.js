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
  setGuildEmojis,
} from '../../features/suggestions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription('Sistema de sugerencias')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Poner el panel de sugerencias en un canal')
        .addChannelOption((o) =>
          o
            .setName('canal')
            .setDescription('Canal del panel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('color').setDescription('Color hex ej: 9B59B6').setRequired(false)
        )
        .addStringOption((o) =>
          o.setName('banner').setDescription('Imagen del PANEL[](https://...)').setRequired(false)
        )
        .addStringOption((o) =>
          o
            .setName('imagen_sugerencia')
            .setDescription('Imagen de cada sugerencia[](https://...)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('emojis')
        .setDescription('Elegir emojis custom de voto')
        .addStringOption((o) =>
          o
            .setName('positivo')
            .setDescription('Ej: <:up:123> o el ID del emoji')
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('negativo')
            .setDescription('Ej: <:down:456> o el ID del emoji')
            .setRequired(true)
        )
    ),

  category: 'Community',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Solo administradores.', ephemeral: true });
    }

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('canal');
      const colorText = interaction.options.getString('color');
      const banner = interaction.options.getString('banner');
      const suggestionImage = interaction.options.getString('imagen_sugerencia');
      const patch = {};

      if (colorText) {
        const hex = colorText.replace('#', '');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
          return interaction.reply({ content: 'Color inválido. Ej: `9B59B6`', ephemeral: true });
        }
        patch.color = parseInt(hex, 16);
      }

      if (banner) {
        if (!banner.startsWith('http')) {
          return interaction.reply({ content: 'banner debe ser https://...', ephemeral: true });
        }
        patch.banner = banner;
      }

      if (suggestionImage) {
        if (!suggestionImage.startsWith('http')) {
          return interaction.reply({
            content: 'imagen_sugerencia debe ser https://...',
            ephemeral: true,
          });
        }
        patch.suggestionImage = suggestionImage;
      }

      if (Object.keys(patch).length) {
        await setSuggestionSettings(interaction.guild.id, patch);
      }

      await setSuggestionChannel(interaction.guild.id, channel.id);
      await sendSuggestionPanel(channel);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Panel listo')
            .setDescription(`Enviado a ${channel}`),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'emojis') {
      const up = interaction.options.getString('positivo');
      const down = interaction.options.getString('negativo');
      await setGuildEmojis(interaction.guild.id, up, down);

      return interaction.reply({
        content: `✅ Emojis guardados\nA favor: ${up}\nEn contra: ${down}\n\nSe usan en **nuevas** sugerencias.`,
        ephemeral: true,
      });
    }
  },
};
