const path = require('path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is up and running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Collection, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder,
  ActivityType, AuditLogEvent
} = require('discord.js');

// ═══════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════
const CONFIG = {
  TOKEN:              process.env.BOT_TOKEN          || '',
  CLIENT_ID:          process.env.CLIENT_ID          || '1520769665494679703',
  GUILD_ID:           process.env.GUILD_ID           || '1489033656487121077',
  TEAM_ROLE_ID:       process.env.TEAM_ROLE_ID       || '1489313397462798518',
  VERIFIED_ROLE_ID:   process.env.VERIFIED_ROLE_ID   || '1513574669436059841',
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || '1497538017538347069',
  LOG_CHANNEL_ID:     process.env.LOG_CHANNEL_ID     || '1514300287605801102',
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || '1495059280242675916',
  BOOST_CHANNEL_ID:   process.env.BOOST_CHANNEL_ID   || '1517630124239884381',
  PROMO_CHANNEL_ID:   process.env.PROMO_CHANNEL_ID   || '1508783637380730931',
  VOTES_LOG_CHANNEL_ID: process.env.VOTES_LOG_CHANNEL_ID || '1506383446145110218',
  SERVER_OWNER_ROLE_ID: process.env.SERVER_OWNER_ROLE_ID || '1490779090733760795',
  RULES_CHANNEL_ID:   process.env.RULES_CHANNEL_ID   || '',
  SUGGESTIONS_CHANNEL_ID: process.env.SUGGESTIONS_CHANNEL_ID || '',
  BLACKLISTED_FROM_LIST: [],

  CATEGORIES: {
    fivem:     { id: '1496093663464263760', name: 'FiveM Servers',      emoji: '🚗', color: 0xE74C3C },
    shop:      { id: '1520760826506510356', name: 'Shop Servers',       emoji: '🛒', color: 0xF39C12 },
    minecraft: { id: '1520761393731866687', name: 'Minecraft Servers',  emoji: '⛏️', color: 0x27AE60 },
    hosting:   { id: '1520761283324940358', name: 'Hosting Servers',    emoji: '🖥️', color: 0x2980B9 },
    other:     { id: '1520761490208981113', name: 'Other Servers',      emoji: '🌐', color: 0x8E44AD },
  },
};

// ═══════════════════════════════════════════════════════
//  DATABASE (in-memory)
// ═══════════════════════════════════════════════════════
const DB = {
  tickets:     {},
  giveaways:   {},
  serverList:  {},
  blacklisted: new Set(),
  pendingServerSubmissions: {},
  // ── מערכות חדשות ──
  warnings:    {},        // userId -> [{ reason, moderator, timestamp }]
  mutes:       {},        // userId -> { until, reason }
  notes:       {},        // userId -> [{ text, moderator, timestamp }]
  suggestions: {},        // messageId -> { content, authorId, upvotes, downvotes, voters, status }
  polls:       {},        // messageId -> { question, options, votes:{optionIdx:[userIds]}, endTime, ended }
  afk:         {},        // userId -> { reason, since }
  levelSystem: {},        // userId -> { xp, level, messages }
  welcomeConfig: {
    dm: true,
    embedColor: 0x5865F2,
    roles: [],            // auto-roles on join
  },
  automod: {
    enabled: true,
    capsPercent: 70,      // % caps to trigger
    spamMessages: 5,      // מספר הודעות ב-5 שניות
    spamWindow: {},       // userId -> [timestamps]
    badWords: [],         // מילים אסורות
    bannedWords: {},      // userId -> count
  },
  slowmode: {},           // channelId -> ms
  embedTemplates: {},     // name -> embedData
  reactionRoles: {},      // messageId -> { channelId, roles: { emoji -> roleId } }
  ticketStats: {
    total: 0,
    closed: 0,
    avgResponse: 0,
  },
  serverBumps: {},        // channelId -> { lastBump, count }
};

// ═══════════════════════════════════════════════════════
//  PROTECTION STATE
// ═══════════════════════════════════════════════════════
const PROTECT = {
  channelDeletes: {},
  roleDeletes:    {},
  kicks:          {},
  bans:           {},
  timeouts:       {},
  WINDOW_MS:  8000,
  MAX_ACTIONS: 2,
};

function recordAction(map, userId) {
  const now = Date.now();
  if (!map[userId]) map[userId] = [];
  map[userId] = map[userId].filter(t => now - t < PROTECT.WINDOW_MS);
  map[userId].push(now);
  return map[userId].length;
}

// ═══════════════════════════════════════════════════════
//  ANTI-LINK
// ═══════════════════════════════════════════════════════
const ANTI_LINK = {
  enabled: true,
  allowedChannels: [],
  exemptRoles: [ process.env.TEAM_ROLE_ID || '1489313397462798518' ],
  patterns: [
    /https?:\/\//i,
    /discord\.gg\/[a-zA-Z0-9]+/i,
    /discord\.com\/invite\/[a-zA-Z0-9]+/i,
    /www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}/i,
    /[a-zA-Z0-9\-]+\.(com|net|org|io|gg|xyz|me|co|dev|app|ly|link|site|online|store|shop|info|biz|tv|cc|vc|tk|ml|ga|cf|gq)/i,
  ],
  warnings: {},
  MAX_WARNINGS: 3,
  WARN_RESET_MS: 60 * 60 * 1000,
};

function hasLink(content) {
  if (!content) return false;
  return ANTI_LINK.patterns.some(p => p.test(content));
}
function isExempt(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  return ANTI_LINK.exemptRoles.some(roleId => member.roles.cache.has(roleId));
}
function addLinkWarning(userId) {
  const now = Date.now();
  if (!ANTI_LINK.warnings[userId]) ANTI_LINK.warnings[userId] = { count: 0, firstAt: now };
  if (now - ANTI_LINK.warnings[userId].firstAt > ANTI_LINK.WARN_RESET_MS)
    ANTI_LINK.warnings[userId] = { count: 0, firstAt: now };
  ANTI_LINK.warnings[userId].count++;
  return ANTI_LINK.warnings[userId].count;
}
async function handleAntiLink(message, client) {
  if (!ANTI_LINK.enabled || !message.guild || message.author.bot) return;
  if (ANTI_LINK.allowedChannels.includes(message.channelId)) return;
  if (isExempt(message.member)) return;
  if (!hasLink(message.content)) return;
  try { await message.delete(); } catch {}
  const warns = addLinkWarning(message.author.id);
  if (warns >= ANTI_LINK.MAX_WARNINGS) {
    try { await message.member.timeout(10 * 60 * 1000, '🛡️ אנטי-לינק'); } catch {}
    ANTI_LINK.warnings[message.author.id] = { count: 0, firstAt: Date.now() };
    try {
      const w = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [new EmbedBuilder().setTitle('🔇 קיבלת עצירה זמנית!').setDescription(`<@${message.author.id}> קיבלת **timeout של 10 דקות** בגלל שליחת לינקים חוזרת.`).setColor(0xED4245).setTimestamp()] });
      setTimeout(() => w.delete().catch(() => {}), 8000);
    } catch {}
  } else {
    try {
      const w = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [new EmbedBuilder().setTitle('🔗 שליחת לינקים אסורה!').setDescription(`<@${message.author.id}> הודעתך נמחקה.\n\n⚠️ **אזהרה ${warns}/${ANTI_LINK.MAX_WARNINGS}**`).setColor(0xFEE75C).setTimestamp()] });
      setTimeout(() => w.delete().catch(() => {}), 6000);
    } catch {}
  }
  await sendLog(client, new EmbedBuilder().setTitle('🔗 אנטי-לינק').addFields({ name: '👤 משתמש', value: `<@${message.author.id}>`, inline: true }, { name: '📍 ערוץ', value: `<#${message.channelId}>`, inline: true }, { name: '📝 תוכן', value: message.content.slice(0, 300) }).setColor(0xFEE75C).setTimestamp());
}

// ═══════════════════════════════════════════════════════
//  AUTO-MOD (CAPS + SPAM + BAD WORDS)
// ═══════════════════════════════════════════════════════
async function handleAutoMod(message, client) {
  if (!DB.automod.enabled || !message.guild || message.author.bot) return;
  if (isExempt(message.member)) return;

  const content = message.content;

  // Bad words filter
  if (DB.automod.badWords.length > 0) {
    const lower = content.toLowerCase();
    const found = DB.automod.badWords.find(w => lower.includes(w.toLowerCase()));
    if (found) {
      try { await message.delete(); } catch {}
      const w = await message.channel.send({ embeds: [new EmbedBuilder().setDescription(`<@${message.author.id}> הודעתך נמחקה — תוכן אסור.`).setColor(0xED4245)] }).catch(() => null);
      if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
      await sendLog(client, new EmbedBuilder().setTitle('🤬 מילה אסורה').addFields({ name: '👤 משתמש', value: `<@${message.author.id}>`, inline: true }, { name: '📍 ערוץ', value: `<#${message.channelId}>`, inline: true }).setColor(0xED4245).setTimestamp());
      return;
    }
  }

  // Caps filter
  if (content.length > 8) {
    const letters = content.replace(/[^a-zA-Zא-ת]/g, '');
    if (letters.length > 6) {
      const upper = content.replace(/[^A-Z]/g, '').length;
      if ((upper / letters.length) * 100 >= DB.automod.capsPercent) {
        try { await message.delete(); } catch {}
        const w = await message.channel.send({ embeds: [new EmbedBuilder().setDescription(`<@${message.author.id}> אנא אל תכתוב בכיפסלוק! ⚠️`).setColor(0xFEE75C)] }).catch(() => null);
        if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
        return;
      }
    }
  }

  // Spam filter
  const now = Date.now();
  const SPAM_WINDOW = 5000;
  if (!DB.automod.spamWindow[message.author.id]) DB.automod.spamWindow[message.author.id] = [];
  DB.automod.spamWindow[message.author.id] = DB.automod.spamWindow[message.author.id].filter(t => now - t < SPAM_WINDOW);
  DB.automod.spamWindow[message.author.id].push(now);
  if (DB.automod.spamWindow[message.author.id].length >= DB.automod.spamMessages) {
    DB.automod.spamWindow[message.author.id] = [];
    try { await message.member.timeout(5 * 60 * 1000, '🛡️ ספאם'); } catch {}
    const w = await message.channel.send({ embeds: [new EmbedBuilder().setTitle('🚫 ספאם זוהה!').setDescription(`<@${message.author.id}> קיבלת timeout של 5 דקות בגלל ספאם.`).setColor(0xED4245)] }).catch(() => null);
    if (w) setTimeout(() => w.delete().catch(() => {}), 8000);
    await sendLog(client, new EmbedBuilder().setTitle('🚫 אוטומוד — ספאם').addFields({ name: '👤 משתמש', value: `<@${message.author.id}>`, inline: true }, { name: '📍 ערוץ', value: `<#${message.channelId}>`, inline: true }).setColor(0xED4245).setTimestamp());
  }
}

// ═══════════════════════════════════════════════════════
//  LEVEL SYSTEM
// ═══════════════════════════════════════════════════════
const XP_PER_MESSAGE = { min: 5, max: 15 };
const XP_COOLDOWN = 60 * 1000; // דקה בין XP
const xpCooldowns = {};

function getLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)); }
function getXpForLevel(level) { return Math.pow(level / 0.1, 2); }

