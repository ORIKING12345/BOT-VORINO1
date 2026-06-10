cat > /home/claude/bot.js << 'ENDOFFILE'
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('The bot is alive and running!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// ╔══════════════════════════════════════════════════════════════════════╗
// ║          ULTIMATE DISCORD STAFF BOT                                  ║
// ║                                                                      ║
// ║  ✅ Only 3 things to fill in: TOKEN, CLIENT_ID, GUILD_ID            ║
// ║  ✅ All roles & channels are set via /setup or the Admin Panel       ║
// ║  ✅ Admin is set automatically the first time /setup is run          ║
// ║  ✅ Only the admin can change settings in the team panel             ║
// ║  ✅ Verification system — button gives role                          ║
// ║  ✅ Logs system — bans, kicks, timeouts, deletes, etc.               ║
// ║                                                                      ║
// ║  Install:  npm install discord.js                                    ║
// ║  Run:      node bot.js                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════════════════
//  🔑  ONLY FILL IN THESE THREE VALUES — NOTHING ELSE
// ════════════════════════════════════════════════════════
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1501915415356510299';
const GUILD_ID  = '1489033656487121077';
// ════════════════════════════════════════════════════════

const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, ChannelType,
  AttachmentBuilder, SlashCommandBuilder, REST, Routes,
  AuditLogEvent,
} = require('discord.js');
const fs = require('fs');

// ──────────────────────────────────────────────────────
//  CONFIG ENGINE  →  everything saved in bot_config.json
// ──────────────────────────────────────────────────────
const CONFIG_FILE        = './bot_config.json';
const TICKET_COUNTS_FILE = './ticket_counts.json';
const OPEN_TICKETS_FILE  = './open_tickets.json';
const LOTTERY_FILE       = './lottery.json';
const DROP_FILE          = './drop.json';

function loadCFG()          { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; } }
function saveCFG(d)         { fs.writeFileSync(CONFIG_FILE, JSON.stringify(d, null, 2)); }
function getCFG()           { return loadCFG(); }
function setCFG(k, v)       { const d = loadCFG(); d[k] = v; saveCFG(d); }
function loadJSON(f, def)   { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } }
function saveJSON(f, d)     { fs.writeFileSync(f, JSON.stringify(d, null, 2)); }

// ──────────────────────────────────────────────────────
//  CLIENT
// ──────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ──────────────────────────────────────────────────────
//  EMBED FACTORY
// ──────────────────────────────────────────────────────
function makeEmbed(title, desc, color = 0x5865F2, fields = []) {
  const cfg = getCFG();
  const e = new EmbedBuilder().setTitle(title).setColor(color)
    .setFooter({ text: cfg.botName || 'Staff Bot' }).setTimestamp();
  if (desc)         e.setDescription(desc);
  if (cfg.botLogo)  e.setThumbnail(cfg.botLogo);
  if (fields.length) e.addFields(fields);
  return e;
}
const okEmbed   = (t, d) => makeEmbed(t, d, 0x57F287);
const errEmbed  = (t, d) => makeEmbed(t, d, 0xED4245);
const warnEmbed = (t, d) => makeEmbed(t, d, 0xFEE75C);
const infoEmbed = (t, d) => makeEmbed(t, d, 0x5865F2);
const goldEmbed = (t, d) => makeEmbed(t, d, 0xFFD700);

// ──────────────────────────────────────────────────────
//  PERMISSION HELPERS
// ──────────────────────────────────────────────────────
function isAdmin(member) {
  const cfg = getCFG();
  return member.user.id === cfg.adminId || member.permissions.has(PermissionFlagsBits.Administrator);
}
function isStaff(member) {
  if (isAdmin(member)) return true;
  const cfg = getCFG();
  return cfg.staffRole ? member.roles.cache.has(cfg.staffRole) : member.permissions.has(PermissionFlagsBits.ManageMessages);
}

// ──────────────────────────────────────────────────────
//  LOGS HELPER  →  sends a log embed to the log channel
// ──────────────────────────────────────────────────────
async function sendLog(guild, embedData) {
  try {
    const cfg = getCFG();
    if (!cfg.logChannel) return;
    const ch = guild.channels.cache.get(cfg.logChannel);
    if (!ch) return;
    const e = new EmbedBuilder()
      .setTitle(embedData.title)
      .setDescription(embedData.desc || null)
      .setColor(embedData.color || 0x5865F2)
      .setFooter({ text: cfg.botName || 'Staff Bot' })
      .setTimestamp();
    if (embedData.fields) e.addFields(embedData.fields);
    if (embedData.thumbnail) e.setThumbnail(embedData.thumbnail);
    await ch.send({ embeds: [e] });
  } catch {}
}

// ══════════════════════════════════════════════════════
//  SLASH COMMAND DEFINITIONS
// ══════════════════════════════════════════════════════
const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('⚙️ Open the bot setup panel (Admin only)'),
  new SlashCommandBuilder().setName('botinfo').setDescription('ℹ️ View current bot configuration'),
  new SlashCommandBuilder().setName('team-panel').setDescription('🛡️ Send the staff team control panel'),
  // Tickets
  new SlashCommandBuilder().setName('ticket-panel').setDescription('📨 Post the ticket creation panel here'),
  new SlashCommandBuilder().setName('close-ticket').setDescription('🔒 Close and archive this ticket'),
  new SlashCommandBuilder().setName('add-user').setDescription('➕ Add a member to this ticket')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('remove-user').setDescription('➖ Remove a member from this ticket')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  // Messages
  new SlashCommandBuilder().setName('send-message').setDescription('📣 Send a rich embed message to any channel')
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Embed body').setRequired(true))
    .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #FF0000'))
    .addStringOption(o => o.setName('image').setDescription('Image URL'))
    .addStringOption(o => o.setName('footer').setDescription('Footer text')),
  // DM All
  new SlashCommandBuilder().setName('dmall').setDescription('📬 DM every server member privately')
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message body').setRequired(true)),
  // Lottery
  new SlashCommandBuilder().setName('lottery-start').setDescription('🎰 Start a lottery')
    .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true)),
  new SlashCommandBuilder().setName('lottery-end').setDescription('🎰 End current lottery and draw winner'),
  new SlashCommandBuilder().setName('lottery-reroll').setDescription('🎲 Reroll the lottery winner'),
  // Drop
  new SlashCommandBuilder().setName('drop-start').setDescription('🎁 Start a drop event')
    .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true)),
  // Moderation
  new SlashCommandBuilder().setName('ban').setDescription('🔨 Ban a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder().setName('unban').setDescription('🔓 Unban a user by ID')
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true)),
  new SlashCommandBuilder().setName('kick').setDescription('👢 Kick a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder().setName('timeout').setDescription('⏰ Timeout a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder().setName('untimeout').setDescription('✅ Remove a member\'s timeout')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ Warn a member')
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  // Feedback
  new SlashCommandBuilder().setName('feedback').setDescription('💬 Submit server feedback')
    .addStringOption(o => o.setName('text').setDescription('Your feedback').setRequired(true))
    .addIntegerOption(o => o.setName('rating').setDescription('Rating 1–5').setMinValue(1).setMaxValue(5).setRequired(true)),
  // Welcome test
  new SlashCommandBuilder().setName('welcome-test').setDescription('👋 Preview the welcome message'),
  // ── NEW: Verification panel
  new SlashCommandBuilder().setName('verify-panel').setDescription('✅ Send the verification panel here (Admin only)'),
].map(c => c.toJSON());

// ──────────────────────────────────────────────────────
//  REGISTER COMMANDS
// ──────────────────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('📡 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered.');
  } catch (e) { console.error('❌ Command registration error:', e); }
}

