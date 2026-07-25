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
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal del panel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('emojis')
        .setDescription('Cambiar los emojis de voto')
        .addStringOption((opt) =>
          opt.setName('positivo').setDescription('Emoji a favor (👍 o :custom:)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('negativo').setDescription('Emoji en contra (👎 o :custom:)').setRequired(true)
        )
    ),

  category: 'Community',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: 'Solo administradores.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('canal');
      await setSuggestionChannel(interaction.guild.id, channel.id);
      await sendSuggestionPanel(channel);

      const embed = new EmbedBuilder()
        .setColor(0xF5A623)
        .setTitle('Panel de sugerencias listo')
        .setDescription(`Panel enviado a ${channel}`)
        .setFooter({ text: 'Envenenado RP' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'emojis') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: 'Solo administradores.',
          ephemeral: true,
        });
      }

      const up = interaction.options.getString('positivo');
      const down = interaction.options.getString('negativo');
      await setGuildEmojis(interaction.guild.id, up, down);

      return interaction.reply({
        content: `Emojis actualizados:\nA favor: ${up}\nEn contra: ${down}\n\nSe aplican en **nuevas** sugerencias.`,
        ephemeral: true,
      });
    }
  },
};