async function handleLevelXP(message, client) {
  if (!message.guild || message.author.bot) return;
  const userId = message.author.id;
  const now = Date.now();
  if (xpCooldowns[userId] && now - xpCooldowns[userId] < XP_COOLDOWN) return;
  xpCooldowns[userId] = now;
  if (!DB.levelSystem[userId]) DB.levelSystem[userId] = { xp: 0, level: 0, messages: 0 };
  const userData = DB.levelSystem[userId];
  const xpGain = Math.floor(Math.random() * (XP_PER_MESSAGE.max - XP_PER_MESSAGE.min + 1)) + XP_PER_MESSAGE.min;
  userData.xp += xpGain;
  userData.messages++;
  const newLevel = getLevel(userData.xp);
  if (newLevel > userData.level) {
    userData.level = newLevel;
    try {
      const embed = new EmbedBuilder()
        .setTitle('🎉 עלית רמה!')
        .setDescription(`<@${userId}> עלית לרמה **${newLevel}**! 🚀`)
        .setColor(0xFFD700)
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp();
      const msg = await message.channel.send({ embeds: [embed] });
      setTimeout(() => msg.delete().catch(() => {}), 15000);
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════
//  AFK SYSTEM
// ═══════════════════════════════════════════════════════
async function handleAfkCheck(message, client) {
  if (!message.guild || message.author.bot) return;
  // האם המשתמש השולח היה AFK?
  if (DB.afk[message.author.id]) {
    const { reason, since } = DB.afk[message.author.id];
    const timeDiff = Math.floor((Date.now() - since) / 1000 / 60);
    delete DB.afk[message.author.id];
    try {
      const nick = message.member.nickname;
      if (nick && nick.startsWith('[AFK] ')) await message.member.setNickname(nick.replace('[AFK] ', '')).catch(() => {});
    } catch {}
    const w = await message.channel.send({ embeds: [new EmbedBuilder().setDescription(`👋 ברוך הבא בחזרה <@${message.author.id}>! היית AFK **${timeDiff} דקות**.`).setColor(0x57F287)] }).catch(() => null);
    if (w) setTimeout(() => w.delete().catch(() => {}), 8000);
  }
  // האם מישהו מנשן מישהו שב-AFK?
  const mentions = message.mentions.users;
  for (const [id, user] of mentions) {
    if (DB.afk[id]) {
      const { reason, since } = DB.afk[id];
      const timeDiff = Math.floor((Date.now() - since) / 1000 / 60);
      const w = await message.channel.send({ embeds: [new EmbedBuilder().setDescription(`💤 <@${id}> כרגע AFK (${timeDiff} דקות)\n📝 סיבה: ${reason}`).setColor(0xFEE75C)] }).catch(() => null);
      if (w) setTimeout(() => w.delete().catch(() => {}), 8000);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function isTeam(member) {
  return member.roles.cache.has(CONFIG.TEAM_ROLE_ID) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}
function timestamp() { return `<t:${Math.floor(Date.now() / 1000)}:F>`; }
function randomId(len = 6) { return Math.random().toString(36).substring(2, 2 + len).toUpperCase(); }
async function sendLog(client, embed) {
  try { const ch = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID); if (ch) ch.send({ embeds: [embed] }); } catch {}
}
function getCategoryByChannelParent(parentId) {
  return Object.entries(CONFIG.CATEGORIES).find(([, v]) => v.id === parentId)?.[0] || null;
}

// ═══════════════════════════════════════════════════════
//  SLASH COMMANDS
// ═══════════════════════════════════════════════════════
const COMMANDS = [
  // ── טיקטים ──
  new SlashCommandBuilder().setName('setup-tickets').setDescription('📩 שלח את פאנל הטיקטים [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  // ── אימות ──
  new SlashCommandBuilder().setName('setup-verify').setDescription('✅ שלח את פאנל האימות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  // ── שידור ──
  new SlashCommandBuilder().setName('broadcast').setDescription('📢 שלח הודעה מהבוט [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('ההודעה').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת (אופציונלי)'))
    .addStringOption(o => o.setName('color').setDescription('צבע hex')),
  // ── DM לכולם ──
  new SlashCommandBuilder().setName('dmall').setDescription('📨 שלח DM לכל השרת [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('message').setDescription('תוכן').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת (אופציונלי)')),
  // ── הגרלה ──
  new SlashCommandBuilder().setName('giveaway').setDescription('🎉 צור הגרלה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prize').setDescription('הפרס').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('זוכים').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('דקות').setRequired(true)),
  new SlashCommandBuilder().setName('endgiveaway').setDescription('🏆 סיים הגרלה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('messageid').setDescription('ID הודעה').setRequired(true)),
  // ── אנטי-לינק ──
  new SlashCommandBuilder().setName('antilink').setDescription('🔗 ניהול אנטי-לינק [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('toggle').setDescription('הפעל/כבה').addBooleanOption(o => o.setName('enabled').setDescription('מצב').setRequired(true)))
    .addSubcommand(s => s.setName('allow-channel').setDescription('ערוץ מותר').addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)))
    .addSubcommand(s => s.setName('remove-channel').setDescription('הסר ערוץ').addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('סטטוס'))
    .addSubcommand(s => s.setName('clearwarnings').setDescription('אפס אזהרות').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))),
  // ── פוסטינג ──
  new SlashCommandBuilder().setName('posting').setDescription('📣 שלח הודעת פרסום עצמי [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('title').setDescription('כותרת').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('תיאור').setRequired(true))
    .addStringOption(o => o.setName('color').setDescription('צבע hex (ברירת מחדל: כחול)')),
  new SlashCommandBuilder().setName('set-posting-channel').setDescription('📣 הגדר את ערוץ הפרסום העצמי הקבוע [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true)),
  // ── סרבר ליסט — פאנל ──
  new SlashCommandBuilder().setName('setup-serverlist').setDescription('🌐 שלח את פאנל הוספת שרת לרשימה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  // ── סרבר ליסט — ניהול ──
  new SlashCommandBuilder().setName('serverlist').setDescription('🛠️ ניהול סרבר ליסט [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('addvote').setDescription('הוסף הצבעה').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('removevote').setDescription('הורד הצבעה').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('מחק חדר שרת').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('blacklist').setDescription('חסום משתמש').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)))
    .addSubcommand(s => s.setName('unblacklist').setDescription('הסר חסימה').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)))
    .addSubcommand(s => s.setName('setvotes').setDescription('קבע הצבעות ידנית').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)).addIntegerOption(o => o.setName('votes').setDescription('מספר הצבעות').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('מידע על שרת').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('top').setDescription('השרתים המובילים לפי קטגוריה'))
    .addSubcommand(s => s.setName('reset-votes').setDescription('אפס את כל ההצבעות של שרת').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('bump').setDescription('עלה שרת למעלה').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true))),
  // ── עריכת שרת עצמי ──
  new SlashCommandBuilder().setName('myserver').setDescription('✏️ ערוך את פרטי השרת שלך ברשימה'),
  // ── בוסט ──
  new SlashCommandBuilder().setName('set-boost-channel').setDescription('💎 הגדר ערוץ הודעות בוסט [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)),
  new SlashCommandBuilder().setName('set-votes-log').setDescription('📊 הגדר ערוץ לוג הצבעות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)),
  new SlashCommandBuilder().setName('set-server-owner-role').setDescription('👑 הגדר רול לבעלי שרתים [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption(o => o.setName('role').setDescription('הרול').setRequired(true)),

  // ══════════════════════════════════
  //  מערכות חדשות — פקודות
  // ══════════════════════════════════

  // ── מודרציה מתקדמת ──
  new SlashCommandBuilder().setName('warn').setDescription('⚠️ אזהרה למשתמש [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('סיבה').setRequired(true)),
  new SlashCommandBuilder().setName('warnings').setDescription('📋 הצג אזהרות של משתמש [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('clearwarns').setDescription('🗑️ נקה אזהרות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))
    .addIntegerOption(o => o.setName('index').setDescription('מספר אזהרה ספציפית (ריק = כולן)')),
  new SlashCommandBuilder().setName('note').setDescription('📓 הוסף הערת מוד למשתמש [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))
    .addStringOption(o => o.setName('text').setDescription('הערה').setRequired(true)),
  new SlashCommandBuilder().setName('notes').setDescription('📓 הצג הערות על משתמש [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('userinfo').setDescription('👤 מידע על משתמש')
    .addUserOption(o => o.setName('user').setDescription('משתמש (ריק = אתה)')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('🏠 מידע על השרת'),
  new SlashCommandBuilder().setName('kick').setDescription('👢 קיק [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('סיבה')),
  new SlashCommandBuilder().setName('ban').setDescription('🔨 באן [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('סיבה'))
    .addIntegerOption(o => o.setName('days').setDescription('ימים למחוק הודעות (0-7)').setMinValue(0).setMaxValue(7)),
  new SlashCommandBuilder().setName('unban').setDescription('🔓 הסר באן [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('userid').setDescription('ID משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('⏳ timeout [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('דקות').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('סיבה')),
  new SlashCommandBuilder().setName('untimeout').setDescription('✅ הסר timeout [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('🗑️ מחק הודעות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('amount').setDescription('כמות (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('מחק רק של משתמש מסוים')),
  new SlashCommandBuilder().setName('slowmode').setDescription('🐢 הגדר סלומוד [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('שניות (0 = כיבוי)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lock').setDescription('🔒 נעל ערוץ [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('🔓 פתח ערוץ [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('automod').setDescription('🤖 ניהול אוטומוד [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('toggle').setDescription('הפעל/כבה').addBooleanOption(o => o.setName('enabled').setDescription('מצב').setRequired(true)))
    .addSubcommand(s => s.setName('addword').setDescription('הוסף מילה אסורה').addStringOption(o => o.setName('word').setDescription('מילה').setRequired(true)))
    .addSubcommand(s => s.setName('removeword').setDescription('הסר מילה אסורה').addStringOption(o => o.setName('word').setDescription('מילה').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('סטטוס אוטומוד')),

  // ── פולים והצבעות ──
  new SlashCommandBuilder().setName('poll').setDescription('📊 צור סקר').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('question').setDescription('שאלה').setRequired(true))
    .addStringOption(o => o.setName('option1').setDescription('אפשרות 1').setRequired(true))
    .addStringOption(o => o.setName('option2').setDescription('אפשרות 2').setRequired(true))
    .addStringOption(o => o.setName('option3').setDescription('אפשרות 3'))
    .addStringOption(o => o.setName('option4').setDescription('אפשרות 4'))
    .addIntegerOption(o => o.setName('minutes').setDescription('דקות (0 = ללא הגבלה)')),

  // ── הצעות ──
  new SlashCommandBuilder().setName('setup-suggestions').setDescription('💡 הגדר ערוץ הצעות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)),
  new SlashCommandBuilder().setName('suggest').setDescription('💡 שלח הצעה לשרת')
    .addStringOption(o => o.setName('suggestion').setDescription('ההצעה שלך').setRequired(true)),
  new SlashCommandBuilder().setName('suggestion-action').setDescription('✅ אשר/דחה הצעה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('messageid').setDescription('ID הודעת ההצעה').setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('approve/deny').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('סיבה')),

  // ── AFK ──
  new SlashCommandBuilder().setName('afk').setDescription('💤 סמן עצמך AFK')
    .addStringOption(o => o.setName('reason').setDescription('סיבה').setRequired(false)),

  // ── לבלס ──
  new SlashCommandBuilder().setName('rank').setDescription('🏆 הצג דירוג').addUserOption(o => o.setName('user').setDescription('משתמש (ריק = אתה)')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 לוח מובילים'),

  // ── ערוצי קול ──
  new SlashCommandBuilder().setName('joinvc').setDescription('🔊 צור ערוץ קול זמני [הצטרף ל-Join to Create]'),

  // ── כלים ──
  new SlashCommandBuilder().setName('avatar').setDescription('🖼️ הצג תמונת פרופיל').addUserOption(o => o.setName('user').setDescription('משתמש')),
  new SlashCommandBuilder().setName('banner').setDescription('🖼️ הצג באנר').addUserOption(o => o.setName('user').setDescription('משתמש')),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 פינג של הבוט'),
  new SlashCommandBuilder().setName('math').setDescription('🔢 חשב ביטוי מתמטי').addStringOption(o => o.setName('expression').setDescription('ביטוי').setRequired(true)),
  new SlashCommandBuilder().setName('coinflip').setDescription('🪙 הטל מטבע'),
  new SlashCommandBuilder().setName('dice').setDescription('🎲 הטל קוביה').addIntegerOption(o => o.setName('sides').setDescription('צלעות (ברירת מחדל 6)')),
  new SlashCommandBuilder().setName('8ball').setDescription('🎱 שאל את הכדור').addStringOption(o => o.setName('question').setDescription('שאלה').setRequired(true)),
  new SlashCommandBuilder().setName('embed').setDescription('📝 שלח embed מותאם אישית [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
];

// ═══════════════════════════════════════════════════════
//  SYSTEM 1 — TICKETS
// ═══════════════════════════════════════════════════════
async function setupTickets(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 פתח טיקט תמיכה')
    .setDescription('לחץ על הכפתור למטה כדי לפתוח טיקט.\nהצוות שלנו יחזור אליך בהקדם האפשרי.')
    .setColor(0x5865F2).setThumbnail(interaction.guild.iconURL()).setFooter({ text: 'VOrino Support System' }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_open').setLabel('📩 פתח טיקט').setStyle(ButtonStyle.Primary)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ פאנל הטיקטים נשלח!', ephemeral: true });
}
async function handleTicketOpen(interaction, client) {
  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('ticket_category').setPlaceholder('📂 בחר קטגוריה').addOptions([
      { label: '💬 שאלה כללית', value: 'general', emoji: '💬' },
      { label: '🛒 קניה', value: 'purchase', emoji: '🛒' },
      { label: '🎁 קבלת פרס', value: 'prize', emoji: '🎁' },
      { label: '🚨 דיווח על משתמש', value: 'report', emoji: '🚨' },
      { label: '🤝 שותפות', value: 'partnership', emoji: '🤝' },
    ])
  );
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📂 בחר קטגוריה').setDescription('בחר את הקטגוריה המתאימה.').setColor(0x5865F2)], components: [menu], ephemeral: true });
}
async function handleTicketCategory(interaction, client) {
  const category = interaction.values[0];
  const categoryNames = { general: '💬 שאלה כללית', purchase: '🛒 קניה', prize: '🎁 קבלת פרס', report: '🚨 דיווח', partnership: '🤝 שותפות' };
  const guild = interaction.guild;
  const user = interaction.user;
  await interaction.deferUpdate();
  DB.ticketStats.total++;
  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName, type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID || null,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.TEAM_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (e) {
    return interaction.followUp({ content: '❌ שגיאה ביצירת הטיקט.', ephemeral: true });
  }
  DB.tickets[ticketChannel.id] = { userId: user.id, category, name: channelName, createdAt: new Date().toISOString(), openedAt: Date.now() };
  const teamRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 סגור').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('📄 טרנסקריפט').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_rename').setLabel('✏️ שנה שם').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('✋ תפוס').setStyle(ButtonStyle.Success),
  );
  await ticketChannel.send({
    content: `<@${user.id}> | <@&${CONFIG.TEAM_ROLE_ID}>`,
    embeds: [new EmbedBuilder().setTitle(`🎫 טיקט — ${categoryNames[category]}`).setDescription(`פתוח על ידי <@${user.id}>\n📅 ${timestamp()}\n\nשלום <@${user.id}>! הצוות יגיע אליך בקרוב.`).setColor(0x57F287).setThumbnail(user.displayAvatarURL()).setFooter({ text: `ID: ${ticketChannel.id}` })],
    components: [teamRow]
  });
  await interaction.followUp({ embeds: [new EmbedBuilder().setDescription(`✅ הטיקט שלך נפתח! <#${ticketChannel.id}>`).setColor(0x57F287)], ephemeral: true });
  await sendLog(client, new EmbedBuilder().setTitle('🎫 טיקט נפתח').addFields({ name: 'משתמש', value: `<@${user.id}>`, inline: true }, { name: 'קטגוריה', value: categoryNames[category], inline: true }, { name: 'ערוץ', value: `<#${ticketChannel.id}>`, inline: true }).setColor(0x5865F2).setTimestamp());
}
async function handleTicketAction(interaction, client) {
  const action = interaction.customId;
  const channel = interaction.channel;
  const ticket = DB.tickets[channel.id];
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  if (action === 'ticket_close') {
    DB.ticketStats.closed++;
    if (ticket) {
      const responseTime = Math.floor((Date.now() - ticket.openedAt) / 1000 / 60);
      DB.ticketStats.avgResponse = Math.round((DB.ticketStats.avgResponse + responseTime) / 2);
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription('🔒 הטיקט נסגר תוך 5 שניות...').setColor(0xED4245)] });
    await sendLog(client, new EmbedBuilder().setTitle('🔒 טיקט נסגר').addFields({ name: 'ערוץ', value: channel.name, inline: true }, { name: 'סגור על ידי', value: `<@${interaction.user.id}>`, inline: true }, { name: 'פתוח על ידי', value: ticket ? `<@${ticket.userId}>` : 'לא ידוע', inline: true }).setColor(0xED4245).setTimestamp());
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  } else if (action === 'ticket_transcript') {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();
    let text = `=== Transcript: ${channel.name} ===\nDate: ${new Date().toISOString()}\n\n`;
    sorted.forEach(m => { text += `[${new Date(m.createdTimestamp).toLocaleString('he-IL')}] ${m.author.tag}: ${m.content || '[embed/attachment]'}\n`; });
    const att = new AttachmentBuilder(Buffer.from(text, 'utf-8'), { name: `transcript-${channel.name}.txt` });
    if (ticket) { try { const u = await client.users.fetch(ticket.userId); await u.send({ content: '📄 הטרנסקריפט של הטיקט שלך:', files: [att] }); } catch {} }
    await interaction.reply({ content: '✅ הטרנסקריפט נשלח.', files: [att], ephemeral: true });
  } else if (action === 'ticket_rename') {
    const modal = new ModalBuilder().setCustomId('ticket_rename_modal').setTitle('✏️ שנה שם טיקט');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_name').setLabel('שם חדש').setStyle(TextInputStyle.Short).setRequired(true)));
    await interaction.showModal(modal);
  } else if (action === 'ticket_claim') {
    await channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✋ הטיקט נתפס על ידי <@${interaction.user.id}>`).setColor(0xFEE75C)] });
  }
}
async function handleTicketRenameModal(interaction) {
  const newName = interaction.fields.getTextInputValue('new_name').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  await interaction.channel.setName(newName);
  await interaction.reply({ content: `✅ השם שונה ל: \`${newName}\``, ephemeral: true });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 2 — VERIFICATION
// ═══════════════════════════════════════════════════════
async function setupVerify(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🔐 אימות חברים')
    .setDescription('ברוך הבא לשרת!\n\nכדי לקבל גישה מלאה, יש לעבור אימות קצר.\nלחץ על **"אמת אותי"** ועקוב אחר ההוראות.')
    .setColor(0x57F287).setThumbnail(interaction.guild.iconURL())
    .addFields({ name: '📋 שאלת אימות', value: 'תענה על שאלה קצרה להוכחת אנושיות.' })
    .setFooter({ text: 'VOrino Verification System' }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_start').setLabel('✅ אמת אותי').setStyle(ButtonStyle.Success));
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ פאנל האימות נשלח!', ephemeral: true });
}
async function handleVerifyStart(interaction, client) {
  if (interaction.member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) return interaction.reply({ content: '✅ אתה כבר מאומת!', ephemeral: true });
  const questions = [
    { q: 'מה צבע הרקיע ביום?', a: 'כחול', options: ['כחול', 'אדום', 'ירוק', 'צהוב'] },
    { q: 'כמה יש ב 2 + 2?', a: '4', options: ['3', '4', '5', '6'] },
    { q: 'מה הוא הפרי הצהוב?', a: 'בננה', options: ['תפוח', 'ענב', 'בננה', 'תות'] },
    { q: 'כמה ימים בשבוע?', a: '7', options: ['5', '6', '7', '8'] },
    { q: 'מה עושים עם מחשב?', a: 'עובדים', options: ['שוחים', 'אוכלים', 'עובדים', 'ישנים'] },
  ];
  const picked = questions[Math.floor(Math.random() * questions.length)];
  const menu = new StringSelectMenuBuilder().setCustomId(`verify_answer_${picked.a}`).setPlaceholder('בחר תשובה...').addOptions(picked.options.map(opt => ({ label: opt, value: opt })));
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔐 שאלת אימות').setDescription(`**${picked.q}**\n\nבחר את התשובה הנכונה:`).setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
}
async function handleVerifyAnswer(interaction, client) {
  const correctAnswer = interaction.customId.replace('verify_answer_', '');
  const chosen = interaction.values[0];
  if (chosen !== correctAnswer) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ תשובה שגויה! נסה שוב.').setColor(0xED4245)], ephemeral: true });
  try { await interaction.member.roles.add(CONFIG.VERIFIED_ROLE_ID); } catch {}
  // Auto roles
  for (const roleId of DB.welcomeConfig.roles) {
    try { await interaction.member.roles.add(roleId); } catch {}
  }
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ אומת בהצלחה!').setDescription(`ברוך הבא, <@${interaction.user.id}>!\nיש לך כעת גישה מלאה 🎉`).setColor(0x57F287).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()], ephemeral: true });
  await sendLog(client, new EmbedBuilder().setTitle('✅ משתמש אומת').setDescription(`<@${interaction.user.id}> עבר אימות.`).setColor(0x57F287).setTimestamp());
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 3 — WELCOME (ENHANCED)
// ═══════════════════════════════════════════════════════
async function handleWelcome(member, client) {
  try {
    const ch = await client.channels.fetch(CONFIG.WELCOME_CHANNEL_ID);
    if (!ch) return;
    const guild = member.guild;
    const embed = new EmbedBuilder()
      .setTitle(`👋 ברוך הבא, ${member.user.username}!`)
      .setDescription(`שמחים לראותך בשרת **${guild.name}**!\n\nאתה החבר מספר **${guild.memberCount}** שלנו 🎉\n\nאל תשכח לעבור אימות ולקרוא את חוקי השרת.`)
      .setColor(DB.welcomeConfig.embedColor)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📅 הצטרף ב', value: timestamp(), inline: true },
        { name: '👥 חברי שרת', value: `${guild.memberCount}`, inline: true },
        { name: '🏷️ תגית', value: member.user.tag, inline: true }
      )
      .setFooter({ text: `VOrino • ${guild.name}`, iconURL: guild.iconURL() })
      .setTimestamp();
    await ch.send({ content: `<@${member.id}>`, embeds: [embed] });

    // Welcome DM
    if (DB.welcomeConfig.dm) {
      try {
        await member.send({ embeds: [new EmbedBuilder()
          .setTitle(`ברוך הבא ל-${guild.name}! 🎉`)
          .setDescription(`היי ${member.user.username}!\n\nשמחים שהצטרפת אלינו. עבור אימות כדי לקבל גישה מלאה.\n\nאם צריך עזרה — פתח טיקט בשרת!`)
          .setColor(0x5865F2).setThumbnail(guild.iconURL()).setTimestamp()
        ] });
      } catch {}
    }
  } catch (e) { console.error('Welcome error:', e); }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 5 — BROADCAST
// ═══════════════════════════════════════════════════════
async function broadcast(interaction) {
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');
  const title = interaction.options.getString('title');
  const colorStr = interaction.options.getString('color') || '#5865F2';
  const color = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2;
  const embed = new EmbedBuilder().setDescription(message).setColor(color).setFooter({ text: 'VOrino', iconURL: interaction.guild.iconURL() }).setTimestamp();
  if (title) embed.setTitle(title);
  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: `✅ ההודעה נשלחה ל<#${channel.id}>`, ephemeral: true });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 5.5 — DM-ALL
// ═══════════════════════════════════════════════════════
async function dmAll(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const message = interaction.options.getString('message');
  const title = interaction.options.getString('title');
  await interaction.reply({ content: '📨 שולח הודעות...', ephemeral: true });
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const members = await guild.members.fetch();
    let success = 0, failed = 0;
    const embed = new EmbedBuilder().setDescription(message).setColor(0x5865F2).setFooter({ text: `הודעה מצוות ${guild.name}`, iconURL: guild.iconURL() }).setTimestamp();
    if (title) embed.setTitle(title);
    for (const [, member] of members) {
      if (member.user.bot) continue;
      try { await member.send({ embeds: [embed] }); success++; await new Promise(r => setTimeout(r, 500)); } catch { failed++; }
    }
    await interaction.followUp({ content: `✅ נשלח ל-**${success}** | נכשל **${failed}**`, ephemeral: true });
  } catch (e) { await interaction.followUp({ content: '❌ שגיאה.', ephemeral: true }); }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 6 — POSTING
// ═══════════════════════════════════════════════════════
async function handlePosting(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  if (!CONFIG.PROMO_CHANNEL_ID) return interaction.reply({ content: '❌ לא הוגדר ערוץ פרסום. הגדר עם /set-posting-channel', ephemeral: true });
  const title    = interaction.options.getString('title');
  const desc     = interaction.options.getString('description');
  const colorStr = interaction.options.getString('color') || '#5865F2';
  const color    = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2;
  let channel;
  try { channel = await client.channels.fetch(CONFIG.PROMO_CHANNEL_ID); } catch { channel = null; }
  if (!channel) return interaction.reply({ content: '❌ ערוץ הפרסום לא נמצא.', ephemeral: true });
  const embed = new EmbedBuilder()
    .setTitle(`📣 ${title}`).setDescription(desc).setColor(color)
    .addFields(
      { name: '📌 איך לפרסם?', value: 'שלח את פרסום השרת שלך בערוץ זה לפי הפורמט:', inline: false },
      { name: '📋 פורמט נדרש', value: '```\n🏷️ שם השרת:\n📝 תיאור:\n🔗 קישור:\n👥 כמות חברים:\n```', inline: false },
      { name: '⚠️ חוקים', value: '• אין ספאם\n• פרסום כל 24 שעות בלבד\n• חובה לעקוב אחרי הפורמט', inline: false }
    )
    .setFooter({ text: 'VOrino • Self Promotion', iconURL: interaction.guild.iconURL() }).setTimestamp();
  try { await channel.send({ embeds: [embed] }); } catch (e) { return interaction.reply({ content: '❌ שליחה נכשלה.', ephemeral: true }); }
  await interaction.reply({ content: `✅ נשלח ל<#${channel.id}>`, ephemeral: true });
}
async function handleSetPostingChannel(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const channel = interaction.options.getChannel('channel');
  CONFIG.PROMO_CHANNEL_ID = channel.id;
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ ערוץ הפרסום הוגדר ל<#${channel.id}>`).setColor(0x57F287)], ephemeral: true });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 7 — LOGS
// ═══════════════════════════════════════════════════════
async function logMemberAdd(member, client) {
  await sendLog(client, new EmbedBuilder().setTitle('📥 חבר הצטרף').setDescription(`<@${member.id}> הצטרף לשרת.`).addFields({ name: '👤 שם', value: member.user.tag, inline: true }, { name: '🆔 ID', value: member.id, inline: true }, { name: '📅 נוצר ב', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }).setThumbnail(member.user.displayAvatarURL()).setColor(0x57F287).setTimestamp());
}
async function logMemberRemove(member, client) {
  await sendLog(client, new EmbedBuilder().setTitle('📤 חבר עזב').setDescription(`**${member.user?.tag || member.id}** עזב.`).addFields({ name: '🆔 ID', value: member.id, inline: true }).setColor(0xED4245).setTimestamp());
}
async function logBanAdd(ban, client) {
  await sendLog(client, new EmbedBuilder().setTitle('🔨 באן').setDescription(`<@${ban.user.id}> קיבל באן.`).addFields({ name: '👤 משתמש', value: ban.user.tag, inline: true }, { name: '📝 סיבה', value: ban.reason || 'לא צוינה', inline: true }).setThumbnail(ban.user.displayAvatarURL()).setColor(0xED4245).setTimestamp());
}
async function logBanRemove(ban, client) {
  await sendLog(client, new EmbedBuilder().setTitle('🔓 באן הוסר').setDescription(`<@${ban.user.id}> הוסר מהבאן.`).setColor(0x57F287).setTimestamp());
}
async function logMessageDelete(msg, client) {
  if (!msg.author || msg.author.bot) return;
  await sendLog(client, new EmbedBuilder().setTitle('🗑️ הודעה נמחקה').addFields({ name: '👤 שולח', value: `<@${msg.author.id}>`, inline: true }, { name: '📍 ערוץ', value: `<#${msg.channelId}>`, inline: true }, { name: '📝 תוכן', value: msg.content || '[ריק / embed]' }).setColor(0xFEE75C).setTimestamp());
}
async function logMessageEdit(oldMsg, newMsg, client) {
  if (!oldMsg.author || oldMsg.author.bot) return;
  if (oldMsg.content === newMsg.content) return;
  await sendLog(client, new EmbedBuilder().setTitle('✏️ הודעה נערכה').addFields(
    { name: '👤 שולח', value: `<@${oldMsg.author.id}>`, inline: true },
    { name: '📍 ערוץ', value: `<#${oldMsg.channelId}>`, inline: true },
    { name: '📝 לפני', value: oldMsg.content?.slice(0, 300) || '[ריק]' },
    { name: '📝 אחרי', value: newMsg.content?.slice(0, 300) || '[ריק]' },
  ).setColor(0x3498DB).setTimestamp());
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 8 — BOOST NOTIFICATIONS
// ═══════════════════════════════════════════════════════
async function handleBoost(oldMember, newMember, client) {
  const wasBooster = oldMember.premiumSince;
  const isBooster = newMember.premiumSince;
  if (!wasBooster && isBooster) {
    if (!CONFIG.BOOST_CHANNEL_ID) return;
    try {
      const ch = await client.channels.fetch(CONFIG.BOOST_CHANNEL_ID);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle('💎 בוסט חדש לשרת!')
        .setDescription(`<@${newMember.id}> עשה בוסט לשרת!\n\n✨ תודה רבה על התמיכה! ✨`)
        .setColor(0xFF73FA).setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👤 בוסטר', value: `<@${newMember.id}>`, inline: true },
          { name: '💎 בוסטים לשרת', value: `${newMember.guild.premiumSubscriptionCount || 0}`, inline: true },
          { name: '🏆 רמת בוסט', value: `Level ${newMember.guild.premiumTier}`, inline: true },
        )
        .setFooter({ text: 'VOrino • Boost System', iconURL: newMember.guild.iconURL() }).setTimestamp();
      await ch.send({ content: `<@${newMember.id}> 💎`, embeds: [embed] });
    } catch (e) { console.error('Boost notification error:', e); }
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 10 — ACTIVITY
// ═══════════════════════════════════════════════════════
function startActivityRotation(client) {
  let phase = 0;
  const update = async () => {
    try {
      const guild = client.guilds.cache.get(CONFIG.GUILD_ID) || await client.guilds.fetch(CONFIG.GUILD_ID);
      if (!guild) return;
      const total = guild.memberCount;
      const statuses = [
        { name: 'Custom Status', state: `👥 ${total} חברים בשרת`, type: ActivityType.Custom },
        { name: 'Custom Status', state: '🛡️ VOrino Server List', type: ActivityType.Custom },
        { name: 'Custom Status', state: `🎫 ${DB.ticketStats.total} טיקטים טופלו`, type: ActivityType.Custom },
        { name: 'Custom Status', state: `🌐 ${Object.keys(DB.serverList).length} שרתים ברשימה`, type: ActivityType.Custom },
      ];
      const s = statuses[phase % statuses.length];
      client.user.setActivity({ name: s.name, state: s.state, type: s.type });
      phase++;
    } catch (err) { console.error('Status error:', err); }
  };
  update();
  setInterval(update, 30 * 1000);
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 11 — GIVEAWAYS
// ═══════════════════════════════════════════════════════
async function createGiveaway(interaction) {
  const prize = interaction.options.getString('prize');
  const winners = interaction.options.getInteger('winners');
  const minutes = interaction.options.getInteger('minutes');
  const endTime = Date.now() + minutes * 60 * 1000;
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 השתתף').setStyle(ButtonStyle.Primary));
  const msg = await interaction.channel.send({
    embeds: [new EmbedBuilder().setTitle('🎉 הגרלה!').setDescription(`**${prize}**\n\n🏆 זוכים: **${winners}**\n⏰ מסתיים: <t:${Math.floor(endTime / 1000)}:R>\n\nלחץ להשתתפות!`).setColor(0x5865F2).setFooter({ text: `מסתיים: ${new Date(endTime).toLocaleString('he-IL')}` }).setTimestamp()],
    components: [row]
  });
  DB.giveaways[msg.id] = { prize, winners, entries: [], endTime, channelId: interaction.channelId, messageId: msg.id };
  await interaction.reply({ content: '✅ הגרלה נוצרה!', ephemeral: true });
  setTimeout(() => endGiveawayAuto(msg.id, interaction.channel, interaction.client), minutes * 60 * 1000);
}
async function handleGiveawayEnter(interaction) {
  const giveaway = DB.giveaways[interaction.message.id];
  if (!giveaway) return interaction.reply({ content: '❌ הגרלה לא נמצאה.', ephemeral: true });
  if (Date.now() > giveaway.endTime) return interaction.reply({ content: '❌ ההגרלה הסתיימה.', ephemeral: true });
  if (giveaway.entries.includes(interaction.user.id)) return interaction.reply({ content: '✅ כבר נרשמת!', ephemeral: true });
  giveaway.entries.push(interaction.user.id);
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ נרשמת! כרגע **${giveaway.entries.length}** משתתפים.`).setColor(0x57F287)], ephemeral: true });
  await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 השתתף (${giveaway.entries.length})`).setStyle(ButtonStyle.Primary))] }).catch(() => {});
}
async function endGiveawayAuto(msgId, channel, client) {
  const giveaway = DB.giveaways[msgId];
  if (!giveaway || giveaway.ended) return;
  giveaway.ended = true;
  const entries = [...giveaway.entries];
  if (entries.length === 0) return channel.send({ embeds: [new EmbedBuilder().setTitle('🎉 הגרלה הסתיימה').setDescription(`אף אחד לא נרשם על **${giveaway.prize}**.`).setColor(0xED4245).setTimestamp()] });
  const winnerIds = [];
  const pool = [...entries];
  const count = Math.min(giveaway.winners, pool.length);
  for (let i = 0; i < count; i++) { const idx = Math.floor(Math.random() * pool.length); winnerIds.push(pool.splice(idx, 1)[0]); }
  const winnerMentions = winnerIds.map(id => `<@${id}>`).join(', ');
  await channel.send({ content: winnerMentions, embeds: [new EmbedBuilder().setTitle('🏆 זוכי ההגרלה!').setDescription(`**פרס:** ${giveaway.prize}\n\n🎊 **זוכים:** ${winnerMentions}`).setColor(0xFEE75C).setTimestamp()] });
  try { const m = await channel.messages.fetch(msgId); await m.edit({ components: [] }); } catch {}
}
async function endGiveawayCommand(interaction) {
  const msgId = interaction.options.getString('messageid');
  if (!DB.giveaways[msgId]) return interaction.reply({ content: '❌ הגרלה לא נמצאה.', ephemeral: true });
  await interaction.reply({ content: '⏳ מסיים...', ephemeral: true });
  await endGiveawayAuto(msgId, interaction.channel, interaction.client);
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 12 — SERVER PROTECTION
// ═══════════════════════════════════════════════════════
async function handleGuildMemberAdd(member, client) {
  if (!member.user.bot) return;
  const guild = member.guild;
  const owner = await guild.fetchOwner();
  try {
    await new Promise(r => setTimeout(r, 1500));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
    const entry = auditLogs.entries.find(e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 10000);
    if (entry) {
      const executor = entry.executor;
      if (executor && executor.id !== owner.id) {
        try { await member.kick('🛡️ הגנה: בוט לא מורשה'); } catch {}
        try { await guild.bans.create(executor.id, { reason: '🛡️ הגנה: הוספת בוט לא מורשה' }); } catch {}
        await sendLog(client, new EmbedBuilder().setTitle('🛡️ הגנה: הוספת בוט').addFields({ name: '🤖 בוט', value: `${member.user.tag} (${member.id})`, inline: true }, { name: '👤 ביצע', value: `<@${executor.id}>`, inline: true }, { name: '⚡ פעולה', value: 'בוט הוסר + משתמש בוין' }).setColor(0xED4245).setTimestamp());
        return;
      }
    }
  } catch (e) { console.error('Bot add protection error:', e); }
  await sendLog(client, new EmbedBuilder().setTitle('🤖 בוט נוסף').setDescription(`${member.user.tag} נוסף.`).setColor(0xFEE75C).setTimestamp());
}
async function handleChannelDelete(channel, client) {
  const guild = channel.guild;
  if (!guild) return;
  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 5 });
    const entry = auditLogs.entries.find(e => e.target?.id === channel.id && Date.now() - e.createdTimestamp < 8000);
    if (!entry) return;
    const executor = entry.executor;
    const owner = await guild.fetchOwner();
    if (executor.id === owner.id || executor.id === client.user.id) return;
    const count = recordAction(PROTECT.channelDeletes, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנה: מחיקת ערוצים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder().setTitle('🛡️ הגנה: מחיקת ערוצים ברצף').addFields({ name: '👤 ביצע', value: `<@${executor.id}>`, inline: true }, { name: '📊 כמות', value: `${count} ב-8 שניות`, inline: true }).setColor(0xED4245).setTimestamp());
    }
  } catch (e) { console.error('Channel delete protection error:', e); }
}
async function handleRoleDelete(role, client) {
  const guild = role.guild;
  if (!guild) return;
  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 5 });
    const entry = auditLogs.entries.find(e => e.target?.id === role.id && Date.now() - e.createdTimestamp < 8000);
    if (!entry) return;
    const executor = entry.executor;
    const owner = await guild.fetchOwner();
    if (executor.id === owner.id || executor.id === client.user.id) return;
    const count = recordAction(PROTECT.roleDeletes, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנה: מחיקת רולים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder().setTitle('🛡️ הגנה: מחיקת רולים ברצף').addFields({ name: '👤 ביצע', value: `<@${executor.id}>`, inline: true }, { name: '📊 כמות', value: `${count} ב-8 שניות`, inline: true }).setColor(0xED4245).setTimestamp());
    }
  } catch (e) { console.error('Role delete protection error:', e); }
}
async function handleProtectedMemberUpdate(oldMember, newMember, client) {
  await handleBoost(oldMember, newMember, client);
  const guild = newMember.guild;
  const owner = await guild.fetchOwner().catch(() => null);
  const wasTimedOut = !oldMember.communicationDisabledUntil;
  const isTimedOut = !!newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date();
  if (wasTimedOut && isTimedOut) {
    await sendLog(client, new EmbedBuilder().setTitle('⏳ Timeout').setDescription(`<@${newMember.id}> קיבל timeout.`).setColor(0xFEE75C).setTimestamp());
    try {
      await new Promise(r => setTimeout(r, 1000));
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 });
      const entry = auditLogs.entries.find(e => e.target?.id === newMember.id && Date.now() - e.createdTimestamp < 8000);
      if (!entry) return;
      const executor = entry.executor;
      if (!owner || executor.id === owner.id || executor.id === client.user.id) return;
      const count = recordAction(PROTECT.timeouts, executor.id);
      if (count > PROTECT.MAX_ACTIONS) {
        try { await guild.bans.create(executor.id, { reason: '🛡️ הגנה: טיימאוטים ברצף' }); } catch {}
        await sendLog(client, new EmbedBuilder().setTitle('🛡️ הגנה: טיימאוטים ברצף').addFields({ name: '👤 ביצע', value: `<@${executor.id}>`, inline: true }).setColor(0xED4245).setTimestamp());
      }
    } catch {}
  }
}
async function handleProtectedBanAdd(ban, client) {
  await logBanAdd(ban, client);
  const guild = ban.guild;
  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
    const entry = auditLogs.entries.find(e => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 8000);
    if (!entry) return;
    const executor = entry.executor;
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner || executor.id === owner.id || executor.id === client.user.id) return;
    const count = recordAction(PROTECT.bans, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנה: באנים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder().setTitle('🛡️ הגנה: באנים ברצף').addFields({ name: '👤 ביצע', value: `<@${executor.id}>`, inline: true }).setColor(0xED4245).setTimestamp());
    }
  } catch {}
}
async function handleProtectedMemberRemove(member, client) {
  await logMemberRemove(member, client);
  const guild = member.guild;
  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
    const entry = auditLogs.entries.find(e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 8000);
    if (!entry) return;
    const executor = entry.executor;
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner || executor.id === owner.id || executor.id === client.user.id) return;
    const count = recordAction(PROTECT.kicks, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנה: קיקים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder().setTitle('🛡️ הגנה: קיקים ברצף').addFields({ name: '👤 ביצע', value: `<@${executor.id}>`, inline: true }).setColor(0xED4245).setTimestamp());
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 13 — ANTI-LINK COMMANDS
// ═══════════════════════════════════════════════════════
async function handleAntiLinkCommand(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === 'toggle') {
    ANTI_LINK.enabled = interaction.options.getBoolean('enabled');
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔗 אנטי-לינק').setDescription(`המערכת כעת: **${ANTI_LINK.enabled ? '✅ פעילה' : '❌ כבויה'}**`).setColor(ANTI_LINK.enabled ? 0x57F287 : 0xED4245).setTimestamp()], ephemeral: true });
  } else if (sub === 'allow-channel') {
    const ch = interaction.options.getChannel('channel');
    if (!ANTI_LINK.allowedChannels.includes(ch.id)) ANTI_LINK.allowedChannels.push(ch.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ <#${ch.id}> נוסף לפטורים.`).setColor(0x57F287)], ephemeral: true });
  } else if (sub === 'remove-channel') {
    const ch = interaction.options.getChannel('channel');
    ANTI_LINK.allowedChannels = ANTI_LINK.allowedChannels.filter(id => id !== ch.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ <#${ch.id}> הוסר.`).setColor(0x57F287)], ephemeral: true });
  } else if (sub === 'status') {
    const allowedList = ANTI_LINK.allowedChannels.length > 0 ? ANTI_LINK.allowedChannels.map(id => `<#${id}>`).join('\n') : 'אין';
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔗 סטטוס אנטי-לינק').addFields({ name: '⚡ מצב', value: ANTI_LINK.enabled ? '✅ פעיל' : '❌ כבוי', inline: true }, { name: '⚠️ מקסימום אזהרות', value: `${ANTI_LINK.MAX_WARNINGS}`, inline: true }, { name: '📢 ערוצים פטורים', value: allowedList }).setColor(0x5865F2).setTimestamp()], ephemeral: true });
  } else if (sub === 'clearwarnings') {
    const user = interaction.options.getUser('user');
    delete ANTI_LINK.warnings[user.id];
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ אזהרות של <@${user.id}> אופסו.`).setColor(0x57F287)], ephemeral: true });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM NEW — MODERATION COMMANDS
// ═══════════════════════════════════════════════════════
async function handleWarn(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  if (!DB.warnings[user.id]) DB.warnings[user.id] = [];
  DB.warnings[user.id].push({ reason, moderator: interaction.user.id, timestamp: new Date().toISOString() });
  const count = DB.warnings[user.id].length;
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⚠️ אזהרה ניתנה').addFields({ name: '👤 משתמש', value: `<@${user.id}>`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason, inline: false }, { name: '⚠️ סה"כ אזהרות', value: `${count}`, inline: true }).setColor(0xFEE75C).setTimestamp()] });
  try {
    await user.send({ embeds: [new EmbedBuilder().setTitle('⚠️ קיבלת אזהרה!').setDescription(`קיבלת אזהרה בשרת **${interaction.guild.name}**.\n\n📝 **סיבה:** ${reason}\n⚠️ **אזהרה מספר:** ${count}`).setColor(0xFEE75C).setTimestamp()] });
  } catch {}
  await sendLog(client, new EmbedBuilder().setTitle('⚠️ אזהרה').addFields({ name: '👤 משתמש', value: `<@${user.id}>`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason }, { name: '🔢 אזהרה #', value: `${count}`, inline: true }).setColor(0xFEE75C).setTimestamp());
}
async function handleWarnings(interaction) {
  const user = interaction.options.getUser('user');
  const warns = DB.warnings[user.id] || [];
  if (warns.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`<@${user.id}> אין לו אזהרות.`).setColor(0x57F287)], ephemeral: true });
  const desc = warns.map((w, i) => `**${i + 1}.** 📝 ${w.reason}\n👮 <@${w.moderator}> | 📅 <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>`).join('\n\n');
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`⚠️ אזהרות — ${user.tag}`).setDescription(desc).setColor(0xFEE75C).setThumbnail(user.displayAvatarURL()).setFooter({ text: `${warns.length} אזהרות בסה"כ` }).setTimestamp()], ephemeral: true });
}
async function handleClearWarns(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const index = interaction.options.getInteger('index');
  if (index !== null) {
    if (!DB.warnings[user.id] || !DB.warnings[user.id][index - 1]) return interaction.reply({ content: '❌ אזהרה לא נמצאה.', ephemeral: true });
    DB.warnings[user.id].splice(index - 1, 1);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ אזהרה #${index} של <@${user.id}> נמחקה.`).setColor(0x57F287)], ephemeral: true });
  } else {
    DB.warnings[user.id] = [];
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ כל אזהרות <@${user.id}> נמחקו.`).setColor(0x57F287)], ephemeral: true });
  }
}
async function handleNote(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const text = interaction.options.getString('text');
  if (!DB.notes[user.id]) DB.notes[user.id] = [];
  DB.notes[user.id].push({ text, moderator: interaction.user.id, timestamp: new Date().toISOString() });
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הערה נוספה ל<@${user.id}>: ${text}`).setColor(0x57F287)], ephemeral: true });
}
async function handleNotes(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const notes = DB.notes[user.id] || [];
  if (notes.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`אין הערות על <@${user.id}>.`).setColor(0x57F287)], ephemeral: true });
  const desc = notes.map((n, i) => `**${i + 1}.** 📓 ${n.text}\n👮 <@${n.moderator}> | <t:${Math.floor(new Date(n.timestamp).getTime() / 1000)}:R>`).join('\n\n');
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📓 הערות — ${user.tag}`).setDescription(desc).setColor(0x3498DB).setThumbnail(user.displayAvatarURL()).setTimestamp()], ephemeral: true });
}
async function handleUserInfo(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild.members.cache.get(user.id);
  const warns = (DB.warnings[user.id] || []).length;
  const notes = (DB.notes[user.id] || []).length;
  const lvl = DB.levelSystem[user.id] || { xp: 0, level: 0, messages: 0 };
  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '📅 נוצר ב', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '📥 הצטרף ב', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'לא ידוע', inline: true },
      { name: '⚠️ אזהרות', value: `${warns}`, inline: true },
      { name: '📓 הערות', value: `${notes}`, inline: true },
      { name: '🏆 רמה', value: `${lvl.level} (${lvl.xp} XP)`, inline: true },
      { name: '💬 הודעות', value: `${lvl.messages}`, inline: true },
    )
    .setColor(0x5865F2)
    .setTimestamp();
  if (member) {
    const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).slice(0, 10).join(', ') || 'אין';
    embed.addFields({ name: '🎭 רולים', value: roles });
  }
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
async function handleServerInfo(interaction) {
  const guild = interaction.guild;
  const members = guild.memberCount;
  const bots = guild.members.cache.filter(m => m.user.bot).size;
  const embed = new EmbedBuilder()
    .setTitle(`🏠 ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '🆔 ID', value: guild.id, inline: true },
      { name: '👑 בעלים', value: `<@${guild.ownerId}>`, inline: true },
      { name: '📅 נוצר ב', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '👥 חברים', value: `${members - bots} 👤 | ${bots} 🤖`, inline: true },
      { name: '📢 ערוצים', value: `${guild.channels.cache.size}`, inline: true },
      { name: '🎭 רולים', value: `${guild.roles.cache.size}`, inline: true },
      { name: '💎 רמת בוסט', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boosts)`, inline: true },
      { name: '🌐 שרתים ברשימה', value: `${Object.keys(DB.serverList).length}`, inline: true },
      { name: '🎫 טיקטים', value: `${DB.ticketStats.total} סה"כ | ${DB.ticketStats.closed} סגורים`, inline: true },
    )
    .setColor(0x5865F2)
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}
async function handleKick(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const member = interaction.guild.members.cache.get(user.id);
  if (!member) return interaction.reply({ content: '❌ משתמש לא נמצא.', ephemeral: true });
  try { await member.kick(reason); } catch { return interaction.reply({ content: '❌ לא ניתן לקיק משתמש זה.', ephemeral: true }); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`👢 <@${user.id}> קיק מהשרת.\n📝 **סיבה:** ${reason}`).setColor(0xED4245)] });
  await sendLog(client, new EmbedBuilder().setTitle('👢 קיק').addFields({ name: '👤 משתמש', value: `${user.tag}`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason }).setColor(0xED4245).setTimestamp());
}
async function handleBan(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const days = interaction.options.getInteger('days') || 0;
  try { await interaction.guild.bans.create(user.id, { reason, deleteMessageDays: days }); } catch { return interaction.reply({ content: '❌ לא ניתן לבאן משתמש זה.', ephemeral: true }); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔨 <@${user.id}> בוין מהשרת.\n📝 **סיבה:** ${reason}`).setColor(0xED4245)] });
  await sendLog(client, new EmbedBuilder().setTitle('🔨 באן').addFields({ name: '👤 משתמש', value: `${user.tag}`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason }).setColor(0xED4245).setTimestamp());
}
async function handleUnban(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const userId = interaction.options.getString('userid');
  try { await interaction.guild.bans.remove(userId); } catch { return interaction.reply({ content: '❌ משתמש לא בוין.', ephemeral: true }); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔓 <@${userId}> הוסר מהבאן.`).setColor(0x57F287)] });
}
async function handleTimeout(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const minutes = interaction.options.getInteger('minutes');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const member = interaction.guild.members.cache.get(user.id);
  if (!member) return interaction.reply({ content: '❌ משתמש לא נמצא.', ephemeral: true });
  try { await member.timeout(minutes * 60 * 1000, reason); } catch { return interaction.reply({ content: '❌ לא ניתן.', ephemeral: true }); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`⏳ <@${user.id}> קיבל timeout של **${minutes} דקות**.\n📝 סיבה: ${reason}`).setColor(0xFEE75C)] });
  await sendLog(client, new EmbedBuilder().setTitle('⏳ Timeout').addFields({ name: '👤 משתמש', value: `<@${user.id}>`, inline: true }, { name: '⏰ זמן', value: `${minutes} דקות`, inline: true }, { name: '📝 סיבה', value: reason }).setColor(0xFEE75C).setTimestamp());
}
async function handleUntimeout(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const user = interaction.options.getUser('user');
  const member = interaction.guild.members.cache.get(user.id);
  if (!member) return interaction.reply({ content: '❌ משתמש לא נמצא.', ephemeral: true });
  try { await member.timeout(null); } catch { return interaction.reply({ content: '❌ לא ניתן.', ephemeral: true }); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Timeout של <@${user.id}> הוסר.`).setColor(0x57F287)] });
}
async function handlePurge(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const amount = interaction.options.getInteger('amount');
  const user = interaction.options.getUser('user');
  await interaction.deferReply({ ephemeral: true });
  try {
    let messages = await interaction.channel.messages.fetch({ limit: amount + 1 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    const deleted = await interaction.channel.bulkDelete(messages, true);
    await interaction.followUp({ content: `✅ נמחקו **${deleted.size}** הודעות.`, ephemeral: true });
    await sendLog(client, new EmbedBuilder().setTitle('🗑️ Purge').addFields({ name: '📍 ערוץ', value: `<#${interaction.channelId}>`, inline: true }, { name: '🔢 כמות', value: `${deleted.size}`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }).setColor(0xFEE75C).setTimestamp());
  } catch { await interaction.followUp({ content: '❌ שגיאה — הודעות ישנות מ-14 יום לא ניתן למחוק.', ephemeral: true }); }
}
async function handleSlowmode(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const seconds = interaction.options.getInteger('seconds');
  await interaction.channel.setRateLimitPerUser(seconds);
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(seconds === 0 ? '✅ סלומוד כובה.' : `✅ סלומוד הוגדר ל-**${seconds} שניות**.`).setColor(0x57F287)] });
}
async function handleLock(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 ערוץ ננעל').setDescription(`<#${interaction.channelId}> ננעל.`).setColor(0xED4245)] });
}
async function handleUnlock(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔓 ערוץ נפתח').setDescription(`<#${interaction.channelId}> נפתח.`).setColor(0x57F287)] });
}
async function handleAutoModCommand(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === 'toggle') {
    DB.automod.enabled = interaction.options.getBoolean('enabled');
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🤖 אוטומוד כעת: **${DB.automod.enabled ? '✅ פעיל' : '❌ כבוי'}**`).setColor(DB.automod.enabled ? 0x57F287 : 0xED4245)], ephemeral: true });
  } else if (sub === 'addword') {
    const word = interaction.options.getString('word').toLowerCase();
    if (!DB.automod.badWords.includes(word)) DB.automod.badWords.push(word);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ המילה \`${word}\` נוספה לרשימת המילים האסורות.`).setColor(0x57F287)], ephemeral: true });
  } else if (sub === 'removeword') {
    const word = interaction.options.getString('word').toLowerCase();
    DB.automod.badWords = DB.automod.badWords.filter(w => w !== word);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ המילה \`${word}\` הוסרה.`).setColor(0x57F287)], ephemeral: true });
  } else if (sub === 'status') {
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🤖 סטטוס אוטומוד').addFields(
      { name: '⚡ מצב', value: DB.automod.enabled ? '✅ פעיל' : '❌ כבוי', inline: true },
      { name: '🔠 גבול כיפסלוק', value: `${DB.automod.capsPercent}%`, inline: true },
      { name: '🔢 גבול ספאם', value: `${DB.automod.spamMessages} הודעות/5 שניות`, inline: true },
      { name: '🚫 מילים אסורות', value: DB.automod.badWords.length > 0 ? DB.automod.badWords.map(w => `\`${w}\``).join(', ') : 'אין', inline: false },
    ).setColor(0x5865F2).setTimestamp()], ephemeral: true });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM NEW — POLLS