// ══════════════════════════════════════════════════════
//  READY
// ══════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log(`\n✅ Bot online: ${client.user.tag}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const cfg = getCFG();
  if (!cfg.adminId) console.log('⚠️  No admin set. Run /setup to begin!');
  else              console.log(`👑 Admin: ${cfg.adminId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await registerCommands();
  client.user.setActivity('🛡️ Legacy Design Bot created by vorino', { type: 3 });
});

// ══════════════════════════════════════════════════════
//  SYSTEM — WELCOME  (auto on join)
// ══════════════════════════════════════════════════════
client.on('guildMemberAdd', async member => {
  try {
    const cfg = getCFG();
    if (!cfg.welcomeChannel) return;
    const ch = member.guild.channels.cache.get(cfg.welcomeChannel);
    if (!ch) return;
    const e = new EmbedBuilder()
      .setTitle(`👋 Welcome to ${member.guild.name}!`)
      .setDescription(
        `Hey ${member}, welcome aboard! 🎉\n\n` +
        `🔹 Read the rules before anything else.\n` +
        `🔹 Head to verification to unlock channels.\n` +
        `🔹 Introduce yourself to the community!\n\n` +
        `You are our **${member.guild.memberCount}th** member!`
      )
      .setColor(0x5865F2)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: cfg.botName || 'Staff Bot' }).setTimestamp();
    if (cfg.botLogo) e.setImage(cfg.botLogo);
    await ch.send({ content: `🎊 Welcome ${member}!`, embeds: [e] });
  } catch {}
});

// ══════════════════════════════════════════════════════
//  SYSTEM — AUTO-LOGS (audit log listeners)
// ══════════════════════════════════════════════════════

// Helper: fetch latest audit log entry of a given type
async function getAuditEntry(guild, type, targetId, maxAgeMs = 5000) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type });
    const entry = logs.entries.first();
    if (!entry) return null;
    if (Date.now() - entry.createdTimestamp > maxAgeMs) return null;
    if (targetId && entry.target?.id !== targetId) return null;
    return entry;
  } catch { return null; }
}

// ── BAN
client.on('guildBanAdd', async ban => {
  const entry = await getAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
  await sendLog(ban.guild, {
    title: '🔨 Member Banned',
    color: 0xED4245,
    thumbnail: ban.user.displayAvatarURL({ dynamic: true }),
    fields: [
      { name: '👤 User', value: `${ban.user} (${ban.user.tag})`, inline: true },
      { name: '🆔 ID', value: ban.user.id, inline: true },
      { name: '👮 By', value: entry?.executor ? `${entry.executor}` : 'Unknown', inline: true },
      { name: '📝 Reason', value: entry?.reason || 'No reason provided', inline: false },
    ],
  });
});

// ── UNBAN
client.on('guildBanRemove', async ban => {
  const entry = await getAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
  await sendLog(ban.guild, {
    title: '🔓 Member Unbanned',
    color: 0x57F287,
    thumbnail: ban.user.displayAvatarURL({ dynamic: true }),
    fields: [
      { name: '👤 User', value: `${ban.user.tag}`, inline: true },
      { name: '🆔 ID', value: ban.user.id, inline: true },
      { name: '👮 By', value: entry?.executor ? `${entry.executor}` : 'Unknown', inline: true },
    ],
  });
});

// ── KICK (member removed without ban — detected via audit log)
client.on('guildMemberRemove', async member => {
  try {
    await new Promise(r => setTimeout(r, 1500)); // let audit log populate
    const entry = await getAuditEntry(member.guild, AuditLogEvent.MemberKick, member.id, 8000);
    if (!entry) return; // left on their own — not a kick
    await sendLog(member.guild, {
      title: '👢 Member Kicked',
      color: 0xFEE75C,
      thumbnail: member.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: '👤 User', value: `${member.user.tag}`, inline: true },
        { name: '🆔 ID', value: member.id, inline: true },
        { name: '👮 By', value: entry.executor ? `${entry.executor}` : 'Unknown', inline: true },
        { name: '📝 Reason', value: entry.reason || 'No reason provided', inline: false },
      ],
    });
  } catch {}
});

// ── TIMEOUT  (member update — communicationDisabledUntil changes)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const wasTimedOut = oldMember.communicationDisabledUntilTimestamp;
    const isTimedOut  = newMember.communicationDisabledUntilTimestamp;

    // Timeout added
    if (!wasTimedOut && isTimedOut) {
      const entry = await getAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const until = Math.floor(isTimedOut / 1000);
      await sendLog(newMember.guild, {
        title: '⏰ Member Timed Out',
        color: 0xFFA500,
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: '👤 User', value: `${newMember.user.tag}`, inline: true },
          { name: '🆔 ID', value: newMember.id, inline: true },
          { name: '👮 By', value: entry?.executor ? `${entry.executor}` : 'Unknown', inline: true },
          { name: '⏱️ Until', value: `<t:${until}:F>`, inline: true },
          { name: '📝 Reason', value: entry?.reason || 'No reason provided', inline: false },
        ],
      });
    }

    // Timeout removed
    if (wasTimedOut && !isTimedOut) {
      const entry = await getAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      await sendLog(newMember.guild, {
        title: '✅ Timeout Removed',
        color: 0x57F287,
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: '👤 User', value: `${newMember.user.tag}`, inline: true },
          { name: '🆔 ID', value: newMember.id, inline: true },
          { name: '👮 By', value: entry?.executor ? `${entry.executor}` : 'Unknown', inline: true },
        ],
      });
    }
  } catch {}
});

// ── MESSAGE DELETE
client.on('messageDelete', async msg => {
  try {
    if (!msg.guild || msg.author?.bot) return;
    const cfg = getCFG();
    if (!cfg.logChannel) return;
    await new Promise(r => setTimeout(r, 1000));
    const entry = await getAuditEntry(msg.guild, AuditLogEvent.MessageDelete, msg.author?.id, 6000);
    await sendLog(msg.guild, {
      title: '🗑️ Message Deleted',
      color: 0xFF6B6B,
      fields: [
        { name: '👤 Author', value: msg.author ? `${msg.author} (${msg.author.tag})` : 'Unknown', inline: true },
        { name: '📍 Channel', value: `${msg.channel}`, inline: true },
        { name: '👮 Deleted By', value: entry?.executor ? `${entry.executor}` : 'Author/Unknown', inline: true },
        { name: '📝 Content', value: msg.content ? (msg.content.length > 1020 ? msg.content.slice(0, 1020) + '…' : msg.content) : '*[No text content]*', inline: false },
      ],
    });
  } catch {}
});

// ── MESSAGE EDIT
client.on('messageUpdate', async (oldMsg, newMsg) => {
  try {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    await sendLog(oldMsg.guild, {
      title: '✏️ Message Edited',
      color: 0x5865F2,
      fields: [
        { name: '👤 Author', value: `${oldMsg.author} (${oldMsg.author?.tag})`, inline: true },
        { name: '📍 Channel', value: `${oldMsg.channel}`, inline: true },
        { name: '🔗 Jump', value: `[Click here](${newMsg.url})`, inline: true },
        { name: '📝 Before', value: oldMsg.content ? (oldMsg.content.length > 500 ? oldMsg.content.slice(0,500)+'…' : oldMsg.content) : '*empty*', inline: false },
        { name: '📝 After',  value: newMsg.content ? (newMsg.content.length > 500 ? newMsg.content.slice(0,500)+'…' : newMsg.content) : '*empty*', inline: false },
      ],
    });
  } catch {}
});

// ── ROLE GIVEN / REMOVED
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const cfg = getCFG();
    if (!cfg.logChannel) return;
    const added   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (!added.size && !removed.size) return;
    // Ignore if it's just a timeout change (already handled above)
    const fields = [];
    if (added.size)   fields.push({ name: '✅ Roles Added',   value: added.map(r=>`<@&${r.id}>`).join(', '),   inline: false });
    if (removed.size) fields.push({ name: '❌ Roles Removed', value: removed.map(r=>`<@&${r.id}>`).join(', '), inline: false });
    if (!fields.length) return;
    await sendLog(newMember.guild, {
      title: '🎭 Member Roles Updated',
      color: 0x9B59B6,
      thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: '👤 Member', value: `${newMember.user} (${newMember.user.tag})`, inline: true },
        ...fields,
      ],
    });
  } catch {}
});

// ══════════════════════════════════════════════════════
//  SYSTEM — ANTI-LINK
// ══════════════════════════════════════════════════════
const LINK_RE = /(https?:\/\/|discord\.gg\/|www\.)\S+/gi;
client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild) return;
  const cfg = getCFG();
  if (!cfg.antiLinkEnabled) return;
  if (!LINK_RE.test(msg.content)) { LINK_RE.lastIndex = 0; return; }
  LINK_RE.lastIndex = 0;
  const member = msg.member;
  if (!member || isAdmin(member) || member.permissions.has(PermissionFlagsBits.Administrator)) return;
  if (cfg.antiLinkBypassRole && member.roles.cache.has(cfg.antiLinkBypassRole)) return;
  try {
    await msg.delete();
    await member.timeout(5 * 60 * 1000, 'Sent a link without permission');
    const w = await msg.channel.send({ embeds: [errEmbed('🔗 Anti-Link', `${member} — links are not permitted here.\n⏰ You have been timed out for **5 minutes**.`)] });
    setTimeout(() => w.delete().catch(() => {}), 7000);
    // Log the auto-delete
    await sendLog(msg.guild, {
      title: '🔗 Anti-Link — Message Deleted',
      color: 0xED4245,
      fields: [
        { name: '👤 User', value: `${member.user} (${member.user.tag})`, inline: true },
        { name: '📍 Channel', value: `${msg.channel}`, inline: true },
        { name: '📝 Content', value: msg.content.length > 800 ? msg.content.slice(0,800)+'…' : msg.content, inline: false },
      ],
    });
  } catch {}
});

// ══════════════════════════════════════════════════════
//  INTERACTION ROUTER
// ══════════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) return onSlash(interaction);
    if (interaction.isButton())           return onButton(interaction);
    if (interaction.isStringSelectMenu()) return onSelect(interaction);
    if (interaction.isModalSubmit())      return onModal(interaction);
  } catch (err) {
    console.error('Interaction error:', err);
    const r = { content: '❌ Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) interaction.followUp(r).catch(() => {});
    else interaction.reply(r).catch(() => {});
  }
});

// ══════════════════════════════════════════════════════
//  SLASH ROUTER
// ══════════════════════════════════════════════════════
async function onSlash(i) {
  if (i.commandName !== 'botinfo' && i.commandName !== 'feedback' && !isStaff(i.member))
    return i.reply({ embeds: [errEmbed('❌ Access Denied', 'You need the staff role to use this command.')], ephemeral: true });
  const map = {
    'setup': cmdSetup, 'botinfo': cmdBotInfo, 'team-panel': cmdTeamPanel,
    'ticket-panel': cmdTicketPanel,
    'close-ticket': cmdCloseTicket, 'add-user': cmdAddUser, 'remove-user': cmdRemoveUser,
    'send-message': cmdSendMessage, 'dmall': cmdDmAll,
    'lottery-start': cmdLotteryStart, 'lottery-end': cmdLotteryEnd, 'lottery-reroll': cmdLotteryReroll,
    'drop-start': cmdDropStart,
    'ban': cmdBan, 'unban': cmdUnban, 'kick': cmdKick,
    'timeout': cmdTimeout, 'untimeout': cmdUntimeout, 'warn': cmdWarn,
    'feedback': cmdFeedback, 'welcome-test': cmdWelcomeTest,
    'verify-panel': cmdVerifyPanel,
  };
  if (map[i.commandName]) return map[i.commandName](i);
}

// ══════════════════════════════════════════════════════
//  /setup  — FIRST-RUN + ADMIN CONFIGURATION
// ══════════════════════════════════════════════════════
async function cmdSetup(i) {
  const cfg = getCFG();
  if (!cfg.adminId) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator))
      return i.reply({ embeds: [errEmbed('❌ Setup Required', 'A server Administrator must run /setup first to claim admin.')], ephemeral: true });
    setCFG('adminId', i.user.id);
    console.log(`👑 Admin set: ${i.user.tag} (${i.user.id})`);
  } else if (!isAdmin(i.member)) {
    return i.reply({ embeds: [errEmbed('❌ Admin Only', 'Only the designated admin can open the setup panel.')], ephemeral: true });
  }

  const e = infoEmbed(
    '⚙️ Bot Setup Panel',
    `**Configure all bot systems from here.**\n` +
    `Everything is saved automatically.\n\n` +
    `👑 **Current Admin:** <@${getCFG().adminId}>\n\n` +
    `*Use the dropdown below to select a system to configure.*`
  );

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('setup_menu').setPlaceholder('⚙️ Choose a system to configure...')
      .addOptions([
        { label: '👑 Change Admin',           value: 'setup_admin',       emoji: '👑', description: 'Set who the admin is' },
        { label: '🤖 Bot Name & Logo',         value: 'setup_branding',    emoji: '🤖', description: 'Display name and logo URL' },
        { label: '🛡️ Staff Role',              value: 'setup_staffrole',   emoji: '🛡️', description: 'Role that can use bot commands' },
        { label: '🎫 Ticket Settings',        value: 'setup_tickets',     emoji: '🎫', description: 'Support role, category, transcripts' },
        { label: '👋 Welcome Channel',        value: 'setup_welcome',     emoji: '👋', description: 'Where to send welcome messages' },
        { label: '💬 Feedback Settings',      value: 'setup_feedback',    emoji: '💬', description: 'Channel and allowed role' },
        { label: '🔗 Anti-Link Settings',     value: 'setup_antilink',    emoji: '🔗', description: 'Enable/disable anti-link' },
        { label: '✅ Verification Settings',  value: 'setup_verify',      emoji: '✅', description: 'Role given on verify + channel' },
        { label: '📋 Log Channel',            value: 'setup_logs',        emoji: '📋', description: 'Channel for moderation logs' },
        { label: '📜 View Current Config',    value: 'setup_view',        emoji: '📜', description: 'See all current settings' },
      ])
  );
  await i.reply({ embeds: [e], components: [menu], ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  SYSTEM 1 — TICKETS
// ══════════════════════════════════════════════════════
async function cmdTicketPanel(i) {
  const e = infoEmbed(
    '🎫 Support Tickets',
    '**Need help? We\'re here for you!**\n\n' +
    '📩 **General Support** — Questions & general help\n' +
    '🛒 **Purchase Issue** — Billing & payment problems\n' +
    '⚠️ **Report a User** — Report a member\n' +
    '🔧 **Technical Help** — Technical issues\n' +
    '💡 **Suggestion** — Share your ideas\n\n' +
    '*Choose a category below to open a ticket.*'
  );
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('ticket_open_category').setPlaceholder('📋 Select a category...')
      .addOptions([
        { label: 'General Support', value: 'general',    emoji: '📩', description: 'General questions and help' },
        { label: 'Purchase Issue',  value: 'purchase',   emoji: '🛒', description: 'Billing and payment' },
        { label: 'Report a User',   value: 'report',     emoji: '⚠️', description: 'Report a rule-breaker' },
        { label: 'Technical Help',  value: 'technical',  emoji: '🔧', description: 'Technical issues' },
        { label: 'Suggestion',      value: 'suggestion', emoji: '💡', description: 'Ideas and suggestions' },
      ])
  );
  await i.channel.send({ embeds: [e], components: [row] });
  await i.reply({ embeds: [okEmbed('✅ Ticket Panel Sent', 'Ticket panel posted in this channel.')], ephemeral: true });
}

async function openTicket(i, category) {
  const cfg = getCFG();
  const openTickets = loadJSON(OPEN_TICKETS_FILE, {});
  if (openTickets[i.user.id]) {
    const ex = i.guild.channels.cache.get(openTickets[i.user.id]);
    if (ex) return i.reply({ embeds: [errEmbed('❌ Already Open', `You already have an open ticket: ${ex}`)], ephemeral: true });
  }
  await i.deferReply({ ephemeral: true });

  const emojis  = { general: '📩', purchase: '🛒', report: '⚠️', technical: '🔧', suggestion: '💡' };
  const labels  = { general: 'General Support', purchase: 'Purchase Issue', report: 'Report', technical: 'Technical', suggestion: 'Suggestion' };
  const name    = `${emojis[category]}-${i.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18)}-${Date.now().toString().slice(-4)}`;

  const overrides = [
    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: i.user.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
  ];
  if (cfg.ticketSupportRole)
    overrides.push({ id: cfg.ticketSupportRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] });

  const chOpts = { name, type: ChannelType.GuildText, permissionOverwrites: overrides, topic: `Ticket • ${i.user.tag} • ${labels[category]}` };
  if (cfg.ticketCategory) chOpts.parent = cfg.ticketCategory;

  const ch = await i.guild.channels.create(chOpts);
  openTickets[i.user.id] = ch.id;
  saveJSON(OPEN_TICKETS_FILE, openTickets);

  const staffMention = cfg.ticketSupportRole ? `<@&${cfg.ticketSupportRole}>` : '@Staff';
  const btns = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger),
  );
  await ch.send({
    content: `${i.user} | ${staffMention}`,
    embeds: [infoEmbed(`${emojis[category]} ${labels[category]} Ticket`,
      `Hello ${i.user}! 👋 A staff member will assist you shortly.\n\n` +
      `**Category:** ${labels[category]}\n**Opened:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `Please describe your issue in full detail.`)],
    components: [btns]
  });

  await i.editReply({ embeds: [okEmbed('✅ Ticket Created', `Your ticket has been opened: ${ch}`)] });
}

