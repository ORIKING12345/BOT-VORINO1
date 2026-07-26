/**
 * ==========================================================================
 *  PURPLE BOT — בוט דיסקורד מקצועי בסגנון סגול
 * ==========================================================================
 *  מערכות כלולות:
 *   1. מערכת טיקטים משוכללת (בחירת סוג טיקט, פאנל שליטה, לקיחת טיקט + הודעה
 *      נבחרת, סגירה עם טרנסקריפט)
 *   2. מערכת אימות בכפתור (רול מיידי)
 *   3. מערכת הגרלות (כפתור כניסה, ספירת משתתפים, בחירת זוכים אוטומטית)
 *   4. מערכת סטטוס שרת FiveM (!status) + חיפוש שחקן (/player-info)
 *   5. מערכת לוגים מלאה (באנים, טיימאאוטים, קיקים, כניסה/יציאה, אימות)
 *   6. מודרציה בסיסית + אבטחה (אנטי-לינק, אנטי-ספאם)
 *   7. סטטוס בוט דינמי לפי כמות משתמשים בשרת ה-FiveM
 * ==========================================================================
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType,
  AttachmentBuilder,
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');

// --------------------------------------------------------------------------
// שרת HTTP קטן — נדרש כדי שרנדר (Render) יזהה את השירות כ-"Web Service" חי.
// רנדר בודק פינג על הפורט הזה כדי לוודא שהתהליך לא קרס.
// --------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      client.isReady && client.isReady()
        ? `✅ Purple Bot מחובר בתור ${client.user.tag}\n`
        : '🔄 הבוט עולה כרגע...\n'
    );
  })
  .listen(PORT, () => console.log(`🌐 HTTP keepalive server מאזין על פורט ${PORT}`));

// ==========================================================================
// הגדרות (CONFIG) — ה-IDs נטענים ממשתני סביבה (Render → Environment) כשהם
// רגישים (טוקן), והשאר מוגדרים ישירות. אפשר לשנות הכל כאן.
// ==========================================================================
const config = {
  "token": process.env.BOT_TOKEN,
  "clientId": process.env.CLIENT_ID || "1520769665494679703",
  "guildId": process.env.GUILD_ID || "1489033656487121077",
  "prefix": "!",

  "colors": {
    "primary": "#9B59B6",
    "dark": "#6C3483",
    "success": "#8E44AD",
    "danger": "#B03A2E",
    "warning": "#A569BD",
    "info": "#BB8FCE"
  },

  "roles": {
    "staffRoleId": "1515690952658911355",
    "adminRoleId": "1515690925458985052",
    "verifiedRoleId": "1515691031352311920",
    "mutedRoleId": "1515691026361352274"
  },

  "channels": {
    "logsChannelId": "1515691200303075471",
    "modLogsChannelId": "1515691205873238166",
    "joinLeaveChannelId": "1515691207966326905",
    "verifyLogsChannelId": "1515691200303075471",
    "transcriptsChannelId": "1515691198180757554",
    "ticketCategoryId": "1515711863613292635",
    "giveawayChannelId": "1515691313666982028",
    "welcomeChannelId": "1528720123559673927"
  },

  "welcome": {
    "bannerImage": "https://i.imgur.com/6YbQ0dJ.png",
    "messages": [
      "נחתת בשרת הכי סגול שיש 💜",
      "שמחים שהצטרפת אלינו!",
      "עוד חבר/ה מגניב/ה לקהילה 🎉"
    ]
  },

  "tickets": {
    "types": [
      { "label": "תמיכה כללית", "value": "support", "emoji": "🛠️", "description": "בעיה טכנית או שאלה כללית" },
      { "label": "דיווח על שחקן", "value": "report", "emoji": "🚨", "description": "דיווח על הפרת חוקים בשרת" },
      { "label": "רכישה / תשלום", "value": "purchase", "emoji": "💳", "description": "בעיה או שאלה לגבי רכישה" },
      { "label": "ערעור על באן", "value": "appeal", "emoji": "⚖️", "description": "ערעור על עונש שקיבלת" },
      { "label": "אחר", "value": "other", "emoji": "❓", "description": "כל נושא אחר שלא מופיע למעלה" }
    ],
    "claimMessages": [
      { "label": "ברוך הבא", "value": "welcome", "text": "שלום וברוך הבא! אני כאן כדי לעזור לך 🙏 אנא פרט/י את הבעיה בהרחבה ככל שניתן." },
      { "label": "רגע של סבלנות", "value": "patience", "text": "היי, ראיתי את הפנייה שלך ואני מטפל/ת בה כרגע. רגע של סבלנות בבקשה 🕐" },
      { "label": "תודה על הפנייה", "value": "thanks", "text": "שלום, תודה שפנית אלינו! איך אני יכול/ה לסייע לך היום?" },
      { "label": "בבדיקה", "value": "checking", "text": "הצוות קיבל את הפנייה שלך ואנחנו בודקים אותה כרגע, נעדכן בקרוב 🔎" }
    ]
  },

  "fivem": {
    "ip": "127.0.0.1",
    "port": "30120",
    "connectLink": "fivem://connect/play.yourserver.com",
    "storeLink": "https://yourstore.tebex.io"
  },

  "giveaways": {
    "emoji": "🎉"
  }
};

// --------------------------------------------------------------------------
// קליינט
// --------------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
});

client.cooldowns = new Collection();
client.spamTracker = new Collection();

// --------------------------------------------------------------------------
// פרסיסטנטיות נתונים (data.json)
// --------------------------------------------------------------------------
const DATA_PATH = path.join(__dirname, 'data', 'data.json');

function defaultData() {
  return {
    tickets: {},        // channelId -> { userId, type, claimedBy, claimedMsgId, ticketNumber, createdAt, closed }
    ticketCounter: 0,
    verified: {},        // userId -> true
    giveaways: {},        // messageId -> { channelId, prize, endsAt, winners, hostId, participants: [], ended }
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData(), null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (err) {
    console.error('שגיאה בטעינת data.json:', err);
    return defaultData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('שגיאה בשמירת data.json:', err);
  }
}

let db = loadData();

// --------------------------------------------------------------------------
// עזרים כלליים - עיצוב סגול אחיד
// --------------------------------------------------------------------------
const COLORS = config.colors;

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTimestamp()
    .setFooter({ text: 'Purple System', iconURL: client.user ? client.user.displayAvatarURL() : undefined });
}

function successEmbed(title, description) {
  return baseEmbed().setColor(COLORS.success).setTitle(`✅ ${title}`).setDescription(description);
}

function errorEmbed(title, description) {
  return baseEmbed().setColor(COLORS.danger).setTitle(`❌ ${title}`).setDescription(description);
}

function infoEmbed(title, description) {
  return baseEmbed().setColor(COLORS.info).setTitle(`ℹ️ ${title}`).setDescription(description);
}

function warningEmbed(title, description) {
  return baseEmbed().setColor(COLORS.warning).setTitle(`⚠️ ${title}`).setDescription(description);
}

function hasStaffRole(member) {
  if (!member) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.has(config.roles.staffRoleId) ||
    member.roles.cache.has(config.roles.adminRoleId)
  );
}

function hasAdminRole(member) {
  if (!member) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.has(config.roles.adminRoleId)
  );
}

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts = [];
  if (days) parts.push(`${days}י'`);
  if (hours) parts.push(`${hours}ש'`);
  if (minutes) parts.push(`${minutes}ד'`);
  if (!days && !hours) parts.push(`${seconds}שנ'`);
  return parts.join(' ') || '0 שנ׳';
}

function parseDuration(str) {
  // תומך בפורמט כמו 10s / 5m / 2h / 1d
  const match = /^(\d+)(s|m|h|d)$/i.exec(str.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

async function getLogChannel(guild, key = 'logsChannelId') {
  const id = config.channels[key];
  if (!id || id.includes('_ID')) return null;
  try {
    return await guild.channels.fetch(id);
  } catch {
    return null;
  }
}

async function sendLog(guild, embed, key = 'logsChannelId') {
  const ch = await getLogChannel(guild, key);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// --------------------------------------------------------------------------
// FiveM - סטטוס שרת + חיפוש שחקן
// --------------------------------------------------------------------------
async function fetchFiveMPlayers() {
  const url = `http://${config.fivem.ip}:${config.fivem.port}/players.json`;
  const res = await axios.get(url, { timeout: 4000 });
  return res.data; // array of players
}

async function fetchFiveMInfo() {
  const url = `http://${config.fivem.ip}:${config.fivem.port}/info.json`;
  const res = await axios.get(url, { timeout: 4000 });
  return res.data;
}

async function getFiveMStatus() {
  try {
    const [players, info] = await Promise.all([fetchFiveMPlayers(), fetchFiveMInfo()]);
    const maxPlayers =
      (info.vars && (info.vars.sv_maxclients || info.vars['sv_maxClients'])) || players.length;
    return {
      online: true,
      players,
      count: players.length,
      max: parseInt(maxPlayers, 10) || players.length,
      hostname: (info.vars && info.vars.sv_projectName) || info.serverversion || 'FiveM Server',
    };
  } catch (err) {
    return { online: false };
  }
}

function findPlayerInList(players, query) {
  const q = query.toLowerCase().trim();
  return players.find((p) => {
    if (p.name && p.name.toLowerCase().includes(q)) return true;
    if (Array.isArray(p.identifiers)) {
      return p.identifiers.some((id) => id.toLowerCase().includes(q));
    }
    return false;
  });
}

// --------------------------------------------------------------------------
// עדכון סטטוס בוט לפי מצב שרת ה-FiveM
// --------------------------------------------------------------------------
async function updateBotPresence() {
  const status = await getFiveMStatus();
  if (!status.online) {
    client.user.setPresence({
      activities: [{ name: 'Server Offline ❌', type: ActivityType.Watching }],
      status: 'dnd',
    });
    return;
  }
  client.user.setPresence({
    activities: [{ name: `${status.count}/${status.max} שחקנים באונליין 🟣`, type: ActivityType.Watching }],
    status: 'online',
  });
}

// ==========================================================================
// מערכת טיקטים
// ==========================================================================

function buildTicketPanelEmbed() {
  return baseEmbed()
    .setTitle('🎫 מערכת טיקטים')
    .setDescription(
      [
        'ברוכים הבאים למערכת התמיכה שלנו!',
        '',
        'בחר/י את הנושא המתאים מהתפריט למטה כדי לפתוח טיקט חדש.',
        'צוות התמיכה שלנו יטפל בפנייתך בהקדם האפשרי 💜',
        '',
        '**חוקי פתיחת טיקט:**',
        '• יש לפתוח טיקט אחד בלבד לכל נושא',
        '• אין לספאם או לפתוח טיקטים סתם',
        '• יש להסביר את הבעיה בצורה ברורה',
      ].join('\n')
    )
    .setThumbnail(client.user ? client.user.displayAvatarURL() : null)
    .setImage('https://i.imgur.com/6YbQ0dJ.png')
    .setColor(COLORS.primary);
}

function buildTicketSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_type_select')
    .setPlaceholder('📩 בחר/י את סוג הטיקט שברצונך לפתוח')
    .addOptions(
      config.tickets.types.map((t) => ({
        label: t.label,
        value: t.value,
        emoji: t.emoji,
        description: t.description,
      }))
    );
  return new ActionRowBuilder().addComponents(select);
}

async function sendTicketPanel(channel) {
  await channel.send({ embeds: [buildTicketPanelEmbed()], components: [buildTicketSelectRow()] });
}

function buildTicketControlRow(claimed) {
  const claimBtn = new ButtonBuilder()
    .setCustomId('ticket_claim')
    .setLabel(claimed ? 'נלקח' : 'קח טיקט')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Success)
    .setDisabled(claimed);

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('סגור טיקט')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const addUserBtn = new ButtonBuilder()
    .setCustomId('ticket_transcript')
    .setLabel('טרנסקריפט')
    .setEmoji('📄')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(claimBtn, closeBtn, addUserBtn);
}

function ticketTypeLabel(value) {
  const t = config.tickets.types.find((x) => x.value === value);
  return t ? `${t.emoji} ${t.label}` : value;
}

async function createTicketChannel(interaction, typeValue) {
  const guild = interaction.guild;
  const member = interaction.member;

  // בדיקה אם כבר יש טיקט פתוח למשתמש
  const existing = Object.entries(db.tickets).find(
    ([, t]) => t.userId === member.id && !t.closed
  );
  if (existing) {
    return interaction.reply({
      embeds: [errorEmbed('טיקט פתוח כבר קיים', `כבר יש לך טיקט פתוח: <#${existing[0]}>`)],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  db.ticketCounter += 1;
  const ticketNumber = db.ticketCounter;
  const channelName = `ticket-${ticketNumber}-${member.user.username}`.toLowerCase().slice(0, 90);

  const categoryId = config.channels.ticketCategoryId;
  const overwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];
  if (config.roles.staffRoleId && !config.roles.staffRoleId.includes('_ID')) {
    overwrites.push({
      id: config.roles.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const channelOptions = {
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    topic: `טיקט #${ticketNumber} | ${ticketTypeLabel(typeValue)} | נפתח ע"י ${member.id}`,
  };
  if (categoryId && !categoryId.includes('_ID')) channelOptions.parent = categoryId;

  const ticketChannel = await guild.channels.create(channelOptions);

  db.tickets[ticketChannel.id] = {
    userId: member.id,
    type: typeValue,
    ticketNumber,
    claimedBy: null,
    createdAt: Date.now(),
    closed: false,
  };
  saveData();

  const welcomeEmbed = baseEmbed()
    .setTitle(`🎫 טיקט #${ticketNumber} — ${ticketTypeLabel(typeValue)}`)
    .setDescription(
      [
        `שלום ${member} 👋`,
        '',
        'תודה שפנית אלינו! צוות התמיכה יגיע בהקדם האפשרי.',
        'בינתיים, אנא פרט/י בהרחבה את הבעיה או הבקשה שלך.',
        '',
        `**נפתח על ידי:** ${member}`,
        `**סוג הפנייה:** ${ticketTypeLabel(typeValue)}`,
        `**נפתח בתאריך:** <t:${Math.floor(Date.now() / 1000)}:F>`,
      ].join('\n')
    )
    .setColor(COLORS.primary);

  const staffPing = config.roles.staffRoleId && !config.roles.staffRoleId.includes('_ID')
    ? `<@&${config.roles.staffRoleId}>`
    : '';

  await ticketChannel.send({
    content: `${member} ${staffPing}`,
    embeds: [welcomeEmbed],
    components: [buildTicketControlRow(false)],
  });

  await interaction.editReply({
    embeds: [successEmbed('הטיקט נפתח בהצלחה', `הטיקט שלך נפתח: ${ticketChannel}`)],
  });

  await sendLog(
    guild,
    infoEmbed('🎫 טיקט חדש נפתח', `**מספר:** #${ticketNumber}\n**משתמש:** ${member}\n**סוג:** ${ticketTypeLabel(typeValue)}\n**ערוץ:** ${ticketChannel}`)
  );
}

function buildClaimMessageSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_claim_message_select')
    .setPlaceholder('💬 בחר/י הודעת פתיחה לשליחה בטיקט')
    .addOptions(
      config.tickets.claimMessages.map((m) => ({ label: m.label, value: m.value }))
    );
  return new ActionRowBuilder().addComponents(select);
}

async function handleTicketClaimButton(interaction) {
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) {
    return interaction.reply({ embeds: [errorEmbed('שגיאה', 'זהו לא ערוץ טיקט תקין.')], ephemeral: true });
  }
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק צוות רשאי לקחת טיקטים.')], ephemeral: true });
  }
  if (ticket.claimedBy) {
    return interaction.reply({
      embeds: [errorEmbed('כבר נלקח', `הטיקט הזה כבר נלקח על ידי <@${ticket.claimedBy}>`)],
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: 'בחר/י הודעה שתישלח בערוץ הטיקט עם לקיחתו:',
    components: [buildClaimMessageSelectRow()],
    ephemeral: true,
  });
}

async function handleClaimMessageSelect(interaction) {
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) return interaction.update({ content: 'שגיאה: טיקט לא נמצא.', components: [] });

  const chosen = config.tickets.claimMessages.find((m) => m.value === interaction.values[0]);
  ticket.claimedBy = interaction.user.id;
  saveData();

  const claimEmbed = successEmbed('🙋 הטיקט נלקח', `הטיקט נלקח על ידי ${interaction.user}`).addFields({
    name: 'הודעה מהצוות',
    value: chosen ? chosen.text : 'הטיקט נלקח וטופל בקרוב.',
  });

  await interaction.channel.send({ embeds: [claimEmbed] });

  // עדכון כפתורי השליטה בהודעה המקורית
  const messages = await interaction.channel.messages.fetch({ limit: 20 });
  const controlMsg = messages.find(
    (m) => m.author.id === client.user.id && m.components.length && m.components[0].components.some((c) => c.customId === 'ticket_claim')
  );
  if (controlMsg) {
    await controlMsg.edit({ components: [buildTicketControlRow(true)] }).catch(() => {});
  }

  await interaction.update({ content: '✅ ההודעה נשלחה בהצלחה בטיקט.', components: [] });

  await sendLog(
    interaction.guild,
    infoEmbed('🙋 טיקט נלקח', `**טיקט:** #${ticket.ticketNumber}\n**נלקח על ידי:** ${interaction.user}\n**ערוץ:** ${interaction.channel}`)
  );
}

async function generateTranscript(channel) {
  const allMessages = [];
  let lastId;
  for (let i = 0; i < 10; i++) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const fetched = await channel.messages.fetch(options);
    if (!fetched.size) break;
    allMessages.push(...fetched.values());
    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }
  allMessages.reverse();

  const lines = allMessages.map((m) => {
    const time = new Date(m.createdTimestamp).toLocaleString('he-IL');
    const content = m.content || '[קובץ מצורף / embed]';
    return `[${time}] ${m.author.tag}: ${content}`;
  });

  const header = `טרנסקריפט עבור ${channel.name}\nנוצר בתאריך: ${new Date().toLocaleString('he-IL')}\n${'='.repeat(50)}\n\n`;
  return header + lines.join('\n');
}

async function handleTicketTranscript(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const text = await generateTranscript(interaction.channel);
  const buffer = Buffer.from(text, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });
  await interaction.editReply({ content: '📄 הטרנסקריפט מוכן:', files: [attachment] });
}

async function handleTicketClose(interaction) {
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) return interaction.reply({ embeds: [errorEmbed('שגיאה', 'זהו לא ערוץ טיקט תקין.')], ephemeral: true });
  if (!hasStaffRole(interaction.member) && interaction.user.id !== ticket.userId) {
    return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לסגור טיקט זה.')], ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId('ticket_close_modal').setTitle('סגירת טיקט');
  const reasonInput = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel('סיבת הסגירה (אופציונלי)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

async function handleTicketCloseModal(interaction) {
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) return interaction.reply({ content: 'שגיאה: טיקט לא נמצא.', ephemeral: true });

  const reason = interaction.fields.getTextInputValue('close_reason') || 'לא צוינה סיבה';
  await interaction.reply({ embeds: [infoEmbed('🔒 סוגר את הטיקט...', `הטיקט ייסגר בעוד 5 שניות.\n**סיבה:** ${reason}`)] });

  const transcriptText = await generateTranscript(interaction.channel);
  const buffer = Buffer.from(transcriptText, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });

  const transcriptChannel = await getLogChannel(interaction.guild, 'transcriptsChannelId');
  const closeLog = infoEmbed(
    '🔒 טיקט נסגר',
    `**מספר:** #${ticket.ticketNumber}\n**נפתח על ידי:** <@${ticket.userId}>\n**נסגר על ידי:** ${interaction.user}\n**סיבה:** ${reason}`
  );
  if (transcriptChannel) transcriptChannel.send({ embeds: [closeLog], files: [attachment] }).catch(() => {});
  await sendLog(interaction.guild, closeLog);

  ticket.closed = true;
  saveData();

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
    delete db.tickets[interaction.channel.id];
    saveData();
  }, 5000);
}

// ==========================================================================
// מערכת ברוכים הבאים
// ==========================================================================

function buildWelcomeEmbed(member) {
  const randomMsg =
    config.welcome.messages[Math.floor(Math.random() * config.welcome.messages.length)];

  return baseEmbed()
    .setColor(COLORS.primary)
    .setTitle('💜 חבר/ה חדש/ה הצטרף/ה!')
    .setDescription(
      [
        `ברוך/ה הבא/ה ${member} ל **${member.guild.name}**!`,
        '',
        randomMsg,
        '',
        `🎫 לא לשכוח לעבור אימות ולפתוח טיקט אם צריך עזרה.`,
      ].join('\n')
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setImage(config.welcome.bannerImage)
    .addFields(
      { name: '👤 משתמש', value: `${member.user.tag}`, inline: true },
      { name: '👥 חבר/ה מספר', value: `${member.guild.memberCount}`, inline: true },
      { name: '📅 הצטרף/ה בתאריך', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
    );
}

async function sendWelcomeMessage(member) {
  const channelId = config.channels.welcomeChannelId;
  if (!channelId || channelId.includes('_ID')) return;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  await channel.send({ content: `${member}`, embeds: [buildWelcomeEmbed(member)] }).catch(() => {});
}

// ==========================================================================
// מערכת אימות
// ==========================================================================

function buildVerifyPanelEmbed() {
  return baseEmbed()
    .setTitle('🛡️ אימות שרת')
    .setDescription(
      [
        'כדי לקבל גישה מלאה לשרת, יש ללחוץ על הכפתור למטה.',
        '',
        'לאחר האימות תקבל/י גישה לכלל הערוצים והרול המתאים באופן מיידי 💜',
        '',
        '**שימו לב:** יש לעמוד בחוקי השרת בכל עת.',
      ].join('\n')
    )
    .setColor(COLORS.primary)
    .setThumbnail(client.user ? client.user.displayAvatarURL() : null);
}

function buildVerifyRow() {
  const btn = new ButtonBuilder()
    .setCustomId('verify_button')
    .setLabel('אמת/י את עצמך')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);
  return new ActionRowBuilder().addComponents(btn);
}

async function sendVerifyPanel(channel) {
  await channel.send({ embeds: [buildVerifyPanelEmbed()], components: [buildVerifyRow()] });
}

async function handleVerifyButton(interaction) {
  const member = interaction.member;
  const roleId = config.roles.verifiedRoleId;

  if (db.verified[member.id]) {
    return interaction.reply({ embeds: [warningEmbed('כבר מאומת/ת', 'כבר עברת אימות בעבר!')], ephemeral: true });
  }

  if (roleId && !roleId.includes('_ID')) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.add(role).catch(() => {});
    }
  }

  db.verified[member.id] = true;
  saveData();

  await interaction.reply({
    embeds: [successEmbed('אומתת בהצלחה! 🎉', `ברוך/ה הבא/ה ל${interaction.guild.name}! קיבלת גישה מלאה לשרת.`)],
    ephemeral: true,
  });

  await sendLog(
    interaction.guild,
    infoEmbed('🛡️ משתמש עבר אימות', `**משתמש:** ${member}\n**מזהה:** ${member.id}`),
    'verifyLogsChannelId'
  );
}

// ==========================================================================
// מערכת הגרלות
// ==========================================================================

function buildGiveawayEmbed(g, ended = false) {
  const e = baseEmbed()
    .setTitle(`${config.giveaways.emoji} הגרלה: ${g.prize}`)
    .setColor(ended ? COLORS.dark : COLORS.primary)
    .addFields(
      { name: '🏆 פרס', value: g.prize, inline: true },
      { name: '👥 משתתפים', value: `${g.participants.length}`, inline: true },
      { name: '🎯 זוכים', value: `${g.winners}`, inline: true },
      { name: '🎗️ מארח/ת', value: `<@${g.hostId}>`, inline: true },
      {
        name: ended ? '⏰ הסתיימה' : '⏰ מסתיימת',
        value: `<t:${Math.floor(g.endsAt / 1000)}:R>`,
        inline: true,
      }
    );
  if (ended) e.setDescription('🔒 ההגרלה הסתיימה! לחצו על הכפתור למטה כדי לראות את הזוכים.');
  else e.setDescription('לחצו על הכפתור למטה כדי להצטרף להגרלה! בהצלחה 💜');
  return e;
}

function buildGiveawayRow(messageId, disabled = false) {
  const btn = new ButtonBuilder()
    .setCustomId(`giveaway_enter_${messageId}`)
    .setLabel('הצטרפות להגרלה')
    .setEmoji(config.giveaways.emoji)
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);
  return new ActionRowBuilder().addComponents(btn);
}

async function startGiveaway(channel, hostId, prize, durationMs, winnersCount) {
  const endsAt = Date.now() + durationMs;
  const tempEmbed = baseEmbed().setTitle(`${config.giveaways.emoji} הגרלה: ${prize}`).setDescription('טוען...');
  const msg = await channel.send({ embeds: [tempEmbed] });

  const giveaway = {
    channelId: channel.id,
    prize,
    endsAt,
    winners: winnersCount,
    hostId,
    participants: [],
    ended: false,
  };
  db.giveaways[msg.id] = giveaway;
  saveData();

  await msg.edit({ embeds: [buildGiveawayEmbed(giveaway)], components: [buildGiveawayRow(msg.id)] });

  scheduleGiveawayEnd(msg.id, durationMs);
  return msg;
}

function scheduleGiveawayEnd(messageId, delay) {
  const safeDelay = Math.min(delay, 2 ** 31 - 1);
  setTimeout(() => endGiveaway(messageId).catch(console.error), safeDelay);
}

async function endGiveaway(messageId) {
  const giveaway = db.giveaways[messageId];
  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;
  saveData();

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return;
  const msg = await channel.messages.fetch(messageId).catch(() => null);

  let winners = [];
  if (giveaway.participants.length > 0) {
    const pool = [...giveaway.participants];
    const count = Math.min(giveaway.winners, pool.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0]);
    }
  }

  if (msg) {
    await msg.edit({ embeds: [buildGiveawayEmbed(giveaway, true)], components: [buildGiveawayRow(messageId, true)] });
  }

  const resultEmbed = winners.length
    ? successEmbed(
        `🎉 ההגרלה "${giveaway.prize}" הסתיימה!`,
        `**זוכים:** ${winners.map((w) => `<@${w}>`).join(', ')}\nמזל טוב! 🎊`
      )
    : warningEmbed(`ההגרלה "${giveaway.prize}" הסתיימה`, 'לא היו מספיק משתתפים לבחור זוכה 😢');

  channel.send({ embeds: [resultEmbed] }).catch(() => {});
}

async function handleGiveawayEnter(interaction, messageId) {
  const giveaway = db.giveaways[messageId];
  if (!giveaway) {
    return interaction.reply({ embeds: [errorEmbed('שגיאה', 'הגרלה זו לא נמצאה.')], ephemeral: true });
  }
  if (giveaway.ended) {
    return interaction.reply({ embeds: [errorEmbed('ההגרלה הסתיימה', 'לא ניתן להצטרף יותר להגרלה זו.')], ephemeral: true });
  }

  const idx = giveaway.participants.indexOf(interaction.user.id);
  let replyText;
  if (idx === -1) {
    giveaway.participants.push(interaction.user.id);
    replyText = successEmbed('הצטרפת להגרלה! 🎉', `כרגע יש ${giveaway.participants.length} משתתפים. בהצלחה!`);
  } else {
    giveaway.participants.splice(idx, 1);
    replyText = infoEmbed('יצאת מההגרלה', `כרגע יש ${giveaway.participants.length} משתתפים.`);
  }
  saveData();

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel) {
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (msg) msg.edit({ embeds: [buildGiveawayEmbed(giveaway)] }).catch(() => {});
  }

  await interaction.reply({ embeds: [replyText], ephemeral: true });
}

function restoreGiveawaysOnStartup() {
  for (const [messageId, giveaway] of Object.entries(db.giveaways)) {
    if (giveaway.ended) continue;
    const remaining = giveaway.endsAt - Date.now();
    if (remaining <= 0) {
      endGiveaway(messageId).catch(console.error);
    } else {
      scheduleGiveawayEnd(messageId, remaining);
    }
  }
}

// ==========================================================================
// אבטחה: אנטי-לינק + אנטי-ספאם
// ==========================================================================
const LINK_REGEX = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+)/gi;
const SPAM_WINDOW_MS = 6000;
const SPAM_MAX_MESSAGES = 5;

async function handleSecurityChecks(message) {
  if (message.author.bot || !message.guild) return false;
  const member = message.member;
  if (hasStaffRole(member)) return false;

  // אנטי לינק
  if (LINK_REGEX.test(message.content)) {
    await message.delete().catch(() => {});
    const warnMsg = await message.channel.send({
      content: `${message.author}`,
      embeds: [warningEmbed('קישורים אסורים', 'אין לשלוח קישורים בערוץ זה ללא הרשאה.')],
    });
    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
    await sendLog(
      message.guild,
      warningEmbed('🔗 קישור נחסם', `**משתמש:** ${message.author}\n**ערוץ:** ${message.channel}\n**תוכן:** ${message.content.slice(0, 200)}`)
    );
    return true;
  }

  // אנטי ספאם
  const now = Date.now();
  const key = message.author.id;
  const tracker = client.spamTracker.get(key) || [];
  const recent = tracker.filter((t) => now - t < SPAM_WINDOW_MS);
  recent.push(now);
  client.spamTracker.set(key, recent);

  if (recent.length > SPAM_MAX_MESSAGES) {
    client.spamTracker.set(key, []);
    try {
      await member.timeout(5 * 60 * 1000, 'ספאם אוטומטי');
      await message.channel.send({
        embeds: [warningEmbed('🚫 זוהה ספאם', `${message.author} קיבל/ה טיימאאוט אוטומטי של 5 דקות.`)],
      });
      await sendLog(
        message.guild,
        errorEmbed('🚫 טיימאאוט אוטומטי (ספאם)', `**משתמש:** ${message.author}\n**ערוץ:** ${message.channel}`)
      );
    } catch (err) {
      console.error('שגיאה בטיימאאוט אוטומטי:', err);
    }
    return true;
  }
  return false;
}

// ==========================================================================
// פקודות סלאש
// ==========================================================================
const slashCommands = [
  new SlashCommandBuilder().setName('ping').setDescription('בודק את זמן התגובה של הבוט'),

  new SlashCommandBuilder().setName('serverinfo').setDescription('מציג מידע על השרת'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('מציג מידע על משתמש')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש לבדיקה').setRequired(false)),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('מציג את תמונת הפרופיל של משתמש')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש לבדיקה').setRequired(false)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('חוסם משתמש מהשרת')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש לחסימה').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('סיבת החסימה').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('מסיר חסימה ממשתמש')
    .addStringOption((o) => o.setName('userid').setDescription('מזהה המשתמש').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('מסלק משתמש מהשרת')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש לסילוק').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('סיבת הסילוק').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('נותן טיימאאוט למשתמש')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('משך (למשל 10m, 1h, 1d)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('סיבה').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('מסיר טיימאאוט ממשתמש')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('מוחק הודעות מהערוץ')
    .addIntegerOption((o) => o.setName('amount').setDescription('כמות הודעות (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('נועל את הערוץ הנוכחי')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('פותח את הערוץ הנוכחי')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('קובע מצב איטי לערוץ')
    .addIntegerOption((o) => o.setName('seconds').setDescription('שניות (0 לביטול)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('מוסיף רול למשתמש')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('הרול להוספה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('מסיר רול ממשתמש')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('הרול להסרה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('giveaway-start')
    .setDescription('מתחיל הגרלה חדשה')
    .addStringOption((o) => o.setName('prize').setDescription('הפרס בהגרלה').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('משך (למשל 1h, 1d)').setRequired(true))
    .addIntegerOption((o) => o.setName('winners').setDescription('כמות זוכים').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('giveaway-reroll')
    .setDescription('מגריל זוכה חדש להגרלה שהסתיימה')
    .addStringOption((o) => o.setName('message_id').setDescription('מזהה הודעת ההגרלה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('giveaway-end')
    .setDescription('מסיים הגרלה מוקדם')
    .addStringOption((o) => o.setName('message_id').setDescription('מזהה הודעת ההגרלה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('player-info')
    .setDescription('מחפש שחקן מחובר בשרת ה-FiveM')
    .addStringOption((o) => o.setName('query').setDescription('שם השחקן או מזהה דיסקורד').setRequired(true)),

  new SlashCommandBuilder().setName('server-players').setDescription('מציג רשימת שחקנים מחוברים לשרת ה-FiveM'),
].map((c) => c.toJSON());

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: slashCommands });
    console.log('✅ פקודות הסלאש נרשמו בהצלחה.');
  } catch (err) {
    console.error('❌ שגיאה ברישום פקודות סלאש:', err);
  }
}

// ==========================================================================
// מטפל בפקודות סלאש
// ==========================================================================
async function handleSlashCommand(interaction) {
  const { commandName, options, guild, member } = interaction;

  switch (commandName) {
    case 'ping': {
      const sent = await interaction.reply({ embeds: [infoEmbed('🏓 פונג!', 'מודד זמן תגובה...')], fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply({
        embeds: [infoEmbed('🏓 פונג!', `**זמן תגובה:** ${latency}ms\n**Websocket:** ${client.ws.ping}ms`)],
      });
      break;
    }

    case 'serverinfo': {
      const e = baseEmbed()
        .setTitle(`📊 מידע על ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '👑 בעלים', value: `<@${guild.ownerId}>`, inline: true },
          { name: '👥 חברים', value: `${guild.memberCount}`, inline: true },
          { name: '📁 ערוצים', value: `${guild.channels.cache.size}`, inline: true },
          { name: '🎭 רולים', value: `${guild.roles.cache.size}`, inline: true },
          { name: '😀 אימוג׳ים', value: `${guild.emojis.cache.size}`, inline: true },
          { name: '📅 נוצר בתאריך', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
        );
      await interaction.reply({ embeds: [e] });
      break;
    }

    case 'userinfo': {
      const target = options.getUser('user') || interaction.user;
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      const e = baseEmbed()
        .setTitle(`👤 מידע על ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🆔 מזהה', value: target.id, inline: true },
          { name: '📅 נוצר בתאריך', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true }
        );
      if (targetMember) {
        e.addFields(
          { name: '📥 הצטרף בתאריך', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:D>`, inline: true },
          {
            name: '🎭 רולים',
            value: targetMember.roles.cache.filter((r) => r.id !== guild.id).map((r) => `${r}`).join(', ') || 'אין',
          }
        );
      }
      await interaction.reply({ embeds: [e] });
      break;
    }

    case 'avatar': {
      const target = options.getUser('user') || interaction.user;
      const e = baseEmbed().setTitle(`🖼️ תמונת הפרופיל של ${target.tag}`).setImage(target.displayAvatarURL({ size: 1024 }));
      await interaction.reply({ embeds: [e] });
      break;
    }

    case 'ban': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const target = options.getUser('user');
      const reason = options.getString('reason') || 'לא צוינה סיבה';
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (targetMember && !targetMember.bannable) {
        return interaction.reply({ embeds: [errorEmbed('לא ניתן', 'לא ניתן לחסום משתמש זה.')], ephemeral: true });
      }
      await guild.members.ban(target.id, { reason });
      await interaction.reply({ embeds: [successEmbed('👢 משתמש נחסם', `${target.tag} נחסם.\n**סיבה:** ${reason}`)] });
      await sendLog(guild, errorEmbed('🔨 באן', `**משתמש:** ${target.tag} (${target.id})\n**מפעיל:** ${interaction.user}\n**סיבה:** ${reason}`), 'modLogsChannelId');
      break;
    }

    case 'unban': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const userId = options.getString('userid');
      await guild.members.unban(userId).catch(() => {
        throw new Error('משתמש לא נמצא ברשימת החסומים');
      });
      await interaction.reply({ embeds: [successEmbed('🔓 החסימה הוסרה', `הוסרה חסימה למשתמש ${userId}`)] });
      await sendLog(guild, successEmbed('🔓 הסרת באן', `**מזהה:** ${userId}\n**מפעיל:** ${interaction.user}`), 'modLogsChannelId');
      break;
    }

    case 'kick': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const target = options.getUser('user');
      const reason = options.getString('reason') || 'לא צוינה סיבה';
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember || !targetMember.kickable) {
        return interaction.reply({ embeds: [errorEmbed('לא ניתן', 'לא ניתן לסלק משתמש זה.')], ephemeral: true });
      }
      await targetMember.kick(reason);
      await interaction.reply({ embeds: [successEmbed('👢 משתמש סולק', `${target.tag} סולק מהשרת.\n**סיבה:** ${reason}`)] });
      await sendLog(guild, warningEmbed('👢 קיק', `**משתמש:** ${target.tag} (${target.id})\n**מפעיל:** ${interaction.user}\n**סיבה:** ${reason}`), 'modLogsChannelId');
      break;
    }

    case 'timeout': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const target = options.getUser('user');
      const durationStr = options.getString('duration');
      const reason = options.getString('reason') || 'לא צוינה סיבה';
      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return interaction.reply({ embeds: [errorEmbed('פורמט שגוי', 'השתמש/י בפורמט כמו 10m, 1h, 1d')], ephemeral: true });
      }
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) return interaction.reply({ embeds: [errorEmbed('שגיאה', 'משתמש לא נמצא.')], ephemeral: true });
      await targetMember.timeout(durationMs, reason);
      await interaction.reply({
        embeds: [successEmbed('⏱️ טיימאאוט הוגדר', `${target.tag} קיבל/ה טיימאאוט למשך ${fmtDuration(durationMs)}\n**סיבה:** ${reason}`)],
      });
      await sendLog(guild, warningEmbed('⏱️ טיימאאוט', `**משתמש:** ${target.tag}\n**משך:** ${fmtDuration(durationMs)}\n**מפעיל:** ${interaction.user}\n**סיבה:** ${reason}`), 'modLogsChannelId');
      break;
    }

    case 'untimeout': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const target = options.getUser('user');
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) return interaction.reply({ embeds: [errorEmbed('שגיאה', 'משתמש לא נמצא.')], ephemeral: true });
      await targetMember.timeout(null);
      await interaction.reply({ embeds: [successEmbed('✅ הטיימאאוט הוסר', `הוסר טיימאאוט מ-${target.tag}`)] });
      await sendLog(guild, successEmbed('✅ הסרת טיימאאוט', `**משתמש:** ${target.tag}\n**מפעיל:** ${interaction.user}`), 'modLogsChannelId');
      break;
    }

    case 'clear': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const amount = options.getInteger('amount');
      if (amount < 1 || amount > 100) {
        return interaction.reply({ embeds: [errorEmbed('כמות שגויה', 'יש לבחור כמות בין 1 ל-100.')], ephemeral: true });
      }
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ embeds: [successEmbed('🧹 הודעות נמחקו', `נמחקו ${deleted.size} הודעות.`)], ephemeral: true });
      await sendLog(guild, infoEmbed('🧹 ניקוי הודעות', `**ערוץ:** ${interaction.channel}\n**כמות:** ${deleted.size}\n**מפעיל:** ${interaction.user}`), 'modLogsChannelId');
      break;
    }

    case 'lock': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
      await interaction.reply({ embeds: [warningEmbed('🔒 הערוץ ננעל', 'הערוץ ננעל על ידי הצוות.')] });
      break;
    }

    case 'unlock': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
      await interaction.reply({ embeds: [successEmbed('🔓 הערוץ נפתח', 'הערוץ נפתח מחדש.')] });
      break;
    }

    case 'slowmode': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const seconds = options.getInteger('seconds');
      await interaction.channel.setRateLimitPerUser(seconds);
      await interaction.reply({ embeds: [successEmbed('🐢 מצב איטי הוגדר', seconds ? `נקבע מצב איטי של ${seconds} שניות.` : 'מצב איטי בוטל.')] });
      break;
    }

    case 'addrole': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const target = options.getUser('user');
      const role = options.getRole('role');
      const targetMember = await guild.members.fetch(target.id);
      await targetMember.roles.add(role);
      await interaction.reply({ embeds: [successEmbed('🎭 רול נוסף', `נוסף הרול ${role} ל-${target.tag}`)] });
      break;
    }

    case 'removerole': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const target = options.getUser('user');
      const role = options.getRole('role');
      const targetMember = await guild.members.fetch(target.id);
      await targetMember.roles.remove(role);
      await interaction.reply({ embeds: [successEmbed('🎭 רול הוסר', `הוסר הרול ${role} מ-${target.tag}`)] });
      break;
    }

    case 'giveaway-start': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const prize = options.getString('prize');
      const durationStr = options.getString('duration');
      const winnersCount = options.getInteger('winners');
      const durationMs = parseDuration(durationStr);
      if (!durationMs) return interaction.reply({ embeds: [errorEmbed('פורמט שגוי', 'השתמש/י בפורמט כמו 1h, 1d')], ephemeral: true });
      await interaction.reply({ embeds: [successEmbed('🎉 ההגרלה החלה', `ההגרלה על "${prize}" פורסמה בערוץ!`)], ephemeral: true });
      await startGiveaway(interaction.channel, interaction.user.id, prize, durationMs, winnersCount);
      break;
    }

    case 'giveaway-end': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const messageId = options.getString('message_id');
      if (!db.giveaways[messageId]) return interaction.reply({ embeds: [errorEmbed('לא נמצא', 'הגרלה זו לא נמצאה.')], ephemeral: true });
      await endGiveaway(messageId);
      await interaction.reply({ embeds: [successEmbed('🏁 ההגרלה הסתיימה', 'ההגרלה הסתיימה בהצלחה.')], ephemeral: true });
      break;
    }

    case 'giveaway-reroll': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const messageId = options.getString('message_id');
      const giveaway = db.giveaways[messageId];
      if (!giveaway || !giveaway.participants.length) {
        return interaction.reply({ embeds: [errorEmbed('לא ניתן', 'אין משתתפים להגרלה זו.')], ephemeral: true });
      }
      const winner = giveaway.participants[Math.floor(Math.random() * giveaway.participants.length)];
      await interaction.reply({ embeds: [successEmbed('🎉 זוכה חדש!', `הזוכה החדש הוא: <@${winner}>`)] });
      break;
    }

    case 'player-info': {
      const query = options.getString('query');
      await interaction.deferReply();
      const status = await getFiveMStatus();
      if (!status.online) {
        return interaction.editReply({ embeds: [errorEmbed('השרת לא מחובר', 'לא ניתן להתחבר לשרת ה-FiveM כרגע.')] });
      }
      const player = findPlayerInList(status.players, query);
      if (!player) {
        return interaction.editReply({ embeds: [errorEmbed('שחקן לא נמצא', `לא נמצא שחקן התואם ל: "${query}"`)] });
      }
      const discordId = (player.identifiers || []).find((id) => id.startsWith('discord:'));
      const e = baseEmbed()
        .setTitle(`🎮 מידע על שחקן: ${player.name}`)
        .addFields(
          { name: '🆔 מזהה שרת', value: `${player.id}`, inline: true },
          { name: '📶 פינג', value: `${player.ping}ms`, inline: true },
          { name: '💬 דיסקורד', value: discordId ? `<@${discordId.split(':')[1]}>` : 'לא מקושר', inline: true },
          { name: '🔑 מזהים', value: (player.identifiers || []).map((i) => `\`${i}\``).join('\n').slice(0, 1000) || 'אין' }
        );
      await interaction.editReply({ embeds: [e] });
      break;
    }

    case 'server-players': {
      await interaction.deferReply();
      const status = await getFiveMStatus();
      if (!status.online) {
        return interaction.editReply({ embeds: [errorEmbed('השרת לא מחובר', 'לא ניתן להתחבר לשרת ה-FiveM כרגע.')] });
      }
      if (!status.players.length) {
        return interaction.editReply({ embeds: [infoEmbed('אין שחקנים', 'אין כרגע שחקנים מחוברים לשרת.')] });
      }
      const list = status.players.slice(0, 30).map((p) => `**${p.id}.** ${p.name} — ${p.ping}ms`).join('\n');
      await interaction.editReply({
        embeds: [infoEmbed(`👥 שחקנים מחוברים (${status.count}/${status.max})`, list)],
      });
      break;
    }
  }
}

// ==========================================================================
// פקודות פרפיקס (!) — פאנלים וסטטוס בלבד
// ==========================================================================
async function handlePrefixCommand(message) {
  if (!message.content.startsWith(config.prefix)) return;
  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // כל פקודות ה-! דורשות הרשאת צוות (למעט status שפתוח לכולם)
  if (cmd !== 'status' && !hasStaffRole(message.member)) return;

  switch (cmd) {
    case 'ticketpanel': {
      await sendTicketPanel(message.channel);
      await message.delete().catch(() => {});
      break;
    }

    case 'verifypanel': {
      await sendVerifyPanel(message.channel);
      await message.delete().catch(() => {});
      break;
    }

    case 'giveaway': {
      // שימוש: !giveaway פרס | משך | זוכים
      const raw = message.content.slice((config.prefix + cmd).length).trim();
      const parts = raw.split('|').map((p) => p.trim());
      if (parts.length < 3) {
        return message.reply({ embeds: [errorEmbed('שימוש שגוי', 'שימוש: `!giveaway פרס | משך (1h) | כמות זוכים`')] });
      }
      const [prize, durationStr, winnersStr] = parts;
      const durationMs = parseDuration(durationStr);
      const winnersCount = parseInt(winnersStr, 10);
      if (!durationMs || !winnersCount) {
        return message.reply({ embeds: [errorEmbed('שימוש שגוי', 'ודא/י פורמט משך תקין (1h/1d) ומספר זוכים תקין.')] });
      }
      await startGiveaway(message.channel, message.author.id, prize, durationMs, winnersCount);
      await message.delete().catch(() => {});
      break;
    }

    case 'status': {
      const statusMsg = await message.reply({ embeds: [infoEmbed('🔄 בודק סטטוס שרת...', 'אנא המתן/י רגע')] });
      const status = await getFiveMStatus();

      if (!status.online) {
        await statusMsg.edit({
          embeds: [
            errorEmbed('🔴 Server Offline', 'לא ניתן להתחבר כרגע לשרת ה-FiveM.').addFields({
              name: 'סטטוס',
              value: 'Server Offline ❌',
            }),
          ],
          components: [],
        });
        break;
      }

      const connectRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🚀 הצטרפות מהירה').setStyle(ButtonStyle.Link).setURL(config.fivem.connectLink),
        new ButtonBuilder().setLabel('🛒 חנות השרת').setStyle(ButtonStyle.Link).setURL(config.fivem.storeLink)
      );

      const e = baseEmbed()
        .setTitle(`🟢 ${status.hostname}`)
        .setDescription('השרת פעיל ומחובר!')
        .addFields(
          { name: '👥 שחקנים', value: `${status.count}/${status.max}`, inline: true },
          { name: '📶 סטטוס', value: 'Online ✅', inline: true }
        )
        .setColor(COLORS.success);

      await statusMsg.edit({ embeds: [e], components: [connectRow] });
      break;
    }
  }
}

// ==========================================================================
// אירועי הבוט
// ==========================================================================

client.once('ready', async () => {
  console.log(`✅ מחובר בתור ${client.user.tag}`);
  await registerSlashCommands();
  restoreGiveawaysOnStartup();
  await updateBotPresence();
  setInterval(updateBotPresence, 60 * 1000); // עדכון סטטוס כל דקה
  console.log('💜 Purple Bot מוכן לפעולה!');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'verify_button') return handleVerifyButton(interaction);
      if (id === 'ticket_claim') return handleTicketClaimButton(interaction);
      if (id === 'ticket_close') return handleTicketClose(interaction);
      if (id === 'ticket_transcript') return handleTicketTranscript(interaction);
      if (id.startsWith('giveaway_enter_')) return handleGiveawayEnter(interaction, id.replace('giveaway_enter_', ''));
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_type_select') return createTicketChannel(interaction, interaction.values[0]);
      if (id === 'ticket_claim_message_select') return handleClaimMessageSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'ticket_close_modal') return handleTicketCloseModal(interaction);
      return;
    }
  } catch (err) {
    console.error('שגיאה בטיפול באינטראקציה:', err);
    const errPayload = { embeds: [errorEmbed('שגיאה', 'אירעה שגיאה בעת ביצוע הפעולה. נסה/י שוב.')], ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(errPayload).catch(() => {});
    } else {
      interaction.reply(errPayload).catch(() => {});
    }
  }
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    const flagged = await handleSecurityChecks(message);
    if (flagged) return;

    if (message.content.startsWith(config.prefix)) {
      await handlePrefixCommand(message);
    }
  } catch (err) {
    console.error('שגיאה בטיפול בהודעה:', err);
  }
});

client.on('guildMemberAdd', async (member) => {
  const e = successEmbed('📥 חבר חדש הצטרף', `${member} הצטרף/ה לשרת!\n**סה"כ חברים:** ${member.guild.memberCount}`);
  await sendLog(member.guild, e, 'joinLeaveChannelId');
  await sendWelcomeMessage(member);
});

client.on('guildMemberRemove', async (member) => {
  const e = errorEmbed('📤 חבר עזב', `${member.user.tag} עזב/ה את השרת.\n**סה"כ חברים:** ${member.guild.memberCount}`);
  await sendLog(member.guild, e, 'joinLeaveChannelId');
});

client.on('guildBanAdd', async (ban) => {
  const e = errorEmbed('🔨 משתמש נחסם', `**משתמש:** ${ban.user.tag} (${ban.user.id})`);
  await sendLog(ban.guild, e, 'modLogsChannelId');
});

client.on('guildBanRemove', async (ban) => {
  const e = successEmbed('🔓 חסימה הוסרה', `**משתמש:** ${ban.user.tag} (${ban.user.id})`);
  await sendLog(ban.guild, e, 'modLogsChannelId');
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // זיהוי טיימאאוט חדש
  const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
  const newTimeout = newMember.communicationDisabledUntilTimestamp;
  if (!oldTimeout && newTimeout && newTimeout > Date.now()) {
    const e = warningEmbed('⏱️ טיימאאוט הופעל', `**משתמש:** ${newMember}\n**עד:** <t:${Math.floor(newTimeout / 1000)}:F>`);
    await sendLog(newMember.guild, e, 'modLogsChannelId');
  } else if (oldTimeout && !newTimeout) {
    const e = successEmbed('✅ טיימאאוט הוסר', `**משתמש:** ${newMember}`);
    await sendLog(newMember.guild, e, 'modLogsChannelId');
  }
});

process.on('unhandledRejection', (err) => console.error('שגיאה לא מטופלת:', err));
process.on('uncaughtException', (err) => console.error('חריגה לא מטופלת:', err));

// --------------------------------------------------------------------------
// התחברות — הטוקן נלקח ממשתנה הסביבה BOT_TOKEN (מוגדר ב-Render → Environment)
// --------------------------------------------------------------------------
if (!config.token) {
  console.error('❌ לא הוגדר BOT_TOKEN במשתני הסביבה. הגדר אותו ב-Render תחת Environment ונסה שוב.');
  process.exit(1);
}

// ==========================================================================
// 🧩 מערכת זמנית — הסרת באן ממשתמש ספציפי
// שימוש: !tempunban
// רק בעלי הרול 1515691031352311920 יכולים להריץ.
// ניתן למחוק את הבלוק הזה בשלמותו כשלא צריך יותר.
// ==========================================================================
const TEMP_UNBAN_ALLOWED_ROLE_ID = '1515691031352311920';
const TEMP_UNBAN_TARGET_USER_ID = '1159560463261114539';

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    if (message.content.trim() !== '!tempunban') return;

    const hasAllowedRole = message.member.roles.cache.has(TEMP_UNBAN_ALLOWED_ROLE_ID);
    if (!hasAllowedRole) return;

    await message.delete().catch(() => {});

    try {
      await message.guild.members.unban(
        TEMP_UNBAN_TARGET_USER_ID,
        `הוסר ע"י ${message.author.tag} (מערכת זמנית)`
      );

      const dm = await message.author.send({
        embeds: [successEmbed('✅ הבאן הוסר', `הוסרה חסימה מהמשתמש עם ID: ${TEMP_UNBAN_TARGET_USER_ID}`)],
      }).catch(() => {});

      await sendLog(
        message.guild,
        successEmbed('🔓 הסרת באן (זמנית)', `**מזהה:** ${TEMP_UNBAN_TARGET_USER_ID}\n**מפעיל:** ${message.author}`),
        'modLogsChannelId'
      );
    } catch (err) {
      message.author.send({ embeds: [errorEmbed('שגיאה', 'המשתמש לא נמצא ברשימת החסומים.')] }).catch(() => {});
    }
  } catch (err) {
    console.error('שגיאה במערכת tempunban:', err);
  }
});
// ==========================================================================
// 🧩 סוף המערכת הזמנית
// ==========================================================================

client.login(config.token);
