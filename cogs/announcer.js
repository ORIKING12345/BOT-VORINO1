// ============================================================
// COG: announcer.js — מערכת שליחת הודעות מהבוט (embed מעוצב)
// ============================================================
const {
  EmbedBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const config = require(require('path').resolve(__dirname, '../config.json'));


// צבעים להגדרה
const COLOR_MAP = {
  כחול: 0x5865F2, ירוק: 0x57F287, צהוב: 0xFEE75C,
  אדום: 0xED4245, ורוד: 0xFF73FA, לבן: 0xFFFFFF,
  כתום: 0xFFA500, סגול: 0x9B59B6,
};

module.exports = {
  load(client) {

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'send-embed') return;

      if (!interaction.member.roles.cache.has(config.roles.announcerRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const modal = new ModalBuilder().setCustomId('embed_modal').setTitle('📢 שליחת הודעה מהבוט');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('embed_title').setLabel('כותרת ההודעה').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('embed_desc')
            .setLabel('תוכן ההודעה (\\n = שורה חדשה)')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('embed_color')
            .setLabel('צבע: כחול/ירוק/צהוב/אדום/ורוד/כתום/סגול')
            .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('כחול')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('embed_footer')
            .setLabel('טקסט תחתית (אופציונלי)')
            .setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('embed_image')
            .setLabel('קישור לתמונה (אופציונלי)')
            .setStyle(TextInputStyle.Short).setRequired(false)
        ),
      );
      await interaction.showModal(modal);
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isModalSubmit()) return;
      if (interaction.customId !== 'embed_modal') return;

      const title = interaction.fields.getTextInputValue('embed_title');
      const desc = interaction.fields.getTextInputValue('embed_desc').replace(/\\n/g, '\n');
      const colorKey = interaction.fields.getTextInputValue('embed_color').trim().toLowerCase();
      const footer = interaction.fields.getTextInputValue('embed_footer');
      const image = interaction.fields.getTextInputValue('embed_image');

      const color = COLOR_MAP[colorKey] || 0x5865F2;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(color)
        .setTimestamp();

      if (footer) embed.setFooter({ text: footer });
      if (image && image.startsWith('http')) embed.setImage(image);

      await interaction.channel.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ ההודעה נשלחה!', ephemeral: true });
    });

    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) guild.commands.create({ name: 'send-embed', description: 'שלח embed מעוצב כבוט [צוות בלבד]' }).catch(() => {});
    });
  }
};
