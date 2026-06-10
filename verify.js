// ============================================================
// COG: verify.js — מערכת אימות
// ============================================================
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const config = require('../config.json');

module.exports = {
  load(client) {

    // ── /setup-verify — רק verifySetupRole ──────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'setup-verify') return;

      if (!interaction.member.roles.cache.has(config.roles.verifySetupRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ אימות חבר')
        .setDescription(
          '## ברוך הבא לשרת!\n\n' +
          'כדי לקבל גישה מלאה לשרת, עליך לאמת את עצמך.\n\n' +
          '**לחץ על הכפתור למטה** כדי לאמת את עצמך ולקבל את הרול.'
        )
        .setColor(0x57F287)
        .setImage('https://i.imgur.com/placeholder.png')
        .setFooter({ text: 'אחרי האימות תקבל גישה לכל ערוצי השרת' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_me')
          .setLabel('✅ אמת אותי!')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ פאנל אימות נשלח!', ephemeral: true });
    });

    // ── לחיצה על כפתור אימות ────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (interaction.customId !== 'verify_me') return;

      const member = interaction.member;

      if (member.roles.cache.has(config.roles.verifyRole)) {
        return interaction.reply({ content: '✅ אתה כבר מאומת!', ephemeral: true });
      }

      await member.roles.add(config.roles.verifyRole);

      const embed = new EmbedBuilder()
        .setTitle('🎉 אומת בהצלחה!')
        .setDescription(`ברוך הבא, <@${member.id}>! יש לך כעת גישה מלאה לשרת.`)
        .setColor(0x57F287)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    });

    // ── Register command ─────────────────────────────────────
    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) guild.commands.create({ name: 'setup-verify', description: 'שלח פאנל אימות [מנהלים בלבד]' }).catch(() => {});
    });
  }
};
