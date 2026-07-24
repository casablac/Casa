import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  setSuggestionChannel,
  getSuggestionChannelId,
  postSuggestion,
} from '../../features/suggestions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription('Sistema de sugerencias con votos')
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Enviar una sugerencia')
        .addStringOption((opt) =>
          opt
            .setName('mensaje')
            .setDescription('Tu sugerencia')
            .setRequired(true)
            .setMaxLength(1000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Elegir el canal de sugerencias')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal donde se publicarán las sugerencias')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    ),

  category: 'Community',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ---- SETUP ----
    if (sub === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: 'Solo un **Administrador** puede configurar el canal de sugerencias.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('canal');
      await setSuggestionChannel(interaction.guild.id, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: 'Envenenado RP' })
        .setTitle('Canal de sugerencias configurado')
        .setDescription(`Las sugerencias se publicarán en ${channel}`)
        .setFooter({ text: 'Powered by Bandido' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ---- ENVIAR ----
    if (sub === 'enviar') {
      const text = interaction.options.getString('mensaje');
      const channelId = getSuggestionChannelId(interaction.guild.id);

      if (!channelId) {
        return interaction.reply({
          content: 'El canal de sugerencias no está configurado. Un admin debe usar `/sugerencia setup`.',
          ephemeral: true,
        });
      }

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({
          content: 'No encontré el canal de sugerencias. Vuelve a configurar con `/sugerencia setup`.',
          ephemeral: true,
        });
      }

      await postSuggestion(channel, interaction.user, text);

      return interaction.reply({
        content: `✅ Tu sugerencia se publicó en ${channel}`,
        ephemeral: true,
      });
    }
  },
};
