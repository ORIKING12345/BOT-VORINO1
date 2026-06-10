// ============================================================
// COG: rolepicker.js — מערכת בחירת רולים
// ============================================================
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const config = require('../config.json');

module.exports = {
  load(client) {

    // ── /setup-roles — רק rolePickerSetupRole ───────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'setup-roles') return;

      if (!interaction.member.roles.cache.has(config.roles.rolePickerSetupRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const role1 = interaction.guild.roles.cache.get(config.roles.roleOne);
      const role2 = interaction.guild.roles.cache.get(config.roles.roleTwo);

      const embed = new EmbedBuilder()
        .setTitle('🎭 בחר את הרול שלך')
        .setDescription(
          `בחר רול שמתאים לך!\n\n` +
          `🔵 **${role1?.name || 'רול ראשון'}** — לחץ לקבלת הרול\n` +
          `🟣 **${role2?.name || 'רול שני'}** — לחץ לקבלת הרול`
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'לחץ שוב להסרת הרול' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('pick_role_one')
          .setLabel(role1?.name || 'רול ראשון')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔵'),
        new ButtonBuilder()
          .setCustomId('pick_role_two')
          .setLabel(role2?.name || 'רול שני')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🟣'),
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ פאנל רולים נשלח!', ephemeral: true });
    });

    // ── Toggle roles ─────────────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      const { customId, member } = interaction;

      if (customId === 'pick_role_one' || customId === 'pick_role_two') {
        const roleId = customId === 'pick_role_one' ? config.roles.roleOne : config.roles.roleTwo;
        const roleName = interaction.guild.roles.cache.get(roleId)?.name || 'הרול';

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          return interaction.reply({ content: `❌ הרול **${roleName}** הוסר ממך.`, ephemeral: true });
        } else {
          await member.roles.add(roleId);
          return interaction.reply({ content: `✅ קיבלת את הרול **${roleName}**!`, ephemeral: true });
        }
      }
    });

    // ── Register command ─────────────────────────────────────
    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) guild.commands.create({ name: 'setup-roles', description: 'שלח פאנל בחירת רולים [מנהלים בלבד]' }).catch(() => {});
    });
  }
};