async function cmdCloseTicket(i) {
  const openTickets = loadJSON(OPEN_TICKETS_FILE, {});
  const ownerId = Object.entries(openTickets).find(([, cid]) => cid === i.channel.id)?.[0];
  if (!ownerId && !isStaff(i.member))
    return i.reply({ embeds: [errEmbed('❌ Not a Ticket', 'This is not a ticket channel, or you cannot close it.')], ephemeral: true });

  await i.reply({ embeds: [warnEmbed('⏳ Closing...', 'Generating transcript and closing ticket...')] });

  try {
    const messages = await i.channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let txt = `═══════════════════════════════════════════\n TICKET TRANSCRIPT\n Channel: ${i.channel.name}\n Closed by: ${i.user.tag}\n Date: ${new Date().toUTCString()}\n═══════════════════════════════════════════\n\n`;
    for (const m of sorted) {
      txt += `[${m.createdAt.toUTCString()}] ${m.author.tag}:\n`;
      if (m.content) txt += `  ${m.content}\n`;
      if (m.embeds.length) txt += `  [Embed: ${m.embeds[0].title || 'untitled'}]\n`;
      if (m.attachments.size) txt += `  [${m.attachments.size} Attachment(s)]\n`;
      txt += '\n';
    }

    const file = new AttachmentBuilder(Buffer.from(txt, 'utf8'), { name: `transcript-${i.channel.name}.txt` });
    const cfg = getCFG();

    if (cfg.transcriptChannel) {
      const tch = i.guild.channels.cache.get(cfg.transcriptChannel);
      if (tch) await tch.send({ embeds: [infoEmbed('📄 Transcript', `**Channel:** ${i.channel.name}\n**Closed by:** ${i.user}\n**Date:** <t:${Math.floor(Date.now()/1000)}:F>`)], files: [file] });
    }

    if (ownerId) {
      try {
        const owner = await i.guild.members.fetch(ownerId);
        await owner.send({
          embeds: [infoEmbed('📄 Your Ticket Was Closed', `Your ticket **${i.channel.name}** has been closed.\nAttached below is your full conversation transcript.`)],
          files: [new AttachmentBuilder(Buffer.from(txt, 'utf8'), { name: `transcript-${i.channel.name}.txt` })]
        });
      } catch {}
      delete openTickets[ownerId];
      saveJSON(OPEN_TICKETS_FILE, openTickets);
    }

    setTimeout(() => i.channel.delete().catch(() => {}), 4000);
  } catch (err) {
    console.error('Close ticket error:', err);
    i.followUp({ embeds: [errEmbed('❌ Error', 'Failed to close ticket properly.')], ephemeral: true }).catch(() => {});
  }
}

