import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  setJoinPingConfig,
  getJoinPingConfig,
} from '../../features/joinPing.js';

export default {
  data: new SlashCommandBuilder()
    .setName('joinping')
    .setDescription('Ping new members in a channel then delete the message')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Set the channel for join pings')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to ping new members in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('off').setDescription('Disable join pings')
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show current join ping settings')
    ),

  category: 'Welcome',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      setJoinPingConfig(guildId, {
        enabled: true,
        channelId: channel.id,
      });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('Join ping enabled')
            .setDescription(
              `When someone joins, the bot will mention them in ${channel} and delete the message after 2 seconds.`
            ),
        ],
      });
    }

    if (sub === 'off') {
      setJoinPingConfig(guildId, { enabled: false });
      return interaction.editReply({ content: 'Join ping disabled.' });
    }

    if (sub === 'status') {
      const cfg = getJoinPingConfig(guildId);
      if (!cfg?.enabled || !cfg?.channelId) {
        return interaction.editReply({ content: 'Join ping is **off**.' });
      }
      return interaction.editReply({
        content: `Join ping is **on** in <#${cfg.channelId}>.`,
      });
    }
  },
};
