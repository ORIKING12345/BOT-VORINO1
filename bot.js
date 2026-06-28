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
  BLACKLISTED_FROM_LIST: [],

  // קטגוריות סרבר ליסט
  CATEGORIES: {
    fivem:   { id: '1496093663464263760', name: 'FiveM Servers',   emoji: '🚗', color: 0xE74C3C },
    shop:    { id: '1520760826506510356', name: 'Shop Servers',    emoji: '🛒', color: 0xF39C12 },
    minecraft: { id: '1520761393731866687', name: 'Minecraft Servers', emoji: '⛏️', color: 0x27AE60 },
    hosting: { id: '1520761283324940358', name: 'Hosting Servers', emoji: '🖥️', color: 0x2980B9 },
    other:   { id: '1520761490208981113', name: 'Other Servers',   emoji: '🌐', color: 0x8E44AD },
  },
};

// ═══════════════════════════════════════════════════════
//  DATABASE (in-memory)
// ═══════════════════════════════════════════════════════
const DB = {
  tickets:     {},
  giveaways:   {},
  serverList:  {}, // channelId -> serverData
  blacklisted: new Set(), // userId -> blacklisted from creating
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
  // ── פרסום עצמי (פוסטינג) ──
  new SlashCommandBuilder().setName('posting').setDescription('📣 שלח הודעת פרסום עצמי [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('ערוץ הפרסום').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('תיאור').setRequired(true))
    .addStringOption(o => o.setName('color').setDescription('צבע hex (ברירת מחדל: כחול)')),
  // ── סרבר ליסט — פאנל ──
  new SlashCommandBuilder().setName('setup-serverlist').setDescription('🌐 שלח את פאנל הוספת שרת לרשימה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  // ── סרבר ליסט — ניהול צוות ──
  new SlashCommandBuilder().setName('serverlist').setDescription('🛠️ ניהול סרבר ליסט [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('addvote').setDescription('הוסף הצבעה לשרת').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('removevote').setDescription('הורד הצבעה מהשרת').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('מחק חדר שרת').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('blacklist').setDescription('חסום משתמש מפתיחת חדרים').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)))
    .addSubcommand(s => s.setName('unblacklist').setDescription('הסר חסימה ממשתמש').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)))
    .addSubcommand(s => s.setName('setvotes').setDescription('קבע מספר הצבעות ידנית').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)).addIntegerOption(o => o.setName('votes').setDescription('מספר הצבעות').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('מידע על שרת ברשימה').addChannelOption(o => o.setName('channel').setDescription('ערוץ השרת').setRequired(true)))
    .addSubcommand(s => s.setName('top').setDescription('הצג את השרתים המובילים')),
  // ── עריכת שרת עצמי ──
  new SlashCommandBuilder().setName('myserver').setDescription('✏️ ערוך את פרטי השרת שלך ברשימה'),
  // ── בוסט ──
  new SlashCommandBuilder().setName('set-boost-channel').setDescription('💎 הגדר ערוץ הודעות בוסט [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)),
  new SlashCommandBuilder().setName('set-votes-log').setDescription('📊 הגדר ערוץ לוג הצבעות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('ערוץ').setRequired(true)),
  new SlashCommandBuilder().setName('set-server-owner-role').setDescription('👑 הגדר רול לבעלי שרתים [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption(o => o.setName('role').setDescription('הרול').setRequired(true)),
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
    ])
  );
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📂 בחר קטגוריה').setDescription('בחר את הקטגוריה המתאימה.').setColor(0x5865F2)], components: [menu], ephemeral: true });
}
async function handleTicketCategory(interaction, client) {
  const category = interaction.values[0];
  const categoryNames = { general: '💬 שאלה כללית', purchase: '🛒 קניה', prize: '🎁 קבלת פרס' };
  const guild = interaction.guild;
  const user = interaction.user;
  await interaction.deferUpdate();
  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${randomId(4)}`;
  const ticketChannel = await guild.channels.create({
    name: channelName, type: ChannelType.GuildText,
    parent: CONFIG.TICKET_CATEGORY_ID || null,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: CONFIG.TEAM_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  });
  DB.tickets[ticketChannel.id] = { userId: user.id, category, name: channelName, createdAt: new Date().toISOString() };
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
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות יכול לבצע פעולה זו.', ephemeral: true });
  if (action === 'ticket_close') {
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
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ אומת בהצלחה!').setDescription(`ברוך הבא, <@${interaction.user.id}>!\nיש לך כעת גישה מלאה 🎉`).setColor(0x57F287).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()], ephemeral: true });
  await sendLog(client, new EmbedBuilder().setTitle('✅ משתמש אומת').setDescription(`<@${interaction.user.id}> עבר אימות.`).setColor(0x57F287).setTimestamp());
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 3 — WELCOME
// ═══════════════════════════════════════════════════════
async function handleWelcome(member, client) {
  try {
    const ch = await client.channels.fetch(CONFIG.WELCOME_CHANNEL_ID);
    if (!ch) return;
    const guild = member.guild;
    const embed = new EmbedBuilder()
      .setTitle(`👋 ברוך הבא, ${member.user.username}!`)
      .setDescription(`שמחים לראותך בשרת **${guild.name}**!\n\nאתה החבר מספר **${guild.memberCount}** שלנו 🎉\n\nאל תשכח לעבור אימות ולקרוא את חוקי השרת.`)
      .setColor(0x5865F2).setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields({ name: '📅 הצטרף ב', value: timestamp(), inline: true }, { name: '👥 חברי שרת', value: `${guild.memberCount}`, inline: true }, { name: '🏷️ תגית', value: member.user.tag, inline: true })
      .setFooter({ text: `VOrino • ${guild.name}`, iconURL: guild.iconURL() }).setTimestamp();
    await ch.send({ content: `<@${member.id}>`, embeds: [embed] });
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
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות יכול.', ephemeral: true });
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
//  SYSTEM 6 — POSTING (פרסום עצמי)
// ═══════════════════════════════════════════════════════
async function handlePosting(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const channel = interaction.options.getChannel('channel');
  const title   = interaction.options.getString('title');
  const desc    = interaction.options.getString('description');
  const colorStr = interaction.options.getString('color') || '#5865F2';
  const color = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2;

  const embed = new EmbedBuilder()
    .setTitle(`📣 ${title}`)
    .setDescription(desc)
    .setColor(color)
    .addFields(
      { name: '📌 איך לפרסם?', value: 'שלח את פרסום השרת שלך בערוץ זה לפי הפורמט שמוצג למטה.', inline: false },
      { name: '📋 פורמט נדרש', value: '```\n🏷️ שם השרת:\n📝 תיאור:\n🔗 קישור להצטרפות:\n👥 כמות חברים:\n```', inline: false },
      { name: '⚠️ חוקים', value: '• אין ספאם\n• פרסום כל 24 שעות בלבד\n• חובה לעקוב אחרי הפורמט', inline: false }
    )
    .setFooter({ text: 'VOrino • Self Promotion', iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: `✅ הודעת הפרסום נשלחה ל<#${channel.id}>`, ephemeral: true });
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

// ═══════════════════════════════════════════════════════
//  SYSTEM 8 — BOOST NOTIFICATIONS
// ═══════════════════════════════════════════════════════
async function handleBoost(oldMember, newMember, client) {
  const wasBooster = oldMember.premiumSince;
  const isBooster = newMember.premiumSince;
  if (!wasBooster && isBooster) {
    const channelId = CONFIG.BOOST_CHANNEL_ID;
    if (!channelId) return;
    try {
      const ch = await client.channels.fetch(channelId);
      if (!ch) return;
      const embed = new EmbedBuilder()
        .setTitle('💎 בוסט חדש לשרת!')
        .setDescription(`<@${newMember.id}> עשה בוסט לשרת!\n\n✨ תודה רבה על התמיכה! ✨`)
        .setColor(0xFF73FA)
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👤 בוסטר', value: `<@${newMember.id}>`, inline: true },
          { name: '💎 בוסטים לשרת', value: `${newMember.guild.premiumSubscriptionCount || 0}`, inline: true },
          { name: '🏆 רמת בוסט', value: `Level ${newMember.guild.premiumTier}`, inline: true },
        )
        .setFooter({ text: 'VOrino • Boost System', iconURL: newMember.guild.iconURL() })
        .setTimestamp();
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
        { name: 'Custom Status', state: '🛡️ All Reserved Save For VOrino', type: ActivityType.Custom },
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
  await sendLog(client, new EmbedBuilder().setTitle('🤖 בוט נוסף').setDescription(`${member.user.tag} נוסף על ידי האוונר.`).setColor(0xFEE75C).setTimestamp());
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
  // בוסט
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
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ <#${ch.id}> נוסף לרשימת הפטורים.`).setColor(0x57F287)], ephemeral: true });
  } else if (sub === 'remove-channel') {
    const ch = interaction.options.getChannel('channel');
    ANTI_LINK.allowedChannels = ANTI_LINK.allowedChannels.filter(id => id !== ch.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ <#${ch.id}> הוסר.`).setColor(0x57F287)], ephemeral: true });
  } else if (sub === 'status') {
    const allowedList = ANTI_LINK.allowedChannels.length > 0 ? ANTI_LINK.allowedChannels.map(id => `<#${id}>`).join('\n') : 'אין ערוצים פטורים';
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔗 סטטוס אנטי-לינק').addFields({ name: '⚡ מצב', value: ANTI_LINK.enabled ? '✅ פעיל' : '❌ כבוי', inline: true }, { name: '⚠️ מקסימום אזהרות', value: `${ANTI_LINK.MAX_WARNINGS}`, inline: true }, { name: '📢 ערוצים פטורים', value: allowedList }).setColor(0x5865F2).setTimestamp()], ephemeral: true });
  } else if (sub === 'clearwarnings') {
    const user = interaction.options.getUser('user');
    delete ANTI_LINK.warnings[user.id];
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ אזהרות של <@${user.id}> אופסו.`).setColor(0x57F287)], ephemeral: true });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 14 — SERVER LIST
// ═══════════════════════════════════════════════════════

// פאנל ראשי
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
      '**📋 מה צריך לספק?**\n' +
      '• שם השרת | תיאור | קישור קבוע | שם בעלים | ID בעלים\n\n' +
      '**⚡ איך עובד מערכת ההצבעות?**\n' +
      'ככל שיש לשרת שלך יותר הצבעות — הוא עולה גבוה יותר ברשימה!\n' +
      'כל אחד יכול להצביע לשרת אחת ל-24 שעות.'
    )
    .setColor(0x5865F2)
    .setThumbnail(interaction.guild.iconURL())
    .setImage('https://i.imgur.com/placeholder.png') // ניתן להחליף לתמונת באנר
    .setFooter({ text: '🌐 VOrino Server List • לחץ על הכפתור למטה להוספת שרתך', iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sl_add_server').setLabel('➕ הוסף את השרת שלך').setStyle(ButtonStyle.Success).setEmoji('🌐'),
    new ButtonBuilder().setCustomId('sl_view_top').setLabel('🏆 השרתים המובילים').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sl_my_server').setLabel('✏️ ערוך את השרת שלי').setStyle(ButtonStyle.Secondary),
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ פאנל הסרבר ליסט נשלח!', ephemeral: true });
}

// פתיחת מודאל הוספת שרת
async function handleSlAddServer(interaction) {
  if (DB.blacklisted.has(interaction.user.id)) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🚫 חסום').setDescription('אתה חסום מהוספת שרתים לרשימה.\nפנה לצוות לערעור.').setColor(0xED4245)], ephemeral: true });
  }
  // בדיקה אם כבר יש לו שרת
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (existing) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('⚠️ כבר יש לך שרת!').setDescription(`כבר יש לך שרת ברשימה: <#${existing.channelId}>\n\nאם ברצונך לערוך אותו לחץ על **✏️ ערוך את השרת שלי**`).setColor(0xFEE75C)], ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId('sl_add_modal').setTitle('➕ הוסף את השרת שלך');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_name').setLabel('🏷️ שם השרת').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_description').setLabel('📝 תיאור השרת').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_link').setLabel('🔗 קישור קבוע לשרת (discord.gg/...)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_owner_id').setLabel('🆔 ID של בעל השרת').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sl_category').setLabel('📂 קטגוריה: fivem / shop / minecraft / hosting / other').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
  );
  await interaction.showModal(modal);
}

// עיבוד מודאל הוספת שרת
async function handleSlAddModal(interaction, client) {
  const name       = interaction.fields.getTextInputValue('sl_name');
  const desc       = interaction.fields.getTextInputValue('sl_description');
  const link       = interaction.fields.getTextInputValue('sl_link');
  const ownerId    = interaction.fields.getTextInputValue('sl_owner_id').trim();
  const catRaw     = interaction.fields.getTextInputValue('sl_category').toLowerCase().trim();

  const validCats = Object.keys(CONFIG.CATEGORIES);
  const category = validCats.find(c => catRaw.includes(c)) || 'other';
  const cat = CONFIG.CATEGORIES[category];

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const channelName = `${cat.emoji}-${name.toLowerCase().replace(/[^a-z0-9א-ת]/g, '-').substring(0, 30)}`;

  // יצירת הערוץ בקטגוריה המתאימה
  let serverChannel;
  try {
    serverChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: cat.id,
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
        { id: CONFIG.TEAM_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
  } catch (e) {
    return interaction.followUp({ content: '❌ שגיאה ביצירת הערוץ. ודא שיש לבוט הרשאות מתאימות.', ephemeral: true });
  }

  const serverData = {
    channelId: serverChannel.id,
    ownerId: interaction.user.id,
    ownerMentionId: ownerId,
    name, description: desc, link, category,
    votes: 0,
    voters: {}, // userId -> timestamp
    createdAt: new Date().toISOString(),
    messageId: null,
  };
  DB.serverList[serverChannel.id] = serverData;

  // בניית embed השרת
  const serverEmbed = buildServerEmbed(serverData, cat, interaction.user);

  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sl_vote_${serverChannel.id}`).setLabel(`⬆️ הצבע (0)`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sl_report_${serverChannel.id}`).setLabel('🚩 דווח').setStyle(ButtonStyle.Danger),
  );

  const msg = await serverChannel.send({ embeds: [serverEmbed], components: [voteRow] });
  serverData.messageId = msg.id;

  // רול לבעל השרת
  if (CONFIG.SERVER_OWNER_ROLE_ID) {
    try { await interaction.member.roles.add(CONFIG.SERVER_OWNER_ROLE_ID); } catch {}
  }

  // לוג
  await sendLog(client, new EmbedBuilder()
    .setTitle('🌐 שרת חדש נוסף לרשימה')
    .addFields(
      { name: '🏷️ שם', value: name, inline: true },
      { name: '📂 קטגוריה', value: `${cat.emoji} ${cat.name}`, inline: true },
      { name: '👤 בעלים', value: `<@${interaction.user.id}>`, inline: true },
      { name: '🔗 קישור', value: link, inline: false },
      { name: '📍 ערוץ', value: `<#${serverChannel.id}>`, inline: true },
    ).setColor(cat.color).setTimestamp()
  );

  await interaction.followUp({
    embeds: [new EmbedBuilder()
      .setTitle('✅ השרת שלך נוסף בהצלחה!')
      .setDescription(`השרת **${name}** נוסף לקטגוריית **${cat.emoji} ${cat.name}**!\n\nערוץ השרת שלך: <#${serverChannel.id}>\n\n💡 כל אחד יכול להצביע לשרת שלך כדי שיעלה גבוה יותר ברשימה!`)
      .setColor(cat.color).setTimestamp()
    ], ephemeral: true
  });
}

// בניית embed לשרת
function buildServerEmbed(serverData, cat, ownerUser) {
  const embed = new EmbedBuilder()
    .setTitle(`${cat.emoji} ${serverData.name}`)
    .setDescription(
      `> ${serverData.description}\n\n` +
      `🔗 **קישור:** [לחץ להצטרפות](${serverData.link.startsWith('http') ? serverData.link : 'https://' + serverData.link})\n` +
      `👑 **בעלים:** <@${serverData.ownerMentionId}>\n` +
      `📂 **קטגוריה:** ${cat.emoji} ${cat.name}`
    )
    .setColor(cat.color)
    .addFields(
      { name: '⬆️ הצבעות', value: `**${serverData.votes}**`, inline: true },
      { name: '📅 נוסף', value: `<t:${Math.floor(new Date(serverData.createdAt).getTime() / 1000)}:R>`, inline: true },
      { name: '🆔 ערוץ', value: `<#${serverData.channelId}>`, inline: true },
    )
    .setFooter({ text: '⬆️ הצבע כדי לעזור לשרת זה לעלות • הצבעה אחת לכל 24 שעות' })
    .setTimestamp();
  if (ownerUser) embed.setAuthor({ name: ownerUser.tag, iconURL: ownerUser.displayAvatarURL() });
  return embed;
}

// טיפול בהצבעה
async function handleSlVote(interaction, client) {
  const channelId = interaction.customId.replace('sl_vote_', '');
  const serverData = DB.serverList[channelId];
  if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });

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

  // עדכון הודעה
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
  } catch {}

  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ הצבעתך נרשמה!').setDescription(`הצבעת לשרת **${serverData.name}**!\n\n⬆️ סה"כ הצבעות: **${serverData.votes}**`).setColor(0x57F287)], ephemeral: true });

  // לוג הצבעה
  if (CONFIG.VOTES_LOG_CHANNEL_ID) {
    try {
      const logCh = await client.channels.fetch(CONFIG.VOTES_LOG_CHANNEL_ID);
      const cat = CONFIG.CATEGORIES[serverData.category];
      await logCh.send({ embeds: [new EmbedBuilder()
        .setTitle('⬆️ הצבעה חדשה!')
        .addFields(
          { name: '🌐 שרת', value: serverData.name, inline: true },
          { name: '👤 מצביע', value: `<@${userId}>`, inline: true },
          { name: '⬆️ סה"כ', value: `${serverData.votes}`, inline: true },
          { name: '📂 קטגוריה', value: `${cat.emoji} ${cat.name}`, inline: true },
        ).setColor(cat.color).setTimestamp()
      ]});
    } catch {}
  }
}

