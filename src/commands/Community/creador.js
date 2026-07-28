import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { setCCConfig, sendCCPanel } from '../../features/contentCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('creador')
    .setDescription('Sistema de postulaciones a Creador de Contenido')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configurar panel y canales')
        .addChannelOption((o) =>
          o
            .setName('panel')
            .setDescription('Canal donde se pone el panel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addChannelOption((o) =>
          o
            .setName('revision')
            .setDescription('Canal donde llegan las postulaciones (Aceptar/Rechazar)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((o) =>
          o
            .setName('resultados')
            .setDescription('Canal de resultados (aceptado/rechazado)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((o) =>
          o
            .setName('logs')
            .setDescription('Canal de logs del staff')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption((o) =>
          o
            .setName('rol')
            .setDescription('Rol que se da al aceptar')
            .setRequired(false)
        )
        .addStringOption((o) =>
          o
            .setName('imagen')
            .setDescription('URL de la imagen del panel[](https://...)')
            .setRequired(false)
        )
        .addStringOption((o) =>
          o
            .setName('descripcion')
            .setDescription('Texto del panel')
            .setRequired(false)
        )
    ),

  category: 'Community',

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Solo administradores.', ephemeral: true });
    }

    const panelChannel = interaction.options.getChannel('panel');
    const reviewChannel = interaction.options.getChannel('revision');
    const resultsChannel = interaction.options.getChannel('resultados');
    const logChannel = interaction.options.getChannel('logs');
    const role = interaction.options.getRole('rol');
    const imagen = interaction.options.getString('imagen');
    const descripcion = interaction.options.getString('descripcion');

    const patch = {
      reviewChannelId: reviewChannel.id,
      resultsChannelId: resultsChannel.id,
    };
    if (logChannel) patch.logChannelId = logChannel.id;
    if (role) patch.roleId = role.id;
    if (imagen) {
      if (!imagen.startsWith('http')) {
        return interaction.reply({
          content: 'La imagen debe ser un link `https://...`',
          ephemeral: true,
        });
      }
      patch.banner = imagen;
    }
    if (descripcion) patch.description = descripcion;

    await setCCConfig(interaction.guild.id, patch);
    await sendCCPanel(panelChannel);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('Sistema de Creadores listo')
          .setDescription(
            [
              `📌 Panel: ${panelChannel}`,
              `📥 Revisión (staff): ${reviewChannel}`,
              `📢 Resultados: ${resultsChannel}`,
              logChannel ? `📋 Logs: ${logChannel}` : null,
              role ? `🎭 Rol al aceptar: ${role}` : null,
              imagen ? `🖼️ Imagen configurada` : null,
            ]
              .filter(Boolean)
              .join('\n')
          ),
      ],
      ephemeral: true,
    });
  },
};