async function cmdAddUser(i) {
  const user = i.options.getUser('user');
  await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
  await i.reply({ embeds: [okEmbed('✅ Added', `${user} has been added to this ticket.`)] });
}

async function cmdRemoveUser(i) {
  const user = i.options.getUser('user');
  await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
  await i.reply({ embeds: [okEmbed('✅ Removed', `${user} has been removed from this ticket.`)] });
}

// ══════════════════════════════════════════════════════
//  SYSTEM — SEND MESSAGE
// ══════════════════════════════════════════════════════
async function cmdSendMessage(i) {
  const ch       = i.options.getChannel('channel');
  const title    = i.options.getString('title');
  const desc     = i.options.getString('description');
  const colorStr = i.options.getString('color') ?? '#5865F2';
  const image    = i.options.getString('image');
  const footer   = i.options.getString('footer');
  const cfg      = getCFG();
  let color = 0x5865F2;
  try { color = parseInt(colorStr.replace('#', ''), 16); } catch {}
  const e = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color)
    .setFooter({ text: footer || cfg.botName || 'Staff Bot' }).setTimestamp();
  if (cfg.botLogo) e.setThumbnail(cfg.botLogo);
  if (image) e.setImage(image);
  await ch.send({ embeds: [e] });
  await i.reply({ embeds: [okEmbed('✅ Sent', `Message delivered to ${ch}.`)], ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  SYSTEM — DM ALL
// ══════════════════════════════════════════════════════
async function cmdDmAll(i) {
  await i.deferReply({ ephemeral: true });
  const title   = i.options.getString('title');
  const message = i.options.getString('message');
  const cfg     = getCFG();
  const members = await i.guild.members.fetch();
  let sent = 0, failed = 0;
  for (const [, m] of members) {
    if (m.user.bot) continue;
    try {
      const e = new EmbedBuilder().setTitle(`📢 ${title}`).setDescription(message).setColor(0x5865F2)
        .setFooter({ text: `From ${i.guild.name} | ${cfg.botName || 'Staff Bot'}` }).setTimestamp();
      if (cfg.botLogo) e.setThumbnail(cfg.botLogo);
      await m.send({ embeds: [e] });
      sent++;
      await new Promise(r => setTimeout(r, 600));
    } catch { failed++; }
  }
  await i.editReply({ embeds: [infoEmbed('📬 DM All Complete', `✅ Sent: **${sent}**\n❌ Failed (DMs closed): **${failed}**`)] });
}

// ══════════════════════════════════════════════════════
//  SYSTEM — LOTTERY
// ══════════════════════════════════════════════════════
async function cmdLotteryStart(i) {
  const prize   = i.options.getString('prize');
  const minutes = i.options.getInteger('minutes');
  const endsAt  = Date.now() + minutes * 60 * 1000;
  const e = new EmbedBuilder()
    .setTitle('🎰 LOTTERY — Enter Now!')
    .setDescription(`**🏆 Prize:** ${prize}\n**⏱️ Ends:** <t:${Math.floor(endsAt/1000)}:R> (<t:${Math.floor(endsAt/1000)}:T>)\n**👥 Entries:** 0\n**👑 Host:** ${i.user}\n\n*Click the button to enter! One entry per person.*`)
    .setColor(0xFFD700).setFooter({ text: getCFG().botName || 'Staff Bot' }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lottery_enter').setLabel('🎟️ Enter Lottery').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('lottery_view_entries').setLabel('👥 View Entries').setStyle(ButtonStyle.Secondary),
  );
  const msg = await i.channel.send({ embeds: [e], components: [row] });
  saveJSON(LOTTERY_FILE, { messageId: msg.id, channelId: i.channel.id, prize, endsAt, entries: [], ended: false });
  await i.reply({ embeds: [okEmbed('✅ Lottery Started', `Lottery for **${prize}** is live! Ends in **${minutes}** min.`)], ephemeral: true });
  setTimeout(async () => {
    const data = loadJSON(LOTTERY_FILE, {});
    if (!data.ended) await doLotteryEnd(i.guild, msg, data);
  }, minutes * 60 * 1000);
}

async function doLotteryEnd(guild, msg, data) {
  if (!data || data.ended) return;
  data.ended = true;
  saveJSON(LOTTERY_FILE, data);
  const ch = guild.channels.cache.get(data.channelId);
  if (!data.entries?.length) {
    if (ch) await ch.send({ embeds: [warnEmbed('🎰 Lottery Ended', 'No entries — no winner this time!')] });
    try { if (msg) await msg.edit({ components: [] }); } catch {}
    return;
  }
  const winnerId = data.entries[Math.floor(Math.random() * data.entries.length)];
  data.lastWinner = winnerId; saveJSON(LOTTERY_FILE, data);
  if (ch) await ch.send({ content: `🎉 <@${winnerId}>`, embeds: [goldEmbed('🎉 Lottery Winner!', `**Prize:** ${data.prize}\n\nCongratulations <@${winnerId}>! Please contact a staff member to claim.`)] });
  try { if (msg) await msg.edit({ components: [] }); } catch {}
}

async function cmdLotteryEnd(i) {
  const data = loadJSON(LOTTERY_FILE, {});
  if (!data.messageId || data.ended) return i.reply({ embeds: [errEmbed('❌ No Lottery', 'No active lottery to end.')], ephemeral: true });
  const ch = i.guild.channels.cache.get(data.channelId);
  const msg = ch ? await ch.messages.fetch(data.messageId).catch(() => null) : null;
  await doLotteryEnd(i.guild, msg, data);
  await i.reply({ embeds: [okEmbed('✅ Ended', 'Lottery ended and winner drawn.')], ephemeral: true });
}

async function cmdLotteryReroll(i) {
  const data = loadJSON(LOTTERY_FILE, {});
  if (!data.entries?.length) return i.reply({ embeds: [errEmbed('❌ No Entries', 'No entries to reroll from.')], ephemeral: true });
  const winnerId = data.entries[Math.floor(Math.random() * data.entries.length)];
  data.lastWinner = winnerId; saveJSON(LOTTERY_FILE, data);
  await i.reply({ embeds: [goldEmbed('🎲 Rerolled!', `New winner: <@${winnerId}>\n**Prize:** ${data.prize}`)] });
}

// ══════════════════════════════════════════════════════
//  SYSTEM — DROP
// ══════════════════════════════════════════════════════
async function cmdDropStart(i) {
  const prize   = i.options.getString('prize');
  const winners = i.options.getInteger('winners');
  const e = new EmbedBuilder()
    .setTitle('🎁 DROP EVENT — Be Fast!')
    .setDescription(`**🏆 Prize:** ${prize}\n**👥 Winners:** First **${winners}** to claim\n**🕐 Started:** <t:${Math.floor(Date.now()/1000)}:R>\n\n⚡ **Click below to claim!**\n*Only the first ${winners} person${winners > 1 ? 's' : ''} win!*`)
    .setColor(0xFF6B35).setFooter({ text: getCFG().botName || 'Staff Bot' }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('drop_claim').setLabel('🎁 CLAIM DROP').setStyle(ButtonStyle.Danger)
  );
  const msg = await i.channel.send({ embeds: [e], components: [row] });
  saveJSON(DROP_FILE, { messageId: msg.id, channelId: i.channel.id, prize, maxWinners: winners, claimers: [] });
  await i.reply({ embeds: [okEmbed('✅ Drop Live!', `Drop for **${prize}** is active!`)], ephemeral: true });
}

async function handleDropClaim(i) {
  const data = loadJSON(DROP_FILE, {});
  if (!data.messageId)                                 return i.reply({ embeds: [errEmbed('❌ No Drop', 'No active drop.')], ephemeral: true });
  if (data.claimers?.includes(i.user.id))              return i.reply({ embeds: [errEmbed('❌ Already Claimed', 'You already claimed this drop!')], ephemeral: true });
  if ((data.claimers?.length ?? 0) >= data.maxWinners) return i.reply({ embeds: [errEmbed('❌ Too Late', 'All spots have been claimed!')], ephemeral: true });
  data.claimers = [...(data.claimers || []), i.user.id];
  saveJSON(DROP_FILE, data);
  await i.reply({ embeds: [goldEmbed('🎁 Claimed!', `You claimed **${data.prize}**! 🎉 Contact staff to receive your prize.`)], ephemeral: true });
  if (data.claimers.length >= data.maxWinners) {
    const mentions = data.claimers.map(id => `<@${id}>`).join(', ');
    const ch = i.guild.channels.cache.get(data.channelId);
    if (ch) {
      const msg = await ch.messages.fetch(data.messageId).catch(() => null);
      if (msg) await msg.edit({ components: [] });
      await ch.send({ embeds: [goldEmbed('🎁 Drop Fully Claimed!', `**Winners:** ${mentions}\n**Prize:** ${data.prize}`)] });
    }
  }
}

// ══════════════════════════════════════════════════════
//  SYSTEM — MODERATION
// ══════════════════════════════════════════════════════
async function cmdBan(i) {
  const user = i.options.getUser('user'), reason = i.options.getString('reason') ?? 'No reason provided';
  const m = i.guild.members.cache.get(user.id);
  if (!m) return i.reply({ embeds: [errEmbed('❌ Not Found', 'Member not found.')], ephemeral: true });
  try {
    await m.ban({ reason });
    await i.reply({ embeds: [makeEmbed('🔨 Banned', `**User:** ${user.tag}\n**Reason:** ${reason}`, 0xED4245)] });
  } catch { i.reply({ embeds: [errEmbed('❌ Failed', 'Could not ban. Check role hierarchy.')], ephemeral: true }); }
}

async function cmdUnban(i) {
  const uid = i.options.getString('userid').trim();
  try {
    await i.guild.bans.remove(uid);
    await i.reply({ embeds: [okEmbed('🔓 Unbanned', `User \`${uid}\` has been unbanned.`)] });
  } catch { i.reply({ embeds: [errEmbed('❌ Failed', 'Could not unban. Check the user ID.')], ephemeral: true }); }
}

async function cmdKick(i) {
  const user = i.options.getUser('user'), reason = i.options.getString('reason') ?? 'No reason provided';
  const m = i.guild.members.cache.get(user.id);
  if (!m) return i.reply({ embeds: [errEmbed('❌ Not Found', 'Member not found.')], ephemeral: true });
  try {
    await m.kick(reason);
    await i.reply({ embeds: [warnEmbed('👢 Kicked', `**User:** ${user.tag}\n**Reason:** ${reason}`)] });
  } catch { i.reply({ embeds: [errEmbed('❌ Failed', 'Could not kick.')], ephemeral: true }); }
}

async function cmdTimeout(i) {
  const user = i.options.getUser('user'), mins = i.options.getInteger('minutes'), reason = i.options.getString('reason') ?? 'No reason provided';
  const m = i.guild.members.cache.get(user.id);
  if (!m) return i.reply({ embeds: [errEmbed('❌ Not Found', 'Member not found.')], ephemeral: true });
  try {
    await m.timeout(mins * 60000, reason);
    await i.reply({ embeds: [warnEmbed('⏰ Timed Out', `**User:** ${user.tag}\n**Duration:** ${mins} min\n**Reason:** ${reason}`)] });
  } catch { i.reply({ embeds: [errEmbed('❌ Failed', 'Could not timeout.')], ephemeral: true }); }
}

async function cmdUntimeout(i) {
  const user = i.options.getUser('user');
  const m = i.guild.members.cache.get(user.id);
  if (!m) return i.reply({ embeds: [errEmbed('❌ Not Found', 'Member not found.')], ephemeral: true });
  try { await m.timeout(null); await i.reply({ embeds: [okEmbed('✅ Timeout Removed', `${user.tag}'s timeout has been removed.`)] }); }
  catch { i.reply({ embeds: [errEmbed('❌ Failed', 'Could not remove timeout.')], ephemeral: true }); }
}

async function cmdWarn(i) {
  const user = i.options.getUser('user'), reason = i.options.getString('reason');
  try { await user.send({ embeds: [warnEmbed('⚠️ Warning', `You received a warning in **${i.guild.name}**.\n\n**Reason:** ${reason}\n\nPlease follow the server rules.`)] }); } catch {}
  await i.reply({ embeds: [warnEmbed('⚠️ Warned', `**User:** ${user.tag}\n**Reason:** ${reason}`)] });
  // Log the warning manually
  await sendLog(i.guild, {
    title: '⚠️ Member Warned',
    color: 0xFEE75C,
    thumbnail: user.displayAvatarURL({ dynamic: true }),
    fields: [
      { name: '👤 User', value: `${user} (${user.tag})`, inline: true },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '👮 By', value: `${i.user}`, inline: true },
      { name: '📝 Reason', value: reason, inline: false },
    ],
  });
}

// ══════════════════════════════════════════════════════
//  SYSTEM — FEEDBACK
// ══════════════════════════════════════════════════════
async function cmdFeedback(i) {
  const cfg = getCFG();
  if (cfg.feedbackRole && !i.member.roles.cache.has(cfg.feedbackRole) && !isStaff(i.member))
    return i.reply({ embeds: [errEmbed('❌ No Permission', 'You need the feedback role to submit feedback.')], ephemeral: true });
  const text = i.options.getString('text'), rating = i.options.getInteger('rating');
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  const e = new EmbedBuilder().setTitle('💬 New Feedback')
    .addFields({ name: '👤 By', value: `${i.user} (${i.user.tag})`, inline: true }, { name: '⭐ Rating', value: stars, inline: true }, { name: '💬 Text', value: text })
    .setColor(0x5865F2).setThumbnail(i.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: cfg.botName || 'Staff Bot' }).setTimestamp();
  const ch = cfg.feedbackChannel ? i.guild.channels.cache.get(cfg.feedbackChannel) : i.guild.systemChannel;
  if (ch) await ch.send({ embeds: [e] });
  await i.reply({ embeds: [okEmbed('✅ Feedback Submitted', 'Thank you for your feedback!')], ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  WELCOME TEST
// ══════════════════════════════════════════════════════
async function cmdWelcomeTest(i) {
  const cfg = getCFG();
  const e = new EmbedBuilder()
    .setTitle(`👋 Welcome to ${i.guild.name}!`)
    .setDescription(`Hey ${i.user}, welcome aboard! 🎉\n\n🔹 Read the rules.\n🔹 Head to verification.\n🔹 Introduce yourself!\n\nYou are member **#${i.guild.memberCount}** *(preview)*`)
    .setColor(0x5865F2).setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `${cfg.botName || 'Staff Bot'} — Preview` }).setTimestamp();
  if (cfg.botLogo) e.setImage(cfg.botLogo);
  await i.reply({ embeds: [e], ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  BOTINFO
// ══════════════════════════════════════════════════════
async function cmdBotInfo(i) {
  const cfg = getCFG();
  await i.reply({ embeds: [infoEmbed('ℹ️ Bot Configuration',
    `**Name:** ${cfg.botName || 'Staff Bot'}\n` +
    `**Admin:** ${cfg.adminId ? `<@${cfg.adminId}>` : '⚠️ Not set — run /setup'}\n` +
    `**Staff Role:** ${cfg.staffRole ? `<@&${cfg.staffRole}>` : '⚠️ Not set'}\n\n` +
    `**— Tickets —**\n` +
    `Support Role: ${cfg.ticketSupportRole ? `<@&${cfg.ticketSupportRole}>` : 'Not set'}\n` +
    `Ticket Category: ${cfg.ticketCategory ? `\`${cfg.ticketCategory}\`` : 'Not set'}\n` +
    `Transcript Channel: ${cfg.transcriptChannel ? `<#${cfg.transcriptChannel}>` : 'Not set'}\n\n` +
    `**— Channels —**\n` +
    `Welcome: ${cfg.welcomeChannel ? `<#${cfg.welcomeChannel}>` : 'Not set'}\n` +
    `Feedback: ${cfg.feedbackChannel ? `<#${cfg.feedbackChannel}>` : 'Not set'}\n` +
    `Log Channel: ${cfg.logChannel ? `<#${cfg.logChannel}>` : 'Not set'}\n\n` +
    `**— Anti-Link —**\n` +
    `Status: ${cfg.antiLinkEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
    `Bypass Role: ${cfg.antiLinkBypassRole ? `<@&${cfg.antiLinkBypassRole}>` : 'None'}\n\n` +
    `**— Verification —**\n` +
    `Verified Role: ${cfg.verifyRole ? `<@&${cfg.verifyRole}>` : 'Not set'}\n` +
    `Verify Message: ${cfg.verifyMessage || 'Default'}`
  )], ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  TEAM PANEL
// ══════════════════════════════════════════════════════
async function cmdTeamPanel(i) {
  const cfg = getCFG();
  const e = infoEmbed('🛡️ Staff Team Control Panel',
    `**Welcome, ${i.user}!** This is the central control panel.\n\n` +
    `Use the buttons and menus below to manage all bot systems.\n\n` +
    `👑 **Admin:** ${cfg.adminId ? `<@${cfg.adminId}>` : '⚠️ Not set'}\n` +
    `🛡️ **Staff Role:** ${cfg.staffRole ? `<@&${cfg.staffRole}>` : '⚠️ Not set'}\n` +
    `🔗 **Anti-Link:** ${cfg.antiLinkEnabled ? '✅ On' : '❌ Off'}\n` +
    `✅ **Verify Role:** ${cfg.verifyRole ? `<@&${cfg.verifyRole}>` : '⚠️ Not set'}\n` +
    `📋 **Log Channel:** ${cfg.logChannel ? `<#${cfg.logChannel}>` : '⚠️ Not set'}`
  );
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('team_ticket_panel').setLabel('🎫 Ticket Panel').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('team_verify_panel').setLabel('✅ Verify Panel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('team_server_stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('team_lottery_info').setLabel('🎰 Lottery Info').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('team_drop_info').setLabel('🎁 Drop Info').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('team_ticket_stats').setLabel('📈 Ticket Stats').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('team_toggle_antilink').setLabel('🔗 Toggle Anti-Link').setStyle(ButtonStyle.Secondary),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('team_quick_action').setPlaceholder('⚡ Quick Actions...')
      .addOptions([
        { label: 'End Active Lottery',    value: 'end_lottery',    emoji: '🎰' },
        { label: 'Reroll Lottery Winner', value: 'reroll_lottery', emoji: '🎲' },
        { label: 'View Bot Config',       value: 'view_config',    emoji: '📜' },
        { label: 'How to DM All',         value: 'dmall_help',     emoji: '📬' },
        { label: 'How to Send Message',   value: 'msg_help',       emoji: '📣' },
      ])
  );
  const r4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('team_open_setup').setLabel('⚙️ Open Setup Panel (Admin Only)').setStyle(ButtonStyle.Danger),
  );
  await i.channel.send({ embeds: [e], components: [r1, r2, r3, r4] });
  await i.reply({ embeds: [okEmbed('✅ Team Panel Sent', 'Staff control panel posted.')], ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  SYSTEM — VERIFICATION
// ══════════════════════════════════════════════════════
async function cmdVerifyPanel(i) {
  if (!isAdmin(i.member))
    return i.reply({ embeds: [errEmbed('❌ Admin Only', 'Only the admin can send the verification panel.')], ephemeral: true });

  const cfg = getCFG();
  if (!cfg.verifyRole)
    return i.reply({ embeds: [errEmbed('❌ Not Configured', 'Please set the **Verify Role** in /setup → Verification Settings first.')], ephemeral: true });

  const title   = cfg.verifyTitle   || '✅ Verification';
  const message = cfg.verifyMessage || 'Click the button below to verify yourself and gain access to the server.';

  const e = new EmbedBuilder()
    .setTitle(title)
    .setDescription(message)
    .setColor(0x57F287)
    .setFooter({ text: cfg.botName || 'Staff Bot' })
    .setTimestamp();
  if (cfg.botLogo) e.setThumbnail(cfg.botLogo);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_click')
      .setLabel(cfg.verifyButtonLabel || '✅ Verify Me')
      .setStyle(ButtonStyle.Success)
  );

  await i.channel.send({ embeds: [e], components: [row] });
  await i.reply({ embeds: [okEmbed('✅ Verification Panel Sent', `Verification panel posted. Members will receive <@&${cfg.verifyRole}> on click.`)], ephemeral: true });
}

async function handleVerifyClick(i) {
  const cfg = getCFG();
  if (!cfg.verifyRole)
    return i.reply({ embeds: [errEmbed('❌ Not Set Up', 'Verification is not configured. Please contact an admin.')], ephemeral: true });

  if (i.member.roles.cache.has(cfg.verifyRole))
    return i.reply({ embeds: [warnEmbed('⚠️ Already Verified', 'You are already verified!')], ephemeral: true });

  try {
    await i.member.roles.add(cfg.verifyRole, 'Verified via verification panel');
    await i.reply({ embeds: [okEmbed('✅ Verified!', `Welcome! You have been given the <@&${cfg.verifyRole}> role and now have full access.`)], ephemeral: true });

    // Log the verification
    await sendLog(i.guild, {
      title: '✅ Member Verified',
      color: 0x57F287,
      thumbnail: i.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: '👤 Member', value: `${i.user} (${i.user.tag})`, inline: true },
        { name: '🆔 ID',     value: i.user.id, inline: true },
        { name: '🎭 Role',   value: `<@&${cfg.verifyRole}>`, inline: true },
      ],
    });
  } catch {
    await i.reply({ embeds: [errEmbed('❌ Failed', 'Could not assign the verified role. Make sure my role is above the verify role in the hierarchy.')], ephemeral: true });
  }
}

// ══════════════════════════════════════════════════════
//  BUTTON HANDLER
// ══════════════════════════════════════════════════════
async function onButton(i) {
  const id = i.customId;

  // ── Verification
  if (id === 'verify_click')         return handleVerifyClick(i);

  if (id === 'ticket_close')  return cmdCloseTicket(i);
  if (id === 'ticket_claim') {
    if (!isStaff(i.member)) return i.reply({ embeds: [errEmbed('❌ Staff Only', 'Only staff can claim tickets.')], ephemeral: true });
    return i.reply({ embeds: [infoEmbed('👤 Claimed', `${i.user} has claimed this ticket and will handle it.`)] });
  }
  if (id === 'lottery_enter') {
    const data = loadJSON(LOTTERY_FILE, {});
    if (data.ended) return i.reply({ embeds: [errEmbed('❌ Ended', 'This lottery has ended.')], ephemeral: true });
    if (data.entries?.includes(i.user.id)) return i.reply({ embeds: [warnEmbed('⚠️ Already In', 'You are already in this lottery!')], ephemeral: true });
    data.entries = [...(data.entries || []), i.user.id];
    saveJSON(LOTTERY_FILE, data);
    return i.reply({ embeds: [okEmbed('🎟️ Entered!', `You entered the lottery!\n👥 Total: **${data.entries.length}**`)], ephemeral: true });
  }
  if (id === 'lottery_view_entries') {
    const data = loadJSON(LOTTERY_FILE, {});
    return i.reply({ embeds: [infoEmbed('👥 Entries', `**Prize:** ${data.prize || 'N/A'}\n**Entries:** ${data.entries?.length ?? 0}`)], ephemeral: true });
  }
  if (id === 'drop_claim')           return handleDropClaim(i);
  if (id === 'team_ticket_panel')    return cmdTicketPanel(i);
  if (id === 'team_verify_panel')    return cmdVerifyPanel(i);
  if (id === 'team_ticket_stats') {
    const counts = loadJSON(TICKET_COUNTS_FILE, {});
    if (!Object.keys(counts).length)
      return i.reply({ embeds: [infoEmbed('📊 Ticket Stats', 'No ticket stats yet.')], ephemeral: true });
    const sorted = Object.entries(counts).sort(([,a],[,b]) => b - a);
    const lines = sorted.map(([uid, count], idx) => `**${idx+1}.** <@${uid}> — **${count}** takes`);
    return i.reply({ embeds: [infoEmbed('📈 Ticket Stats', lines.join('\n'))], ephemeral: true });
  }
  if (id === 'team_open_setup')      return cmdSetup(i);
  if (id === 'team_toggle_antilink') {
    const cfg = getCFG(); const val = !cfg.antiLinkEnabled; setCFG('antiLinkEnabled', val);
    return i.reply({ embeds: [infoEmbed('🔗 Anti-Link', `Anti-link is now **${val ? 'ENABLED ✅' : 'DISABLED ❌'}**.`)], ephemeral: true });
  }
  if (id === 'team_server_stats') {
    await i.guild.members.fetch();
    return i.reply({ embeds: [infoEmbed('📊 Server Stats',
      `**Server:** ${i.guild.name}\n**Members:** ${i.guild.memberCount}\n**Channels:** ${i.guild.channels.cache.size}\n**Roles:** ${i.guild.roles.cache.size}\n` +
      `**Created:** <t:${Math.floor(i.guild.createdTimestamp/1000)}:D>\n**Boosts:** ${i.guild.premiumSubscriptionCount}`)], ephemeral: true });
  }
  if (id === 'team_lottery_info') {
    const d = loadJSON(LOTTERY_FILE, {});
    return i.reply({ embeds: [d.prize ? infoEmbed('🎰 Lottery', `**Prize:** ${d.prize}\n**Status:** ${d.ended ? '❌ Ended' : '✅ Active'}\n**Entries:** ${d.entries?.length ?? 0}`) : warnEmbed('🎰 No Lottery', 'No active lottery.')], ephemeral: true });
  }
  if (id === 'team_drop_info') {
    const d = loadJSON(DROP_FILE, {});
    return i.reply({ embeds: [d.prize ? infoEmbed('🎁 Drop', `**Prize:** ${d.prize}\n**Claimed:** ${d.claimers?.length ?? 0}/${d.maxWinners}`) : warnEmbed('🎁 No Drop', 'No active drop.')], ephemeral: true });
  }
}

// ══════════════════════════════════════════════════════
//  SELECT HANDLER
// ══════════════════════════════════════════════════════
async function onSelect(i) {
  const id = i.customId, val = i.values[0];
  if (id === 'ticket_open_category') return openTicket(i, val);
  if (id === 'setup_menu')           return handleSetupMenu(i, val);
  if (id === 'team_quick_action') {
    if (val === 'end_lottery')    return cmdLotteryEnd(i);
    if (val === 'reroll_lottery') return cmdLotteryReroll(i);
    if (val === 'view_config')    return cmdBotInfo(i);
    if (val === 'dmall_help')     return i.reply({ embeds: [infoEmbed('📬 DM All', 'Use `/dmall` to message all members.')], ephemeral: true });
    if (val === 'msg_help')       return i.reply({ embeds: [infoEmbed('📣 Send Message', 'Use `/send-message` to post a styled embed.')], ephemeral: true });
  }
}

// ══════════════════════════════════════════════════════
//  SETUP MENU
// ══════════════════════════════════════════════════════
async function handleSetupMenu(i, action) {
  if (!isAdmin(i.member))
    return i.reply({ embeds: [errEmbed('❌ Admin Only', 'Only the admin can change settings.')], ephemeral: true });

  if (action === 'setup_view') return cmdBotInfo(i);

  const modals = {
    setup_admin: () => {
      const m = new ModalBuilder().setCustomId('modal_admin').setTitle('👑 Set Admin User');
      m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('admin_id').setLabel('Admin User ID (right-click → Copy ID)').setStyle(TextInputStyle.Short).setRequired(true)
      )); return m;
    },
    setup_branding: () => {
      const cfg = getCFG();
      const m = new ModalBuilder().setCustomId('modal_branding').setTitle('🤖 Bot Branding');
      m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bot_name').setLabel('Bot Display Name').setStyle(TextInputStyle.Short).setValue(cfg.botName || '').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bot_logo').setLabel('Logo URL (optional)').setStyle(TextInputStyle.Short).setValue(cfg.botLogo || '').setRequired(false)),
      ); return m;
    },
    setup_staffrole: () => {
      const m = new ModalBuilder().setCustomId('modal_staffrole').setTitle('🛡️ Staff Role');
      m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('staff_role').setLabel('Staff Role ID').setStyle(TextInputStyle.Short).setPlaceholder('Right-click the role → Copy ID').setRequired(true)
      )); return m;
    },
    setup_tickets: () => {
      const cfg = getCFG();
      const m = new ModalBuilder().setCustomId('modal_tickets').setTitle('🎫 Ticket Settings');
      m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('support_role').setLabel('Support Role ID').setStyle(TextInputStyle.Short).setValue(cfg.ticketSupportRole || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_category').setLabel('Ticket Category ID').setStyle(TextInputStyle.Short).setValue(cfg.ticketCategory || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('transcript_ch').setLabel('Transcript Channel ID').setStyle(TextInputStyle.Short).setValue(cfg.transcriptChannel || '').setRequired(false)),
      ); return m;
    },
    setup_welcome: () => {
      const m = new ModalBuilder().setCustomId('modal_welcome').setTitle('👋 Welcome Channel');
      m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('welcome_channel').setLabel('Welcome Channel ID').setStyle(TextInputStyle.Short).setValue(getCFG().welcomeChannel || '').setRequired(true)
      )); return m;
    },
    setup_feedback: () => {
      const cfg = getCFG();
      const m = new ModalBuilder().setCustomId('modal_feedback').setTitle('💬 Feedback Settings');
      m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback_channel').setLabel('Feedback Channel ID').setStyle(TextInputStyle.Short).setValue(cfg.feedbackChannel || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback_role').setLabel('Allowed Feedback Role ID (blank = staff)').setStyle(TextInputStyle.Short).setValue(cfg.feedbackRole || '').setRequired(false)),
      ); return m;
    },
    setup_antilink: () => {
      const cfg = getCFG();
      const m = new ModalBuilder().setCustomId('modal_antilink').setTitle('🔗 Anti-Link Settings');
      m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('enabled').setLabel('Enable Anti-Link? (yes / no)').setStyle(TextInputStyle.Short).setValue(cfg.antiLinkEnabled ? 'yes' : 'no').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bypass_role').setLabel('Bypass Role ID (may send links)').setStyle(TextInputStyle.Short).setValue(cfg.antiLinkBypassRole || '').setRequired(false)),
      ); return m;
    },
    // ── NEW: Verification modal
    setup_verify: () => {
      const cfg = getCFG();
      const m = new ModalBuilder().setCustomId('modal_verify').setTitle('✅ Verification Settings');
      m.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('verify_role').setLabel('Verified Role ID').setStyle(TextInputStyle.Short).setValue(cfg.verifyRole || '').setRequired(true).setPlaceholder('Right-click the role → Copy ID')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('verify_title').setLabel('Panel Title').setStyle(TextInputStyle.Short).setValue(cfg.verifyTitle || '✅ Verification').setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('verify_message').setLabel('Panel Message').setStyle(TextInputStyle.Paragraph).setValue(cfg.verifyMessage || 'Click the button below to verify yourself and gain access to the server.').setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('verify_button_label').setLabel('Button Label').setStyle(TextInputStyle.Short).setValue(cfg.verifyButtonLabel || '✅ Verify Me').setRequired(false)
        ),
      ); return m;
    },
    // ── NEW: Logs modal
    setup_logs: () => {
      const cfg = getCFG();
      const m = new ModalBuilder().setCustomId('modal_logs').setTitle('📋 Log Channel');
      m.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('log_channel').setLabel('Log Channel ID').setStyle(TextInputStyle.Short).setValue(cfg.logChannel || '').setRequired(true).setPlaceholder('Right-click the channel → Copy ID')
        ),
      ); return m;
    },
  };

  if (modals[action]) return i.showModal(modals[action]());
}

