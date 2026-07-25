export async function handleSuggestionMessage(message) {
  // Ignorar bots
  if (message.author.bot) return false;
  if (!message.guild) return false;

  const channelId = getSuggestionChannelId(message.guild.id);
  if (!channelId || message.channel.id !== channelId) return false;

  // Ignorar comandos
  if (message.content.startsWith('/')) return false;

  const text = message.content?.trim();
  if (!text || text.length < 2) return false;

  try {
    // Borrar mensaje original
    await message.delete().catch(() => {});

    const title =
      text.length > 80 ? text.slice(0, 77) + '...' : text;
    const details = text;

    const embed = buildSuggestionEmbed(
      message.guild.id,
      message.author,
      title,
      details
    );

    let row;
    try {
      row = buildVoteRow(message.guild.id, 0, 0, false);
    } catch {
      row = buildVoteRow(message.guild.id, 0, 0, true);
    }

    let msg;
    try {
      msg = await message.channel.send({
        embeds: [embed],
        components: [row],
      });
    } catch {
      row = buildVoteRow(message.guild.id, 0, 0, true);
      msg = await message.channel.send({
        embeds: [embed],
        components: [row],
      });
    }

    saveVotes(msg.id, {
      up: [],
      down: [],
      authorId: message.author.id,
      title,
      details,
    });

    return true;
  } catch (err) {
    console.error('Error en sugerencia por mensaje:', err);
    return false;
  }
}
