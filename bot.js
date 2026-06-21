const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is up and running!');
});

app.listen(PORT, () => {
console.log('Server listening on port ${PORT}');
});

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Collection, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder,
  ActivityType, AuditLogEvent
} = require('discord.js');

const CONFIG = {
  TOKEN:              process.env.BOT_TOKEN          || '',
  CLIENT_ID:          process.env.CLIENT_ID          || '1501915415356510299',
  GUILD_ID:           process.env.GUILD_ID           || '1489033656487121077',
  TEAM_ROLE_ID:       process.env.TEAM_ROLE_ID       || '1489313397462798518',
  VERIFIED_ROLE_ID:   process.env.VERIFIED_ROLE_ID   || '1513574669436059841',
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || '1497538017538347069',
  LOG_CHANNEL_ID:     process.env.LOG_CHANNEL_ID     || '1514300287605801102',
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || '1495059280242675916',
};

const DB = {
  tickets:   {},
  giveaways: {},
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
  WINDOW_MS: 8000,
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
//  SYSTEM 13 — ANTI-LINK
// ═══════════════════════════════════════════════════════
const ANTI_LINK = {
  enabled: true,

  // ערוצים שמותר בהם לשלוח לינקים — הוסף Channel IDs לפי הצורך
  allowedChannels: [],

  // רולים פטורים מהמערכת (צוות פטור אוטומטית דרך isExempt)
  exemptRoles: [
    process.env.TEAM_ROLE_ID || '1489313397462798518',
  ],

  // תבניות לזיהוי לינקים
  patterns: [
    /https?:\/\//i,
    /discord\.gg\/[a-zA-Z0-9]+/i,
    /discord\.com\/invite\/[a-zA-Z0-9]+/i,
    /www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}/i,
    /[a-zA-Z0-9\-]+\.(com|net|org|io|gg|xyz|me|co|dev|app|ly|link|site|online|store|shop|info|biz|tv|cc|vc|tk|ml|ga|cf|gq)/i,
  ],

  // ניהול אזהרות לפי משתמש
  warnings: {},
  MAX_WARNINGS: 3,
  WARN_RESET_MS: 60 * 60 * 1000, // איפוס אזהרות אחרי שעה
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
  if (!ANTI_LINK.warnings[userId]) {
    ANTI_LINK.warnings[userId] = { count: 0, firstAt: now };
  }
  // איפוס אם עברה שעה מאז האזהרה הראשונה
  if (now - ANTI_LINK.warnings[userId].firstAt > ANTI_LINK.WARN_RESET_MS) {
    ANTI_LINK.warnings[userId] = { count: 0, firstAt: now };
  }
  ANTI_LINK.warnings[userId].count++;
  return ANTI_LINK.warnings[userId].count;
}

