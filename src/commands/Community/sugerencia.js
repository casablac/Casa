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

function parseHexColor(input) {
  if (!input) return null;
  let hex = String(input).trim().replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

export default {
  data: new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription('Sistema de sugerencias')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Poner el panel en un canal')
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
            .setDescription('Color de la línea del embed (ej: 9B59B6 o #9B59B6)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('imagen')
            .setDescription('URL de la imagen/banner del panel[](https://...)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('emojis')
        .setDescription('Cambiar emojis de voto')
        .addStringOption((opt) =>
          opt.setName('positivo').setDescription('Emoji a favor').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('negativo').setDescription('Emoji en contra').setRequired(true)
        )
    ),

  category: 'Community',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Solo administradores.', ephemeral: true });
      }

      const channel = interaction.options.getChannel('canal');
      const colorRaw = interaction.options.getString('color');
      const imagen = interaction.options.getString('imagen');

      if (colorRaw) {
        const color = parseHexColor(colorRaw);
        if (color === null) {
          return interaction.reply({
            content: 'Color inválido. Usa formato `9B59B6` o `#9B59B6`.',
            ephemeral: true,
          });
        }
        await setSuggestionSettings(interaction.guild.id, { color });
      }

      if (imagen) {
        if (!imagen.startsWith('http')) {
          return interaction.reply({
            content: 'La imagen debe ser una URL que empiece por `https://`',
            ephemeral: true,
          });
        }
        await setSuggestionSettings(interaction.guild.id, { banner: imagen });
      }

      await setSuggestionChannel(interaction.guild.id, channel.id);
      await sendSuggestionPanel(channel);

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('Panel de sugerencias listo')
        .setDescription(`Panel enviado a ${channel}`)
        .setFooter({ text: 'Envenenado RP' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'emojis') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Solo administradores.', ephemeral: true });
      }
      const up = interaction.options.getString('positivo');
      const down = interaction.options.getString('negativo');
      await setGuildEmojis(interaction.guild.id, up, down);
      return interaction.reply({
        content: `Emojis actualizados:\nA favor: ${up}\nEn contra: ${down}`,
        ephemeral: true,
      });
    }
  },
};