// ═══════════════════════════════════════════════════════
async function handlePoll(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const question = interaction.options.getString('question');
  const minutes = interaction.options.getInteger('minutes') || 0;
  const optionsList = ['option1','option2','option3','option4'].map(k => interaction.options.getString(k)).filter(Boolean);
  const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
  const desc = optionsList.map((opt, i) => `${emojis[i]} **${opt}**`).join('\n');
  const endTime = minutes > 0 ? Date.now() + minutes * 60 * 1000 : null;
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${question}`)
    .setDescription(desc)
    .setColor(0x5865F2)
    .setFooter({ text: endTime ? `מסתיים בעוד ${minutes} דקות` : 'פתוח ללא הגבלת זמן' })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    ...optionsList.map((opt, i) => new ButtonBuilder().setCustomId(`poll_vote_${i}`).setLabel(`${emojis[i]} ${opt.slice(0, 20)}`).setStyle(ButtonStyle.Primary))
  );
  const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
  DB.polls[msg.id] = { question, options: optionsList, votes: Object.fromEntries(optionsList.map((_, i) => [i, []])), endTime, ended: false, channelId: interaction.channelId };
  await interaction.reply({ content: '✅ הסקר נוצר!', ephemeral: true });
  if (endTime) setTimeout(() => endPoll(msg.id, interaction.channel), minutes * 60 * 1000);
}
async function handlePollVote(interaction) {
  const parts = interaction.customId.split('_');
  const optionIdx = parseInt(parts[parts.length - 1]);
  const poll = DB.polls[interaction.message.id];
  if (!poll || poll.ended) return interaction.reply({ content: '❌ הסקר הסתיים.', ephemeral: true });
  // הסר הצבעה קודמת
  for (const key of Object.keys(poll.votes)) {
    poll.votes[key] = poll.votes[key].filter(id => id !== interaction.user.id);
  }
  if (!poll.votes[optionIdx]) poll.votes[optionIdx] = [];
  poll.votes[optionIdx].push(interaction.user.id);
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעת על **${poll.options[optionIdx]}**`).setColor(0x57F287)], ephemeral: true });
  // עדכון תוצאות ב-embed
  const total = Object.values(poll.votes).flat().length;
  const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
  const desc = poll.options.map((opt, i) => {
    const votes = (poll.votes[i] || []).length;
    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    return `${emojis[i]} **${opt}**\n\`${bar}\` ${pct}% (${votes} הצבעות)`;
  }).join('\n\n');
  const embed = new EmbedBuilder().setTitle(`📊 ${poll.question}`).setDescription(desc).setColor(0x5865F2).setFooter({ text: `סה"כ ${total} הצבעות` }).setTimestamp();
  try { await interaction.message.edit({ embeds: [embed] }); } catch {}
}
async function endPoll(msgId, channel) {
  const poll = DB.polls[msgId];
  if (!poll || poll.ended) return;
  poll.ended = true;
  const total = Object.values(poll.votes).flat().length;
  const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
  const winner = poll.options.reduce((best, opt, i) => ((poll.votes[i]||[]).length > (poll.votes[best]||[]).length ? i : best), 0);
  const desc = poll.options.map((opt, i) => {
    const votes = (poll.votes[i] || []).length;
    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    return `${emojis[i]} **${opt}** ${i === winner ? '👑' : ''}\n\`${bar}\` ${pct}% (${votes} הצבעות)`;
  }).join('\n\n');
  const embed = new EmbedBuilder().setTitle(`📊 [הסתיים] ${poll.question}`).setDescription(desc).setColor(0x57F287).setFooter({ text: `סה"כ ${total} הצבעות • המנצח: ${poll.options[winner]}` }).setTimestamp();
  try {
    const msg = await channel.messages.fetch(msgId);
    await msg.edit({ embeds: [embed], components: [] });
    await channel.send({ embeds: [new EmbedBuilder().setDescription(`🏆 הסקר הסתיים! המנצח: **${poll.options[winner]}** עם **${(poll.votes[winner]||[]).length}** הצבעות`).setColor(0xFFD700)] });
  } catch {}
}

