import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  setSuggestionChannel,
  setGuildEmojis,
} from '../../features/suggestions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription('Configurar el canal de sugerencias y emojis de voto')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal de sugerencias')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('positivo')
        .setDescription('Emoji a favor (ID o <:nombre:id>)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('negativo')
        .setDescription('Emoji en contra (ID o <:nombre:id>)')
        .setRequired(false)
    ),

  category: 'Community',

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Solo administradores.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('canal');
    const up = interaction.options.getString('positivo');
    const down = interaction.options.getString('negativo');

    if (up && down) {
      await setGuildEmojis(interaction.guild.id, up, down);
    }

    await setSuggestionChannel(interaction.guild.id, channel.id);

    // Ya NO se envía el panel

    const lines = [`Canal configurado: ${channel}`];
    if (up && down) {
      lines.push(`Emoji a favor: ${up}`);
      lines.push(`Emoji en contra: ${down}`);
    } else {
      lines.push('Emojis: se mantienen los actuales (o por defecto)');
    }
    lines.push('\nLa gente solo tiene que escribir en ese canal.');

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('Sugerencias listas')
          .setDescription(lines.join('\n')),
      ],
      ephemeral: true,
    });
  },
};
