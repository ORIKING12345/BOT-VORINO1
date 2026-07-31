/**
 * ==========================================================================
 *  VORINO BOT — בוט דיסקורד מקצועי בסגנון כתום זוהר
 * ==========================================================================
 *  מערכות כלולות:
 *   1. מערכת טיקטים משוכללת (בחירת סוג טיקט, פאנל שליטה, לקיחת טיקט + הודעה
 *      נבחרת, סגירה עם טרנסקריפט)
 *   2. מערכת אימות בכפתור (רול מיידי)
 *   3. מערכת הגרלות (כפתור כניסה, ספירת משתתפים, בחירת זוכים אוטומטית)
 *   4. מערכת סטטוס שרת FiveM (/server-status) + חיפוש שחקן (/player-info)
 *      + חיבור ל-SQL לשליפת נתוני שחקנים אמיתיים מהדאטהבייס
 *   5. שליטה חיה בשרת ה-FiveM דרך Vorino Bridge (HTTP מאובטח): קיק,
 *      באן, הסרת באן, שידור הודעה
 *   6. מערכת לוגים מלאה (באנים, טיימאאוטים, קיקים, כניסה/יציאה, אימות)
 *   7. מודרציה בסיסית + אבטחה (אנטי-לינק, אנטי-ספאם)
 *   8. סטטוס בוט דינמי לפי כמות משתמשים בשרת ה-FiveM
 *
 *  🔧 עדכון גרסה 2.1 (תיקון סטטוס שרת):
 *   • ה-API הרשמי של cfx.re (servers-frontend.fivem.net) חסום כעת (403)
 *     לבקשות סקריפטים ולא נתמך יותר לשימוש חיצוני. הוסר משימוש קבוע.
 *   • שיטת השליפה הישירה מול IP:PORT (players.json/info.json) עדיין
 *     נשמרת כגיבוי, אך ברוב האחסונים חסומה ע"י אנטי-DDoS לתעבורה נכנסת.
 *   • נוסף מנגנון "Heartbeat": שרת ה-FiveM עצמו שולח (outbound, לא חסום)
 *     עדכון סטטוס לבוט כל 30 שניות דרך משאב Lua נפרד (vorino_status),
 *     והבוט שומר את זה בזיכרון ומציג אותו בפאנל. זו כעת שיטת ברירת המחדל.
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
  OverwriteType,
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');

// --------------------------------------------------------------------------
// שרת HTTP — משמש גם ל-keepalive של Render וגם לקבלת "heartbeat" סטטוס
// מהשרת FiveM עצמו. במקום שהבוט ינסה לגשת פנימה לשרת (תעבורה נכנסת שכמעט
// תמיד חסומה ע"י האנטי-DDoS של האחסון), שרת ה-FiveM שולח החוצה (outbound,
// כמעט אף פעם לא חסום) עדכון סטטוס כל 30 שניות. ראו משאב vorino_status.
// --------------------------------------------------------------------------
let cachedFivemStatus = null; // { online, hostname, count, max, players, receivedAt }
const HEARTBEAT_STALE_MS = 90 * 1000; // אם לא הגיע heartbeat תוך 90 שניות -> אופליין

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/vorino/heartbeat') {
      const secret = process.env.VORINO_BRIDGE_SECRET || '';
      if (!secret || req.headers['x-vorino-secret'] !== secret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy(); // הגנה מפני payload ענק
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          cachedFivemStatus = {
            online: true,
            hostname: data.hostname || 'FiveM Server',
            count: Number(data.count) || 0,
            max: Number(data.max) || 0,
            players: Array.isArray(data.players) ? data.players : [],
            receivedAt: Date.now(),
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
        }
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      client.isReady && client.isReady()
        ? `✅ Vorino Bot מחובר בתור ${client.user.tag}\n`
        : '🔄 הבוט עולה כרגע...\n'
    );
  })
  .listen(PORT, () => console.log(`🌐 HTTP keepalive/heartbeat server מאזין על פורט ${PORT}`));

// ==========================================================================
// הגדרות (CONFIG) — ה-IDs נטענים ממשתני סביבה (Render → Environment) כשהם
// רגישים (טוקן, סיסמאות), והשאר מוגדרים ישירות. אפשר לשנות הכל כאן.
// ==========================================================================
const config = {
  "token": process.env.BOT_TOKEN,
  "clientId": process.env.CLIENT_ID || "1520769665494679703",
  "guildId": process.env.GUILD_ID || "1489033656487121077",
  "prefix": "!",

  "colors": {
    "primary": "#FF7A00",
    "dark": "#7A3B00",
    "success": "#2ECC71",
    "danger": "#E74C3C",
    "warning": "#F39C12",
    "info": "#FFA733"
  },

  "roles": {
    "staffRoleId": "1530926821481382049",
    "adminRoleId": "1530926804846641372",
    "verifiedRoleId": "1530926887310856403",
    "mutedRoleId": "1530926882793455616"
  },

  "channels": {
    "logsChannelId": "1530927234066419802",
    "modLogsChannelId": "1530927228471349419",
    "joinLeaveChannelId": "1530927230698655874",
    "verifyLogsChannelId": "1530927232950730792",
    "transcriptsChannelId": "1530933515737108531",
    "ticketCategoryId": "1530927115967660052",
    "giveawayChannelId": "1530927265100202056",
    "welcomeChannelId": "1530927236570677299"
  },

  "welcome": {
    "bannerImage": "https://i.imgur.com/6YbQ0dJ.png",
    "messages": [
      "נחתת בשרת הכי כתום שיש 🧡",
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
      { "label": "ברוך הבא", "value": "welcome", "text": "שלום וברוך הבא. אני כאן כדי לסייע לך 🙏 אנא פרט/י את הבעיה בהרחבה ככל שניתן." },
      { "label": "רגע של סבלנות", "value": "patience", "text": "שלום, ראיתי את פנייתך ואני מטפל/ת בה כעת. נדרש מעט סבלנות 🕐" },
      { "label": "תודה על הפנייה", "value": "thanks", "text": "שלום, תודה שפנית אלינו. כיצד ניתן לסייע לך היום?" },
      { "label": "בבדיקה", "value": "checking", "text": "הצוות קיבל את פנייתך והיא נבדקת כעת. נעדכן בהקדם 🔎" }
    ]
  },

  "fivem": {
    "ip": "191.96.229.83",
    "port": "30120",
    // חייב להיות קישור אמיתי (URL) שמתחיל ב-http:// או https:// כדי שכפתור ה-Link בדיסקורד יעבוד.
    "connectLink": "https://cfx.re/join/rmmg7ej",
    // אופציונלי - אם אין חנות, השאירו מחרוזת ריקה ("") והכפתור פשוט לא יופיע.
    "storeLink": ""
  },

  // --------------------------------------------------------------------
  // VORINO BRIDGE — שליטה חיה בשרת ה-FiveM (קיק / באן / הסרת באן / הודעה)
  // דרך משאב Lua ייעודי (vorino_bridge) שרץ בתוך השרת ומאזין ל-HTTP.
  // חובה: להתקין את המשאב vorino_bridge בשרת, ולהגדיר ב-server.cfg:
  //   ensure vorino_bridge
  //   setr vorino_secret "אותה_סיסמה_בדיוק_כמו_VORINO_BRIDGE_SECRET"
  // הסיסמה עצמה נטענת אך ורק ממשתנה סביבה — לעולם לא נכתבת כאן בקוד.
  // שימו לב: אם האחסון חוסם תעבורה נכנסת לפורט המשחק (כמו שקורה עם
  // players.json/info.json), גם הבריאג' הזה עלול להיכשל מאותה סיבה.
  // ראו משאב vorino_status לפתרון מבוסס heartbeat יוצא לגבי סטטוס בלבד.
  // --------------------------------------------------------------------
  "bridge": {
    "secret": process.env.VORINO_BRIDGE_SECRET || "",
    "baseUrl": "" // מוגדר בפועל מיד אחרי יצירת האובייקט (תלוי ב-fivem.ip/port)
  },

  "giveaways": {
    "emoji": "🎉"
  },

  "staff": {
    // הקטגוריה שבה ייפתחו החדרים האישיים של חברי הצוות (חובה למלא)
    "categoryId": "1530932507875479886",
    // סדר היררכיה של רולי צוות, מהזוטר ביותר לבכיר ביותר.
    // כל רול שמופיע ברשימה מקבל אוטומטית גישה לחדרים האישיים
    // של כל הרולים שמופיעים *לפניו* ברשימה (כלומר, בכירים רואים זוטרים).
    // אפשר להשאיר ריק אם לא רוצים את ההתנהגות הזו.
    "hierarchy": [
      // "roleIdZutar",
      // "roleIdBinoni",
      // "roleIdBachir"
    ]
  }
};

// כתובת הבסיס של גשר ה-HTTP בשרת (אותו IP:PORT כמו fivem, אלא אם הוגדר אחרת)
config.bridge.baseUrl = process.env.VORINO_BRIDGE_URL || `http://${config.fivem.ip}:${config.fivem.port}`;

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
    staffChannels: {},    // channelId -> { userId, roleId, accessRoles: [], createdAt }
    claimLeaderboard: {}, // userId -> count של לקיחות טיקטים (לוח מובילים)
    leaderboardPanel: null,  // { channelId, messageId } של הודעת הפאנל שמתעדכנת אוטומטית
    serverStatusPanel: null, // { channelId, messageId } של פאנל סטטוס השרת שמתעדכן אוטומטית כל דקה
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData(), null, 2));
    }
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    // מיזוג עם ברירת המחדל כדי לתמוך בקבצי data.json ישנים שנשמרו לפני התוספות
    return { ...defaultData(), ...parsed };
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
// עזרים כלליים - עיצוב כתום אחיד
// --------------------------------------------------------------------------
const COLORS = config.colors;

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTimestamp()
    .setFooter({ text: 'All Reserved Save To Vorino', iconURL: client.user ? client.user.displayAvatarURL() : undefined });
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

// ==========================================================================
// VORINO BRIDGE — שליטה חיה בשרת FiveM דרך HTTP (לא RCON)
// ==========================================================================
// שכבה הזו מדברת עם המשאב Lua "vorino_bridge" שרץ בתוך שרת ה-FiveM עצמו
// (ראו את הקובץ vorino_bridge/server.lua). כל בקשה נשלחת עם כותרת
// X-Vorino-Secret שחייבת להתאים בדיוק לסיסמה שהוגדרה גם בשרת (vorino_secret)
// וגם כאן אצל הבוט (VORINO_BRIDGE_SECRET). כל בקשה ותגובה נרשמות ל-console
// כדי שיהיה אפשר לעקוב אחרי כל פעולה שמתבצעת מול השרת.
// שימו לב: פונקציות אלו דורשות תעבורה *נכנסת* לשרת ה-FiveM. אם האחסון
// חוסם זאת (כמו שקורה עם סטטוס השרת), גם הפקודות האלו ייכשלו בטיימאאוט.
// --------------------------------------------------------------------------
async function bridgeRequest(path, body, timeoutMs = 6000) {
  if (!config.bridge.secret) {
    throw new Error('לא הוגדר VORINO_BRIDGE_SECRET במשתני הסביבה — לא ניתן לתקשר עם השרת.');
  }

  const url = `${config.bridge.baseUrl}${path}`;
  console.log(`📡 [Vorino Bridge] → בקשה יוצאת: ${path} | payload: ${JSON.stringify(body)}`);

  try {
    const res = await axios.post(url, body, {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'X-Vorino-Secret': config.bridge.secret,
      },
    });

    console.log(`✅ [Vorino Bridge] ← תגובה מ-${path}: ${JSON.stringify(res.data)}`);

    if (!res.data || res.data.ok !== true) {
      throw new Error((res.data && res.data.error) || 'השרת החזיר תגובה לא תקינה.');
    }
    return res.data;
  } catch (err) {
    const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`❌ [Vorino Bridge] שגיאה בבקשה ל-${path}: ${detail}`);
    if (err.response && err.response.status === 401) {
      throw new Error('אימות נכשל מול השרת (401) — ודא/י שהסיסמה זהה בשרת (vorino_secret) ואצל הבוט (VORINO_BRIDGE_SECRET).');
    }
    throw new Error(`תקשורת עם השרת נכשלה: ${detail}`);
  }
}

async function bridgeKickPlayer(serverId, reason) {
  return bridgeRequest('/vorino/kick', { id: serverId, reason });
}

async function bridgeBanPlayer(serverId, reason) {
  return bridgeRequest('/vorino/ban', { id: serverId, reason });
}

async function bridgeUnbanPlayer(identifier) {
  return bridgeRequest('/vorino/unban', { identifier });
}

async function bridgeBroadcastMessage(message) {
  return bridgeRequest('/vorino/message', { message });
}

// ==========================================================================
// נתוני שחקנים ממסד הנתונים — נשלפים מתוך השרת עצמו דרך Vorino Bridge
// ==========================================================================
// הבוט לא מתחבר למסד הנתונים ישירות בכלל. הבקשה נשלחת למשאב ה-Lua
// (vorino_bridge/server.lua) שרץ בתוך שרת ה-FiveM, והוא זה שמריץ את
// שאילתת ה-SQL בעזרת oxmysql / mysql-async שכבר מותקן שם, ומחזיר את
// התוצאה כ-JSON. כך אין צורך לחשוף את מסד הנתונים כלפי חוץ בכלל.
// --------------------------------------------------------------------------
async function fetchPlayerFromDatabase(query) {
  try {
    const result = await bridgeRequest('/vorino/player-info', { query });
    return result.player || null;
  } catch (err) {
    console.warn(`ℹ️ [Vorino Bridge] לא ניתן היה לשלוף נתוני מסד נתונים: ${err.message}`);
    return null;
  }
}

// --------------------------------------------------------------------------
// FiveM - סטטוס שרת + חיפוש שחקן
// --------------------------------------------------------------------------
// שיטת שליפה ישירה (גיבוי בלבד) - עובדת רק אם האחסון מאפשר תעבורה נכנסת
// לפורט המשחק. ברוב האחסונים זה חסום ע"י אנטי-DDoS, ולכן שיטת ברירת
// המחדל היא ה-heartbeat (ראו cachedFivemStatus למעלה + משאב vorino_status).
// --------------------------------------------------------------------------

async function fetchFiveMPlayers() {
  const url = `http://${config.fivem.ip}:${config.fivem.port}/players.json`;
  const res = await axios.get(url, { timeout: 5000 });
  return res.data; // array of players
}

async function fetchFiveMInfo() {
  const url = `http://${config.fivem.ip}:${config.fivem.port}/info.json`;
  const res = await axios.get(url, { timeout: 5000 });
  return res.data;
}

async function fetchFiveMViaDirectIP() {
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
}

async function getFiveMStatus() {
  // עדיפות ראשונה: heartbeat שהתקבל מה-FiveM server עצמו (תעבורה יוצאת,
  // כמעט אף פעם לא חסומה ע"י אנטי-DDoS) - ראו משאב vorino_status.
  if (cachedFivemStatus && Date.now() - cachedFivemStatus.receivedAt < HEARTBEAT_STALE_MS) {
    return cachedFivemStatus;
  }

  // גיבוי: ניסיון ישיר מול IP:PORT - יעבוד רק אם האחסון לא חוסם תעבורה נכנסת
  try {
    return await fetchFiveMViaDirectIP();
  } catch (err) {
    const status = err.response ? err.response.status : null;
    const code = err.code || null;
    console.warn(`⚠️ נכשל שליפת סטטוס FiveM ישירות מה-IP. status=${status} code=${code} msg=${err.message}`);
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
      activities: [{ name: 'השרת אינו זמין ❌', type: ActivityType.Watching }],
      status: 'dnd',
    });
    return;
  }
  client.user.setPresence({
    activities: [{ name: `${status.count}/${status.max} שחקנים באונליין 🟧`, type: ActivityType.Watching }],
    status: 'online',
  });
}

// --------------------------------------------------------------------------
// עיצוב פאנל סטטוס שרת FiveM — עם פס התקדמות ויזואלי, בלי חשיפת IP/פורט
// --------------------------------------------------------------------------
function buildPlayerProgressBar(count, max, length = 14) {
  const safeMax = max > 0 ? max : Math.max(count, 1);
  const ratio = Math.min(count / safeMax, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '🟧'.repeat(filled) + '⬛'.repeat(empty);
}

function buildServerStatusEmbed(status) {
  const divider = '🟠━━━━━━━━━━━━━━━━━━━🟠';

  if (!status.online) {
    return baseEmbed()
      .setColor(COLORS.danger)
      .setTitle('🔴 שרת ה-FiveM אינו זמין')
      .setDescription(
        [
          divider,
          '**◈ הבוט לא הצליח להתחבר לשרת כרגע.**',
          '',
          'ייתכן שהשרת נמצא בתחזוקה, בתהליך הפעלה מחדש, או כבוי זמנית.',
          'הפאנל יתעדכן אוטומטית ברגע שהשרת יחזור להיות זמין ⏳',
          divider,
        ].join('\n')
      )
      .addFields(
        { name: '📶 סטטוס', value: '```diff\n- Offline\n```', inline: true },
        { name: '🌐 כתובת התחברות', value: `\`${config.fivem.ip}:${config.fivem.port}\``, inline: true }
      )
      .setFooter({ text: '🔄 מתעדכן אוטומטית כל דקה • Vorino Bot' });
  }

  const bar = buildPlayerProgressBar(status.count, status.max);
  const percent = status.max > 0 ? Math.round((status.count / status.max) * 100) : 0;

  return baseEmbed()
    .setColor(COLORS.primary)
    .setTitle(`🟠 ${status.hostname} 🟠`)
    .setThumbnail(client.user ? client.user.displayAvatarURL() : null)
    .setDescription(
      [
        divider,
        '**◈ השרת פעיל ומקוון כעת** 🧡✨',
        divider,
      ].join('\n')
    )
    .addFields(
      { name: '📶 סטטוס', value: '```diff\n+ Online\n```', inline: true },
      { name: '🌐 כתובת התחברות (IP:PORT)', value: `\`\`\`${config.fivem.ip}:${config.fivem.port}\`\`\``, inline: true },
      { name: '\u200b', value: '\u200b', inline: false },
      { name: '👥 שחקנים מחוברים', value: `**${status.count} / ${status.max}** שחקנים  •  **${percent}%** תפוסה`, inline: false },
      { name: '📊 מד תפוסה', value: `${bar}\n\`${percent}%\``, inline: false }
    )
    .setFooter({ text: '🔄 מתעדכן אוטומטית כל דקה • Vorino Bot 🧡' });
}

function buildServerStatusRow() {
  const components = [
    new ButtonBuilder().setLabel('🚀 הצטרפות מהירה').setStyle(ButtonStyle.Link).setURL(config.fivem.connectLink),
  ];
  if (config.fivem.storeLink) {
    components.push(new ButtonBuilder().setLabel('🛒 חנות השרת').setStyle(ButtonStyle.Link).setURL(config.fivem.storeLink));
  }
  components.push(
    new ButtonBuilder().setCustomId('server_status_refresh').setLabel('רענון ידני').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );
  return new ActionRowBuilder().addComponents(components);
}

async function handleServerStatusRefresh(interaction) {
  await interaction.deferUpdate();
  const status = await getFiveMStatus();
  await interaction.editReply({ embeds: [buildServerStatusEmbed(status)], components: [buildServerStatusRow()] });
}

// פאנל סטטוס שרת שמתעדכן אוטומטית כל דקה, בדומה ללוח המובילים.
async function updateServerStatusPanel() {
  if (!db.serverStatusPanel) return;
  const { channelId, messageId } = db.serverStatusPanel;
  try {
    const channel = await client.channels.fetch(channelId);
    const msg = await channel.messages.fetch(messageId);
    const status = await getFiveMStatus();
    await msg.edit({ embeds: [buildServerStatusEmbed(status)], components: [buildServerStatusRow()] });
  } catch (err) {
    console.error('שגיאה בעדכון פאנל סטטוס השרת (ייתכן שההודעה/הערוץ נמחקו):', err.message);
  }
}

// ==========================================================================
// מערכת טיקטים
// ==========================================================================

function buildTicketPanelEmbed() {
  return baseEmbed()
    .setTitle('🎫 מערכת פניות ותמיכה')
    .setDescription(
      [
        '**◈ ברוכים הבאים למרכז התמיכה הרשמי.**',
        '',
        'בחר/י את הנושא המתאים מהתפריט למטה כדי לפתוח פנייה חדשה.',
        'צוות התמיכה יטפל בפנייתך במהירות המרבית 🧡',
        '',
        '**כללי פתיחת פנייה:**',
        '• פנייה אחת בלבד לכל נושא',
        '• אין לפתוח פניות סרק או לבצע ספאם',
        '• יש לפרט את הבעיה בצורה ברורה ומדויקת',
      ].join('\n')
    )
    .setThumbnail(client.user ? client.user.displayAvatarURL() : null)
    .setColor(COLORS.primary);
}

function buildTicketSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_type_select')
    .setPlaceholder('📩 בחר/י את סוג הפנייה שברצונך לפתוח')
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
    .setLabel(claimed ? 'נלקח' : 'קח פנייה')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Success)
    .setDisabled(claimed);

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('סגור פנייה')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const addUserBtn = new ButtonBuilder()
    .setCustomId('ticket_transcript')
    .setLabel('טרנסקריפט')
    .setEmoji('📄')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(claimBtn, closeBtn, addUserBtn);
}

// הופך שם/כינוי חופשי לשם ערוץ תקין בדיסקורד (ללא רווחים/תווים אסורים)
function sanitizeChannelName(raw) {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'user';
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
      embeds: [errorEmbed('פנייה פתוחה כבר קיימת', `כבר יש לך פנייה פתוחה: <#${existing[0]}>`)],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  db.ticketCounter += 1;
  const ticketNumber = db.ticketCounter;
  const channelName = `ticket-${ticketNumber}-${member.user.username}`.toLowerCase().slice(0, 90);

  const categoryId = config.channels.ticketCategoryId;
  const overwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      type: OverwriteType.Member,
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
      type: OverwriteType.Role,
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

  let ticketChannel;
  try {
    // בדיקה מוקדמת: קטגוריה מוגבלת ל-50 ערוצים בדיסקורד
    if (channelOptions.parent) {
      const category = await guild.channels.fetch(channelOptions.parent).catch(() => null);
      if (!category) {
        db.ticketCounter -= 1; // מבטלים את המונה כדי לא "לשרוף" מספר טיקט על ניסיון כושל
        return interaction.editReply({
          embeds: [errorEmbed('קטגוריית טיקטים לא נמצאה', 'הקטגוריה המוגדרת ב-ticketCategoryId לא קיימת יותר או שהבוט לא רואה אותה.')],
        });
      }
      if (category.children.cache.size >= 50) {
        db.ticketCounter -= 1;
        return interaction.editReply({
          embeds: [errorEmbed('הקטגוריה מלאה', 'קטגוריית הטיקטים הגיעה למקסימום 50 ערוצים. יש לפנות ערוצים ישנים או להגדיר קטגוריה נוספת.')],
        });
      }
    }
    ticketChannel = await guild.channels.create(channelOptions);
  } catch (err) {
    console.error('שגיאה ביצירת ערוץ טיקט:', err);
    db.ticketCounter -= 1;
    return interaction.editReply({
      embeds: [errorEmbed('שגיאה בפתיחת הפנייה', 'לא ניתן היה ליצור את ערוץ הפנייה. ודא/י שלבוט יש הרשאת "Manage Channels" בשרת ובקטגוריה שהוגדרה.')],
    });
  }

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
    .setTitle(`🎫 פנייה #${ticketNumber} — ${ticketTypeLabel(typeValue)}`)
    .setDescription(
      [
        `שלום ${member} 👋`,
        '',
        'תודה על פנייתך. צוות התמיכה יגיע בהקדם האפשרי.',
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
    embeds: [successEmbed('הפנייה נפתחה בהצלחה', `הפנייה שלך נפתחה: ${ticketChannel}`)],
  });

  await sendLog(
    guild,
    infoEmbed('🎫 פנייה חדשה נפתחה', `**מספר:** #${ticketNumber}\n**משתמש:** ${member}\n**סוג:** ${ticketTypeLabel(typeValue)}\n**ערוץ:** ${ticketChannel}`)
  );
}

function buildClaimMessageSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_claim_message_select')
    .setPlaceholder('💬 בחר/י הודעת פתיחה לשליחה בפנייה')
    .addOptions(
      config.tickets.claimMessages.map((m) => ({ label: m.label, value: m.value }))
    );
  return new ActionRowBuilder().addComponents(select);
}

async function handleTicketClaimButton(interaction) {
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) {
    return interaction.reply({ embeds: [errorEmbed('שגיאה', 'זהו לא ערוץ פנייה תקין.')], ephemeral: true });
  }
  if (!hasStaffRole(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק צוות רשאי לקחת פניות.')], ephemeral: true });
  }
  if (ticket.claimedBy) {
    return interaction.reply({
      embeds: [errorEmbed('כבר נלקח', `הפנייה הזו כבר נלקחה על ידי <@${ticket.claimedBy}>`)],
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: 'בחר/י הודעה שתישלח בערוץ הפנייה עם לקיחתה:',
    components: [buildClaimMessageSelectRow()],
    ephemeral: true,
  });
}

async function handleClaimMessageSelect(interaction) {
  const ticket = db.tickets[interaction.channel.id];
  if (!ticket) return interaction.update({ content: 'שגיאה: פנייה לא נמצאה.', components: [] });

  const chosen = config.tickets.claimMessages.find((m) => m.value === interaction.values[0]);
  ticket.claimedBy = interaction.user.id;
  ensureLeaderboardEntry(interaction.user.id);
  db.claimLeaderboard[interaction.user.id] += 1;
  saveData();

  const claimEmbed = successEmbed('🙋 הפנייה נלקחה', `הפנייה נלקחה על ידי ${interaction.user}`).addFields({
    name: 'הודעה מהצוות',
    value: chosen ? chosen.text : 'הפנייה נלקחה וטופלת בקרוב.',
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

  await interaction.update({ content: '✅ ההודעה נשלחה בהצלחה בפנייה.', components: [] });

  await sendLog(
    interaction.guild,
    infoEmbed('🙋 פנייה נלקחה', `**פנייה:** #${ticket.ticketNumber}\n**נלקחה על ידי:** ${interaction.user}\n**ערוץ:** ${interaction.channel}`)
  );

  await updateLeaderboardPanel(interaction.guild);
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
  if (!ticket) return interaction.reply({ embeds: [errorEmbed('שגיאה', 'זהו לא ערוץ פנייה תקין.')], ephemeral: true });
  if (!hasStaffRole(interaction.member) && interaction.user.id !== ticket.userId) {
    return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לסגור פנייה זו.')], ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId('ticket_close_modal').setTitle('סגירת פנייה');
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
  if (!ticket) return interaction.reply({ content: 'שגיאה: פנייה לא נמצאה.', ephemeral: true });

  const reason = interaction.fields.getTextInputValue('close_reason') || 'לא צוינה סיבה';
  await interaction.reply({ embeds: [infoEmbed('🔒 סוגר את הפנייה...', `הפנייה תיסגר בעוד 5 שניות.\n**סיבה:** ${reason}`)] });

  const transcriptText = await generateTranscript(interaction.channel);
  const buffer = Buffer.from(transcriptText, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });

  const transcriptChannel = await getLogChannel(interaction.guild, 'transcriptsChannelId');
  const closeLog = infoEmbed(
    '🔒 פנייה נסגרה',
    `**מספר:** #${ticket.ticketNumber}\n**נפתחה על ידי:** <@${ticket.userId}>\n**נסגרה על ידי:** ${interaction.user}\n**סיבה:** ${reason}`
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
    .setTitle('🧡 חבר/ה חדש/ה הצטרף/ה!')
    .setDescription(
      [
        `ברוך/ה הבא/ה ${member} ל **${member.guild.name}**!`,
        '',
        randomMsg,
        '',
        `🎫 לא לשכוח לעבור אימות ולפתוח פנייה אם צריך עזרה.`,
      ].join('\n')
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
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
        'לאחר האימות תקבל/י גישה לכלל הערוצים והרול המתאים באופן מיידי 🧡',
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
  else e.setDescription('לחצו על הכפתור למטה כדי להצטרף להגרלה! בהצלחה 🧡');
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
// מערכת לוח מובילים — לקיחות טיקטים (Claims Leaderboard)
// ==========================================================================

function medalForRank(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

function ensureLeaderboardEntry(userId) {
  if (!(userId in db.claimLeaderboard)) {
    db.claimLeaderboard[userId] = 0;
    return true; // נוסף עכשיו
  }
  return false; // כבר היה קיים
}

function buildLeaderboardEmbed() {
  const entries = Object.entries(db.claimLeaderboard); // [userId, count]
  entries.sort((a, b) => b[1] - a[1]);

  const lines = entries.length
    ? entries.map(([userId, count], idx) => `${medalForRank(idx + 1)} <@${userId}> — **${count}** לקיחות`)
    : ['אין עדיין אנשים בטבלה. אפשר להוסיף עם `/leaderboard-add`.'];

  return baseEmbed()
    .setTitle('🏆 לוח מובילים — לקיחות טיקטים')
    .setDescription(lines.join('\n'))
    .setColor(COLORS.primary)
    .setFooter({ text: 'מתעדכן אוטומטית בכל לקיחת טיקט • Vorino Bot' });
}

async function updateLeaderboardPanel(guild) {
  if (!db.leaderboardPanel) return;
  const { channelId, messageId } = db.leaderboardPanel;
  try {
    const channel = await guild.channels.fetch(channelId);
    const msg = await channel.messages.fetch(messageId);
    await msg.edit({ embeds: [buildLeaderboardEmbed()] });
  } catch (err) {
    console.error('שגיאה בעדכון פאנל לוח המובילים (ייתכן שההודעה/הערוץ נמחקו):', err);
  }
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
    .setDescription('חוסם משתמש מהשרת (דיסקורד)')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש לחסימה').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('סיבת החסימה').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('מסיר חסימה ממשתמש (דיסקורד)')
    .addStringOption((o) => o.setName('userid').setDescription('מזהה המשתמש').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('מסלק משתמש מהשרת (דיסקורד)')
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
    .setName('server-status')
    .setDescription('מציג פאנל סטטוס שרת FiveM חי (מתעדכן אוטומטית כל דקה)'),

  new SlashCommandBuilder()
    .setName('player-info')
    .setDescription('מחפש שחקן בשרת ה-FiveM (חי + מסד נתונים, אם מוגדר)')
    .addStringOption((o) => o.setName('query').setDescription('שם השחקן, מזהה בשרת או זיהוי').setRequired(true)),

  new SlashCommandBuilder().setName('server-players').setDescription('מציג רשימת שחקנים מחוברים לשרת ה-FiveM'),

  new SlashCommandBuilder()
    .setName('server-kick')
    .setDescription('מסלק שחקן משרת ה-FiveM עצמו (בזמן אמת, דרך Vorino Bridge)')
    .addIntegerOption((o) => o.setName('server_id').setDescription('מזהה השחקן בשרת (Server ID)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('סיבת הסילוק').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('server-ban')
    .setDescription('חוסם שחקן משרת ה-FiveM עצמו (בזמן אמת, דרך Vorino Bridge)')
    .addIntegerOption((o) => o.setName('server_id').setDescription('מזהה השחקן בשרת (Server ID)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('סיבת החסימה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('server-unban')
    .setDescription('מסיר חסימה משחקן בשרת ה-FiveM עצמו (בזמן אמת, דרך Vorino Bridge)')
    .addStringOption((o) => o.setName('identifier').setDescription('מזהה הבאן / הזיהוי של השחקן').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('server-message')
    .setDescription('משדר הודעה לכלל השחקנים בשרת ה-FiveM (בזמן אמת, דרך Vorino Bridge)')
    .addStringOption((o) => o.setName('message').setDescription('תוכן ההודעה שתישלח לכל השחקנים').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('addstaff')
    .setDescription('מוסיף חבר צוות חדש ופותח לו חדר אישי (אדמין בלבד)')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש להוספה לצוות').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('הרול שיינתן לחבר הצוות').setRequired(true))
    .addRoleOption((o) => o.setName('access_role_1').setDescription('רול נוסף עם גישה לחדר (אופציונלי)').setRequired(false))
    .addRoleOption((o) => o.setName('access_role_2').setDescription('רול נוסף עם גישה לחדר (אופציונלי)').setRequired(false))
    .addRoleOption((o) => o.setName('access_role_3').setDescription('רול נוסף עם גישה לחדר (אופציונלי)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('removestaff')
    .setDescription('מסיר חבר צוות ומוחק את החדר האישי שלו (אדמין בלבד)')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש להסרה מהצוות').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('מציג את לוח המובילים של לקיחות הטיקטים')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('leaderboard-panel')
    .setDescription('מפרסם פאנל לוח מובילים שמתעדכן אוטומטית בכל לקיחת טיקט')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('leaderboard-add')
    .setDescription('מוסיף משתמש ללוח המובילים (עם 0 לקיחות אם עדיין אין לו)')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש להוספה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('leaderboard-remove')
    .setDescription('מסיר משתמש מלוח המובילים')
    .addUserOption((o) => o.setName('user').setDescription('המשתמש להסרה').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('leaderboard-reset')
    .setDescription('מאפס את לוח המובילים כולו (בלתי הפיך, אדמין בלבד)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('izkor')
    .setDescription('יוצר הנצחה לזכר חייל שנפל בהגנה על המולדת (אדמין בלבד)')
    .addStringOption((o) => o.setName('name').setDescription('שם החייל ז"ל').setRequired(true))
    .addStringOption((o) => o.setName('description').setDescription('תיאור / סיפור על החייל').setRequired(true))
    .addStringOption((o) => o.setName('image').setDescription('קישור לתמונת החייל (אופציונלי)').setRequired(false))
    .addStringOption((o) => o.setName('rank').setDescription('דרגה / תפקיד (אופציונלי)').setRequired(false))
    .addStringOption((o) => o.setName('unit').setDescription('יחידה / חטיבה (אופציונלי)').setRequired(false))
    .addStringOption((o) => o.setName('date').setDescription('תאריך הנפילה (אופציונלי)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

// --------------------------------------------------------------------------
// רישום פקודות סלאש — סנכרון מלא מול דיסקורד
// --------------------------------------------------------------------------
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    const existing = await rest
      .get(Routes.applicationGuildCommands(config.clientId, config.guildId))
      .catch(() => []);
    const existingNames = new Set((existing || []).map((c) => c.name));
    const newNames = new Set(slashCommands.map((c) => c.name));

    const added = [...newNames].filter((n) => !existingNames.has(n));
    const removed = [...existingNames].filter((n) => !newNames.has(n));

    const result = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: slashCommands,
    });

    console.log(`✅ פקודות הסלאש סונכרנו בהצלחה. סה"כ פקודות פעילות: ${result.length}`);
    if (added.length) console.log(`   ➕ נוספו: ${added.join(', ')}`);
    if (removed.length) console.log(`   ➖ הוסרו (לא קיימות יותר בקוד): ${removed.join(', ')}`);
    if (!added.length && !removed.length) console.log('   ↔️ אין שינוי ברשימת הפקודות מאז העלייה הקודמת.');
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

    case 'server-status': {
      await interaction.deferReply();
      const status = await getFiveMStatus();
      const sentMsg = await interaction.editReply({ embeds: [buildServerStatusEmbed(status)], components: [buildServerStatusRow()] });
      // שומרים את ההודעה כדי שהפאנל הזה יתעדכן אוטומטית כל דקה
      db.serverStatusPanel = { channelId: interaction.channel.id, messageId: sentMsg.id };
      saveData();
      break;
    }

    case 'player-info': {
      const query = options.getString('query');
      await interaction.deferReply();

      const status = await getFiveMStatus();
      const livePlayer = status.online ? findPlayerInList(status.players, query) : null;
      const dbPlayer = await fetchPlayerFromDatabase(query);

      if (!livePlayer && !dbPlayer) {
        return interaction.editReply({
          embeds: [errorEmbed('שחקן לא נמצא', `לא נמצא שחקן התואם ל: "${query}" — לא באונליין ולא במסד הנתונים.`)],
        });
      }

      const e = baseEmbed().setTitle(`🎮 כרטיס שחקן: ${(livePlayer && livePlayer.name) || query}`);

      if (livePlayer) {
        const discordId = (livePlayer.identifiers || []).find((id) => id.startsWith('discord:'));
        e.addFields(
          { name: '📶 סטטוס', value: '```diff\n+ מחובר כעת\n```', inline: false },
          { name: '🆔 מזהה שרת', value: `${livePlayer.id}`, inline: true },
          { name: '📡 פינג', value: `${livePlayer.ping}ms`, inline: true },
          { name: '💬 דיסקורד', value: discordId ? `<@${discordId.split(':')[1]}>` : 'לא מקושר', inline: true }
        );
      } else {
        e.addFields({ name: '📶 סטטוס', value: '```diff\n- לא מחובר כרגע\n```', inline: false });
      }

      if (dbPlayer) {
        // מציג את כל השדות שהשרת החזיר בפועל מטבלת Gamers, פרט לשדות רגישים
        // (סיסמאות/טוקנים/כתובות IP) שמסוננים תמיד כבסיס בטיחות.
        const blacklist = ['password', 'pass', 'token', 'secret', 'hwid', 'ip'];
        const dbLines = Object.entries(dbPlayer)
          .filter(([key, val]) => val !== null && val !== undefined && !blacklist.some((b) => key.toLowerCase().includes(b)))
          .slice(0, 20)
          .map(([key, val]) => `**${key}:** ${val}`);
        if (dbLines.length) {
          e.addFields({ name: '🗄️ נתוני מסד הנתונים (Gamers)', value: dbLines.join('\n').slice(0, 1024) });
        }
      } else {
        e.addFields({ name: '🗄️ מסד נתונים', value: 'לא נמצאו נתונים במסד הנתונים עבור חיפוש זה (או שהגשר לשרת לא הגיב).' });
      }

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

    case 'server-kick': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const serverId = options.getInteger('server_id');
      const reason = options.getString('reason') || 'לא צוינה סיבה';
      await interaction.deferReply();
      try {
        await bridgeKickPlayer(serverId, reason);
        await interaction.editReply({ embeds: [successEmbed('🚨 שחקן סולק מהשרת', `שחקן במזהה **${serverId}** סולק מהשרת בזמן אמת.\n**סיבה:** ${reason}`)] });
        await sendLog(guild, warningEmbed('🚨 קיק משרת FiveM', `**מזהה שחקן:** ${serverId}\n**מפעיל:** ${interaction.user}\n**סיבה:** ${reason}`), 'modLogsChannelId');
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('שגיאה בביצוע הקיק', err.message)] });
      }
      break;
    }

    case 'server-ban': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const serverId = options.getInteger('server_id');
      const reason = options.getString('reason');
      await interaction.deferReply();
      try {
        await bridgeBanPlayer(serverId, reason);
        await interaction.editReply({ embeds: [successEmbed('🚨 שחקן נחסם בשרת', `שחקן במזהה **${serverId}** נחסם בשרת בזמן אמת.\n**סיבה:** ${reason}`)] });
        await sendLog(guild, errorEmbed('🚨 באן משרת FiveM', `**מזהה שחקן:** ${serverId}\n**מפעיל:** ${interaction.user}\n**סיבה:** ${reason}`), 'modLogsChannelId');
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('שגיאה בביצוע החסימה', err.message)] });
      }
      break;
    }

    case 'server-unban': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const identifier = options.getString('identifier');
      await interaction.deferReply();
      try {
        await bridgeUnbanPlayer(identifier);
        await interaction.editReply({ embeds: [successEmbed('✅ החסימה הוסרה בשרת', `הוסרה חסימה עבור **${identifier}**.`)] });
        await sendLog(guild, successEmbed('✅ הסרת באן משרת FiveM', `**זיהוי:** ${identifier}\n**מפעיל:** ${interaction.user}`), 'modLogsChannelId');
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('שגיאה בהסרת החסימה', err.message)] });
      }
      break;
    }

    case 'server-message': {
      if (!hasStaffRole(member)) return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'אין לך הרשאה לבצע פקודה זו.')], ephemeral: true });
      const msgText = options.getString('message');
      await interaction.deferReply();
      try {
        await bridgeBroadcastMessage(msgText);
        await interaction.editReply({ embeds: [successEmbed('📢 ההודעה שודרה', `ההודעה נשלחה לכלל השחקנים המחוברים בשרת:\n\n> ${msgText}`)] });
        await sendLog(guild, infoEmbed('📢 שידור הודעה לשרת FiveM', `**תוכן:** ${msgText}\n**מפעיל:** ${interaction.user}`));
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('שגיאה בשידור ההודעה', err.message)] });
      }
      break;
    }

    case 'addstaff': {
      if (!hasAdminRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק אדמינים יכולים להשתמש בפקודה זו.')], ephemeral: true });
      }

      const targetUser = options.getUser('user');
      const staffRole = options.getRole('role');
      const extraRoles = [1, 2, 3]
        .map((n) => options.getRole(`access_role_${n}`))
        .filter(Boolean);

      const categoryId = config.staff.categoryId;
      if (!categoryId || categoryId.includes('_ID')) {
        return interaction.reply({
          embeds: [errorEmbed('לא הוגדרה קטגוריה', 'יש להגדיר קודם את staff.categoryId בקונפיג של הבוט לפני השימוש בפקודה.')],
          ephemeral: true,
        });
      }

      const alreadyExisting = Object.entries(db.staffChannels).find(([, s]) => s.userId === targetUser.id);
      if (alreadyExisting) {
        return interaction.reply({
          embeds: [errorEmbed('כבר קיים חדר', `כבר קיים חדר צוות אישי עבור המשתמש הזה: <#${alreadyExisting[0]}>`)],
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        return interaction.editReply({ embeds: [errorEmbed('שגיאה', 'לא נמצא חבר כזה בשרת.')] });
      }

      try {
        await targetMember.roles.add(staffRole);
      } catch (err) {
        console.error('שגיאה בהוספת רול צוות:', err);
        return interaction.editReply({
          embeds: [errorEmbed('שגיאה בהוספת הרול', 'לבוט אין הרשאה להוסיף את הרול הזה. ודא/י שרול הבוט נמצא מעל הרול הזה בהיררכיה.')],
        });
      }

      // גישה אוטומטית לפי היררכיה: רולים שמופיעים ברשימת config.staff.hierarchy
      // *אחרי* הרול שניתן, מקבלים גישה אוטומטית (כלומר, בכירים רואים חדרים של זוטרים)
      const hierarchy = config.staff.hierarchy || [];
      const roleIndex = hierarchy.indexOf(staffRole.id);
      const seniorRoleIds = roleIndex === -1 ? [] : hierarchy.slice(roleIndex + 1);

      // --------------------------------------------------------------------
      // 🔧 כל איבר ב-overwrites חייב id + type מפורש כדי למנוע שגיאת
      // "Supplied parameter is not a cached User or Role" — כל רול נבדק
      // מול guild.roles.cache לפני שהוא נכנס לרשימה, ורולים לא-קיימים
      // פשוט מדולגים במקום לקרוס את כל הפקודה.
      // --------------------------------------------------------------------
      const overwrites = [
        { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: targetUser.id,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ];

      if (config.roles.adminRoleId && !config.roles.adminRoleId.includes('_ID')) {
        const adminRole = guild.roles.cache.get(config.roles.adminRoleId);
        if (adminRole) {
          overwrites.push({
            id: adminRole.id,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          });
        } else {
          console.warn(`⚠️ adminRoleId (${config.roles.adminRoleId}) לא נמצא בקאש הרולים של השרת — דילוג.`);
        }
      }

      overwrites.push({
        id: staffRole.id,
        type: OverwriteType.Role,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });

      const accessRoleIds = [...seniorRoleIds, ...extraRoles.map((r) => r.id)];
      for (const roleId of accessRoleIds) {
        if (overwrites.some((o) => o.id === roleId)) continue;
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          console.warn(`⚠️ רול גישה (${roleId}) מתוך hierarchy/access_role לא נמצא בשרת — דילוג.`);
          continue;
        }
        overwrites.push({
          id: role.id,
          type: OverwriteType.Role,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }

      let staffChannel;
      try {
        const category = await guild.channels.fetch(categoryId).catch(() => null);
        if (!category) {
          return interaction.editReply({ embeds: [errorEmbed('קטגוריה לא נמצאה', 'הקטגוריה שהוגדרה ב-staff.categoryId לא קיימת יותר, או שהבוט לא רואה אותה.')] });
        }
        // שם הערוץ: staff-<כינוי מהשרת> (אם אין כינוי, נופל חזרה לשם המשתמש)
        const staffNick = sanitizeChannelName(targetMember.displayName || targetMember.user.username);
        staffChannel = await guild.channels.create({
          name: `staff-${staffNick}`.slice(0, 90),
          type: ChannelType.GuildText,
          parent: categoryId,
          permissionOverwrites: overwrites,
          topic: `חדר אישי לחבר צוות | ${targetUser.id} | רול: ${staffRole.name}`,
        });
      } catch (err) {
        console.error('שגיאה ביצירת חדר צוות:', err);
        return interaction.editReply({
          embeds: [errorEmbed('שגיאה ביצירת החדר', 'ייתכן שהקטגוריה מלאה (מקסימום 50 ערוצים) או שלבוט אין הרשאות מספיקות בקטגוריה זו.')],
        });
      }

      db.staffChannels[staffChannel.id] = {
        userId: targetUser.id,
        roleId: staffRole.id,
        accessRoles: [staffRole.id, ...accessRoleIds],
        createdAt: Date.now(),
      };
      saveData();

      const welcomeEmbed = successEmbed(
        '🧡 ברוך/ה הבא/ה לצוות!',
        [
          `שלום ${targetMember} 👋`,
          '',
          `נוספת לצוות עם הרול ${staffRole}.`,
          'זהו החדר האישי שלך — כאן תוכל/י לתקשר עם שאר הצוות ולקבל עדכונים אישיים.',
        ].join('\n')
      );
      await staffChannel.send({ content: `${targetMember}`, embeds: [welcomeEmbed] });

      await interaction.editReply({
        embeds: [successEmbed('✅ חבר צוות נוסף בהצלחה', `${targetMember} נוסף/ה לצוות עם הרול ${staffRole}.\nהחדר האישי: ${staffChannel}`)],
      });

      await sendLog(
        guild,
        infoEmbed('👥 חבר צוות חדש', `**משתמש:** ${targetMember}\n**רול:** ${staffRole}\n**חדר:** ${staffChannel}\n**נוסף על ידי:** ${interaction.user}`)
      );
      break;
    }

    case 'removestaff': {
      if (!hasAdminRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק אדמינים יכולים להשתמש בפקודה זו.')], ephemeral: true });
      }
      const targetUser = options.getUser('user');
      const entry = Object.entries(db.staffChannels).find(([, s]) => s.userId === targetUser.id);
      if (!entry) {
        return interaction.reply({ embeds: [errorEmbed('לא נמצא', 'לא נמצא חדר צוות פעיל למשתמש הזה.')], ephemeral: true });
      }
      const [channelId, staffData] = entry;

      await interaction.reply({ embeds: [infoEmbed('🗑️ מסיר מהצוות...', 'החדר יימחק בעוד 5 שניות.')], ephemeral: true });

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (targetMember && staffData.roleId) {
        await targetMember.roles.remove(staffData.roleId).catch(() => {});
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel) setTimeout(() => channel.delete().catch(() => {}), 5000);

      delete db.staffChannels[channelId];
      saveData();

      await sendLog(guild, warningEmbed('👥 חבר צוות הוסר', `**משתמש:** <@${targetUser.id}>\n**הוסר על ידי:** ${interaction.user}`));
      break;
    }

    case 'leaderboard': {
      if (!hasStaffRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק צוות יכול לצפות בלוח המובילים.')], ephemeral: true });
      }
      await interaction.reply({ embeds: [buildLeaderboardEmbed()] });
      break;
    }

    case 'leaderboard-panel': {
      if (!hasStaffRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק צוות יכול לפרסם את הפאנל.')], ephemeral: true });
      }
      const panelMsg = await interaction.channel.send({ embeds: [buildLeaderboardEmbed()] });
      db.leaderboardPanel = { channelId: interaction.channel.id, messageId: panelMsg.id };
      saveData();
      await interaction.reply({
        embeds: [
          successEmbed(
            '✅ הפאנל פורסם',
            'הפאנל יתעדכן אוטומטית בכל פעם שטיקט יילקח, וגם בעת שימוש בפקודות /leaderboard-add ו-/leaderboard-remove.'
          ),
        ],
        ephemeral: true,
      });
      break;
    }

    case 'leaderboard-add': {
      if (!hasStaffRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק צוות יכול להוסיף לטבלה.')], ephemeral: true });
      }
      const target = options.getUser('user');
      const added = ensureLeaderboardEntry(target.id);
      saveData();
      await updateLeaderboardPanel(guild);
      await interaction.reply({
        embeds: [
          added
            ? successEmbed('➕ נוסף/ה לטבלה', `${target} נוסף/ה ללוח המובילים עם 0 לקיחות.`)
            : infoEmbed('כבר בטבלה', `${target} כבר נמצא/ת בלוח המובילים.`),
        ],
        ephemeral: true,
      });
      break;
    }

    case 'leaderboard-remove': {
      if (!hasStaffRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק צוות יכול להסיר מהטבלה.')], ephemeral: true });
      }
      const target = options.getUser('user');
      if (!(target.id in db.claimLeaderboard)) {
        return interaction.reply({ embeds: [errorEmbed('לא נמצא', `${target} לא נמצא/ת בלוח המובילים.`)], ephemeral: true });
      }
      delete db.claimLeaderboard[target.id];
      saveData();
      await updateLeaderboardPanel(guild);
      await interaction.reply({ embeds: [successEmbed('➖ הוסר/ה מהטבלה', `${target} הוסר/ה מלוח המובילים.`)], ephemeral: true });
      break;
    }

    case 'leaderboard-reset': {
      if (!hasAdminRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק אדמינים יכולים לאפס את לוח המובילים.')], ephemeral: true });
      }
      db.claimLeaderboard = {};
      saveData();
      await updateLeaderboardPanel(guild);
      await interaction.reply({ embeds: [successEmbed('🔄 הלוח אופס', 'לוח המובילים אופס בהצלחה.')] });
      await sendLog(guild, warningEmbed('🔄 איפוס לוח מובילים', `**אופס על ידי:** ${interaction.user}`));
      break;
    }

    case 'izkor': {
      if (!hasAdminRole(member)) {
        return interaction.reply({ embeds: [errorEmbed('אין הרשאה', 'רק אדמינים יכולים להשתמש בפקודה זו.')], ephemeral: true });
      }

      const soldierName = options.getString('name');
      const description = options.getString('description');
      const imageUrl = options.getString('image');
      const rank = options.getString('rank');
      const unit = options.getString('unit');
      const dateStr = options.getString('date');

      // ולידציה בסיסית לקישור התמונה כדי לא לשלוח embed שבור
      if (imageUrl && !/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(imageUrl.trim())) {
        return interaction.reply({
          embeds: [errorEmbed('קישור תמונה לא תקין', 'יש להזין קישור ישיר לתמונה (למשל מסתיים ב-.png / .jpg / .webp).')],
          ephemeral: true,
        });
      }

      const memorialEmbed = new EmbedBuilder()
        .setColor(COLORS.dark)
        .setTitle(`🕯️ לזכרו/ה של ${soldierName} ז"ל`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({
          text: 'יהי זכרו/ה ברוך 🇮🇱',
          iconURL: client.user ? client.user.displayAvatarURL() : undefined,
        });

      if (rank) memorialEmbed.addFields({ name: '🎖️ דרגה / תפקיד', value: rank, inline: true });
      if (unit) memorialEmbed.addFields({ name: '🪖 יחידה', value: unit, inline: true });
      if (dateStr) memorialEmbed.addFields({ name: '📅 תאריך הנפילה', value: dateStr, inline: true });
      if (imageUrl) memorialEmbed.setImage(imageUrl.trim());

      await interaction.reply({ embeds: [memorialEmbed] });

      await sendLog(
        guild,
        infoEmbed('🕯️ פורסמה הנצחה', `**שם:** ${soldierName}\n**פורסם על ידי:** ${interaction.user}\n**ערוץ:** ${interaction.channel}`)
      );
      break;
    }
  }
}

// ==========================================================================
// פקודות פרפיקס (!) — פאנלים בלבד
// ==========================================================================
async function handlePrefixCommand(message) {
  if (!message.content.startsWith(config.prefix)) return;
  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // כל פקודות ה-! דורשות הרשאת צוות
  if (!hasStaffRole(message.member)) return;

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
  }
}

// --------------------------------------------------------------------------
// בדיקת הרשאות הבוט + מיקומו בהיררכיית הרולים
// --------------------------------------------------------------------------
async function checkBotPermissions(guild) {
  const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    console.warn('⚠️ לא הצלחתי לבדוק הרשאות בוט (לא נמצא כחבר בשרת?).');
    return;
  }

  const hasAdmin = me.permissions.has(PermissionFlagsBits.Administrator);

  const specificPerms = [
    ['ViewChannel', PermissionFlagsBits.ViewChannel],
    ['SendMessages', PermissionFlagsBits.SendMessages],
    ['ManageChannels', PermissionFlagsBits.ManageChannels],
    ['ManageRoles', PermissionFlagsBits.ManageRoles],
    ['ManageMessages', PermissionFlagsBits.ManageMessages],
    ['KickMembers', PermissionFlagsBits.KickMembers],
    ['BanMembers', PermissionFlagsBits.BanMembers],
    ['ModerateMembers', PermissionFlagsBits.ModerateMembers],
    ['EmbedLinks', PermissionFlagsBits.EmbedLinks],
    ['AttachFiles', PermissionFlagsBits.AttachFiles],
    ['ReadMessageHistory', PermissionFlagsBits.ReadMessageHistory],
  ];

  const warnLines = [];

  if (hasAdmin) {
    console.log('✅ לבוט יש הרשאת Administrator — כל ההרשאות פעילות.');
  } else {
    const missing = specificPerms.filter(([, perm]) => !me.permissions.has(perm)).map(([name]) => name);
    if (missing.length) {
      console.warn(`⚠️ לבוט אין הרשאת Administrator, וחסרות לו ${missing.length} הרשאות: ${missing.join(', ')}`);
      warnLines.push(
        `**לבוט חסרות הרשאות:** ${missing.join(', ')}`,
        'פתרון: הגדרות שרת → רולים → הרול של הבוט → הפעל/י Administrator (או את ההרשאות החסרות בנפרד).'
      );
    } else {
      console.log('✅ לבוט יש את כל ההרשאות הספציפיות הנדרשות (בלי Administrator).');
    }
  }

  // בדיקת מיקום הרול של הבוט מול הרולים החשובים בקונפיג
  const botHighestPosition = me.roles.highest.position;
  const rolesToCheck = [
    ['staffRoleId', config.roles.staffRoleId],
    ['adminRoleId', config.roles.adminRoleId],
    ['verifiedRoleId', config.roles.verifiedRoleId],
    ['mutedRoleId', config.roles.mutedRoleId],
  ];

  for (const [label, roleId] of rolesToCheck) {
    if (!roleId || roleId.includes('_ID')) continue;
    const role = guild.roles.cache.get(roleId);
    if (role && role.position >= botHighestPosition) {
      const msg = `⚠️ הרול "${role.name}" (${label}) נמצא מעל או שווה לרול הבוט בהיררכיה — הבוט לא יוכל לתת/להסיר אותו! יש לגרור את רול הבוט למעלה בהגדרות שרת → רולים.`;
      console.warn(msg);
      warnLines.push(msg);
    }
    if (!role) {
      const msg = `⚠️ הרול שהוגדר עבור ${label} (${roleId}) לא נמצא בקאש הרולים של השרת — ודא/י שה-ID נכון ושייך לשרת הנכון.`;
      console.warn(msg);
      warnLines.push(msg);
    }
  }

  // בדיקת קטגוריות (טיקטים + צוות) — האם הבוט בכלל רואה אותן
  const categoriesToCheck = [
    ['ticketCategoryId', config.channels.ticketCategoryId],
    ['staff.categoryId', config.staff.categoryId],
  ];
  for (const [label, catId] of categoriesToCheck) {
    if (!catId || catId.includes('_ID')) continue;
    const category = await guild.channels.fetch(catId).catch(() => null);
    if (!category) {
      const msg = `⚠️ הקטגוריה שהוגדרה עבור ${label} (${catId}) לא נמצאה, או שהבוט לא רואה אותה.`;
      console.warn(msg);
      warnLines.push(msg);
    }
  }

  if (!config.bridge.secret) {
    console.warn('⚠️ VORINO_BRIDGE_SECRET לא הוגדר — פקודות server-kick / server-ban / server-unban / server-message ו-/player-info (חלק ה-SQL), וכן ה-heartbeat של הסטטוס, לא יעבדו עד שתגדירו אותו (ואת אותה סיסמה בדיוק גם בצד ה-Lua).');
  }

  if (warnLines.length) {
    await sendLog(guild, warningEmbed('⚠️ נמצאו בעיות הרשאה/הגדרה בהפעלת הבוט', warnLines.join('\n\n')));
  }
}

// ==========================================================================
// אירועי הבוט
// ==========================================================================

client.once('ready', async () => {
  console.log(`✅ מחובר בתור ${client.user.tag}`);
  console.log(`🔗 קישור הזמנה עם הרשאות מלאות (Administrator): https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands`);
  await registerSlashCommands();

  const mainGuild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (mainGuild) {
    await checkBotPermissions(mainGuild);
  } else {
    console.warn('⚠️ לא נמצא שרת עם guildId שהוגדר בקונפיג — לא בוצעה בדיקת הרשאות.');
  }

  restoreGiveawaysOnStartup();
  await updateBotPresence();
  await updateServerStatusPanel();
  setInterval(updateBotPresence, 60 * 1000);        // עדכון סטטוס הבוט כל דקה
  setInterval(updateServerStatusPanel, 60 * 1000);   // עדכון פאנל סטטוס השרת כל דקה
  console.log('🧡 Vorino Bot מוכן לפעולה!');
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
      if (id === 'server_status_refresh') return handleServerStatusRefresh(interaction);
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

client.login(config.token);
