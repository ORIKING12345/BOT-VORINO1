// ============================================================
// COG: feedback.js — מערכת פידבקים
// ============================================================
const {
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const config = require('../config.json');

module.exports = {
  load(client) {

    // ── /setup-feedback — רק feedbackSetupRole ───────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'setup-feedback') return;

      if (!interaction.member.roles.cache.has(config.roles.feedbackSetupRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('⭐ השאר פידבק')
        .setDescription('רוצה לשתף חוויה? לחץ על הכפתור למטה ושלח פידבק!')
        .setColor(0xFEE75C);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_feedback').setLabel('📝 שלח פידבק').setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ פאנל פידבק נשלח!', ephemeral: true });
    });

    // ── פתיחת מודל פידבק ────────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (interaction.customId !== 'open_feedback') return;

      const modal = new ModalBuilder().setCustomId('feedback_modal').setTitle('📝 שליחת פידבק');

      const targetInput = new TextInputBuilder()
        .setCustomId('feedback_target').setLabel('תייג את הממבר שאליו הפידבק (@username)').setStyle(TextInputStyle.Short).setRequired(true);

      const starsInput = new TextInputBuilder()
        .setCustomId('feedback_stars').setLabel('דירוג (1-5 כוכבים)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1);

      const textInput = new TextInputBuilder()
        .setCustomId('feedback_text').setLabel('תוכן הפידבק').setStyle(TextInputStyle.Paragraph).setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(targetInput),
        new ActionRowBuilder().addComponents(starsInput),
        new ActionRowBuilder().addComponents(textInput),
      );

      await interaction.showModal(modal);
    });

    // ── קבלת פידבק ──────────────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isModalSubmit()) return;
      if (interaction.customId !== 'feedback_modal') return;

      const target = interaction.fields.getTextInputValue('feedback_target');
      const starsRaw = parseInt(interaction.fields.getTextInputValue('feedback_stars'));
      const text = interaction.fields.getTextInputValue('feedback_text');
      const stars = Math.min(5, Math.max(1, starsRaw || 1));
      const starsStr = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);

      const feedbackChannel = interaction.guild.channels.cache.get(config.channels.feedbackChannel);
      if (!feedbackChannel) {
        return interaction.reply({ content: '❌ ערוץ פידבקים לא הוגדר.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('📨 פידבק חדש')
        .addFields(
          { name: '👤 מאת', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🎯 אל', value: target, inline: true },
          { name: '⭐ דירוג', value: `${starsStr} (${stars}/5)`, inline: true },
          { name: '💬 תוכן', value: text },
        )
        .setColor(0xFEE75C)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      await feedbackChannel.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ הפידבק נשלח בהצלחה!', ephemeral: true });
    });

    // ── Register command ─────────────────────────────────────
    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) guild.commands.create({ name: 'setup-feedback', description: 'שלח פאנל פידבקים [מנהלים בלבד]' }).catch(() => {});
    });
  }
};
