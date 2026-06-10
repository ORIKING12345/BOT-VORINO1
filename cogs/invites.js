// ============================================================
// COG: invites.js — מערכת הזמנות
// ============================================================
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config.json');

const inviteCache = new Map(); // code -> { uses, inviterId }
const inviteCount = new Map(); // userId -> count

module.exports = {
  load(client) {

    // ── Cache invites on ready ───────────────────────────────
    client.on('ready', async () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) return;
      const invites = await guild.invites.fetch();
      invites.forEach(inv => {
        inviteCache.set(inv.code, { uses: inv.uses, inviterId: inv.inviter?.id });
      });
    });

    // ── Track new invite creates ─────────────────────────────
    client.on('inviteCreate', (invite) => {
      inviteCache.set(invite.code, { uses: invite.uses, inviterId: invite.inviter?.id });
    });

    // ── Track who invited new member ─────────────────────────
    client.on('guildMemberAdd', async (member) => {
      if (member.guild.id !== config.guildId) return;
      const newInvites = await member.guild.invites.fetch();

      let usedInvite = null;
      newInvites.forEach(inv => {
        const cached = inviteCache.get(inv.code);
        if (cached && inv.uses > cached.uses) usedInvite = inv;
        inviteCache.set(inv.code, { uses: inv.uses, inviterId: inv.inviter?.id });
      });

      if (usedInvite?.inviter) {
        const inviterId = usedInvite.inviter.id;
        const current = inviteCount.get(inviterId) || 0;
        inviteCount.set(inviterId, current + 1);
      }
    });

    // ── /my-invites — לכולם ──────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'my-invites') return;

      const count = inviteCount.get(interaction.user.id) || 0;
      const embed = new EmbedBuilder()
        .setTitle('📨 ההזמנות שלך')
        .setDescription(`הזמנת **${count}** אנשים לשרת!`)
        .setColor(0x5865F2)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    });

    // ── /invite-leaderboard — רק inviteAdminRole ─────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'invite-leaderboard') return;

      if (!interaction.member.roles.cache.has(config.roles.inviteAdminRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const sorted = [...inviteCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

      if (sorted.length === 0) {
        return interaction.reply({ content: '📭 אין נתוני הזמנות עדיין.', ephemeral: true });
      }

      const rows = sorted.map(([uid, count], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} <@${uid}> — **${count}** הזמנות`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('📊 טבלת מזמינים')
        .setDescription(rows)
        .setColor(0xFEE75C)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    });

    // ── Register commands ────────────────────────────────────
    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) {
        guild.commands.create({ name: 'my-invites', description: 'כמה אנשים הזמנת לשרת?' }).catch(() => {});
        guild.commands.create({ name: 'invite-leaderboard', description: 'טבלת מזמינים [מנהלים בלבד]' }).catch(() => {});
      }
    });
  }
};