// ══════════════════════════════════════════════════════
//  MODAL HANDLER
// ══════════════════════════════════════════════════════
async function onModal(i) {
  const id = i.customId;
  const get = key => i.fields.getTextInputValue(key)?.trim();

  if (id === 'modal_admin') {
    setCFG('adminId', get('admin_id'));
    return i.reply({ embeds: [okEmbed('✅ Admin Updated', `Admin set to <@${getCFG().adminId}>.`)], ephemeral: true });
  }
  if (id === 'modal_branding') {
    const name = get('bot_name'), logo = get('bot_logo');
    const d = loadCFG(); d.botName = name; if (logo) d.botLogo = logo; saveCFG(d);
    return i.reply({ embeds: [okEmbed('✅ Branding Saved', `Name: **${name}**${logo ? '\nLogo: updated' : ''}`)], ephemeral: true });
  }
  if (id === 'modal_staffrole') {
    setCFG('staffRole', get('staff_role'));
    return i.reply({ embeds: [okEmbed('✅ Staff Role Set', `Staff role: <@&${getCFG().staffRole}>`)], ephemeral: true });
  }
  if (id === 'modal_tickets') {
    const d = loadCFG();
    const sr = get('support_role'), cat = get('ticket_category'), tr = get('transcript_ch');
    if (sr) d.ticketSupportRole = sr; if (cat) d.ticketCategory = cat; if (tr) d.transcriptChannel = tr;
    saveCFG(d);
    return i.reply({ embeds: [okEmbed('✅ Ticket Settings Saved', 'Ticket configuration updated.')], ephemeral: true });
  }
  if (id === 'modal_welcome') {
    setCFG('welcomeChannel', get('welcome_channel'));
    return i.reply({ embeds: [okEmbed('✅ Welcome Channel Set', `Welcome messages → <#${getCFG().welcomeChannel}>`)], ephemeral: true });
  }
  if (id === 'modal_feedback') {
    const d = loadCFG();
    const ch = get('feedback_channel'), role = get('feedback_role');
    if (ch) d.feedbackChannel = ch; if (role) d.feedbackRole = role; saveCFG(d);
    return i.reply({ embeds: [okEmbed('✅ Feedback Settings Saved', 'Feedback configuration updated.')], ephemeral: true });
  }
  if (id === 'modal_antilink') {
    const d = loadCFG();
    d.antiLinkEnabled = get('enabled').toLowerCase() === 'yes';
    const bypass = get('bypass_role'); if (bypass) d.antiLinkBypassRole = bypass;
    saveCFG(d);
    return i.reply({ embeds: [okEmbed('✅ Anti-Link Updated', `Anti-link: **${d.antiLinkEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}**`)], ephemeral: true });
  }
  // ── NEW: Verification modal save
  if (id === 'modal_verify') {
    const d = loadCFG();
    d.verifyRole        = get('verify_role');
    const title   = get('verify_title');
    const message = get('verify_message');
    const label   = get('verify_button_label');
    if (title)   d.verifyTitle       = title;
    if (message) d.verifyMessage     = message;
    if (label)   d.verifyButtonLabel = label;
    saveCFG(d);
    return i.reply({ embeds: [okEmbed('✅ Verification Settings Saved',
      `Verified Role: <@&${d.verifyRole}>\nTitle: **${d.verifyTitle || '✅ Verification'}**\n\nNow use \`/verify-panel\` or the **✅ Verify Panel** button in the Team Panel to post it.`)], ephemeral: true });
  }
  // ── NEW: Logs modal save
  if (id === 'modal_logs') {
    setCFG('logChannel', get('log_channel'));
    return i.reply({ embeds: [okEmbed('✅ Log Channel Set', `Moderation logs → <#${getCFG().logChannel}>`)], ephemeral: true });
  }

  await i.reply({ content: '✅ Saved.', ephemeral: true });
}

// ══════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════
client.login(process.env.DISCORD_TOKEN);
ENDOFFILE
echo "done"
Output

done
Done

You are out of free messages until 12:00 AM




