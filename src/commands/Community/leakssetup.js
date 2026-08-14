import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import {
  sendLeaksApplyPanel,
  setLeaksApplyConfig,
} from '../../features/leaksApply.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leakssetup')
    .setDescription('Setup the Leaks application panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('panel')
        .setDescription('Channel where the apply panel will be sent')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('logs')
        .setDescription('Channel for application logs (postulacion-logs)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt
        .setName('role')
        .setDescription('Role given when accepted (leaks)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('imagen')
        .setDescription('Optional image URL for the panel')
        .setRequired(false)
    ),

  category: 'Community',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const panelChannel = interaction.options.getChannel('panel');
      const logsChannel = interaction.options.getChannel('logs');
      const role = interaction.options.getRole('role');
      const imageUrl = interaction.options.getString('imagen');

      if (imageUrl) {
        try {
          const url = new URL(imageUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return interaction.editReply({
              content: '❌ Image link must start with http:// or https://',
            });
          }
        } catch {
          return interaction.editReply({ content: '❌ Invalid image URL.' });
        }
      }

      const me = interaction.guild.members.me;
      const panelPerms = panelChannel.permissionsFor(me);
      if (!panelPerms?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return interaction.editReply({
          content:
            '❌ I need View Channel, Send Messages and Embed Links in the panel channel.',
        });
      }

      const logsPerms = logsChannel.permissionsFor(me);
      if (!logsPerms?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return interaction.editReply({
          content:
            '❌ I need View Channel, Send Messages and Embed Links in the logs channel.',
        });
      }

      if (role.managed || role.position >= me.roles.highest.position) {
        return interaction.editReply({
          content:
            '❌ I cannot assign that role. Move my role above **leaks** in Server Settings → Roles.',
        });
      }

      setLeaksApplyConfig(interaction.guild.id, {
        panelChannelId: panelChannel.id,
        logsChannelId: logsChannel.id,
        roleId: role.id,
      });

      await sendLeaksApplyPanel(panelChannel, imageUrl);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({ name: 'XF L' })
        .setTitle('Leaks applications ready')
        .setDescription('Panel sent and system configured.')
        .addFields(
          { name: '📌 Panel', value: `${panelChannel}`, inline: true },
          { name: '📋 Logs', value: `${logsChannel}`, inline: true },
          { name: '🎭 Role', value: `${role}`, inline: true }
        )
        .setFooter({ text: 'Powered by Casa' });

      if (imageUrl) embed.setImage(imageUrl);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[leakssetup] Error:', error);
      await interaction
        .editReply({
          content: `❌ Error:\n\`\`\`${error?.message || error}\`\`\``,
        })
        .catch(() => {});
    }
  },
};