async function handleAntiLink(message, client) {
  if (!ANTI_LINK.enabled) return;
  if (!message.guild) return;
  if (message.author.bot) return;

  // ערוץ פטור?
  if (ANTI_LINK.allowedChannels.includes(message.channelId)) return;

  // משתמש פטור?
  if (isExempt(message.member)) return;

  if (!hasLink(message.content)) return;

  // מחק את ההודעה
  try { await message.delete(); } catch {}

  const warns = addLinkWarning(message.author.id);

  if (warns >= ANTI_LINK.MAX_WARNINGS) {
    // Timeout של 10 דקות לאחר חריגה
    try {
      await message.member.timeout(10 * 60 * 1000, '🛡️ אנטי-לינק: חריגה ממגבלת אזהרות');
    } catch {}

    // איפוס אזהרות לאחר ה-timeout
    ANTI_LINK.warnings[message.author.id] = { count: 0, firstAt: Date.now() };

    try {
      const warn = await message.channel.send({
        content: `<@${message.author.id}>`,
        embeds: [new EmbedBuilder()
          .setTitle('🔇 קיבלת עצירה זמנית!')
          .setDescription(
            `<@${message.author.id}> קיבלת **timeout של 10 דקות** בגלל שליחת לינקים חוזרת.\n\n` +
            `⚠️ שליחת לינקים אינה מותרת בשרת זה.`
          )
          .setColor(0xED4245)
          .setTimestamp()
        ]
      });
      setTimeout(() => warn.delete().catch(() => {}), 8000);
    } catch {}

    await sendLog(client, new EmbedBuilder()
      .setTitle('🛡️ אנטי-לינק: Timeout הוטל')
      .addFields(
        { name: '👤 משתמש', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: '📍 ערוץ', value: `<#${message.channelId}>`, inline: true },
        { name: '📝 תוכן שנמחק', value: message.content.slice(0, 300) },
        { name: '⚡ פעולה', value: 'הודעה נמחקה + timeout 10 דקות', inline: false },
      )
      .setColor(0xED4245).setTimestamp()
    );

  } else {
    // אזהרה רגילה
    try {
      const warn = await message.channel.send({
        content: `<@${message.author.id}>`,
        embeds: [new EmbedBuilder()
          .setTitle('🔗 שליחת לינקים אסורה!')
          .setDescription(
            `<@${message.author.id}> הודעתך נמחקה.\n\n` +
            `⚠️ **אזהרה ${warns}/${ANTI_LINK.MAX_WARNINGS}** — שליחת לינקים אינה מותרת בשרת זה.\n` +
            `לאחר ${ANTI_LINK.MAX_WARNINGS} אזהרות תקבל timeout של 10 דקות.`
          )
          .setColor(0xFEE75C)
          .setTimestamp()
        ]
      });
      setTimeout(() => warn.delete().catch(() => {}), 6000);
    } catch {}

    await sendLog(client, new EmbedBuilder()
      .setTitle('🔗 אנטי-לינק: לינק נמחק')
      .addFields(
        { name: '👤 משתמש', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: '📍 ערוץ', value: `<#${message.channelId}>`, inline: true },
        { name: '⚠️ אזהרות', value: `${warns}/${ANTI_LINK.MAX_WARNINGS}`, inline: true },
        { name: '📝 תוכן שנמחק', value: message.content.slice(0, 300) },
      )
      .setColor(0xFEE75C).setTimestamp()
    );
  }
}