// ═══════════════════════════════════════════════════════
//  SYSTEM NEW — SUGGESTIONS
// ═══════════════════════════════════════════════════════
async function handleSetupSuggestions(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  CONFIG.SUGGESTIONS_CHANNEL_ID = interaction.options.getChannel('channel').id;
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ ערוץ הצעות הוגדר ל<#${CONFIG.SUGGESTIONS_CHANNEL_ID}>`).setColor(0x57F287)], ephemeral: true });
}
async function handleSuggest(interaction, client) {
  if (!CONFIG.SUGGESTIONS_CHANNEL_ID) return interaction.reply({ content: '❌ ערוץ הצעות לא הוגדר.', ephemeral: true });
  const suggestion = interaction.options.getString('suggestion');
  let ch;
  try { ch = await client.channels.fetch(CONFIG.SUGGESTIONS_CHANNEL_ID); } catch { return interaction.reply({ content: '❌ ערוץ לא נמצא.', ephemeral: true }); }
  const embed = new EmbedBuilder()
    .setTitle('💡 הצעה חדשה')
    .setDescription(suggestion)
    .setColor(0x5865F2)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .addFields({ name: '📊 תוצאות', value: '✅ 0 | ❌ 0', inline: true }, { name: '📋 סטטוס', value: '⏳ ממתין', inline: true })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('suggest_up').setLabel('✅ בעד').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('suggest_down').setLabel('❌ נגד').setStyle(ButtonStyle.Danger),
  );
  const msg = await ch.send({ embeds: [embed], components: [row] });
  DB.suggestions[msg.id] = { content: suggestion, authorId: interaction.user.id, upvotes: 0, downvotes: 0, voters: {}, status: 'pending' };
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription('✅ ההצעה שלך נשלחה!').setColor(0x57F287)], ephemeral: true });
}
async function handleSuggestionVote(interaction, client) {
  const isUp = interaction.customId === 'suggest_up';
  const suggestion = DB.suggestions[interaction.message.id];
  if (!suggestion) return interaction.reply({ content: '❌ הצעה לא נמצאה.', ephemeral: true });
  const prev = suggestion.voters[interaction.user.id];
  const type = isUp ? 'up' : 'down';
  if (prev === type) {
    // ביטול הצבעה
    delete suggestion.voters[interaction.user.id];
    if (isUp) suggestion.upvotes = Math.max(0, suggestion.upvotes - 1);
    else suggestion.downvotes = Math.max(0, suggestion.downvotes - 1);
    await interaction.reply({ content: '↩️ הצבעתך בוטלה.', ephemeral: true });
  } else {
    if (prev) {
      if (prev === 'up') suggestion.upvotes = Math.max(0, suggestion.upvotes - 1);
      else suggestion.downvotes = Math.max(0, suggestion.downvotes - 1);
    }
    suggestion.voters[interaction.user.id] = type;
    if (isUp) suggestion.upvotes++;
    else suggestion.downvotes++;
    await interaction.reply({ content: `${isUp ? '✅ הצבעת בעד' : '❌ הצבעת נגד'}.`, ephemeral: true });
  }
  const total = suggestion.upvotes + suggestion.downvotes;
  const pct = total > 0 ? Math.round((suggestion.upvotes / total) * 100) : 0;
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setFields({ name: '📊 תוצאות', value: `✅ ${suggestion.upvotes} | ❌ ${suggestion.downvotes} (${pct}% בעד)`, inline: true }, { name: '📋 סטטוס', value: suggestion.status === 'approved' ? '✅ אושרה' : suggestion.status === 'denied' ? '❌ נדחתה' : '⏳ ממתין', inline: true });
  await interaction.message.edit({ embeds: [embed] }).catch(() => {});
}
async function handleSuggestionAction(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const msgId = interaction.options.getString('messageid');
  const action = interaction.options.getString('action');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const suggestion = DB.suggestions[msgId];
  if (!suggestion) return interaction.reply({ content: '❌ הצעה לא נמצאה.', ephemeral: true });
  suggestion.status = action === 'approve' ? 'approved' : 'denied';
  const color = action === 'approve' ? 0x57F287 : 0xED4245;
  const statusText = action === 'approve' ? '✅ אושרה' : '❌ נדחתה';
  try {
    const ch = await client.channels.fetch(CONFIG.SUGGESTIONS_CHANNEL_ID);
    const msg = await ch.messages.fetch(msgId);
    const oldEmbed = msg.embeds[0];
    const embed = new EmbedBuilder()
      .setTitle(oldEmbed.title)
      .setDescription(oldEmbed.description)
      .setColor(color)
      .setAuthor(oldEmbed.author)
      .addFields({ name: '📊 תוצאות', value: `✅ ${suggestion.upvotes} | ❌ ${suggestion.downvotes}`, inline: true }, { name: '📋 סטטוס', value: statusText, inline: true }, { name: '📝 סיבה', value: reason }, { name: '👮 טופל על ידי', value: `<@${interaction.user.id}>`, inline: true })
      .setTimestamp();
    await msg.edit({ embeds: [embed], components: [] });
    // DM למציע
    try {
      const author = await client.users.fetch(suggestion.authorId);
      await author.send({ embeds: [new EmbedBuilder().setTitle(`הצעתך ${action === 'approve' ? 'אושרה ✅' : 'נדחתה ❌'}`).setDescription(`**ההצעה:** ${suggestion.content}\n\n**סיבה:** ${reason}`).setColor(color).setTimestamp()] });
    } catch {}
  } catch {}
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ ההצעה ${statusText}.`).setColor(color)], ephemeral: true });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM NEW — AFK
// ═══════════════════════════════════════════════════════
async function handleAfkCommand(interaction) {
  const reason = interaction.options.getString('reason') || 'אין סיבה';
  DB.afk[interaction.user.id] = { reason, since: Date.now() };
  try {
    const currentNick = interaction.member.nickname || interaction.user.username;
    if (!currentNick.startsWith('[AFK]')) {
      await interaction.member.setNickname(`[AFK] ${currentNick}`.slice(0, 32)).catch(() => {});
    }
  } catch {}
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`💤 סומנת כ-AFK!\n📝 **סיבה:** ${reason}`).setColor(0xFEE75C)], ephemeral: false });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM NEW — RANK / LEADERBOARD
// ═══════════════════════════════════════════════════════
async function handleRank(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const data = DB.levelSystem[user.id] || { xp: 0, level: 0, messages: 0 };
  const nextLevelXp = getXpForLevel(data.level + 1);
  const progress = Math.min(100, Math.round((data.xp / nextLevelXp) * 100));
  const bar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));
  const sorted = Object.entries(DB.levelSystem).sort(([,a],[,b]) => b.xp - a.xp);
  const rank = sorted.findIndex(([id]) => id === user.id) + 1;
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '🎯 רמה', value: `**${data.level}**`, inline: true },
      { name: '✨ XP', value: `**${data.xp}** / ${Math.round(nextLevelXp)}`, inline: true },
      { name: '💬 הודעות', value: `**${data.messages}**`, inline: true },
      { name: `📊 התקדמות (${progress}%)`, value: `\`${bar}\``, inline: false },
      { name: '🏅 מיקום', value: `#${rank}`, inline: true },
    )
    .setColor(0xFFD700)
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
}
async function handleLeaderboard(interaction) {
  const sorted = Object.entries(DB.levelSystem).sort(([,a],[,b]) => b.xp - a.xp).slice(0, 10);
  if (sorted.length === 0) return interaction.reply({ content: '❌ אין נתונים עדיין.', ephemeral: true });
  const medals = ['🥇','🥈','🥉'];
  const desc = sorted.map(([id, data], i) => `${medals[i] || `**${i+1}.**`} <@${id}> — רמה **${data.level}** | **${data.xp}** XP | ${data.messages} הודעות`).join('\n');
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 לוח המובילים').setDescription(desc).setColor(0xFFD700).setFooter({ text: `${sorted.length} משתמשים` }).setTimestamp()] });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM NEW — UTILITY COMMANDS
// ═══════════════════════════════════════════════════════
async function handleAvatar(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const url = user.displayAvatarURL({ dynamic: true, size: 1024 });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🖼️ תמונת פרופיל — ${user.tag}`).setImage(url).setColor(0x5865F2).setDescription(`[פתח בדפדפן](${url})`)] });
}
async function handlePing(interaction) {
  const sent = await interaction.reply({ content: '🏓 מחשב...', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏓 Pong!').addFields({ name: '🔁 Round-trip', value: `${latency}ms`, inline: true }, { name: '💓 API Latency', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true }).setColor(latency < 100 ? 0x57F287 : latency < 300 ? 0xFEE75C : 0xED4245)], content: null });
}
async function handleMath(interaction) {
  const expr = interaction.options.getString('expression');
  try {
    const result = Function(`'use strict'; return (${expr.replace(/[^0-9+\-*/.()%^ ]/g, '')})`)();
    if (isNaN(result) || !isFinite(result)) throw new Error('Invalid');
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔢 מחשבון').addFields({ name: '📝 ביטוי', value: `\`${expr}\``, inline: true }, { name: '✅ תוצאה', value: `**${result}**`, inline: true }).setColor(0x5865F2)] });
  } catch { await interaction.reply({ content: '❌ ביטוי לא תקין.', ephemeral: true }); }
}
async function handleCoinflip(interaction) {
  const result = Math.random() < 0.5 ? '👑 עץ' : '✨ פלי';
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🪙 הטלת מטבע').setDescription(`**${result}**`).setColor(0xFFD700)] });
}
async function handleDice(interaction) {
  const sides = interaction.options.getInteger('sides') || 6;
  const result = Math.floor(Math.random() * sides) + 1;
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎲 הטלת קוביה').setDescription(`**${result}** / ${sides}`).setColor(0x5865F2)] });
}
async function handle8Ball(interaction) {
  const answers = ['בהחלט כן! ✅', 'נראה שכן 🟢', 'כנראה שכן', 'שאל מאוחר יותר ⏳', 'לא בטוח 🤔', 'כנראה שלא 🔴', 'לא נראה', 'בהחלט לא! ❌', 'המגיקון אומר: כן 🎱', 'לא עכשיו...'];
  const question = interaction.options.getString('question');
  const answer = answers[Math.floor(Math.random() * answers.length)];
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎱 Magic 8-Ball').addFields({ name: '❓ שאלה', value: question }, { name: '🎱 תשובה', value: `**${answer}**` }).setColor(0x5865F2)] });
}
async function handleEmbedCommand(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const modal = new ModalBuilder().setCustomId('embed_builder_modal').setTitle('📝 בנה Embed');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_title').setLabel('כותרת').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_desc').setLabel('תיאור').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_color').setLabel('צבע hex (לדוג: #5865F2)').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_footer').setLabel('פוטר (אופציונלי)').setStyle(TextInputStyle.Short).setRequired(false)),
  );
  await interaction.showModal(modal);
}
async function handleEmbedModal(interaction) {
  const title = interaction.fields.getTextInputValue('embed_title') || null;
  const desc  = interaction.fields.getTextInputValue('embed_desc');
  const colorStr = interaction.fields.getTextInputValue('embed_color') || '#5865F2';
  const footer = interaction.fields.getTextInputValue('embed_footer') || null;
  const color = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2;
  const embed = new EmbedBuilder().setDescription(desc).setColor(color).setTimestamp();
  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });
  await interaction.reply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 14 — SERVER LIST (ENHANCED — SORTED BY VOTES PER CATEGORY)