// דיווח
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
  await sendLog(client, new EmbedBuilder()
    .setTitle('🚩 דיווח על שרת')
    .addFields(
      { name: '🌐 שרת מדווח', value: serverData ? serverData.name : channelId, inline: true },
      { name: '📍 ערוץ', value: `<#${channelId}>`, inline: true },
      { name: '👤 מדווח', value: `<@${interaction.user.id}>`, inline: true },
      { name: '📝 סיבה', value: reason },
    ).setColor(0xED4245).setTimestamp()
  );
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription('✅ הדיווח נשלח לצוות. תודה!').setColor(0x57F287)], ephemeral: true });
}

// צפייה בשרתים מובילים (מפאנל)
async function handleSlViewTop(interaction, client) {
  const top = Object.values(DB.serverList).sort((a, b) => b.votes - a.votes).slice(0, 10);
  if (top.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('אין שרתים ברשימה עדיין.').setColor(0x5865F2)], ephemeral: true });
  const desc = top.map((s, i) => {
    const cat = CONFIG.CATEGORIES[s.category];
    return `**${i + 1}.** ${cat.emoji} **${s.name}** — ⬆️ ${s.votes} הצבעות | <#${s.channelId}>`;
  }).join('\n');
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 השרתים המובילים').setDescription(desc).setColor(0xFFD700).setTimestamp()], ephemeral: true });
}