// ═══════════════════════════════════════════════════════
//  SLASH COMMANDS
// ═══════════════════════════════════════════════════════
const COMMANDS = [
  new SlashCommandBuilder().setName('setup-tickets')
    .setDescription('📩 שלח את פאנל הטיקטים [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('setup-verify')
    .setDescription('✅ שלח את פאנל האימות [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('broadcast')
    .setDescription('📢 שלח הודעה מהבוט [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('ההודעה').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת (אופציונלי)'))
    .addStringOption(o => o.setName('color').setDescription('צבע hex')),
  new SlashCommandBuilder().setName('dmall')
    .setDescription('📨 שלח הודעה פרטית לכל חברי השרת [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('message').setDescription('תוכן ההודעה').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת (אופציונלי)')),
  new SlashCommandBuilder().setName('giveaway')
    .setDescription('🎉 צור הגרלה [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prize').setDescription('הפרס').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('זוכים').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('דקות').setRequired(true)),
  new SlashCommandBuilder().setName('endgiveaway')
    .setDescription('🏆 סיים הגרלה [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('messageid').setDescription('ID הודעה').setRequired(true)),

  // ── Anti-Link Management ──
  new SlashCommandBuilder().setName('antilink')
    .setDescription('🔗 ניהול מערכת אנטי-לינק [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('toggle')
      .setDescription('הפעל או כבה את המערכת')
      .addBooleanOption(o => o.setName('enabled').setDescription('true = פעיל | false = כבוי').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('allow-channel')
      .setDescription('הוסף ערוץ שמותר בו לינקים')
      .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove-channel')
      .setDescription('הסר ערוץ מרשימת הפטורים')
      .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('הצג את סטטוס המערכת הנוכחי'))
    .addSubcommand(sub => sub
      .setName('clearwarnings')
      .setDescription('אפס אזהרות של משתמש מסוים')
      .addUserOption(o => o.setName('user').setDescription('המשתמש').setRequired(true))),
];

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function isTeam(member) {
  return member.roles.cache.has(CONFIG.TEAM_ROLE_ID) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}
function timestamp() { return `<t:${Math.floor(Date.now() / 1000)}:F>`; }
function randomId(len = 6) { return Math.random().toString(36).substring(2, 2 + len).toUpperCase(); }

async function sendLog(client, embed) {
  try {
    const ch = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
    if (ch) ch.send({ embeds: [embed] });
  } catch {}
}

// ═══════════════════════════════════════════════════════
//  ANTI-LINK SLASH COMMAND HANDLER
// ═══════════════════════════════════════════════════════
async function handleAntiLinkCommand(interaction) {
  if (!isTeam(interaction.member)) {
    return interaction.reply({ content: '❌ רק צוות יכול לנהל את המערכת.', ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'toggle') {
    ANTI_LINK.enabled = interaction.options.getBoolean('enabled');
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🔗 אנטי-לינק — עדכון מצב')
        .setDescription(`המערכת כעת: **${ANTI_LINK.enabled ? '✅ פעילה' : '❌ כבויה'}**`)
        .setColor(ANTI_LINK.enabled ? 0x57F287 : 0xED4245)
        .setTimestamp()
      ], ephemeral: true
    });

  } else if (sub === 'allow-channel') {
    const ch = interaction.options.getChannel('channel');
    if (ANTI_LINK.allowedChannels.includes(ch.id)) {
      return interaction.reply({ content: '⚠️ הערוץ כבר נמצא ברשימת הפטורים.', ephemeral: true });
    }
    ANTI_LINK.allowedChannels.push(ch.id);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setDescription(`✅ הערוץ <#${ch.id}> נוסף לרשימת הפטורים — לינקים מותרים שם.`)
        .setColor(0x57F287)
      ], ephemeral: true
    });

  } else if (sub === 'remove-channel') {
    const ch = interaction.options.getChannel('channel');
    ANTI_LINK.allowedChannels = ANTI_LINK.allowedChannels.filter(id => id !== ch.id);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setDescription(`✅ הערוץ <#${ch.id}> הוסר מרשימת הפטורים.`)
        .setColor(0x57F287)
      ], ephemeral: true
    });

  } else if (sub === 'status') {
    const allowedList = ANTI_LINK.allowedChannels.length > 0
      ? ANTI_LINK.allowedChannels.map(id => `<#${id}>`).join('\n')
      : 'אין ערוצים פטורים';
    const exemptList = ANTI_LINK.exemptRoles.map(id => `<@&${id}>`).join(', ');
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🔗 סטטוס מערכת אנטי-לינק')
        .addFields(
          { name: '⚡ מצב', value: ANTI_LINK.enabled ? '✅ פעיל' : '❌ כבוי', inline: true },
          { name: '⚠️ מקסימום אזהרות לפני timeout', value: `${ANTI_LINK.MAX_WARNINGS}`, inline: true },
          { name: '⏳ איפוס אזהרות אחרי', value: '1 שעה', inline: true },
          { name: '📢 ערוצים פטורים', value: allowedList },
          { name: '🛡️ רולים פטורים', value: exemptList },
        )
        .setColor(0x5865F2).setTimestamp()
      ], ephemeral: true
    });

  } else if (sub === 'clearwarnings') {
    const user = interaction.options.getUser('user');
    delete ANTI_LINK.warnings[user.id];
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setDescription(`✅ אזהרות האנטי-לינק של <@${user.id}> אופסו.`)
        .setColor(0x57F287)
      ], ephemeral: true
    });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 1 — TICKETS
// ═══════════════════════════════════════════════════════
async function setupTickets(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 פתח טיקט תמיכה')
    .setDescription('לחץ על הכפתור למטה כדי לפתוח טיקט.\nהצוות שלנו יחזור אליך בהקדם האפשרי.')
    .setColor(0x5865F2)
    .setThumbnail(interaction.guild.iconURL())
    .setFooter({ text: 'VOrino Support System' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_open').setLabel('📩 פתח טיקט').setStyle(ButtonStyle.Primary)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ פאנל הטיקטים נשלח!', ephemeral: true });
}

async function handleTicketOpen(interaction, client) {
  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_category')
      .setPlaceholder('📂 בחר קטגוריה')
      .addOptions([
        { label: '💬 שאלה כללית', value: 'general', emoji: '💬' },
        { label: '🛒 קניה', value: 'purchase', emoji: '🛒' },
        { label: '🎁 קבלת פרס', value: 'prize', emoji: '🎁' },
      ])
  );
  await interaction.reply({
    embeds: [new EmbedBuilder().setTitle('📂 בחר קטגוריה').setDescription('בחר את הקטגוריה המתאימה.').setColor(0x5865F2)],
    components: [menu],
    ephemeral: true
  });
}