// ═══════════════════════════════════════════════════════

// ── פאנל ──
async function setupServerList(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🌐 רשימת השרתים — VOrino Server List')
    .setDescription(
      '## ברוך הבא לרשימת השרתים של VOrino!\n\n' +
      '> כאן תוכל להוסיף את השרת שלך ולקבל חשיפה לכל חברי הקהילה.\n\n' +
      '**📂 קטגוריות זמינות:**\n' +
      '🚗 **FiveM Servers** — שרתי FiveM\n' +
      '🛒 **Shop Servers** — חנויות\n' +
      '⛏️ **Minecraft Servers** — שרתי מיינקראפט\n' +
      '🖥️ **Hosting Servers** — שירותי אירוח\n' +
      '🌐 **Other Servers** — אחר\n\n' +
      '**⚡ מערכת ההצבעות:**\n' +
      'בכל קטגוריה השרתים ממוינים לפי **מספר ההצבעות** — מי שמוביל עולה למעלה!\n' +
      'הצבע אחת ל-24 שעות לכל שרת.\n\n' +
      '**🔝 Bump:**\n' +
      'בעל שרת יכול לבקש Bump — השרת עולה למעלה זמנית!'
    )
    .setColor(0x5865F2)
    .setThumbnail(interaction.guild.iconURL())
    .setFooter({ text: '🌐 VOrino Server List', iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sl_add_server').setLabel('➕ הוסף את השרת שלך').setStyle(ButtonStyle.Success).setEmoji('🌐'),
    new ButtonBuilder().setCustomId('sl_view_top').setLabel('🏆 רשימה לפי קטגוריה').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sl_my_server').setLabel('✏️ ערוך את השרת שלי').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sl_bump_server').setLabel('🔝 Bump').setStyle(ButtonStyle.Secondary),
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ פאנל הסרבר ליסט נשלח!', ephemeral: true });
}

// ── פתיחת מודאל ──
async function handleSlAddServer(interaction) {
  if (DB.blacklisted.has(interaction.user.id))
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🚫 חסום').setDescription('אתה חסום מהוספת שרתים לרשימה.').setColor(0xED4245)], ephemeral: true });
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (existing)
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('⚠️ כבר יש לך שרת!').setDescription(`כבר יש לך שרת ברשימה: <#${existing.channelId}>\n\nלחץ על **✏️ ערוך את השרת שלי** לעריכה.`).setColor(0xFEE75C)], ephemeral: true });
  const modal = new ModalBuilder().setCustomId('sl_add_modal').setTitle('➕ הוסף את השרת שלך');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_name').setLabel('🏷️ שם השרת').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_description').setLabel('📝 תיאור השרת').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_link').setLabel('🔗 קישור קבוע (discord.gg/...)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_category').setLabel('סוג: fivem / shop / minecraft / hosting / other').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
  );
  await interaction.showModal(modal);
}