// עריכת שרת עצמי (מפאנל)
async function handleSlMyServer(interaction) {
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (!existing) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ אין לך שרת ברשימה. לחץ על ➕ הוסף את השרת שלך').setColor(0xED4245)], ephemeral: true });
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
  // עדכון הודעה
  try {
    const ch = await client.channels.fetch(existing.channelId);
    const msg = await ch.messages.fetch(existing.messageId);
    const cat = CONFIG.CATEGORIES[existing.category];
    await msg.edit({ embeds: [buildServerEmbed(existing, cat, interaction.user)] });
  } catch {}
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ השרת עודכן!').setDescription(`השרת **${existing.name}** עודכן בהצלחה!`).setColor(0x57F287)], ephemeral: true });
}

// ── פקודת /myserver ──
async function handleMyServerCommand(interaction, client) {
  const existing = Object.values(DB.serverList).find(s => s.ownerId === interaction.user.id);
  if (!existing) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ אין לך שרת ברשימה.\nהשתמש בפאנל כדי להוסיף אחד.').setColor(0xED4245)], ephemeral: true });
  const cat = CONFIG.CATEGORIES[existing.category];
  const embed = new EmbedBuilder()
    .setTitle(`✏️ ניהול השרת שלך — ${existing.name}`)
    .setDescription(`📂 קטגוריה: ${cat.emoji} ${cat.name}\n🔗 קישור: ${existing.link}\n⬆️ הצבעות: **${existing.votes}**\n📍 ערוץ: <#${existing.channelId}>`)
    .setColor(cat.color).setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sl_my_server').setLabel('✏️ ערוך פרטים').setStyle(ButtonStyle.Primary),
  );
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ── פקודות ניהול צוות ──
async function handleServerListCommand(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply({ content: '❌ רק צוות.', ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'addvote') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    serverData.votes++;
    await updateServerMessage(ch.id, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעה נוספה לשרת **${serverData.name}** (סה"כ: ${serverData.votes})`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'removevote') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    if (serverData.votes > 0) serverData.votes--;
    await updateServerMessage(ch.id, client);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעה הורדה מהשרת **${serverData.name}** (סה"כ: ${serverData.votes})`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'delete') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    const name = serverData.name;
    delete DB.serverList[ch.id];
    try { await ch.delete(); } catch {}
    await sendLog(client, new EmbedBuilder().setTitle('🗑️ שרת הוסר מהרשימה').addFields({ name: '🌐 שרת', value: name, inline: true }, { name: '👤 הוסר על ידי', value: `<@${interaction.user.id}>`, inline: true }).setColor(0xED4245).setTimestamp());
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ השרת **${name}** הוסר מהרשימה.`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'blacklist') {
    const user = interaction.options.getUser('user');
    DB.blacklisted.add(user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ <@${user.id}> נחסם מהוספת שרתים.`).setColor(0xED4245)], ephemeral: true });

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
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ הצבעות של **${serverData.name}** הוגדרו ל-**${votes}**`).setColor(0x57F287)], ephemeral: true });

  } else if (sub === 'info') {
    const ch = interaction.options.getChannel('channel');
    const serverData = DB.serverList[ch.id];
    if (!serverData) return interaction.reply({ content: '❌ שרת לא נמצא.', ephemeral: true });
    const cat = CONFIG.CATEGORIES[serverData.category];
    await interaction.reply({ embeds: [new EmbedBuilder()
      .setTitle(`📋 מידע: ${serverData.name}`)
      .addFields(
        { name: '📂 קטגוריה', value: `${cat.emoji} ${cat.name}`, inline: true },
        { name: '👤 בעלים', value: `<@${serverData.ownerId}>`, inline: true },
        { name: '🆔 ID בעלים מוצהר', value: serverData.ownerMentionId, inline: true },
        { name: '⬆️ הצבעות', value: `${serverData.votes}`, inline: true },
        { name: '📅 נוסף', value: `<t:${Math.floor(new Date(serverData.createdAt).getTime() / 1000)}:F>`, inline: true },
        { name: '🔗 קישור', value: serverData.link, inline: false },
        { name: '📝 תיאור', value: serverData.description.substring(0, 200), inline: false },
      ).setColor(cat.color).setTimestamp()
    ], ephemeral: true });

  } else if (sub === 'top') {
    const top = Object.values(DB.serverList).sort((a, b) => b.votes - a.votes).slice(0, 10);
    if (top.length === 0) return interaction.reply({ content: '❌ אין שרתים ברשימה.', ephemeral: true });
    const desc = top.map((s, i) => {
      const cat = CONFIG.CATEGORIES[s.category];
      return `**${i + 1}.** ${cat.emoji} **${s.name}** — ⬆️ ${s.votes} הצבעות | <#${s.channelId}>`;
    }).join('\n');
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 טופ שרתים').setDescription(desc).setColor(0xFFD700).setTimestamp()], ephemeral: true });
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
  } catch {}
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
});