async function handleTicketCategory(interaction, client) {
  const category = interaction.values[0];
  const categoryNames = { general: '💬 שאלה כללית', purchase: '🛒 קניה', prize: '🎁 קבלת פרס' };
  const guild = interaction.guild;
  const user = interaction.user;
  await interaction.deferUpdate();

  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${randomId(4)}`;
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
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
    embeds: [new EmbedBuilder()
      .setTitle(`🎫 טיקט — ${categoryNames[category]}`)
      .setDescription(`פתוח על ידי <@${user.id}>\n📅 ${timestamp()}\n\nשלום <@${user.id}>! הצוות יגיע אליך בקרוב.`)
      .setColor(0x57F287).setThumbnail(user.displayAvatarURL()).setFooter({ text: `ID: ${ticketChannel.id}` })
    ],
    components: [teamRow]
  });

  await interaction.followUp({
    embeds: [new EmbedBuilder().setDescription(`✅ הטיקט שלך נפתח! <#${ticketChannel.id}>`).setColor(0x57F287)],
    ephemeral: true
  });

  await sendLog(client, new EmbedBuilder()
    .setTitle('🎫 טיקט נפתח')
    .addFields(
      { name: 'משתמש', value: `<@${user.id}>`, inline: true },
      { name: 'קטגוריה', value: categoryNames[category], inline: true },
      { name: 'ערוץ', value: `<#${ticketChannel.id}>`, inline: true },
    ).setColor(0x5865F2).setTimestamp()
  );
}

async function handleTicketAction(interaction, client) {
  const action = interaction.customId;
  const channel = interaction.channel;
  const ticket = DB.tickets[channel.id];

  if (!isTeam(interaction.member)) {
    return interaction.reply({ content: '❌ רק צוות יכול לבצע פעולה זו.', ephemeral: true });
  }

  if (action === 'ticket_close') {
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription('🔒 הטיקט נסגר תוך 5 שניות...').setColor(0xED4245)] });
    await sendLog(client, new EmbedBuilder()
      .setTitle('🔒 טיקט נסגר')
      .addFields(
        { name: 'ערוץ', value: channel.name, inline: true },
        { name: 'סגור על ידי', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'פתוח על ידי', value: ticket ? `<@${ticket.userId}>` : 'לא ידוע', inline: true },
      ).setColor(0xED4245).setTimestamp()
    );
    setTimeout(() => channel.delete().catch(() => {}), 5000);

  } else if (action === 'ticket_transcript') {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();
    let text = `=== Transcript: ${channel.name} ===\nDate: ${new Date().toISOString()}\n\n`;
    sorted.forEach(m => {
      text += `[${new Date(m.createdTimestamp).toLocaleString('he-IL')}] ${m.author.tag}: ${m.content || '[embed/attachment]'}\n`;
    });
    const att = new AttachmentBuilder(Buffer.from(text, 'utf-8'), { name: `transcript-${channel.name}.txt` });
    if (ticket) {
      try { const u = await client.users.fetch(ticket.userId); await u.send({ content: '📄 הטרנסקריפט של הטיקט שלך:', files: [att] }); } catch {}
    }
    await interaction.reply({ content: '✅ הטרנסקריפט נשלח.', files: [att], ephemeral: true });

  } else if (action === 'ticket_rename') {
    const modal = new ModalBuilder().setCustomId('ticket_rename_modal').setTitle('✏️ שנה שם טיקט');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('new_name').setLabel('שם חדש').setStyle(TextInputStyle.Short).setRequired(true)
    ));
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
    .setColor(0x57F287)
    .setThumbnail(interaction.guild.iconURL())
    .addFields({ name: '📋 שאלת אימות', value: 'תענה על שאלה קצרה להוכחת אנושיות.' })
    .setFooter({ text: 'VOrino Verification System' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_start').setLabel('✅ אמת אותי').setStyle(ButtonStyle.Success)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ פאנל האימות נשלח!', ephemeral: true });
}

