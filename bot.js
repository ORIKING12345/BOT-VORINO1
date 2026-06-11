/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              VOrino Bot — All 11 Systems + Extras            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Collection, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder,
  ActivityType, AuditLogEvent
} = require('discord.js');

const CONFIG = {
TOKEN: process.env.BOT_TOKEN
  CLIENT_ID:          process.env.CLIENT_ID          || '1501915415356510299',
  GUILD_ID:           process.env.GUILD_ID           || '1489033656487121077',
  TEAM_ROLE_ID:       process.env.TEAM_ROLE_ID       || '1489313397462798518',
  VERIFIED_ROLE_ID:   process.env.VERIFIED_ROLE_ID   || '1513574669436059841',
  PROOF_ROLE_ID:      process.env.PROOF_ROLE_ID      || '1490779090733760795',
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || '1497538017538347069',
  LOG_CHANNEL_ID:     process.env.LOG_CHANNEL_ID     || '1514300287605801102',
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || '1495059280242675916',
  PROOF_CHANNEL_ID:   process.env.PROOF_CHANNEL_ID   || '1514607305776300234',
  ORDERS_CHANNEL_ID:  process.env.ORDERS_CHANNEL_ID  || '1514607472327786657',
};

const DB = {
  tickets:    {},
  orders:     [],
  coupons:    {},
  warranties: {},
  giveaways:  {},
  drops:      {},
  guessGames: {},
};

