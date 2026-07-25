import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  setSuggestionChannel,
  sendSuggestionPanel,
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
