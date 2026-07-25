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
    .setDescription('Configurar panel de sugerencias y emojis de voto')
    .addChannelOption((o) =>
      o
        .setName('canal')
        .setDescription('Canal donde se pondrá el panel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('positivo')
        .setDescription('Emoji a favor (<:nombre:id> o solo el ID)')
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName('negativo')
        .setDescription('Emoji en contra (<:nombre:id> o solo el ID)')
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
    await sendSuggestionPanel(channel);

    const lines = [`📌 Panel enviado a ${channel}`];
    if (up && down) {
      lines.push(`👍 Positivo: ${up}`);
      lines.push(`👎 Negativo: ${down}`);
    } else {
      lines.push('Emojis: se mantienen los actuales (o 👍👎 por defecto)');
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('Sugerencias configuradas')
          .setDescription(lines.join('\n'))
          .setFooter({ text: 'Envenenado RP' }),
      ],
      ephemeral: true,
    });
  },
};