// ═══════════════════════════════════════════════════════
//  PROTECTION STATE — tracks rapid deletions
// ═══════════════════════════════════════════════════════
const PROTECT = {
  channelDeletes: {},   // userId -> [timestamps]
  roleDeletes:    {},
  kicks:          {},
  bans:           {},
  timeouts:       {},
  WINDOW_MS: 8000,      // 8 second window
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
//  SLASH COMMANDS
// ═══════════════════════════════════════════════════════
const COMMANDS = [
  new SlashCommandBuilder().setName('setup-tickets')
    .setDescription('📩 שלח את פאנל הטיקטים [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('setup-verify')
    .setDescription('✅ שלח את פאנל האימות [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('addorder')
    .setDescription('➕ הוסף הזמנה [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('המשתמש').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('המוצר').setRequired(true))
    .addIntegerOption(o => o.setName('quantity').setDescription('כמות').setRequired(true)),
  new SlashCommandBuilder().setName('orders')
    .setDescription('📋 הצג טבלת הזמנות [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('myorders')
    .setDescription('📦 ההזמנות שלי'),
  new SlashCommandBuilder().setName('orderstats')
    .setDescription('📊 סטטיסטיקת הזמנות לפי משתמש [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('broadcast')
    .setDescription('📢 שלח הודעה מהבוט [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('הערוץ').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('ההודעה').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת (אופציונלי)'))
    .addStringOption(o => o.setName('color').setDescription('צבע hex')),
  // DM-All system
  new SlashCommandBuilder().setName('dmall')
    .setDescription('📨 שלח הודעה פרטית לכל חברי השרת [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('message').setDescription('תוכן ההודעה').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('כותרת (אופציונלי)')),
  new SlashCommandBuilder().setName('createcoupon')
    .setDescription('🎟️ צור קופון [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('code').setDescription('קוד הקופון').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('המשתמש').setRequired(true))
    .addStringOption(o => o.setName('reward').setDescription('הפרס').setRequired(true)),
  new SlashCommandBuilder().setName('redeemcoupon')
    .setDescription('🎁 מימוש קופון')
    .addStringOption(o => o.setName('code').setDescription('קוד').setRequired(true)),
  new SlashCommandBuilder().setName('checkcoupon')
    .setDescription('🔍 בדוק קופון [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('code').setDescription('קוד').setRequired(true)),
  new SlashCommandBuilder().setName('addwarranty')
    .setDescription('🛡️ הוסף אחריות [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('המשתמש').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('המוצר').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('משך').setRequired(true)),
  new SlashCommandBuilder().setName('mywarranty')
    .setDescription('🛡️ הצג אחריות שלי'),
  new SlashCommandBuilder().setName('checkwarranty')
    .setDescription('🔍 בדוק אחריות משתמש [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('המשתמש').setRequired(true)),
  new SlashCommandBuilder().setName('setup-proofs')
    .setDescription('📊 שלח פאנל הוכחות [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('drop')
    .setDescription('🎁 צור דרופ [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prize').setDescription('הפרס').setRequired(true)),
  new SlashCommandBuilder().setName('giveaway')
    .setDescription('🎉 צור הגרלה [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prize').setDescription('הפרס').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('זוכים').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('דקות').setRequired(true)),
  new SlashCommandBuilder().setName('guessnumber')
    .setDescription('🔢 התחל משחק נחש מספר [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('prize').setDescription('הפרס').setRequired(true))
    .addIntegerOption(o => o.setName('max').setDescription('מספר מקסימלי')),
  new SlashCommandBuilder().setName('endgiveaway')
    .setDescription('🏆 סיים הגרלה [צוות]')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('messageid').setDescription('ID הודעה').setRequired(true)),
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
        { label: '💬 תמיכה כללית', value: 'general', emoji: '💬' },
        { label: '🛒 בעיה בהזמנה', value: 'order', emoji: '🛒' },
        { label: '💰 תשלום', value: 'payment', emoji: '💰' },
        { label: '🛡️ אחריות', value: 'warranty', emoji: '🛡️' },
        { label: '🎁 קופון', value: 'coupon', emoji: '🎁' },
        { label: '🔧 בעיה טכנית', value: 'tech', emoji: '🔧' },
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
  const categoryNames = { general: '💬 כללי', order: '🛒 הזמנה', payment: '💰 תשלום', warranty: '🛡️ אחריות', coupon: '🎁 קופון', tech: '🔧 טכני' };
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
//  SYSTEM 4 — ORDERS (with per-user count)
// ═══════════════════════════════════════════════════════
async function addOrder(interaction) {
  const user = interaction.options.getUser('user');
  const item = interaction.options.getString('item');
  const quantity = interaction.options.getInteger('quantity');
  const orderId = randomId(8);

  DB.orders.push({
    orderId, userId: user.id, tag: user.tag, item, quantity,
    date: new Date().toLocaleDateString('he-IL'), addedBy: interaction.user.id,
  });

  const userTotal = DB.orders.filter(o => o.userId === user.id).length;

  const embed = new EmbedBuilder()
    .setTitle('✅ הזמנה נוספה')
    .addFields(
      { name: '🆔 מזהה', value: orderId, inline: true },
      { name: '👤 משתמש', value: `<@${user.id}>`, inline: true },
      { name: '📦 מוצר', value: item, inline: true },
      { name: '🔢 כמות', value: `${quantity}`, inline: true },
      { name: '📅 תאריך', value: new Date().toLocaleDateString('he-IL'), inline: true },
      { name: '📊 סה"כ הזמנות למשתמש', value: `${userTotal}`, inline: true },
    )
    .setColor(0x57F287).setTimestamp();

  await interaction.reply({ embeds: [embed] });

  try {
    await user.send({ embeds: [new EmbedBuilder()
      .setTitle('📦 הזמנה חדשה!')
      .setDescription(`הזמנה חדשה נוספה עבורך בשרת **${interaction.guild.name}**`)
      .addFields(
        { name: '🆔 מזהה', value: orderId, inline: true },
        { name: '📦 מוצר', value: item, inline: true },
        { name: '🔢 כמות', value: `${quantity}`, inline: true },
        { name: '📊 סה"כ הזמנות שלך', value: `${userTotal}`, inline: true },
      )
      .setColor(0x5865F2).setTimestamp()
    ]});
  } catch {}
}

async function showOrders(interaction) {
  if (!isTeam(interaction.member)) {
    return interaction.reply({ content: '❌ רק צוות יכול לצפות בטבלה זו.', ephemeral: true });
  }
  if (DB.orders.length === 0) {
   return interaction.reply({ embeds: [new EmbedBuilder().setDescription('📋 אין הזמנות עדיין.').setColor(0x5865F2)], ephemeral: false });

  }
  const embed = new EmbedBuilder()
    .setTitle('📋 טבלת הזמנות')
    .setColor(0x5865F2)
    .setFooter({ text: `סך הכל: ${DB.orders.length} הזמנות` })
    .setTimestamp();
  DB.orders.slice(0, 10).forEach((o, i) => {
    embed.addFields({ name: `#${i + 1} | ${o.orderId}`, value: `👤 <@${o.userId}>\n📦 ${o.item} × ${o.quantity}\n📅 ${o.date}`, inline: true });
  });
  await interaction.reply({ embeds: [embed] });
}

async function showMyOrders(interaction) {
  const mine = DB.orders.filter(o => o.userId === interaction.user.id);
  if (mine.length === 0) {
    return interaction.reply({ embeds: [new EmbedBuilder().setDescription('📦 אין לך הזמנות עדיין.').setColor(0x5865F2)], ephemeral: true });
  }
  const embed = new EmbedBuilder()
    .setTitle('📦 ההזמנות שלי')
    .setColor(0x5865F2)
    .setFooter({ text: `סך הכל: ${mine.length} הזמנות` });
  mine.forEach((o, i) => {
    embed.addFields({ name: `#${i + 1} — ${o.orderId}`, value: `📦 ${o.item}\n🔢 × ${o.quantity}\n📅 ${o.date}`, inline: true });
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// סטטיסטיקת הזמנות לפי משתמש — לצוות בלבד
async function showOrderStats(interaction) {
  if (!isTeam(interaction.member)) {
    return interaction.reply({ content: '❌ רק צוות יכול לצפות בסטטיסטיקה.', ephemeral: true });
  }
  if (DB.orders.length === 0) {
    return interaction.reply({ embeds: [new EmbedBuilder().setDescription('📊 אין נתונים עדיין.').setColor(0x5865F2)], ephemeral: false });
  }

  // Count orders per user
  const userMap = {};
  DB.orders.forEach(o => {
    if (!userMap[o.userId]) userMap[o.userId] = { tag: o.tag, count: 0, totalQty: 0 };
    userMap[o.userId].count++;
    userMap[o.userId].totalQty += o.quantity;
  });

  const sorted = Object.entries(userMap).sort((a, b) => b[1].count - a[1].count);

  const embed = new EmbedBuilder()
    .setTitle('📊 סטטיסטיקת הזמנות לפי משתמש')
    .setColor(0x5865F2)
    .setFooter({ text: `${sorted.length} משתמשים | ${DB.orders.length} הזמנות סה"כ` })
    .setTimestamp();

  sorted.slice(0, 15).forEach(([userId, data], i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    embed.addFields({
      name: `${medal} ${data.tag}`,
      value: `👤 <@${userId}>\n📦 ${data.count} הזמנות | 🔢 ${data.totalQty} פריטים`,
      inline: true
    });
  });

  await interaction.reply({ embeds: [embed] });
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
        // Small delay to avoid rate limits
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
//  SYSTEM 6 — COUPONS
// ═══════════════════════════════════════════════════════
async function createCoupon(interaction) {
  const code = interaction.options.getString('code').toUpperCase();
  const user = interaction.options.getUser('user');
  const reward = interaction.options.getString('reward');
  DB.coupons[code] = { reward, used: false, createdBy: interaction.user.id, userId: user.id };
  try {
    await user.send({ embeds: [new EmbedBuilder()
      .setTitle('🎟️ קיבלת קופון!')
      .setDescription(`קוד: \`${code}\`\n\n**פרס:** ${reward}\n\nפתח טיקט לממש.`)
      .setColor(0xFEE75C).setTimestamp()
    ]});
  } catch {}
  await interaction.reply({ embeds: [new EmbedBuilder()
    .setTitle('✅ קופון נוצר')
    .addFields(
      { name: '🎟️ קוד', value: `\`${code}\``, inline: true },
      { name: '👤 משתמש', value: `<@${user.id}>`, inline: true },
      { name: '🎁 פרס', value: reward, inline: true },
    ).setColor(0x57F287).setTimestamp()
  ], ephemeral: true });
}

async function redeemCoupon(interaction) {
  const code = interaction.options.getString('code').toUpperCase();
  const coupon = DB.coupons[code];
  if (!coupon) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ קוד לא קיים.').setColor(0xED4245)], ephemeral: true });
  if (coupon.used) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ קופון כבר מומש.').setColor(0xED4245)], ephemeral: true });
  if (coupon.userId !== interaction.user.id) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ קופון לא שייך אליך.').setColor(0xED4245)], ephemeral: true });
  coupon.used = true;
  coupon.redeemedAt = new Date().toISOString();
  await interaction.reply({ embeds: [new EmbedBuilder()
    .setTitle('🎁 קופון מומש!').setDescription(`✅ \`${code}\` מומש!\n\n**פרס:** ${coupon.reward}\n\nפתח טיקט לקבלה.`)
    .setColor(0x57F287).setTimestamp()
  ], ephemeral: true });
  await sendLog(interaction.client, new EmbedBuilder()
    .setTitle('🎟️ קופון מומש')
    .addFields({ name: 'קוד', value: `\`${code}\``, inline: true }, { name: 'משתמש', value: `<@${interaction.user.id}>`, inline: true }, { name: 'פרס', value: coupon.reward, inline: true })
    .setColor(0xFEE75C).setTimestamp()
  );
}

async function checkCoupon(interaction) {
  const code = interaction.options.getString('code').toUpperCase();
  const coupon = DB.coupons[code];
  if (!coupon) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('❌ קוד לא קיים.').setColor(0xED4245)], ephemeral: true });
  await interaction.reply({ embeds: [new EmbedBuilder()
    .setTitle(`🎟️ קופון: \`${code}\``)
    .addFields(
      { name: '👤 עבור', value: `<@${coupon.userId}>`, inline: true },
      { name: '🎁 פרס', value: coupon.reward, inline: true },
      { name: '📊 סטטוס', value: coupon.used ? '❌ מומש' : '✅ פעיל', inline: true },
      { name: '🛠️ נוצר על ידי', value: `<@${coupon.createdBy}>`, inline: true },
    ).setColor(coupon.used ? 0xED4245 : 0x57F287).setTimestamp()
  ], ephemeral: true });
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

async function logMemberUpdate(oldMember, newMember, client) {
  const wasTimedOut = !oldMember.communicationDisabledUntil;
  const isTimedOut = !!newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date();
  if (wasTimedOut && isTimedOut) {
    await sendLog(client, new EmbedBuilder()
      .setTitle('⏳ Timeout')
      .setDescription(`<@${newMember.id}> קיבל timeout עד: <t:${Math.floor(newMember.communicationDisabledUntil / 1000)}:F>`)
      .setColor(0xFEE75C).setTimestamp()
    );
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 8 — WARRANTY
// ═══════════════════════════════════════════════════════
async function addWarranty(interaction) {
  const user = interaction.options.getUser('user');
  const item = interaction.options.getString('item');
  const duration = interaction.options.getString('duration');
  const id = randomId(8);
  if (!DB.warranties[user.id]) DB.warranties[user.id] = [];
  DB.warranties[user.id].push({ id, item, duration, createdAt: new Date().toISOString(), createdBy: interaction.user.id });
  await interaction.reply({ embeds: [new EmbedBuilder()
    .setTitle('🛡️ אחריות נוספה')
    .addFields(
      { name: '🆔 מזהה', value: id, inline: true },
      { name: '👤 משתמש', value: `<@${user.id}>`, inline: true },
      { name: '📦 מוצר', value: item, inline: true },
      { name: '⏳ משך', value: duration, inline: true },
    ).setColor(0x57F287).setTimestamp()
  ]});
  try {
    await user.send({ embeds: [new EmbedBuilder()
      .setTitle('🛡️ קיבלת אחריות!').setDescription(`אחריות חדשה בשרת **${interaction.guild.name}**`)
      .addFields({ name: '🆔', value: id, inline: true }, { name: '📦', value: item, inline: true }, { name: '⏳', value: duration, inline: true })
      .setColor(0x5865F2).setTimestamp()
    ]});
  } catch {}
}

async function showMyWarranty(interaction) {
  const ws = DB.warranties[interaction.user.id];
  if (!ws || ws.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setDescription('🛡️ אין לך אחריות.').setColor(0x5865F2)], ephemeral: true });
  const embed = new EmbedBuilder().setTitle('🛡️ האחריות שלי').setColor(0x5865F2);
  ws.forEach((w, i) => embed.addFields({ name: `#${i + 1} — ${w.id}`, value: `📦 ${w.item}\n⏳ ${w.duration}\n📅 ${new Date(w.createdAt).toLocaleDateString('he-IL')}`, inline: true }));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function checkWarranty(interaction) {
  const user = interaction.options.getUser('user');
  const ws = DB.warranties[user.id];
  if (!ws || ws.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🛡️ אין אחריות עבור <@${user.id}>.`).setColor(0x5865F2)], ephemeral: true });
  const embed = new EmbedBuilder().setTitle(`🛡️ אחריות של ${user.tag}`).setColor(0x5865F2);
  ws.forEach((w, i) => embed.addFields({ name: `#${i + 1} — ${w.id}`, value: `📦 ${w.item}\n⏳ ${w.duration}\n📅 ${new Date(w.createdAt).toLocaleDateString('he-IL')}`, inline: true }));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 9 — PROOFS PANEL (STABLE & NO RATE LIMIT)
// ═══════════════════════════════════════════════════════
async function setupProofs(interaction, client) {
  await interaction.deferReply({ ephemeral: false });

  const guild = interaction.guild;
  const buildEmbed = (pm) => {
    // יצירת הרשימה על בסיס החברים שמצאנו
    const list = pm && pm.length > 0 
      ? pm.map(m => `• <@${m.id}>`).join('\n') 
      : 'אין חברים עם רול זה כרגע.';

    return new EmbedBuilder()
      .setTitle('📊 אנשים שקיבלו עיצוב  ')
      .setDescription(list)
      .setColor(0x5865F2)
      .addFields({ name: '👥 סה״כ חברים פעילים', value: `${pm ? pm.length : 0} חברים` })
      .setFooter({ text: 'מתעדכן אוטומטית בכל 5 דקות' })
      .setTimestamp();
  };

  try {
    // 🛠️ התיקון הסופי: מושך אך ורק את רשימת ה-IDs של חברי הרול (מונע חסימות לחלוטין)
    const role = await guild.roles.fetch(CONFIG.PROOF_ROLE_ID);
    let proofMembers = [];
    
    if (role) {
      // מביא את כל חברי הרול בצורה ישירה ויציבה
      const fetchedMembers = await role.guild.members.fetch();
      proofMembers = fetchedMembers.filter(m => m.roles.cache.has(CONFIG.PROOF_ROLE_ID)).map(m => m);
    }
    
    const msg = await interaction.channel.send({ embeds: [buildEmbed(proofMembers)] });
    await interaction.editReply({ content: '✅ פאנל החברים נשלח בהצלחה לערוץ!' });

    // לולאה בטוחה
    const intervalId = setInterval(async () => {
      try {
        const freshMsg = await interaction.channel.messages.fetch(msg.id).catch(() => null);
        if (!freshMsg) return clearInterval(intervalId);

        const freshRole = await guild.roles.fetch(CONFIG.PROOF_ROLE_ID);
        let freshList = [];
        if (freshRole) {
          const fetched = await freshRole.guild.members.fetch();
          freshList = fetched.filter(m => m.roles.cache.has(CONFIG.PROOF_ROLE_ID)).map(m => m);
        }
        await msg.edit({ embeds: [buildEmbed(freshList)] });
      } catch (err) {
        if (err.code === 429) clearInterval(intervalId);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('שגיאה במהלך הפעלת הפאנל:', error);
    await interaction.editReply({ content: '❌ אירעה שגיאה זמנית זיהוי המשתמשים. אנא נסה שוב בעוד דקה.' });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 10 — ACTIVITY STATUS (Legacy Design style)
//  Uses ActivityType.Custom with emoji + state text
// ═══════════════════════════════════════════════════════
function startActivityRotation(client) {
  let phase = 0;
  const update = async () => {
    try {
      const guild = client.guilds.cache.get(CONFIG.GUILD_ID) || await client.guilds.fetch(CONFIG.GUILD_ID);
      if (!guild) return;

      const total = guild.memberCount;
      
      // תיקון החסימה: משיכה מהירה של התפקיד וספירת החברים שלו בלי להעמיס
      const role = guild.roles.cache.get(CONFIG.PROOF_ROLE_ID) || await guild.roles.fetch(CONFIG.PROOF_ROLE_ID);
      const proofCount = role ? role.members.size : 0;

      const statuses = [
        { name: 'Custom Status', state: `👥 ${total} חברים בשרת`, type: ActivityType.Custom },
        { name: 'Custom Status', state: `✅ ${proofCount} עם רול הוכחות`, type: ActivityType.Custom },
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
  // שינינו את הזמן ל-30 שניות (30000ms) כדי למנוע מנטלית משרתי דיסקורד לחסום את הבוט שלך
  setInterval(update, 30 * 1000);
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 11 — DROPS / GIVEAWAYS / GUESS
// ═══════════════════════════════════════════════════════
async function createDrop(interaction) {
  const prize = interaction.options.getString('prize');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('drop_claim').setLabel('🎁 תפוס!').setStyle(ButtonStyle.Success)
  );
  const msg = await interaction.channel.send({
    embeds: [new EmbedBuilder().setTitle('🎁 DROP!').setDescription(`**${prize}**\n\nלחץ מהר לתפוס! 🏃`).setColor(0xFEE75C).setFooter({ text: 'ראשון שלוחץ — זוכה!' }).setTimestamp()],
    components: [row]
  });
  DB.drops[msg.id] = { prize, claimed: false, channelId: interaction.channelId };
  await interaction.reply({ content: '✅ דרופ נוצר!', ephemeral: true });
}

async function handleDropClaim(interaction, client) {
  const drop = DB.drops[interaction.message.id];
  if (!drop) return interaction.reply({ content: '❌ דרופ לא נמצא.', ephemeral: true });
  if (drop.claimed) return interaction.reply({ content: '❌ הדרופ כבר נתפס!', ephemeral: true });
  drop.claimed = true;
  drop.winner = interaction.user.id;
  await interaction.update({
    embeds: [new EmbedBuilder().setTitle('🎁 הדרופ נתפס!').setDescription(`**${drop.prize}**\n\n🏆 <@${interaction.user.id}> תפס!`).setColor(0x57F287).setTimestamp()],
    components: []
  });
}

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

async function startGuessGame(interaction) {
  const prize = interaction.options.getString('prize');
  const max = interaction.options.getInteger('max') || 100;
  const number = Math.floor(Math.random() * max) + 1;
  DB.guessGames[interaction.channelId] = { number, prize, createdBy: interaction.user.id, max };
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('guess_number').setLabel('🔢 נחש!').setStyle(ButtonStyle.Primary)
  );
  await interaction.channel.send({
    embeds: [new EmbedBuilder().setTitle('🔢 נחש את המספר!').setDescription(`**פרס:** ${prize}\n\nמספר בין **1** ל **${max}**\n\nלחץ לנחש!`).setColor(0x5865F2).setFooter({ text: 'ראשון שנחש נכון — זוכה!' }).setTimestamp()],
    components: [row]
  });
  await interaction.reply({ content: '✅ משחק נוצר!', ephemeral: true });
}

async function handleGuessButton(interaction) {
  const game = DB.guessGames[interaction.channelId];
  if (!game) return interaction.reply({ content: '❌ אין משחק פעיל.', ephemeral: true });
  if (game.ended) return interaction.reply({ content: '❌ המשחק הסתיים.', ephemeral: true });
  const modal = new ModalBuilder().setCustomId('guess_modal').setTitle('🔢 נחש את המספר');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('guess_input').setLabel(`מספר בין 1 ל ${game.max}`).setStyle(TextInputStyle.Short).setRequired(true)
  ));
  await interaction.showModal(modal);
}

async function handleGuessModal(interaction) {
  const game = DB.guessGames[interaction.channelId];
  if (!game || game.ended) return interaction.reply({ content: '❌ אין משחק פעיל.', ephemeral: true });
  const guess = parseInt(interaction.fields.getTextInputValue('guess_input'));
  if (isNaN(guess)) return interaction.reply({ content: '❌ מספר לא תקין.', ephemeral: true });
  if (guess === game.number) {
    game.ended = true;
    await interaction.reply({ embeds: [new EmbedBuilder()
      .setTitle('🏆 ניצחת!').setDescription(`<@${interaction.user.id}> ניחש! המספר היה **${game.number}**\n\n🎁 **פרס:** ${game.prize}`)
      .setColor(0x57F287).setTimestamp()
    ]});
  } else {
    await interaction.reply({ content: `❌ לא נכון! ${guess < game.number ? '📈 גבוה יותר!' : '📉 נמוך יותר!'}`, ephemeral: true });
  }
}

// ═══════════════════════════════════════════════════════
//  SYSTEM 12 — SERVER PROTECTION
//  • Block bot additions (except owner)
//  • Ban on rapid channel/role/kick/ban/timeout actions
// ═══════════════════════════════════════════════════════

async function handleGuildMemberAdd(member, client) {
  if (!member.user.bot) return;

  const guild = member.guild;
  const owner = await guild.fetchOwner();

  // Try to find who added the bot via audit log
  try {
    await new Promise(r => setTimeout(r, 1500)); // wait for audit log
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
    const entry = auditLogs.entries.find(e =>
      e.target?.id === member.id && Date.now() - e.createdTimestamp < 10000
    );

    if (entry) {
      const executor = entry.executor;
      if (executor && executor.id !== owner.id) {
        // Not owner — kick the bot and ban the adder
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

  // If owner added it — just log
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
      // Ban the raider
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

  // Detect kick/ban via audit log for mass actions
  // Detect rapid timeouts
  const wasTimedOut = !oldMember.communicationDisabledUntil;
  const isTimedOut = !!newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date();

  if (wasTimedOut && isTimedOut) {
    // Log for system 7
    await sendLog(client, new EmbedBuilder()
      .setTitle('⏳ Timeout')
      .setDescription(`<@${newMember.id}> קיבל timeout עד: <t:${Math.floor(newMember.communicationDisabledUntil / 1000)}:F>`)
      .setColor(0xFEE75C).setTimestamp()
    );

    // Check if rapid
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
  // Existing log
  await logBanAdd(ban, client);

  // Protection check for mass bans
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
  // Existing log
  await logMemberRemove(member, client);

  // Protection: rapid kicks
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
      if (cmd === 'addorder') return addOrder(interaction);
      if (cmd === 'orders') return showOrders(interaction);
      if (cmd === 'myorders') return showMyOrders(interaction);
      if (cmd === 'orderstats') return showOrderStats(interaction);
      if (cmd === 'broadcast') return broadcast(interaction);
      if (cmd === 'dmall') return dmAll(interaction, client);
      if (cmd === 'createcoupon') return createCoupon(interaction);
      if (cmd === 'redeemcoupon') return redeemCoupon(interaction);
      if (cmd === 'checkcoupon') return checkCoupon(interaction);
      if (cmd === 'addwarranty') return addWarranty(interaction);
      if (cmd === 'mywarranty') return showMyWarranty(interaction);
      if (cmd === 'checkwarranty') return checkWarranty(interaction);
      if (cmd === 'setup-proofs') return setupProofs(interaction, client);
      if (cmd === 'drop') return createDrop(interaction);
      if (cmd === 'giveaway') return createGiveaway(interaction);
      if (cmd === 'guessnumber') return startGuessGame(interaction);
      if (cmd === 'endgiveaway') return endGiveawayCommand(interaction);
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'ticket_open') return handleTicketOpen(interaction, client);
      if (['ticket_close','ticket_transcript','ticket_rename','ticket_claim'].includes(id)) return handleTicketAction(interaction, client);
      if (id === 'verify_start') return handleVerifyStart(interaction, client);
      if (id === 'drop_claim') return handleDropClaim(interaction, client);
      if (id === 'giveaway_enter') return handleGiveawayEnter(interaction);
      if (id === 'guess_number') return handleGuessButton(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_category') return handleTicketCategory(interaction, client);
      if (id.startsWith('verify_answer_')) return handleVerifyAnswer(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id === 'ticket_rename_modal') return handleTicketRenameModal(interaction);
      if (id === 'guess_modal') return handleGuessModal(interaction);
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
