const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is up and running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
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
  WELCOME_DM:         true,
  WELCOME_EMBED_COLOR: 0x5865F2,
};

// ═══════════════════════════════════════════════════════
//  DATABASE (in-memory)
// ═══════════════════════════════════════════════════════
const DB = {
  tickets:      {},   // channelId -> { userId, category, name, createdAt, openedAt }
  ticketStats:  { total: 0, closed: 0 },
  giveaways:    {},   // messageId -> { prize, winners, entries, endTime, channelId, ended }
};

// ═══════════════════════════════════════════════════════
//  ANTI-NUKE PROTECTION STATE
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
//  HELPERS
// ═══════════════════════════════════════════════════════
function isTeam(member) {
  return member.roles.cache.has(CONFIG.TEAM_ROLE_ID) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}
function timestamp() { return `<t:${Math.floor(Date.now() / 1000)}:F>`; }
async function sendLog(client, embed) {
  try { const ch = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID); if (ch) ch.send({ embeds: [embed] }); } catch {}
}
function denyEmbed(text) {
  return { embeds: [new EmbedBuilder().setDescription(`❌ ${text}`).setColor(0xED4245)], ephemeral: true };
}
// היררכיה: האם ה-executor מותר לו לפעול על ה-target, והאם הבוט מסוגל
function canModerate(interaction, targetMember, action) {
  if (!targetMember) return { ok: false, reason: 'המשתמש לא נמצא בשרת.' };
  if (targetMember.id === interaction.user.id) return { ok: false, reason: 'אי אפשר לבצע פעולה זו על עצמך.' };
  if (targetMember.id === interaction.client.user.id) return { ok: false, reason: 'אי אפשר לבצע פעולה זו על הבוט.' };
  const guild = interaction.guild;
  const isOwner = interaction.user.id === guild.ownerId;
  if (!isOwner && targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
    return { ok: false, reason: 'אין לך הרשאה לבצע פעולה על משתמש עם רול שווה/גבוה משלך.' };
  }
  if (action === 'kick'    && !targetMember.kickable)    return { ok: false, reason: 'לבוט אין הרשאה לקיק את המשתמש (הרול שלו גבוה מדי).' };
  if (action === 'ban'     && !targetMember.bannable)    return { ok: false, reason: 'לבוט אין הרשאה לבאן את המשתמש (הרול שלו גבוה מדי).' };
  if (action === 'timeout' && !targetMember.moderatable) return { ok: false, reason: 'לבוט אין הרשאה לתת טיימאוט למשתמש (הרול שלו גבוה מדי).' };
  return { ok: true };
}

