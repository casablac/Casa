async function handleSetImages(selectInteraction, rootInteraction, state) {
    try {
        await selectInteraction.deferUpdate().catch(() => {});

        const imageSelect = new StringSelectMenuBuilder()
            .setCustomId('eb_image_pick')
            .setPlaceholder('What would you like to change?')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Set Thumbnail')
                    .setDescription('Small image in the top-right corner')
                    .setValue('set_thumbnail')
                    .setEmoji('🖼️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Set Large Image')
                    .setDescription('Full-width banner at the bottom')
                    .setValue('set_image')
                    .setEmoji('📸'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Clear Thumbnail')
                    .setDescription('Remove the current thumbnail')
                    .setValue('clear_thumbnail')
                    .setEmoji('🗑️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Clear Large Image')
                    .setDescription('Remove the current large image')
                    .setValue('clear_image')
                    .setEmoji('🗑️'),
            );

        await selectInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Set Images')
                    .setDescription('Choose which image to set or remove.')
                    .addFields(
                        {
                            name: 'Thumbnail',
                            value: state.thumbnail ? `[View](${state.thumbnail})` : '`Not set`',
                            inline: true,
                        },
                        {
                            name: 'Large Image',
                            value: state.image ? `[View](${state.image})` : '`Not set`',
                            inline: true,
                        },
                    )
                    .setColor(getColor('info')),
            ],
            components: [new ActionRowBuilder().addComponents(imageSelect)],
            flags: MessageFlags.Ephemeral,
        });

        const channel = rootInteraction.channel;
        if (!channel) {
            logger.warn('Embed builder: no channel for image collector');
            return;
        }

        const imgMenuCollector = channel.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) =>
                i.user.id === selectInteraction.user.id && i.customId === 'eb_image_pick',
            time: 60_000,
            max: 1,
        });

        imgMenuCollector.on('collect', async (imgInter) => {
            try {
                const pick = imgInter.values[0];

                if (pick === 'clear_thumbnail') {
                    state.thumbnail = null;
                    await imgInter.deferUpdate().catch(() => {});
                    await refreshDashboard(rootInteraction, state);
                    return;
                }
                if (pick === 'clear_image') {
                    state.image = null;
                    await imgInter.deferUpdate().catch(() => {});
                    await refreshDashboard(rootInteraction, state);
                    return;
                }

                const isThumb = pick === 'set_thumbnail';
                const previous = isThumb ? state.thumbnail || '' : state.image || '';
                // Discord modal short input: evitar URLs demasiado largas en setValue
                const defaultValue = previous.length <= 200 ? previous : '';

                const urlModal = new ModalBuilder()
                    .setCustomId('eb_image_url')
                    .setTitle(isThumb ? 'Set Thumbnail' : 'Set Large Image')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('image_url')
                                .setLabel('Image URL[](https://...)')
                                .setStyle(TextInputStyle.Short)
                                .setValue(defaultValue)
                                .setRequired(true)
                                .setMaxLength(400)
                                .setPlaceholder('https://example.com/image.png'),
                        ),
                    );

                const shown = await InteractionHelper.safeShowModal(imgInter, urlModal);
                if (!shown) return;

                const submitted = await imgInter
                    .awaitModalSubmit({
                        filter: (i) =>
                            i.customId === 'eb_image_url' && i.user.id === imgInter.user.id,
                        time: 60_000,
                    })
                    .catch(() => null);

                if (!submitted) return;

                const url = submitted.fields.getTextInputValue('image_url').trim();
                if (!isValidUrl(url)) {
                    await replyUserError(submitted, {
                        type: ErrorTypes.USER_INPUT,
                        message:
                            'La URL debe ser un link `https://` público a una imagen (png, jpg, gif, webp).',
                    });
                    return;
                }

                if (isThumb) state.thumbnail = url;
                else state.image = url;

                await submitted.deferUpdate().catch(() => {});
                await refreshDashboard(rootInteraction, state);
            } catch (error) {
                logger.warn('Embed builder image picker failed:', error?.message || error);
                try {
                    if (!imgInter.replied && !imgInter.deferred) {
                        await imgInter.reply({
                            content: 'Error al configurar la imagen. Prueba otra URL (https).',
                            ephemeral: true,
                        });
                    }
                } catch {
                    // ignore
                }
            }
        });
    } catch (error) {
        logger.error('handleSetImages error:', error);
        try {
            if (!selectInteraction.replied && !selectInteraction.deferred) {
                await selectInteraction.deferUpdate().catch(() => {});
            }
            await selectInteraction.followUp({
                content: 'No se pudo abrir el menú de imágenes. Intenta de nuevo con `/embedbuilder`.',
                ephemeral: true,
            });
        } catch {
            // ignore
        }
    }
}