// ═══════════════════════════════════════════════════════
//  INTERACTION HANDLER
// ═══════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  try {
    // ── Slash Commands ──
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;
      if (cmd === 'setup-tickets')        return setupTickets(interaction);
      if (cmd === 'setup-verify')         return setupVerify(interaction);
      if (cmd === 'broadcast')            return broadcast(interaction);
      if (cmd === 'dmall')                return dmAll(interaction, client);
      if (cmd === 'giveaway')             return createGiveaway(interaction);
      if (cmd === 'endgiveaway')          return endGiveawayCommand(interaction);
      if (cmd === 'antilink')             return handleAntiLinkCommand(interaction);
      if (cmd === 'posting')              return handlePosting(interaction);
      if (cmd === 'setup-serverlist')     return setupServerList(interaction);
      if (cmd === 'serverlist')           return handleServerListCommand(interaction, client);
      if (cmd === 'myserver')             return handleMyServerCommand(interaction, client);
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
      if (id === 'ticket_open')                                 return handleTicketOpen(interaction, client);
      if (['ticket_close','ticket_transcript','ticket_rename','ticket_claim'].includes(id)) return handleTicketAction(interaction, client);
      if (id === 'verify_start')                                return handleVerifyStart(interaction, client);
      if (id === 'giveaway_enter')                              return handleGiveawayEnter(interaction);
      if (id === 'sl_add_server')                               return handleSlAddServer(interaction);
      if (id === 'sl_view_top')                                 return handleSlViewTop(interaction, client);
      if (id === 'sl_my_server')                                return handleSlMyServer(interaction);
      if (id.startsWith('sl_vote_'))                           return handleSlVote(interaction, client);
      if (id.startsWith('sl_report_') && !id.includes('modal')) return handleSlReport(interaction);
    }

    // ── Select Menus ──
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_category')       return handleTicketCategory(interaction, client);
      if (id.startsWith('verify_answer_')) return handleVerifyAnswer(interaction, client);
    }

    // ── Modals ──
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id === 'ticket_rename_modal')   return handleTicketRenameModal(interaction);
      if (id === 'sl_add_modal')          return handleSlAddModal(interaction, client);
      if (id === 'sl_edit_modal')         return handleSlEditModal(interaction, client);
      if (id.startsWith('sl_report_modal_')) return handleSlReportModal(interaction, client);
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
client.on('guildMemberRemove',  (member)            => handleProtectedMemberRemove(member, client));
client.on('guildBanAdd',        (ban)               => handleProtectedBanAdd(ban, client));
client.on('guildBanRemove',     (ban)               => logBanRemove(ban, client));
client.on('messageDelete',      (msg)               => logMessageDelete(msg, client));
client.on('guildMemberUpdate',  (oldMember, newMember) => handleProtectedMemberUpdate(oldMember, newMember, client));
client.on('channelDelete',      (channel)           => handleChannelDelete(channel, client));
client.on('roleDelete',         (role)              => handleRoleDelete(role, client));
client.on('messageCreate',      (message)           => handleAntiLink(message, client));

// ═══════════════════════════════════════════════════════
//  DEPLOY
// ═══════════════════════════════════════════════════════
async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  console.log('🔄 Deploying slash commands...');
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: COMMANDS.map(c => c.toJSON()) });
  console.log('✅ Deployed!');
}

if (process.argv.includes('--deploy')) {
  deployCommands().then(() => process.exit(0)).catch(console.error);
} else {
  client.login(CONFIG.TOKEN);
}