// ═══════════════════════════════════════════════════════
//  SLASH COMMANDS
// ═══════════════════════════════════════════════════════
const COMMANDS = [
  // ── טיקטים ──
  new SlashCommandBuilder().setName('setup-tickets').setDescription('📩 שלח את פאנל הטיקטים [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  // ── אימות ──
  new SlashCommandBuilder().setName('setup-verify').setDescription('✅ שלח את פאנל האימות [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  // ── הגרלה ──
  new SlashCommandBuilder().setName('giveaway').setDescription('🎉 צור הגרלה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prize').setDescription('הפרס').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('זוכים').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('דקות').setRequired(true)),
  new SlashCommandBuilder().setName('endgiveaway').setDescription('🏆 סיים הגרלה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('messageid').setDescription('ID הודעה').setRequired(true)),
  new SlashCommandBuilder().setName('reroll').setDescription('🔄 בחר זוכה חדש להגרלה שהסתיימה [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('messageid').setDescription('ID הודעה').setRequired(true)),
  // ── תשתית ──
  new SlashCommandBuilder().setName('set-log-channel').setDescription('📜 הגדר ערוץ לוגים [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true)),

  // ── מודרציה ──
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
  new SlashCommandBuilder().setName('slowmode').setDescription('🐢 הגדר סלואומוד [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('שניות (0 = כיבוי)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lock').setDescription('🔒 נעל ערוץ [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('🔓 פתח ערוץ [צוות]').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
];

// ═══════════════════════════════════════════════════════
//  SYSTEM 1 — TICKETS
// ═══════════════════════════════════════════════════════
async function setupTickets(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 פתח טיקט תמיכה')
    .setDescription('לחץ על הכפתור למטה כדי לפתוח טיקט.\nהצוות שלנו יחזור אליך בהקדם האפשרי.')
    .setColor(0x5865F2).setThumbnail(interaction.guild.iconURL()).setFooter({ text: 'Support System' }).setTimestamp();
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

  // מונע פתיחת כמה טיקטים במקביל לאותו משתמש
  const openTicket = Object.values(DB.tickets).find(t => t.userId === user.id);
  if (openTicket && guild.channels.cache.has(Object.keys(DB.tickets).find(k => DB.tickets[k] === openTicket))) {
    return interaction.followUp({ content: '❌ כבר יש לך טיקט פתוח.', ephemeral: true });
  }

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
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  if (action === 'ticket_close') {
    DB.ticketStats.closed++;
    await interaction.reply({ embeds: [new EmbedBuilder().setDescription('🔒 הטיקט נסגר תוך 5 שניות...').setColor(0xED4245)] });
    await sendLog(client, new EmbedBuilder().setTitle('🔒 טיקט נסגר').addFields({ name: 'ערוץ', value: channel.name, inline: true }, { name: 'סגור על ידי', value: `<@${interaction.user.id}>`, inline: true }, { name: 'פתוח על ידי', value: ticket ? `<@${ticket.userId}>` : 'לא ידוע', inline: true }).setColor(0xED4245).setTimestamp());
    delete DB.tickets[channel.id];
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
    .setFooter({ text: 'Verification System' }).setTimestamp();
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
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ אומת בהצלחה!').setDescription(`ברוך הבא, <@${interaction.user.id}>!\nיש לך כעת גישה מלאה 🎉`).setColor(0x57F287).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()], ephemeral: true });
  await sendLog(client, new EmbedBuilder().setTitle('✅ משתמש אומת').setDescription(`<@${interaction.user.id}> עבר אימות.`).setColor(0x57F287).setTimestamp());
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 3 — WELCOME + BOOST
// ═══════════════════════════════════════════════════════
async function handleWelcome(member, client) {
  try {
    const ch = await client.channels.fetch(CONFIG.WELCOME_CHANNEL_ID);
    if (!ch) return;
    const guild = member.guild;
    const embed = new EmbedBuilder()
      .setTitle(`👋 ברוך הבא, ${member.user.username}!`)
      .setDescription(`שמחים לראותך בשרת **${guild.name}**!\n\nאתה החבר מספר **${guild.memberCount}** שלנו 🎉\n\nאל תשכח לעבור אימות ולקרוא את חוקי השרת.`)
      .setColor(CONFIG.WELCOME_EMBED_COLOR)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📅 הצטרף ב', value: timestamp(), inline: true },
        { name: '👥 חברי שרת', value: `${guild.memberCount}`, inline: true },
        { name: '🏷️ תגית', value: member.user.tag, inline: true }
      )
      .setFooter({ text: guild.name, iconURL: guild.iconURL() })
      .setTimestamp();
    await ch.send({ content: `<@${member.id}>`, embeds: [embed] });

    if (CONFIG.WELCOME_DM) {
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
        .setFooter({ text: 'Boost System', iconURL: newMember.guild.iconURL() }).setTimestamp();
      await ch.send({ content: `<@${newMember.id}> 💎`, embeds: [embed] });
    } catch (e) { console.error('Boost notification error:', e); }
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 4 — LOGS
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
//  SYSTEM 5 — ANTI-NUKE PROTECTION
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
//  SYSTEM 6 — MODERATION (kick/ban/timeout — improved)
// ═══════════════════════════════════════════════════════
async function handleKick(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const member = interaction.guild.members.cache.get(user.id);
  const check = canModerate(interaction, member, 'kick');
  if (!check.ok) return interaction.reply(denyEmbed(check.reason));

  try { await user.send({ embeds: [new EmbedBuilder().setTitle('👢 קיבלת קיק').setDescription(`קיבלת קיק מהשרת **${interaction.guild.name}**.\n📝 **סיבה:** ${reason}`).setColor(0xED4245).setTimestamp()] }); } catch {}
  try { await member.kick(reason); } catch { return interaction.reply(denyEmbed('שגיאה בביצוע הקיק.')); }

  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('👢 קיק בוצע').setDescription(`<@${user.id}> קיבל קיק מהשרת.`).addFields({ name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason, inline: true }).setThumbnail(user.displayAvatarURL()).setColor(0xED4245).setTimestamp()] });
  await sendLog(client, new EmbedBuilder().setTitle('👢 קיק').addFields({ name: '👤 משתמש', value: `${user.tag} (${user.id})`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason }).setColor(0xED4245).setTimestamp());
}
async function handleBan(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const days = interaction.options.getInteger('days') || 0;
  const member = interaction.guild.members.cache.get(user.id);
  if (member) {
    const check = canModerate(interaction, member, 'ban');
    if (!check.ok) return interaction.reply(denyEmbed(check.reason));
  }

  try { await user.send({ embeds: [new EmbedBuilder().setTitle('🔨 קיבלת באן').setDescription(`קיבלת באן מהשרת **${interaction.guild.name}**.\n📝 **סיבה:** ${reason}`).setColor(0xED4245).setTimestamp()] }); } catch {}
  try { await interaction.guild.bans.create(user.id, { reason, deleteMessageDays: days }); } catch { return interaction.reply(denyEmbed('לא ניתן לבאן משתמש זה.')); }

  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔨 באן בוצע').setDescription(`<@${user.id}> בוין מהשרת.`).addFields({ name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason, inline: true }).setThumbnail(user.displayAvatarURL()).setColor(0xED4245).setTimestamp()] });
  await sendLog(client, new EmbedBuilder().setTitle('🔨 באן').addFields({ name: '👤 משתמש', value: `${user.tag} (${user.id})`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason }).setColor(0xED4245).setTimestamp());
}
async function handleUnban(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  const userId = interaction.options.getString('userid');
  try { await interaction.guild.bans.remove(userId); } catch { return interaction.reply(denyEmbed('משתמש לא בוין, או ID לא תקין.')); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔓 <@${userId}> הוסר מהבאן.`).setColor(0x57F287)] });
  await sendLog(client, new EmbedBuilder().setTitle('🔓 באן הוסר').addFields({ name: '👤 משתמש', value: `<@${userId}>`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }).setColor(0x57F287).setTimestamp());
}
async function handleTimeout(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  const user = interaction.options.getUser('user');
  const minutes = interaction.options.getInteger('minutes');
  const reason = interaction.options.getString('reason') || 'לא צוינה';
  const member = interaction.guild.members.cache.get(user.id);
  const check = canModerate(interaction, member, 'timeout');
  if (!check.ok) return interaction.reply(denyEmbed(check.reason));
  if (minutes < 1 || minutes > 40320) return interaction.reply(denyEmbed('משך הטיימאוט חייב להיות בין דקה ל-28 יום.'));

  try { await member.timeout(minutes * 60 * 1000, reason); } catch { return interaction.reply(denyEmbed('שגיאה במתן טיימאוט.')); }
  try { await user.send({ embeds: [new EmbedBuilder().setTitle('⏳ קיבלת טיימאוט').setDescription(`קיבלת טיימאוט בשרת **${interaction.guild.name}** למשך ${minutes} דקות.\n📝 **סיבה:** ${reason}`).setColor(0xFEE75C).setTimestamp()] }); } catch {}

  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⏳ Timeout בוצע').setDescription(`<@${user.id}> קיבל timeout של **${minutes} דקות**.`).addFields({ name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 סיבה', value: reason, inline: true }).setColor(0xFEE75C).setTimestamp()] });
  await sendLog(client, new EmbedBuilder().setTitle('⏳ Timeout').addFields({ name: '👤 משתמש', value: `<@${user.id}>`, inline: true }, { name: '⏰ זמן', value: `${minutes} דקות`, inline: true }, { name: '📝 סיבה', value: reason }).setColor(0xFEE75C).setTimestamp());
}
async function handleUntimeout(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  const user = interaction.options.getUser('user');
  const member = interaction.guild.members.cache.get(user.id);
  if (!member) return interaction.reply(denyEmbed('משתמש לא נמצא.'));
  try { await member.timeout(null); } catch { return interaction.reply(denyEmbed('לא ניתן.')); }
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Timeout של <@${user.id}> הוסר.`).setColor(0x57F287)] });
  await sendLog(client, new EmbedBuilder().setTitle('✅ Timeout הוסר').addFields({ name: '👤 משתמש', value: `<@${user.id}>`, inline: true }, { name: '👮 מנחה', value: `<@${interaction.user.id}>`, inline: true }).setColor(0x57F287).setTimestamp());
}
async function handlePurge(interaction, client) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
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
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  const seconds = interaction.options.getInteger('seconds');
  await interaction.channel.setRateLimitPerUser(seconds);
  await interaction.reply({ embeds: [new EmbedBuilder().setDescription(seconds === 0 ? '✅ סלואומוד כובה.' : `✅ סלואומוד הוגדר ל-**${seconds} שניות**.`).setColor(0x57F287)] });
}
async function handleLock(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 ערוץ ננעל').setDescription(`<#${interaction.channelId}> ננעל.`).setColor(0xED4245)] });
}
async function handleUnlock(interaction) {
  if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
  await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔓 ערוץ נפתח').setDescription(`<#${interaction.channelId}> נפתח.`).setColor(0x57F287)] });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 7 — GIVEAWAYS
// ═══════════════════════════════════════════════════════
async function createGiveaway(interaction) {
  const prize = interaction.options.getString('prize');
  const winners = interaction.options.getInteger('winners');
  const minutes = interaction.options.getInteger('minutes');
  const endTime = Date.now() + minutes * 60 * 1000;
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 השתתף (0)').setStyle(ButtonStyle.Primary));
  const msg = await interaction.channel.send({
    embeds: [new EmbedBuilder().setTitle('🎉 הגרלה!').setDescription(`**${prize}**\n\n🏆 זוכים: **${winners}**\n⏰ מסתיים: <t:${Math.floor(endTime / 1000)}:R>\n\nלחץ להשתתפות!`).setColor(0x5865F2).setFooter({ text: `מסתיים: ${new Date(endTime).toLocaleString('he-IL')}` }).setTimestamp()],
    components: [row]
  });
  DB.giveaways[msg.id] = { prize, winners, entries: [], endTime, channelId: interaction.channelId, messageId: msg.id, ended: false };
  await interaction.reply({ content: '✅ הגרלה נוצרה!', ephemeral: true });
  setTimeout(() => endGiveawayAuto(msg.id, interaction.channel, interaction.client), minutes * 60 * 1000);
}
async function handleGiveawayEnter(interaction) {
  const giveaway = DB.giveaways[interaction.message.id];
  if (!giveaway) return interaction.reply({ content: '❌ הגרלה לא נמצאה.', ephemeral: true });
  if (giveaway.ended || Date.now() > giveaway.endTime) return interaction.reply({ content: '❌ ההגרלה הסתיימה.', ephemeral: true });
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
  try { const m = await channel.messages.fetch(msgId); await m.edit({ components: [] }); } catch {}
  if (entries.length === 0) return channel.send({ embeds: [new EmbedBuilder().setTitle('🎉 הגרלה הסתיימה').setDescription(`אף אחד לא נרשם על **${giveaway.prize}**.`).setColor(0xED4245).setTimestamp()] });
  const winnerIds = [];
  const pool = [...entries];
  const count = Math.min(giveaway.winners, pool.length);
  for (let i = 0; i < count; i++) { const idx = Math.floor(Math.random() * pool.length); winnerIds.push(pool.splice(idx, 1)[0]); }
  giveaway.lastWinners = winnerIds;
  const winnerMentions = winnerIds.map(id => `<@${id}>`).join(', ');
  await channel.send({ content: winnerMentions, embeds: [new EmbedBuilder().setTitle('🏆 זוכי ההגרלה!').setDescription(`**פרס:** ${giveaway.prize}\n\n🎊 **זוכים:** ${winnerMentions}`).setColor(0xFEE75C).setTimestamp()] });
}
async function endGiveawayCommand(interaction) {
  const msgId = interaction.options.getString('messageid');
  if (!DB.giveaways[msgId]) return interaction.reply({ content: '❌ הגרלה לא נמצאה.', ephemeral: true });
  await interaction.reply({ content: '⏳ מסיים...', ephemeral: true });
  await endGiveawayAuto(msgId, interaction.channel, interaction.client);
}
async function rerollGiveaway(interaction) {
  const msgId = interaction.options.getString('messageid');
  const giveaway = DB.giveaways[msgId];
  if (!giveaway || !giveaway.ended) return interaction.reply({ content: '❌ הגרלה זו לא נמצאה או שעדיין לא הסתיימה.', ephemeral: true });
  if (!giveaway.entries.length) return interaction.reply({ content: '❌ אין משתתפים.', ephemeral: true });
  const winnerId = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
  await interaction.reply({ content: `🔄 זוכה חדש ל-**${giveaway.prize}**: <@${winnerId}> 🎉` });
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

// ── סטטוס מסתובב + נוכחות "אונליין" מפורשת ──
function startActivityRotation(client) {
  let phase = 0;
  const update = async () => {
    try {
      const guild = client.guilds.cache.get(CONFIG.GUILD_ID) || await client.guilds.fetch(CONFIG.GUILD_ID);
      if (!guild) return;
      const statuses = [
        `👥 ${guild.memberCount} חברים בשרת`,
        `🎫 ${DB.ticketStats.total} טיקטים טופלו`,
        `🎉 ${Object.keys(DB.giveaways).length} הגרלות`,
      ];
      client.user.setPresence({
        status: 'online',
        activities: [{ name: 'Custom Status', state: statuses[phase % statuses.length], type: ActivityType.Custom }]
      });
      phase++;
    } catch (err) { console.error('Status error:', err); }
  };
  update();
  setInterval(update, 30 * 1000);
}

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
      if (cmd === 'setup-tickets')       return setupTickets(interaction);
      if (cmd === 'setup-verify')        return setupVerify(interaction);
      if (cmd === 'giveaway')            return createGiveaway(interaction);
      if (cmd === 'endgiveaway')         return endGiveawayCommand(interaction);
      if (cmd === 'reroll')              return rerollGiveaway(interaction);
      if (cmd === 'kick')                return handleKick(interaction, client);
      if (cmd === 'ban')                 return handleBan(interaction, client);
      if (cmd === 'unban')               return handleUnban(interaction, client);
      if (cmd === 'timeout')             return handleTimeout(interaction, client);
      if (cmd === 'untimeout')           return handleUntimeout(interaction, client);
      if (cmd === 'purge')               return handlePurge(interaction, client);
      if (cmd === 'slowmode')            return handleSlowmode(interaction);
      if (cmd === 'lock')                return handleLock(interaction);
      if (cmd === 'unlock')              return handleUnlock(interaction);
      if (cmd === 'set-log-channel') {
        if (!isTeam(interaction.member)) return interaction.reply(denyEmbed('רק צוות.'));
        CONFIG.LOG_CHANNEL_ID = interaction.options.getChannel('channel').id;
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ ערוץ הלוגים הוגדר ל<#${CONFIG.LOG_CHANNEL_ID}>`).setColor(0x57F287)], ephemeral: true });
      }
    }

    // ── Buttons ──
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'ticket_open')                                       return handleTicketOpen(interaction, client);
      if (['ticket_close','ticket_transcript','ticket_rename','ticket_claim'].includes(id)) return handleTicketAction(interaction, client);
      if (id === 'verify_start')                                      return handleVerifyStart(interaction, client);
      if (id === 'giveaway_enter')                                    return handleGiveawayEnter(interaction);
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