// ── בניית embed לשרת ──
function buildServerEmbed(serverData, cat, ownerUser) {
  const rankInCategory = getSortedCategoryList(serverData.category).findIndex(s => s.channelId === serverData.channelId) + 1;
  const bumpText = serverData.lastBump ? `<t:${Math.floor(serverData.lastBump / 1000)}:R>` : 'אף פעם';
  const embed = new EmbedBuilder()
    .setTitle(`${cat.emoji} ${serverData.name}`)
    .setDescription(
      `> ${serverData.description}\n\n` +
      `🔗 **קישור:** [לחץ להצטרפות](${serverData.link.startsWith('http') ? serverData.link : 'https://' + serverData.link})\n` +
      `👑 **בעלים:** <@${serverData.ownerId}>\n` +
      `📂 **קטגוריה:** ${cat.emoji} ${cat.name}`
    )
    .setColor(cat.color)
    .addFields(
      { name: '⬆️ הצבעות', value: `**${serverData.votes}**`, inline: true },
      { name: `🏅 מיקום ב-${cat.name}`, value: `**#${rankInCategory}**`, inline: true },
      { name: '🔝 Bump אחרון', value: bumpText, inline: true },
      { name: '📅 נוסף', value: `<t:${Math.floor(new Date(serverData.createdAt).getTime() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: '⬆️ הצבע כדי לעזור לשרת לעלות • הצבעה אחת לכל 24 שעות' })
    .setTimestamp();
  if (ownerUser) embed.setAuthor({ name: ownerUser.tag, iconURL: ownerUser.displayAvatarURL() });
  return embed;
}

// ── פונקציה מרכזית: מיון שרתים לפי קטגוריה לפי הצבעות ──
function getSortedCategoryList(category) {
  return Object.values(DB.serverList)
    .filter(s => s.category === category)
    .sort((a, b) => {
      // אם לאחד יש bump ולשני לא — המבאמפ עולה
      const bumpA = a.bumpUntil || 0;
      const bumpB = b.bumpUntil || 0;
      const now = Date.now();
      const aActive = bumpA > now ? 1 : 0;
      const bActive = bumpB > now ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      // בשאר המקרים — לפי הצבעות
      return b.votes - a.votes;
    });
}

// ── הצגת רשימה לפי קטגוריה ──
async function handleSlViewTop(interaction, client) {
  const catKeys = Object.keys(CONFIG.CATEGORIES);
  const rows = [];
  let desc = '';

  for (const catKey of catKeys) {
    const cat = CONFIG.CATEGORIES[catKey];
    const list = getSortedCategoryList(catKey);
    if (list.length === 0) continue;
    desc += `\n\n## ${cat.emoji} ${cat.name}\n`;
    list.forEach((s, i) => {
      const crown = i === 0 ? ' 👑' : '';
      desc += `**#${i + 1}${crown}** ${s.name} — ⬆️ ${s.votes} הצבעות | <#${s.channelId}>\n`;
    });
  }

  if (!desc) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('אין שרתים ברשימה עדיין.').setColor(0x5865F2)], ephemeral: true });

  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌐 רשימת שרתים לפי קטגוריה').setDescription(desc).setColor(0x5865F2).setFooter({ text: 'ממוין לפי הצבעות בכל קטגוריה' }).setTimestamp()], ephemeral: true });
}