async function handleVerifyStart(interaction, client) {
  if (interaction.member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
    return interaction.reply({ content: '✅ אתה כבר מאומת!', ephemeral: true });
  }
  const questions = [
    { q: 'מה צבע הרקיע ביום?', a: 'כחול', options: ['כחול', 'אדום', 'ירוק', 'צהוב'] },
    { q: 'כמה יש ב 2 + 2?', a: '4', options: ['3', '4', '5', '6'] },
    { q: 'מה הוא הפרי הצהוב?', a: 'בננה', options: ['תפוח', 'ענב', 'בננה', 'תות'] },
  ];
  const picked = questions[Math.floor(Math.random() * questions.length)];
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`verify_answer_${picked.a}`)
    .setPlaceholder('בחר תשובה...')
    .addOptions(picked.options.map(opt => ({ label: opt, value: opt })));
  await interaction.reply({
    embeds: [new EmbedBuilder().setTitle('🔐 שאלת אימות').setDescription(`**${picked.q}**\n\nבחר את התשובה הנכונה:`).setColor(0x5865F2)],
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

async function handleVerifyAnswer(interaction, client) {
  const correctAnswer = interaction.customId.replace('verify_answer_', '');
  const chosen = interaction.values[0];
  if (chosen !== correctAnswer) {
    return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ תשובה שגויה! נסה שוב.').setColor(0xED4245)], ephemeral: true });
  }
  try { await interaction.member.roles.add(CONFIG.VERIFIED_ROLE_ID); } catch {}
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('✅ אומת בהצלחה!')
      .setDescription(`ברוך הבא, <@${interaction.user.id}>!\nיש לך כעת גישה מלאה 🎉`)
      .setColor(0x57F287).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()
    ],
    ephemeral: true
  });
  await sendLog(client, new EmbedBuilder()
    .setTitle('✅ משתמש אומת').setDescription(`<@${interaction.user.id}> עבר אימות.`).setColor(0x57F287).setTimestamp()
  );
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
      .setColor(0x5865F2)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📅 הצטרף ב', value: timestamp(), inline: true },
        { name: '👥 חברי שרת', value: `${guild.memberCount}`, inline: true },
        { name: '🏷️ תגית', value: member.user.tag, inline: true },
      )
      .setFooter({ text: `VOrino • ${guild.name}`, iconURL: guild.iconURL() })
      .setTimestamp();
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

  const embed = new EmbedBuilder()
    .setDescription(message)
    .setColor(color)
    .setFooter({ text: 'VOrino', iconURL: interaction.guild.iconURL() })
    .setTimestamp();
  if (title) embed.setTitle(title);

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: `✅ ההודעה נשלחה ל<#${channel.id}>`, ephemeral: true });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 5.5 — DM-ALL
// ═══════════════════════════════════════════════════════
async function dmAll(interaction, client) {
  if (!isTeam(interaction.member)) {
    return interaction.reply({ content: '❌ רק צוות יכול להשתמש בפקודה זו.', ephemeral: true });
  }

  const message = interaction.options.getString('message');
  const title = interaction.options.getString('title');

  await interaction.reply({ content: '📨 שולח הודעות... זה עלול לקחת זמן.', ephemeral: true });

  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const members = await guild.members.fetch();

    let success = 0;
    let failed = 0;

    const embed = new EmbedBuilder()
      .setDescription(message)
      .setColor(0x5865F2)
      .setFooter({ text: `הודעה מצוות ${guild.name}`, iconURL: guild.iconURL() })
      .setTimestamp();
    if (title) embed.setTitle(title);

    for (const [, member] of members) {
      if (member.user.bot) continue;
      try {
        await member.send({ embeds: [embed] });
        success++;
        await new Promise(r => setTimeout(r, 500));
      } catch {
        failed++;
      }
    }

    await sendLog(client, new EmbedBuilder()
      .setTitle('📨 DM-All נשלח')
      .addFields(
        { name: '✅ נשלח', value: `${success}`, inline: true },
        { name: '❌ נכשל', value: `${failed}`, inline: true },
        { name: '👤 נשלח על ידי', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📝 תוכן', value: message.slice(0, 200) },
      )
      .setColor(0x5865F2).setTimestamp()
    );

    await interaction.followUp({
      content: `✅ הסתיים! נשלח ל-**${success}** משתמשים | נכשל עבור **${failed}**`,
      ephemeral: true
    });
  } catch (e) {
    console.error('DM-All error:', e);
    await interaction.followUp({ content: '❌ שגיאה בשליחת ההודעות.', ephemeral: true });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 7 — LOGS
// ═══════════════════════════════════════════════════════
async function logMemberAdd(member, client) {
  await sendLog(client, new EmbedBuilder()
    .setTitle('📥 חבר הצטרף')
    .setDescription(`<@${member.id}> הצטרף לשרת.`)
    .addFields(
      { name: '👤 שם', value: member.user.tag, inline: true },
      { name: '🆔 ID', value: member.id, inline: true },
      { name: '📅 נוצר ב', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setThumbnail(member.user.displayAvatarURL()).setColor(0x57F287).setTimestamp()
  );
}

async function logMemberRemove(member, client) {
  await sendLog(client, new EmbedBuilder()
    .setTitle('📤 חבר עזב').setDescription(`**${member.user?.tag || member.id}** עזב.`)
    .addFields({ name: '🆔 ID', value: member.id, inline: true }).setColor(0xED4245).setTimestamp()
  );
}

async function logBanAdd(ban, client) {
  await sendLog(client, new EmbedBuilder()
    .setTitle('🔨 באן').setDescription(`<@${ban.user.id}> קיבל באן.`)
    .addFields({ name: '👤 משתמש', value: ban.user.tag, inline: true }, { name: '📝 סיבה', value: ban.reason || 'לא צוינה', inline: true })
    .setThumbnail(ban.user.displayAvatarURL()).setColor(0xED4245).setTimestamp()
  );
}

async function logBanRemove(ban, client) {
  await sendLog(client, new EmbedBuilder()
    .setTitle('🔓 באן הוסר').setDescription(`<@${ban.user.id}> הוסר מהבאן.`).setColor(0x57F287).setTimestamp()
  );
}

async function logMessageDelete(msg, client) {
  if (!msg.author || msg.author.bot) return;
  await sendLog(client, new EmbedBuilder()
    .setTitle('🗑️ הודעה נמחקה')
    .addFields(
      { name: '👤 שולח', value: `<@${msg.author.id}>`, inline: true },
      { name: '📍 ערוץ', value: `<#${msg.channelId}>`, inline: true },
      { name: '📝 תוכן', value: msg.content || '[ריק / embed]' },
    ).setColor(0xFEE75C).setTimestamp()
  );
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 10 — ACTIVITY STATUS
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
    } catch (err) {
      console.error('שגיאה בעדכון הסטטוס:', err);
    }
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
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 השתתף').setStyle(ButtonStyle.Primary)
  );
  const msg = await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🎉 הגרלה!').setDescription(`**${prize}**\n\n🏆 זוכים: **${winners}**\n⏰ מסתיים: <t:${Math.floor(endTime / 1000)}:R>\n\nלחץ להשתתפות!`)
      .setColor(0x5865F2).setFooter({ text: `מסתיים: ${new Date(endTime).toLocaleString('he-IL')}` }).setTimestamp()
    ],
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
  await interaction.message.edit({
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 השתתף (${giveaway.entries.length})`).setStyle(ButtonStyle.Primary)
    )]
  }).catch(() => {});
}

async function endGiveawayAuto(msgId, channel, client) {
  const giveaway = DB.giveaways[msgId];
  if (!giveaway || giveaway.ended) return;
  giveaway.ended = true;
  const entries = [...giveaway.entries];
  if (entries.length === 0) {
    return channel.send({ embeds: [new EmbedBuilder().setTitle('🎉 הגרלה הסתיימה').setDescription(`אף אחד לא נרשם על **${giveaway.prize}**.`).setColor(0xED4245).setTimestamp()] });
  }
  const winnerIds = [];
  const pool = [...entries];
  const count = Math.min(giveaway.winners, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winnerIds.push(pool.splice(idx, 1)[0]);
  }
  const winnerMentions = winnerIds.map(id => `<@${id}>`).join(', ');
  await channel.send({ content: winnerMentions, embeds: [new EmbedBuilder()
    .setTitle('🏆 זוכי ההגרלה!').setDescription(`**פרס:** ${giveaway.prize}\n\n🎊 **זוכים:** ${winnerMentions}`).setColor(0xFEE75C).setTimestamp()
  ]});
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
    const entry = auditLogs.entries.find(e =>
      e.target?.id === member.id && Date.now() - e.createdTimestamp < 10000
    );

    if (entry) {
      const executor = entry.executor;
      if (executor && executor.id !== owner.id) {
        try { await member.kick('🛡️ הגנת שרת: הוספת בוט לא מורשה'); } catch {}
        try {
          await guild.bans.create(executor.id, { reason: '🛡️ הגנת שרת: ניסיון הוספת בוט לא מורשה' });
        } catch {}

        await sendLog(client, new EmbedBuilder()
          .setTitle('🛡️ הגנה: ניסיון הוספת בוט')
          .addFields(
            { name: '🤖 בוט שנוסף', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: '👤 מי ניסה', value: `<@${executor.id}> (${executor.tag})`, inline: true },
            { name: '⚡ פעולה', value: 'בוט הוסר + המשתמש בוין', inline: false },
          )
          .setColor(0xED4245).setTimestamp()
        );
        return;
      }
    }
  } catch (e) {
    console.error('Bot add protection error:', e);
  }

  await sendLog(client, new EmbedBuilder()
    .setTitle('🤖 בוט נוסף')
    .setDescription(`${member.user.tag} נוסף על ידי האוונר.`)
    .setColor(0xFEE75C).setTimestamp()
  );
}

async function handleChannelDelete(channel, client) {
  const guild = channel.guild;
  if (!guild) return;

  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 5 });
    const entry = auditLogs.entries.find(e =>
      e.target?.id === channel.id && Date.now() - e.createdTimestamp < 8000
    );
    if (!entry) return;

    const executor = entry.executor;
    const owner = await guild.fetchOwner();
    if (executor.id === owner.id || executor.id === client.user.id) return;

    const count = recordAction(PROTECT.channelDeletes, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנת שרת: מחיקת ערוצים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder()
        .setTitle('🛡️ הגנה: מחיקת ערוצים ברצף')
        .addFields(
          { name: '👤 ביצע', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: '📊 כמות', value: `${count} ערוצים ב-8 שניות`, inline: true },
          { name: '⚡ פעולה', value: 'משתמש בוין', inline: false },
        )
        .setColor(0xED4245).setTimestamp()
      );
    }
  } catch (e) { console.error('Channel delete protection error:', e); }
}

async function handleRoleDelete(role, client) {
  const guild = role.guild;
  if (!guild) return;

  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 5 });
    const entry = auditLogs.entries.find(e =>
      e.target?.id === role.id && Date.now() - e.createdTimestamp < 8000
    );
    if (!entry) return;

    const executor = entry.executor;
    const owner = await guild.fetchOwner();
    if (executor.id === owner.id || executor.id === client.user.id) return;

    const count = recordAction(PROTECT.roleDeletes, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנת שרת: מחיקת רולים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder()
        .setTitle('🛡️ הגנה: מחיקת רולים ברצף')
        .addFields(
          { name: '👤 ביצע', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: '📊 כמות', value: `${count} רולים ב-8 שניות`, inline: true },
          { name: '⚡ פעולה', value: 'משתמש בוין', inline: false },
        )
        .setColor(0xED4245).setTimestamp()
      );
    }
  } catch (e) { console.error('Role delete protection error:', e); }
}

async function handleProtectedMemberUpdate(oldMember, newMember, client) {
  const guild = newMember.guild;
  const owner = await guild.fetchOwner().catch(() => null);

  const wasTimedOut = !oldMember.communicationDisabledUntil;
  const isTimedOut = !!newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date();

  if (wasTimedOut && isTimedOut) {
    await sendLog(client, new EmbedBuilder()
      .setTitle('⏳ Timeout')
      .setDescription(`<@${newMember.id}> קיבל timeout עד: <t:${Math.floor(newMember.communicationDisabledUntil / 1000)}:F>`)
      .setColor(0xFEE75C).setTimestamp()
    );

    try {
      await new Promise(r => setTimeout(r, 1000));
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 });
      const entry = auditLogs.entries.find(e =>
        e.target?.id === newMember.id && Date.now() - e.createdTimestamp < 8000
      );
      if (!entry) return;
      const executor = entry.executor;
      if (!owner || executor.id === owner.id || executor.id === client.user.id) return;

      const count = recordAction(PROTECT.timeouts, executor.id);
      if (count > PROTECT.MAX_ACTIONS) {
        try { await guild.bans.create(executor.id, { reason: '🛡️ הגנת שרת: timeout ברצף' }); } catch {}
        await sendLog(client, new EmbedBuilder()
          .setTitle('🛡️ הגנה: טיימאוטים ברצף')
          .addFields(
            { name: '👤 ביצע', value: `<@${executor.id}> (${executor.tag})`, inline: true },
            { name: '📊 כמות', value: `${count} ב-8 שניות`, inline: true },
            { name: '⚡ פעולה', value: 'משתמש בוין', inline: false },
          ).setColor(0xED4245).setTimestamp()
        );
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
    const entry = auditLogs.entries.find(e =>
      e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 8000
    );
    if (!entry) return;
    const executor = entry.executor;
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner || executor.id === owner.id || executor.id === client.user.id) return;

    const count = recordAction(PROTECT.bans, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנת שרת: באנים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder()
        .setTitle('🛡️ הגנה: באנים ברצף')
        .addFields(
          { name: '👤 ביצע', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: '📊 כמות', value: `${count} ב-8 שניות`, inline: true },
          { name: '⚡ פעולה', value: 'משתמש בוין', inline: false },
        ).setColor(0xED4245).setTimestamp()
      );
    }
  } catch {}
}

async function handleProtectedMemberRemove(member, client) {
  await logMemberRemove(member, client);

  const guild = member.guild;
  try {
    await new Promise(r => setTimeout(r, 1000));
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
    const entry = auditLogs.entries.find(e =>
      e.target?.id === member.id && Date.now() - e.createdTimestamp < 8000
    );
    if (!entry) return;
    const executor = entry.executor;
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner || executor.id === owner.id || executor.id === client.user.id) return;

    const count = recordAction(PROTECT.kicks, executor.id);
    if (count > PROTECT.MAX_ACTIONS) {
      try { await guild.bans.create(executor.id, { reason: '🛡️ הגנת שרת: קיקים ברצף' }); } catch {}
      await sendLog(client, new EmbedBuilder()
        .setTitle('🛡️ הגנה: קיקים ברצף')
        .addFields(
          { name: '👤 ביצע', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: '📊 כמות', value: `${count} ב-8 שניות`, inline: true },
          { name: '⚡ פעולה', value: 'משתמש בוין', inline: false },
        ).setColor(0xED4245).setTimestamp()
      );
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════
//  CLIENT SETUP
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
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;
      if (cmd === 'setup-tickets') return setupTickets(interaction);
      if (cmd === 'setup-verify') return setupVerify(interaction);
      if (cmd === 'broadcast') return broadcast(interaction);
      if (cmd === 'dmall') return dmAll(interaction, client);
      if (cmd === 'giveaway') return createGiveaway(interaction);
      if (cmd === 'endgiveaway') return endGiveawayCommand(interaction);
      if (cmd === 'antilink') return handleAntiLinkCommand(interaction);
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'ticket_open') return handleTicketOpen(interaction, client);
      if (['ticket_close','ticket_transcript','ticket_rename','ticket_claim'].includes(id)) return handleTicketAction(interaction, client);
      if (id === 'verify_start') return handleVerifyStart(interaction, client);
      if (id === 'giveaway_enter') return handleGiveawayEnter(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_category') return handleTicketCategory(interaction, client);
      if (id.startsWith('verify_answer_')) return handleVerifyAnswer(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id === 'ticket_rename_modal') return handleTicketRenameModal(interaction);
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
  if (member.user.bot) {
    await handleGuildMemberAdd(member, client);
  } else {
    handleWelcome(member, client);
    logMemberAdd(member, client);
  }
});

client.on('guildMemberRemove', (member) => handleProtectedMemberRemove(member, client));
client.on('guildBanAdd', (ban) => handleProtectedBanAdd(ban, client));
client.on('guildBanRemove', (ban) => logBanRemove(ban, client));
client.on('messageDelete', (msg) => logMessageDelete(msg, client));
client.on('guildMemberUpdate', (oldMember, newMember) => handleProtectedMemberUpdate(oldMember, newMember, client));
client.on('channelDelete', (channel) => handleChannelDelete(channel, client));
client.on('roleDelete', (role) => handleRoleDelete(role, client));

// ═══════════════════════════════════════════════════════
//  SYSTEM 13 — ANTI-LINK: מאזין להודעות
// ═══════════════════════════════════════════════════════
client.on('messageCreate', (message) => handleAntiLink(message, client));

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
