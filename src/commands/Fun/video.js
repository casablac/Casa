import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import {
  addVideo,
  getVideoQueue,
  getVideoConfig,
  setVideoConfig,
  sendNextVideo,
} from '../../services/videoQueueService.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('video')
    .setDescription('Sistema de cola de videos (envío automático cada 24h)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('agregar')
        .setDescription('Agrega un link de video a la cola')
        .addStringOption((opt) =>
          opt.setName('link').setDescription('URL del video').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cola')
        .setDescription('Muestra cuántos videos hay en la cola')
    )
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Envía el siguiente video ahora mismo')
    )
    .addSubcommand((sub) =>
      sub
        .setName('configurar')
        .setDescription('Configura el canal donde se enviarán los videos')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal de destino')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('activar')
            .setDescription('Activar envío automático cada 24h')
            .setRequired(true)
        )
    ),

  category: 'Fun',

  async execute(interaction, config, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'agregar') {
      const link = interaction.options.getString('link');
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return InteractionHelper.safeReply(interaction, {
          embeds: [errorEmbed('Link inválido', 'Debes poner una URL válida.')],
          ephemeral: true,
        });
      }
      const total = await addVideo(guildId, link, interaction.user.id);
      return InteractionHelper.safeReply(interaction, {
        embeds: [
          successEmbed('Video agregado', `Se agregó a la cola.\nTotal en cola: **${total}**`),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'cola') {
      const queue = await getVideoQueue(guildId);
      const cfg = await getVideoConfig(guildId);
      return InteractionHelper.safeReply(interaction, {
        embeds: [
          infoEmbed(
            'Cola de videos',
            `Videos pendientes: **${queue.length}**\n` +
              `Canal destino: ${cfg.channelId ? `<#${cfg.channelId}>` : 'No configurado'}\n` +
              `Automático: ${cfg.enabled ? '✅ Activado (cada 24h)' : '❌ Desactivado'}`
          ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'enviar') {
      const result = await sendNextVideo(client, guildId);
      if (result.sent) {
        return InteractionHelper.safeReply(interaction, {
          embeds: [
            successEmbed(
              'Video enviado',
              `Se envió el video.\nQuedan **${result.remaining}** en la cola.`
            ),
          ],
          ephemeral: true,
        });
      }
      const messages = {
        empty: 'No hay videos en la cola.',
        not_configured: 'Primero configura el canal con `/video configurar`.',
        channel_not_found: 'No encontré el canal de destino.',
        send_error: `Error al enviar: ${result.error}`,
      };
      return InteractionHelper.safeReply(interaction, {
        embeds: [errorEmbed('No se pudo enviar', messages[result.reason] || 'Error desconocido')],
        ephemeral: true,
      });
    }

    if (sub === 'configurar') {
      const channel = interaction.options.getChannel('canal');
      const activar = interaction.options.getBoolean('activar');
      await setVideoConfig(guildId, {
        channelId: channel.id,
        enabled: activar,
      });
      return InteractionHelper.safeReply(interaction, {
        embeds: [
          successEmbed(
            'Configuración guardada',
            `Canal: ${channel}\nAutomático cada 24h: **${activar ? 'Activado' : 'Desactivado'}**`
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