// ── הצבעה ──
async function handleSlVote(interaction, client) {
  const channelId = interaction.customId.replace('sl_vote_', '');
  const serverData = DB.serverList[channelId];
  if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
  if (serverData.ownerId === interaction.user.id)
    return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ אינך יכול להצביע לשרת שלך.').setColor(0xED4245)], ephemeral: true });
  const userId = interaction.user.id;
  const now = Date.now();
  const lastVote = serverData.voters[userId] || 0;
  const COOLDOWN = 24 * 60 * 60 * 1000;
  if (now - lastVote < COOLDOWN) {
    const remaining = Math.ceil((COOLDOWN - (now - lastVote)) / 1000 / 60 / 60);
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('⏳ כבר הצבעת!').setDescription(`תוכל להצביע שוב בעוד **${remaining} שעות**`).setColor(0xFEE75C)], ephemeral: true });
  }
  serverData.votes++;
  serverData.voters[userId] = now;

  // מיון מחדש וסידור embed
  await updateServerMessage(channelId, client);
  // עדכן סדר כל השרתים בקטגוריה
  await reorderCategoryChannels(serverData.category, client);

  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ הצבעתך נרשמה!').setDescription(`הצבעת לשרת **${serverData.name}**!\n\n⬆️ סה"כ הצבעות: **${serverData.votes}**`).setColor(0x57F287)], ephemeral: true });

  if (CONFIG.VOTES_LOG_CHANNEL_ID) {
    try {
      const logCh = await client.channels.fetch(CONFIG.VOTES_LOG_CHANNEL_ID);
      const cat = CONFIG.CATEGORIES[serverData.category];
      await logCh.send({ embeds: [new EmbedBuilder().setTitle('⬆️ הצבעה חדשה!').addFields(
        { name: '🌐 שרת', value: serverData.name, inline: true },
        { name: '👤 מצביע', value: `<@${userId}>`, inline: true },
        { name: '⬆️ סה"כ', value: `${serverData.votes}`, inline: true },
        { name: '📂 קטגוריה', value: `${cat.emoji} ${cat.name}`, inline: true },
        { name: '🏅 מיקום חדש', value: `#${getSortedCategoryList(serverData.category).findIndex(s => s.channelId === channelId) + 1}`, inline: true },
      ).setColor(cat.color).setTimestamp()] });
    } catch {}
  }
}

// ── Bump ──
async function handleSlBumpServer(interaction, client) {
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (!existing) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ אין לך שרת ברשימה.').setColor(0xED4245)], ephemeral: true });
  const now = Date.now();
  const BUMP_COOLDOWN = 6 * 60 * 60 * 1000; // 6 שעות
  if (existing.lastBump && now - existing.lastBump < BUMP_COOLDOWN) {
    const remaining = Math.ceil((BUMP_COOLDOWN - (now - existing.lastBump)) / 1000 / 60 / 60);
    return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`⏳ תוכל לבצע Bump שוב בעוד **${remaining} שעות**`).setColor(0xFEE75C)], ephemeral: true });
  }
  existing.lastBump = now;
  existing.bumpUntil = now + 3 * 60 * 60 * 1000; // עולה למעלה 3 שעות
  existing.bumpCount = (existing.bumpCount || 0) + 1;
  await updateServerMessage(existing.channelId, client);
  await reorderCategoryChannels(existing.category, client);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔝 Bump בוצע!').setDescription(`השרת **${existing.name}** עלה למעלה בקטגוריה ${CONFIG.CATEGORIES[existing.category].emoji} לשלוש שעות!`).setColor(0x57F287)], ephemeral: false });
}

// ── עדכון סדר ערוצים לפי מיון ──
async function reorderCategoryChannels(category, client) {
  try {
    const sorted = getSortedCategoryList(category);
    for (let i = 0; i < sorted.length; i++) {
      try {
        const ch = await client.channels.fetch(sorted[i].channelId).catch(() => null);
        if (ch) await ch.setPosition(i).catch(() => {});
      } catch {}
      // עדכן embed כדי לשקף מיקום חדש
      await updateServerMessage(sorted[i].channelId, client);
    }
  } catch {}
}

// ── דיווח ──
async function handleSlReport(interaction) {
  const channelId = interaction.customId.replace('sl_report_', '');
  const serverData = DB.serverList[channelId];
  if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
  const modal = new ModalBuilder().setCustomId(`sl_report_modal_${channelId}`).setTitle('🚩 דיווח על שרת');
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('report_reason').setLabel('סיבת הדיווח').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300)));
  await interaction.showModal(modal);
}
async function handleSlReportModal(interaction, client) {
  const channelId = interaction.customId.replace('sl_report_modal_', '');
  const serverData = DB.serverList[channelId];
  const reason = interaction.fields.getTextInputValue('report_reason');
  await sendLog(client, new EmbedBuilder().setTitle('🚩 דיווח על שרת').addFields(
    { name: '🌐 שרת', value: serverData ? serverData.name : channelId, inline: true },
    { name: '📍 ערוץ', value: `<#${channelId}>`, inline: true },
    { name: '👤 מדווח', value: `<@${interaction.user.id}>`, inline: true },
    { name: '📝 סיבה', value: reason },
  ).setColor(0xED4245).setTimestamp());
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription('✅ הדיווח נשלח לצוות.').setColor(0x57F287)], ephemeral: true });
}

// ── עריכת שרת עצמי ──
async function handleSlMyServer(interaction) {
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (!existing) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ אין לך שרת ברשימה.').setColor(0xED4245)], ephemeral: true });
  const modal = new ModalBuilder().setCustomId('sl_edit_modal').setTitle('✏️ עריכת השרת שלך');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_edit_name').setLabel('🏷️ שם חדש').setStyle(TextInputStyle.Short).setRequired(true).setValue(existing.name).setMaxLength(50)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_edit_desc').setLabel('📝 תיאור חדש').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(existing.description).setMaxLength(500)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_edit_link').setLabel('🔗 קישור חדש').setStyle(TextInputStyle.Short).setRequired(true).setValue(existing.link).setMaxLength(100)),
  );
  await interaction.showModal(modal);
}
async function handleSlEditModal(interaction, client) {
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (!existing) return interaction.reply({ content: '❌ לא נמצא שרת שלך.', ephemeral: true });
  existing.name = interaction.fields.getTextInputValue('sl_edit_name');
  existing.description = interaction.fields.getTextInputValue('sl_edit_desc');
  existing.link = interaction.fields.getTextInputValue('sl_edit_link');
  await updateServerMessage(existing.channelId, client);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ השרת עודכן!').setDescription(`השרת **${existing.name}** עודכן.`).setColor(0x57F287)], ephemeral: true });
}

// ── /myserver ──
async function handleMyServerCommand(interaction, client) {
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (!existing) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ אין לך שרת ברשימה.').setColor(0xED4245)], ephemeral: true });
  const cat = CONFIG.CATEGORIES[existing.category];
  const rank = getSortedCategoryList(existing.category).findIndex(s => s.channelId === existing.channelId) + 1;
  const embed = new EmbedBuilder()
    .setTitle(`✏️ ניהול השרת שלך — ${existing.name}`)
    .setDescription(`📂 קטגוריה: ${cat.emoji} ${cat.name}\n🔗 קישור: ${existing.link}\n⬆️ הצבעות: **${existing.votes}**\n🏅 מיקום: **#${rank}** בקטגוריה\n📍 ערוץ: <#${existing.channelId}>`)
    .setColor(cat.color).setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sl_my_server').setLabel('✏️ ערוך פרטים').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sl_bump_server').setLabel('🔝 Bump').setStyle(ButtonStyle.Success),
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ── פקודות ניהול ──
async function handleServerListCommand(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'addvote') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    serverData.votes++;
    await updateServerMessage(ch.id, client);
    await reorderCategoryChannels(serverData.category, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעה נוספה ל-**${serverData.name}** (${serverData.votes} הצבעות)`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'removevote') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    if (serverData.votes > 0) serverData.votes--;
    await updateServerMessage(ch.id, client);
    await reorderCategoryChannels(serverData.category, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעה הורדה מ-**${serverData.name}** (${serverData.votes} הצבעות)`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'delete') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    const cat = serverData.category;
    const name = serverData.name;
    delete DB.serverList[ch.id];
    try { await ch.delete(); } catch {}
    await reorderCategoryChannels(cat, client);
    await sendLog(client, new EmbedBuilder().setTitle('🗑️ שרת הוסר').addFields({ name: '🌐 שרת', value: name, inline: true }, { name: '👤 הוסר על ידי', value: `<@${interaction.user.id}>`, inline: true }).setColor(0xED4245).setTimestamp());
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ השרת **${name}** הוסר.`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'blacklist') {
    const user = interaction.options.getUser('user');
    DB.blacklisted.add(user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ <@${user.id}> נחסם.`).setColor(0xED4245)], ephemeral: true });

  } else if (sub === 'unblacklist') {
    const user = interaction.options.getUser('user');
    DB.blacklisted.delete(user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ חסימת <@${user.id}> הוסרה.`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'setvotes') {
    const ch = interaction.options.getChannel('channel');
    const votes = interaction.options.getInteger('votes');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    serverData.votes = votes;
    await updateServerMessage(ch.id, client);
    await reorderCategoryChannels(serverData.category, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעות של **${serverData.name}** הוגדרו ל-**${votes}**`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'reset-votes') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    serverData.votes = 0;
    serverData.voters = {};
    await updateServerMessage(ch.id, client);
    await reorderCategoryChannels(serverData.category, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעות של **${serverData.name}** אופסו.`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'bump') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    serverData.lastBump = Date.now();
    serverData.bumpUntil = Date.now() + 3 * 60 * 60 * 1000;
    await updateServerMessage(ch.id, client);
    await reorderCategoryChannels(serverData.category, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ **${serverData.name}** עלה למעלה בקטגוריה שלו!`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'info') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    const cat = CONFIG.CATEGORIES[serverData.category];
    const rank = getSortedCategoryList(serverData.category).findIndex(s => s.channelId === ch.id) + 1;
    await interaction.reply({ embeds: [new EmbedBuilder()
      .setTitle(`📋 מידע: ${serverData.name}`)
      .addFields(
        { name: '📂 קטגוריה', value: `${cat.emoji} ${cat.name}`, inline: true },
        { name: '👤 בעלים', value: `<@${serverData.ownerId}>`, inline: true },
        { name: '⬆️ הצבעות', value: `${serverData.votes}`, inline: true },
        { name: '🏅 מיקום', value: `#${rank} בקטגוריה`, inline: true },
        { name: '🔝 Bump', value: `${serverData.bumpCount || 0} פעמים`, inline: true },
        { name: '📅 נוסף', value: `<t:${Math.floor(new Date(serverData.createdAt).getTime() / 1000)}:F>`, inline: true },
        { name: '🔗 קישור', value: serverData.link, inline: false },
        { name: '📝 תיאור', value: serverData.description.substring(0, 200), inline: false },
      ).setColor(cat.color).setTimestamp()
    ], ephemeral: true });

  } else if (sub === 'top') {
    // מציג לפי קטגוריה — מי שמוביל בכל קטגוריה
    let desc = '';
    for (const [catKey, cat] of Object.entries(CONFIG.CATEGORIES)) {
      const list = getSortedCategoryList(catKey);
      if (list.length === 0) continue;
      desc += `\n\n**${cat.emoji} ${cat.name}** (${list.length} שרתים)\n`;
      list.slice(0, 5).forEach((s, i) => {
        const crown = i === 0 ? ' 👑' : '';
        desc += `**#${i+1}${crown}** ${s.name} — ⬆️ ${s.votes} | <#${s.channelId}>\n`;
      });
    }
    if (!desc) return interaction.reply({ content: '❌ אין שרתים.', ephemeral: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 טופ שרתים לפי קטגוריה').setDescription(desc).setColor(0xFFD700).setTimestamp()], ephemeral: true });
  }
}

async function updateServerMessage(channelId, client) {
  const serverData = DB.serverList[channelId];
  if (!serverData) return;
  try {
    const ch = await client.channels.fetch(channelId);
    const msg = await ch.messages.fetch(serverData.messageId);
    const cat = CONFIG.CATEGORIES[serverData.category];
    await msg.edit({
      embeds: [buildServerEmbed(serverData, cat, null)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sl_vote_${channelId}`).setLabel(`⬆️ הצבע (${serverData.votes})`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sl_report_${channelId}`).setLabel('🚩 דווח').setStyle(ButtonStyle.Danger),
      )]
    });
  } catch (e) { console.error('updateServerMessage error:', e); }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 15 — SERVER LIST APPROVAL VIA TICKET
