import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { playQuery, replyMusicSuccess } from '../../services/music/musicActions.js';

export default {
  slashOnly: true,
  category: 'Music',
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o la agrega a la cola')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Nombre de la canción o URL').setRequired(true),
    ),

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    try {
      if (!client.riffy) {
        return interaction.editReply({
          content:
            '❌ La música no está disponible: **Lavalink no está conectado**.\n' +
            'Revisa `lavalink/nodes.json` o las variables `LAVALINK_HOST` / `LAVALINK_NODES`.',
        });
      }

      if (!interaction.member?.voice?.channel) {
        return interaction.editReply({
          content: '❌ Entra a un **canal de voz** y vuelve a usar `/play`.',
        });
      }

      const query = interaction.options.getString('query', true);
      const result = await playQuery(client, interaction, query);
      await replyMusicSuccess(interaction, result.embed);
    } catch (error) {
      console.error('[play] Error:', error);

      const msg =
        error?.userMessage ||
        error?.message ||
        'Error desconocido al reproducir.';

      // Mensajes más claros según el fallo
      let content = `❌ ${msg}`;
      if (/lavalink|riffy|node|ECONNREFUSED|connect/i.test(String(msg))) {
        content =
          '❌ No hay conexión con **Lavalink**.\n' +
          'El servidor de audio está caído o mal configurado.';
      }

      try {
        await interaction.editReply({ content });
      } catch {
        // ignore
      }
    }
  },
};
