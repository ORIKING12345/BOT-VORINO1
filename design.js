// ============================================================
// COG: design.js — מערכת Get a Design
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  load(client) {

    // ── /design-stats — לכולם ────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'design-stats') return;

      const guild = interaction.guild;
      await guild.members.fetch();
      const role = guild.roles.cache.get(config.roles.designRole);

      if (!role) {
        return interaction.reply({ content: '❌ רול Get a Design לא הוגדר.', ephemeral: true });
      }

      const members = role.members;
      const list = members.map((m, i) => `${i + 1}. <@${m.id}>`).join('\n') || 'אין אנשים עם הרול.';

      const embed = new EmbedBuilder()
        .setTitle('🎨 Get a Design — סטטיסטיקות')
        .setDescription(
          `**סה"כ אנשים עם הרול:** ${members.size}\n\n` +
          `**רשימת הממברים:**\n${list.slice(0, 1800)}`
        )
        .setColor(0xFF73FA)
        .setFooter({ text: `עודכן: ${new Date().toLocaleString('he-IL')}` });

      await interaction.reply({ embeds: [embed] });
    });

    // ── Register command ─────────────────────────────────────
    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) guild.commands.create({ name: 'design-stats', description: 'כמה אנשים יש להם רול Get a Design?' }).catch(() => {});
    });
  }
};