// ═══════════════════════════════════════════════════════
async function handleSlAddModal(interaction, client) {
  const name   = interaction.fields.getTextInputValue('sl_name');
  const desc   = interaction.fields.getTextInputValue('sl_description');
  const link   = interaction.fields.getTextInputValue('sl_link');
  const catRaw = interaction.fields.getTextInputValue('sl_category').toLowerCase().trim();
  const validCats = Object.keys(CONFIG.CATEGORIES);
  const category = validCats.find(c => catRaw.includes(c)) || 'other';
  const cat = CONFIG.CATEGORIES[category];
  if (!cat || !cat.id) return interaction.reply({ content: '❌ שגיאת תצורה: קטגוריה לא מוגדרת.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const user = interaction.user;
  const safeName = name.toLowerCase().replace(/[^a-z0-9א-ת]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 30) || 'server';
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: `sl-request-${safeName}`,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID || null,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.TEAM_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (e) {
    return interaction.followUp({ content: '❌ שגיאה ביצירת טיקט הבקשה.', ephemeral: true });
  }
  DB.pendingServerSubmissions[ticketChannel.id] = { ownerId: user.id, name, description: desc, link, category, createdAt: new Date().toISOString() };
  const reqEmbed = new EmbedBuilder()
    .setTitle(`📥 בקשה להוספת שרת — ${name}`)
    .addFields(
      { name: '🏷️ שם', value: name, inline: true },
      { name: '📂 קטגוריה', value: `${cat.emoji} ${cat.name}`, inline: true },
      { name: '👤 מבקש', value: `<@${user.id}>`, inline: true },
      { name: '🔗 קישור', value: link, inline: false },
      { name: '📝 תיאור', value: desc, inline: false },
    )
    .setColor(cat.color).setThumbnail(user.displayAvatarURL()).setTimestamp();
  await ticketChannel.send({
    content: `<@${user.id}> | <@&${CONFIG.TEAM_ROLE_ID}>`,
    embeds: [reqEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sl_approve_${ticketChannel.id}`).setLabel('✅ אשר').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`sl_deny_${ticketChannel.id}`).setLabel('❌ דחה').setStyle(ButtonStyle.Danger),
    )],
  });
  await sendLog(client, new EmbedBuilder().setTitle('📥 בקשת הוספת שרת').addFields({ name: '🏷️ שם', value: name, inline: true }, { name: '👤 מבקש', value: `<@${user.id}>`, inline: true }, { name: '📍 טיקט', value: `<#${ticketChannel.id}>`, inline: true }).setColor(cat.color).setTimestamp());
  await interaction.followUp({ embeds: [new EmbedBuilder().setTitle('✅ הבקשה שלך נשלחה!').setDescription(`הבקשה להוספת **${name}** נשלחה לאישור.\nעקוב אחרי הטיקט: <#${ticketChannel.id}>`).setColor(cat.color).setTimestamp()], ephemeral: true });
}
async function handleSlApprovalButton(interaction, client) {
  const isApprove = interaction.customId.startsWith('sl_approve_');
  const ticketChannelId = interaction.customId.replace(isApprove ? 'sl_approve_' : 'sl_deny_', '');
  const submission = DB.pendingServerSubmissions[ticketChannelId];
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  if (!submission) return interaction.reply({ content: '❌ הבקשה לא נמצאה.', ephemeral: true });
  isApprove ? await handleSlApprove(interaction, client, ticketChannelId, submission) : await handleSlDeny(interaction, client, ticketChannelId, submission);
}
async function handleSlApprove(interaction, client, ticketChannelId, submission) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  const cat = CONFIG.CATEGORIES[submission.category];
  if (!cat || !cat.id || !guild.channels.cache.get(cat.id))
    return interaction.followUp({ content: `❌ קטגוריה לא נמצאה.`, ephemeral: true });
  const safeName = submission.name.toLowerCase().replace(/[^a-z0-9א-ת]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 30) || 'server';
  let serverChannel;
  try {
    serverChannel = await guild.channels.create({
      name: safeName, type: ChannelType.GuildText, parent: cat.id,
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
        { id: CONFIG.TEAM_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: submission.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (e) { return interaction.followUp({ content: '❌ שגיאה ביצירת ערוץ.', ephemeral: true }); }
  const serverData = {
    channelId: serverChannel.id, ownerId: submission.ownerId,
    name: submission.name, description: submission.description, link: submission.link, category: submission.category,
    votes: 0, voters: {}, createdAt: new Date().toISOString(), messageId: null,
    lastBump: null, bumpUntil: null, bumpCount: 0,
  };
  DB.serverList[serverChannel.id] = serverData;
  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sl_vote_${serverChannel.id}`).setLabel('⬆️ הצבע (0)').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sl_report_${serverChannel.id}`).setLabel('🚩 דווח').setStyle(ButtonStyle.Danger),
  );
  let msg;
  try { msg = await serverChannel.send({ embeds: [buildServerEmbed(serverData, cat, null)], components: [voteRow] }); }
  catch (e) { return interaction.followUp({ content: '❌ הערוץ נוצר אך שליחה נכשלה.', ephemeral: true }); }
  serverData.messageId = msg.id;
  // מיין קטגוריה מחדש
  await reorderCategoryChannels(submission.category, client);
  if (CONFIG.SERVER_OWNER_ROLE_ID) {
    try { const ownerMember = await guild.members.fetch(submission.ownerId); await ownerMember.roles.add(CONFIG.SERVER_OWNER_ROLE_ID); } catch {}
  }
  try {
    const ownerUser = await client.users.fetch(submission.ownerId);
    await ownerUser.send({ embeds: [new EmbedBuilder().setTitle('✅ הבקשה שלך אושרה!').setDescription(`השרת **${submission.name}** אושר!\n\nערוץ השרת: <#${serverChannel.id}>\n\nזכור שהצבעות מסדרות את השרת — ככל שיש יותר הצבעות, אתה עולה גבוה יותר! 🚀`).setColor(cat.color).setTimestamp()] });
  } catch {}
  await sendLog(client, new EmbedBuilder().setTitle('✅ שרת אושר').addFields({ name: '🏷️ שם', value: submission.name, inline: true }, { name: '👤 בעלים', value: `<@${submission.ownerId}>`, inline: true }, { name: '✅ אישר', value: `<@${interaction.user.id}>`, inline: true }, { name: '📍 ערוץ', value: `<#${serverChannel.id}>`, inline: true }).setColor(cat.color).setTimestamp());
  await interaction.followUp({ embeds: [new EmbedBuilder().setDescription(`✅ אושר! ערוץ: <#${serverChannel.id}>\n\nטיקט יימחק תוך 5 שניות...`).setColor(0x57F287)] });
  delete DB.pendingServerSubmissions[ticketChannelId];
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}
async function handleSlDeny(interaction, client, ticketChannelId, submission) {
  const modal = new ModalBuilder().setCustomId(`sl_deny_modal_${ticketChannelId}`).setTitle('❌ דחיית בקשה');
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('deny_reason').setLabel('סיבת הדחייה').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300)));
  await interaction.showModal(modal);
}
async function handleSlDenyModal(interaction, client) {
  const ticketChannelId = interaction.customId.replace('sl_deny_modal_', '');
  const submission = DB.pendingServerSubmissions[ticketChannelId];
  const reason = interaction.fields.getTextInputValue('deny_reason');
  if (!submission) return interaction.reply({ content: '❌ הבקשה לא נמצאה.', ephemeral: true });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ הבקשה נדחתה').setDescription(`סיבה: ${reason}\n\nטיקט יימחק תוך 5 שניות...`).setColor(0xED4245)] });
  let dmSent = false;
  try {
    const ownerUser = await client.users.fetch(submission.ownerId);
    await ownerUser.send({ embeds: [new EmbedBuilder().setTitle('❌ הבקשה שלך נדחתה').setDescription(`הבקשה להוספת **${submission.name}** נדחתה.\n\n📝 **סיבה:** ${reason}`).setColor(0xED4245).setTimestamp()] });
    dmSent = true;
  } catch {}
  if (!dmSent) await interaction.followUp({ content: `<@${submission.ownerId}> ⚠️ הבקשה שלך לשרת **${submission.name}** נדחתה. סיבה: ${reason}` });
  await sendLog(client, new EmbedBuilder().setTitle('❌ בקשת שרת נדחתה').addFields({ name: '🏷️ שם', value: submission.name, inline: true }, { name: '👤 מבקש', value: `<@${submission.ownerId}>`, inline: true }, { name: '❌ דחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason }, { name: '📨 DM', value: dmSent ? '✅' : '❌', inline: true }).setColor(0xED4245).setTimestamp());
  delete DB.pendingServerSubmissions[ticketChannelId];
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

// ═══════════════════════════════════════════════════════
//  CLIENT
// ═══════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  startActivityRotation(client);
  // כל שעה — אפס bump שפג
  setInterval(() => {
    const now = Date.now();
    for (const serverData of Object.values(DB.serverList)) {
      if (serverData.bumpUntil && serverData.bumpUntil <= now) serverData.bumpUntil = null;
    }
  }, 60 * 60 * 1000);
});

// ═══════════════════════════════════════════════════════
//  INTERACTION HANDLER
// ═══════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  try {
    // ── Slash Commands ──
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;
      if (cmd === 'setup-tickets')         return setupTickets(interaction);
      if (cmd === 'setup-verify')          return setupVerify(interaction);
      if (cmd === 'broadcast')             return broadcast(interaction);
      if (cmd === 'dmall')                 return dmAll(interaction, client);
      if (cmd === 'giveaway')              return createGiveaway(interaction);
      if (cmd === 'endgiveaway')           return endGiveawayCommand(interaction);
      if (cmd === 'antilink')              return handleAntiLinkCommand(interaction);
      if (cmd === 'posting')               return handlePosting(interaction, client);
      if (cmd === 'set-posting-channel')   return handleSetPostingChannel(interaction);
      if (cmd === 'setup-serverlist')      return setupServerList(interaction);
      if (cmd === 'serverlist')            return handleServerListCommand(interaction, client);
      if (cmd === 'myserver')              return handleMyServerCommand(interaction, client);
      // מערכות חדשות
      if (cmd === 'warn')                  return handleWarn(interaction, client);
      if (cmd === 'warnings')              return handleWarnings(interaction);
      if (cmd === 'clearwarns')            return handleClearWarns(interaction);
      if (cmd === 'note')                  return handleNote(interaction);
      if (cmd === 'notes')                 return handleNotes(interaction);
      if (cmd === 'userinfo')              return handleUserInfo(interaction);
      if (cmd === 'serverinfo')            return handleServerInfo(interaction);
      if (cmd === 'kick')                  return handleKick(interaction, client);
      if (cmd === 'ban')                   return handleBan(interaction, client);
      if (cmd === 'unban')                 return handleUnban(interaction, client);
      if (cmd === 'timeout')               return handleTimeout(interaction, client);
      if (cmd === 'untimeout')             return handleUntimeout(interaction);
      if (cmd === 'purge')                 return handlePurge(interaction, client);
      if (cmd === 'slowmode')              return handleSlowmode(interaction);
      if (cmd === 'lock')                  return handleLock(interaction);
      if (cmd === 'unlock')                return handleUnlock(interaction);
      if (cmd === 'automod')               return handleAutoModCommand(interaction);
      if (cmd === 'poll')                  return handlePoll(interaction);
      if (cmd === 'setup-suggestions')     return handleSetupSuggestions(interaction);
      if (cmd === 'suggest')               return handleSuggest(interaction, client);
      if (cmd === 'suggestion-action')     return handleSuggestionAction(interaction, client);
      if (cmd === 'afk')                   return handleAfkCommand(interaction);
      if (cmd === 'rank')                  return handleRank(interaction);
      if (cmd === 'leaderboard')           return handleLeaderboard(interaction);
      if (cmd === 'avatar')                return handleAvatar(interaction);
      if (cmd === 'ping')                  return handlePing(interaction);
      if (cmd === 'math')                  return handleMath(interaction);
      if (cmd === 'coinflip')              return handleCoinflip(interaction);
      if (cmd === 'dice')                  return handleDice(interaction);
      if (cmd === '8ball')                 return handle8Ball(interaction);
      if (cmd === 'embed')                 return handleEmbedCommand(interaction);
      if (cmd === 'set-boost-channel') {
        if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
        CONFIG.BOOST_CHANNEL_ID = interaction.options.getChannel('channel').id;
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ ערוץ בוסט הוגדר ל<#${CONFIG.BOOST_CHANNEL_ID}>`).setColor(0x57F287)], ephemeral: true });
      }
      if (cmd === 'set-votes-log') {
        if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
        CONFIG.VOTES_LOG_CHANNEL_ID = interaction.options.getChannel('channel').id;
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ ערוץ לוג הצבעות הוגדר ל<#${CONFIG.VOTES_LOG_CHANNEL_ID}>`).setColor(0x57F287)], ephemeral: true });
      }
      if (cmd === 'set-server-owner-role') {
        if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
        CONFIG.SERVER_OWNER_ROLE_ID = interaction.options.getRole('role').id;
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ רול בעלי שרתים הוגדר ל<@&${CONFIG.SERVER_OWNER_ROLE_ID}>`).setColor(0x57F287)], ephemeral: true });
      }
    }

    // ── Buttons ──
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'ticket_open')                                       return handleTicketOpen(interaction, client);
      if (['ticket_close','ticket_transcript','ticket_rename','ticket_claim'].includes(id)) return handleTicketAction(interaction, client);
      if (id === 'verify_start')                                      return handleVerifyStart(interaction, client);
      if (id === 'giveaway_enter')                                    return handleGiveawayEnter(interaction);
      if (id === 'sl_add_server')                                     return handleSlAddServer(interaction);
      if (id === 'sl_view_top')                                       return handleSlViewTop(interaction, client);
      if (id === 'sl_my_server')                                      return handleSlMyServer(interaction);
      if (id === 'sl_bump_server')                                    return handleSlBumpServer(interaction, client);
      if (id.startsWith('sl_vote_'))                                  return handleSlVote(interaction, client);
      if (id.startsWith('sl_report_') && !id.includes('modal'))      return handleSlReport(interaction);
      if (id.startsWith('sl_approve_') || id.startsWith('sl_deny_')) return handleSlApprovalButton(interaction, client);
      if (id === 'suggest_up' || id === 'suggest_down')               return handleSuggestionVote(interaction, client);
      if (id.startsWith('poll_vote_'))                                return handlePollVote(interaction);
    }

    // ── Select Menus ──
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_category')        return handleTicketCategory(interaction, client);
      if (id.startsWith('verify_answer_')) return handleVerifyAnswer(interaction, client);
    }

    // ── Modals ──
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id === 'ticket_rename_modal')          return handleTicketRenameModal(interaction);
      if (id === 'sl_add_modal')                 return handleSlAddModal(interaction, client);
      if (id === 'sl_edit_modal')                return handleSlEditModal(interaction, client);
      if (id === 'embed_builder_modal')          return handleEmbedModal(interaction);
      if (id.startsWith('sl_report_modal_'))     return handleSlReportModal(interaction, client);
      if (id.startsWith('sl_deny_modal_'))       return handleSlDenyModal(interaction, client);
    }

  } catch (err) {
    console.error('Interaction error:', err);
    try {
      const msg = { content: '❌ אירעה שגיאה.', ephemeral: true };
      if (interaction.replied || interaction.deferred) interaction.followUp(msg);
      else interaction.reply(msg);
    } catch {}
  }
});

// ═══════════════════════════════════════════════════════
//  GUILD EVENTS
// ═══════════════════════════════════════════════════════
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) { await handleGuildMemberAdd(member, client); }
  else { handleWelcome(member, client); logMemberAdd(member, client); }
});
client.on('guildMemberRemove',  (member)               => handleProtectedMemberRemove(member, client));
client.on('guildBanAdd',        (ban)                  => handleProtectedBanAdd(ban, client));
client.on('guildBanRemove',     (ban)                  => logBanRemove(ban, client));
client.on('messageDelete',      (msg)                  => logMessageDelete(msg, client));
client.on('messageUpdate',      (old, nw)              => logMessageEdit(old, nw, client));
client.on('guildMemberUpdate',  (oldMember, newMember) => handleProtectedMemberUpdate(oldMember, newMember, client));
client.on('channelDelete',      (channel)              => handleChannelDelete(channel, client));
client.on('roleDelete',         (role)                 => handleRoleDelete(role, client));
client.on('messageCreate', async (message) => {
  if (message.author?.bot) return;
  await handleAntiLink(message, client);
  await handleAutoMod(message, client);
  await handleAfkCheck(message, client);
  await handleLevelXP(message, client);
});

// ═══════════════════════════════════════════════════════
//  DEPLOY
// ═══════════════════════════════════════════════════════
async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  console.log('🔄 Deploying slash commands...');
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: COMMANDS.map(c => c.toJSON()) });
  console.log('✅ Deployed!');
}

deployCommands().then(() => client.login(CONFIG.TOKEN)).catch(console.error);
