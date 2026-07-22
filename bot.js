const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, Collection } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: '1520769665494679703',
    guildId: '1489033656487121077',
    ticketCategoryId: '1529542314534371538',
    logChannelId: '1529537134908669993',
    welcomeChannelId: '1529537107012485230',
    adminRoleId: '1529537049470959797',
    modRoleId: '1529537045427654686',
    verifyRoleId: '1529537052444721262',
    giveawaysChannelId: '1529537109147517181',
    dropsChannelId: '1529537109147517181',
    voteChannelId: '1529544456418754602',
    memberCountChannelId: process.env.MEMBER_COUNT_CHANNEL_ID || 'MEMBER_COUNT_CHANNEL_ID',
    suggestionsChannelId: process.env.SUGGESTIONS_CHANNEL_ID || 'SUGGESTIONS_CHANNEL_ID',
    botStatusChannelId: process.env.BOT_STATUS_CHANNEL_ID || 'BOT_STATUS_CHANNEL_ID',
    welcomeRoleId: process.env.WELCOME_ROLE_ID || 'WELCOME_ROLE_ID',
    mutedRoleId: process.env.MUTED_ROLE_ID || 'MUTED_ROLE_ID'
};

// Collections
const tickets = new Collection();
const giveaways = new Collection();
const drops = new Collection();
const votes = new Collection();
const warnings = new Collection();
const suggestions = new Collection();
const appeals = new Collection();
const dailyRewards = new Collection();
const economy = new Collection();
const levels = new Collection();
const reactionRoles = new Collection();
const customCommands = new Collection();
const tempBans = new Collection();
const topTen = new Collection();
const staffLogs = new Collection();
const userActivity = new Collection();
const giveawaysEntries = new Collection();
const dropCooldowns = new Collection();
const voteCooldowns = new Collection();
const suggestCooldowns = new Collection();
const reportCooldowns = new Collection();
const dailyCooldowns = new Collection();
const ticketCooldowns = new Collection();
const verifyCooldowns = new Collection();
const muteLogs = new Collection();
const kickLogs = new Collection();
const banLogs = new Collection();
const warnLogs = new Collection();
const purgeLogs = new Collection();
const lockdownLogs = new Collection();
const slowmodeLogs = new Collection();
const nicknameLogs = new Collection();
const roleLogs = new Collection();
const giveawayLogs = new Collection();
const dropLogs = new Collection();
const voteLogs = new Collection();
const suggestLogs = new Collection();
const reportLogs = new Collection();
const appealLogs = new Collection();
const economyLogs = new Collection();
const levelLogs = new Collection();
const reactionRoleLogs = new Collection();
const customCmdLogs = new Collection();
const ticketLogs = new Collection();
const verifyLogs = new Collection();

// Server stats
let serverStats = {
    members: 0,
    online: 0,
    voice: 0,
    boosts: 0,
    channels: 0,
    roles: 0,
    messages: 0,
    commands: 0,
    tickets: 0,
    giveaways: 0,
    drops: 0,
    votes: 0,
    warnings: 0,
    bans: 0,
    kicks: 0,
    mutes: 0
};

// Bot stats
let botStats = {
    startTime: Date.now(),
    commandsUsed: 0,
    messagesProcessed: 0,
    ticketsCreated: 0,
    giveawaysCreated: 0,
    dropsCreated: 0,
    votesCreated: 0,
    warningsIssued: 0,
    bansIssued: 0,
    kicksIssued: 0,
    mutesIssued: 0,
    suggestionsSubmitted: 0,
    reportsSubmitted: 0,
    appealsSubmitted: 0,
    dailyClaims: 0,
    levelUps: 0,
    reactionRolesSet: 0,
    customCommandsSet: 0
};

// ==================== STARTUP ====================
client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} is online!`);
    console.log(`🎯 Red & Black theme loaded!`);
    console.log(`📊 Server: ${client.guilds.cache.get(config.guildId)?.name || 'Unknown'}`);
    console.log(`👥 Members: ${client.guilds.cache.get(config.guildId)?.memberCount || 0}`);
    
    await registerCommands();
    startIntervals();
    loadData();
    setupBotStatus();
});

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder().setName('ticket').setDescription('📌 Open a support ticket'),
        new SlashCommandBuilder().setName('verify').setDescription('🔐 Start verification process'),
        new SlashCommandBuilder().setName('staff').setDescription('🛡️ Staff panel'),
        new SlashCommandBuilder().setName('giveaway').setDescription('🎉 Create a giveaway')
            .addStringOption(option => option.setName('prize').setDescription('Prize name').setRequired(true))
            .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
            .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(true)),
        new SlashCommandBuilder().setName('drop').setDescription('📦 Create a drop')
            .addStringOption(option => option.setName('item').setDescription('Item name').setRequired(true))
            .addIntegerOption(option => option.setName('amount').setDescription('Amount').setRequired(true)),
        new SlashCommandBuilder().setName('top').setDescription('🏆 View top 10 members by activity'),
        new SlashCommandBuilder().setName('vote').setDescription('📊 Create a vote')
            .addStringOption(option => option.setName('question').setDescription('Vote question').setRequired(true))
            .addStringOption(option => option.setName('options').setDescription('Options separated by |').setRequired(true)),
        new SlashCommandBuilder().setName('say').setDescription('📢 Send message as bot')
            .addStringOption(option => option.setName('message').setDescription('Message').setRequired(true))
            .addChannelOption(option => option.setName('channel').setDescription('Channel').setRequired(true)),
        new SlashCommandBuilder().setName('panel').setDescription('⚙️ Admin panel'),
        new SlashCommandBuilder().setName('config').setDescription('🔧 Configure bot settings'),
        new SlashCommandBuilder().setName('warn').setDescription('⚠️ Warn a member')
            .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Warning reason').setRequired(true)),
        new SlashCommandBuilder().setName('kick').setDescription('👢 Kick a member')
            .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Kick reason')),
        new SlashCommandBuilder().setName('ban').setDescription('🔨 Ban a member')
            .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Ban reason')),
        new SlashCommandBuilder().setName('suggest').setDescription('💡 Submit a suggestion')
            .addStringOption(option => option.setName('suggestion').setDescription('Your suggestion').setRequired(true)),
        new SlashCommandBuilder().setName('report').setDescription('📋 Report a user')
            .addUserOption(option => option.setName('user').setDescription('User to report').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Report reason').setRequired(true)),
        new SlashCommandBuilder().setName('appeal').setDescription('📝 Submit a ban appeal')
            .addStringOption(option => option.setName('reason').setDescription('Appeal reason').setRequired(true)),
        new SlashCommandBuilder().setName('daily').setDescription('💰 Claim daily reward'),
        new SlashCommandBuilder().setName('balance').setDescription('💰 Check your balance'),
        new SlashCommandBuilder().setName('level').setDescription('📊 Check your level'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 View level leaderboard'),
        new SlashCommandBuilder().setName('reactionrole').setDescription('🎨 Setup reaction roles')
            .addChannelOption(option => option.setName('channel').setDescription('Channel').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Message ID').setRequired(true))
            .addRoleOption(option => option.setName('role').setDescription('Role to assign').setRequired(true))
            .addStringOption(option => option.setName('emoji').setDescription('Emoji').setRequired(true)),
        new SlashCommandBuilder().setName('customcmd').setDescription('🔧 Create a custom command')
            .addStringOption(option => option.setName('name').setDescription('Command name').setRequired(true))
            .addStringOption(option => option.setName('response').setDescription('Command response').setRequired(true)),
        new SlashCommandBuilder().setName('purge').setDescription('🧹 Purge messages')
            .addIntegerOption(option => option.setName('amount').setDescription('Number of messages').setRequired(true)),
        new SlashCommandBuilder().setName('slowmode').setDescription('⏱️ Set slowmode')
            .addIntegerOption(option => option.setName('seconds').setDescription('Seconds').setRequired(true)),
        new SlashCommandBuilder().setName('lockdown').setDescription('🔒 Lockdown channel'),
        new SlashCommandBuilder().setName('unlock').setDescription('🔓 Unlock channel'),
        new SlashCommandBuilder().setName('announce').setDescription('📢 Make an announcement')
            .addStringOption(option => option.setName('title').setDescription('Announcement title').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Announcement message').setRequired(true)),
        new SlashCommandBuilder().setName('poll').setDescription('📊 Create a poll')
            .addStringOption(option => option.setName('question').setDescription('Poll question').setRequired(true))
            .addStringOption(option => option.setName('options').setDescription('Options separated by |').setRequired(true)),
        new SlashCommandBuilder().setName('mute').setDescription('🔇 Mute a member')
            .addUserOption(option => option.setName('user').setDescription('User to mute').setRequired(true))
            .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Mute reason')),
        new SlashCommandBuilder().setName('unmute').setDescription('🔊 Unmute a member')
            .addUserOption(option => option.setName('user').setDescription('User to unmute').setRequired(true)),
        new SlashCommandBuilder().setName('setnick').setDescription('✏️ Set nickname')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption(option => option.setName('nickname').setDescription('New nickname').setRequired(true)),
        new SlashCommandBuilder().setName('addrole').setDescription('➕ Add role to member')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
            .addRoleOption(option => option.setName('role').setDescription('Role').setRequired(true)),
        new SlashCommandBuilder().setName('removerole').setDescription('➖ Remove role from member')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
            .addRoleOption(option => option.setName('role').setDescription('Role').setRequired(true)),
        new SlashCommandBuilder().setName('clearwarns').setDescription('🧹 Clear warnings')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)),
        new SlashCommandBuilder().setName('warnings').setDescription('📋 View warnings')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)),
        new SlashCommandBuilder().setName('serverinfo').setDescription('ℹ️ Server information'),
        new SlashCommandBuilder().setName('userinfo').setDescription('ℹ️ User information')
            .addUserOption(option => option.setName('user').setDescription('User')),
        new SlashCommandBuilder().setName('avatar').setDescription('🖼️ View avatar')
            .addUserOption(option => option.setName('user').setDescription('User')),
        new SlashCommandBuilder().setName('help').setDescription('❓ Help menu'),
        new SlashCommandBuilder().setName('ping').setDescription('🏓 Check bot ping'),
        new SlashCommandBuilder().setName('stats').setDescription('📊 View bot statistics'),
        new SlashCommandBuilder().setName('botinfo').setDescription('ℹ️ Bot information'),
        new SlashCommandBuilder().setName('uptime').setDescription('⏱️ Bot uptime'),
        new SlashCommandBuilder().setName('invite').setDescription('🔗 Get bot invite link'),
        new SlashCommandBuilder().setName('support').setDescription('🆘 Get support server link'),
        new SlashCommandBuilder().setName('feedback').setDescription('💬 Send feedback')
            .addStringOption(option => option.setName('feedback').setDescription('Your feedback').setRequired(true)),
        new SlashCommandBuilder().setName('suggestion').setDescription('💡 Submit a suggestion')
            .addStringOption(option => option.setName('suggestion').setDescription('Your suggestion').setRequired(true)),
        new SlashCommandBuilder().setName('bugreport').setDescription('🐛 Report a bug')
            .addStringOption(option => option.setName('bug').setDescription('Bug description').setRequired(true)),
        new SlashCommandBuilder().setName('feature').setDescription('✨ Request a feature')
            .addStringOption(option => option.setName('feature').setDescription('Feature request').setRequired(true)),
        new SlashCommandBuilder().setName('about').setDescription('📖 About the bot'),
        new SlashCommandBuilder().setName('credits').setDescription('👏 Credits'),
        new SlashCommandBuilder().setName('donate').setDescription('💖 Support the bot'),
        new SlashCommandBuilder().setName('premium').setDescription('⭐ Premium features'),
        new SlashCommandBuilder().setName('terms').setDescription('📜 Terms of service'),
        new SlashCommandBuilder().setName('privacy').setDescription('🔒 Privacy policy')
    ];

    const rest = new REST({ version: '10' }).setToken(config.token);
    try {
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

function startIntervals() {
    updateStatus();
    setInterval(updateStatus, 60000);
    updateTopTen();
    setInterval(updateTopTen, 300000);
    updateMemberCount();
    setInterval(updateMemberCount, 60000);
    checkTempBans();
    setInterval(checkTempBans, 60000);
    saveData();
    setInterval(saveData, 600000);
    updateBotStats();
    setInterval(updateBotStats, 300000);
    checkGiveaways();
    setInterval(checkGiveaways, 60000);
    cleanupCollections();
    setInterval(cleanupCollections, 3600000);
}

function setupBotStatus() {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    
    const channel = guild.channels.cache.get(config.botStatusChannelId);
    if (!channel) return;
    
    const embed = createEmbed('🤖 Bot Status', 'Bot is online and ready!')
        .addFields(
            { name: '🕒 Uptime', value: 'Just started', inline: true },
            { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
            { name: '📊 Commands', value: `${botStats.commandsUsed}`, inline: true }
        );
    
    channel.send({ embeds: [embed] }).catch(() => {});
}

function cleanupCollections() {
    const now = Date.now();
    const oneDay = 86400000;
    const oneWeek = 604800000;
    
    // Clean old tickets
    tickets.forEach((ticket, key) => {
        if (now - ticket.created > oneWeek) {
            tickets.delete(key);
        }
    });
    
    // Clean old giveaways
    giveaways.forEach((giveaway, key) => {
        if (now - giveaway.endTime > oneDay) {
            giveaways.delete(key);
        }
    });
    
    // Clean old drops
    drops.forEach((drop, key) => {
        if (drop.remaining === 0) {
            drops.delete(key);
        }
    });
    
    // Clean old votes
    votes.forEach((vote, key) => {
        if (now - vote.created > oneDay) {
            votes.delete(key);
        }
    });
    
    // Clean old warnings
    warnings.forEach((warnList, userId) => {
        const filtered = warnList.filter(w => now - new Date(w.date).getTime() < oneWeek);
        if (filtered.length === 0) {
            warnings.delete(userId);
        } else {
            warnings.set(userId, filtered);
        }
    });
}

// ==================== EMBED FUNCTION ====================
function createEmbed(title, description, color = '#ff0000') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: '🔥 Black & Red Server', iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();
}

// ==================== UPDATE FUNCTIONS ====================
function updateStatus() {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    
    const memberCount = guild.memberCount;
    client.user.setPresence({
        activities: [{ name: `${memberCount} members 🔥 | /help`, type: 3 }],
        status: 'online'
    });
    
    serverStats.members = memberCount;
    serverStats.online = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
    serverStats.voice = guild.members.cache.filter(m => m.voice.channel).size;
    serverStats.boosts = guild.premiumSubscriptionCount || 0;
    serverStats.channels = guild.channels.cache.size;
    serverStats.roles = guild.roles.cache.size;
}

async function updateTopTen() {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    
    try {
        const members = await guild.members.fetch();
        const sorted = members.filter(m => !m.user.bot).sort((a, b) => {
            const aTime = a.joinedTimestamp || 0;
            const bTime = b.joinedTimestamp || 0;
            return bTime - aTime;
        });
        
        topTen.clear();
        sorted.first(10).forEach((m, i) => {
            topTen.set(i + 1, {
                id: m.id,
                username: m.user.username,
                joinDate: m.joinedAt,
                displayName: m.displayName,
                avatar: m.user.displayAvatarURL()
            });
        });
    } catch (error) {
        console.error('Error updating top ten:', error);
    }
}

async function updateMemberCount() {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    
    const channel = guild.channels.cache.get(config.memberCountChannelId);
    if (channel) {
        await channel.setName(`👥 ${guild.memberCount} Members`).catch(() => {});
    }
}

function checkTempBans() {
    const now = Date.now();
    tempBans.forEach((ban, userId) => {
        if (ban.endTime <= now) {
            const guild = client.guilds.cache.get(config.guildId);
            guild.members.unban(userId).catch(() => {});
            tempBans.delete(userId);
            logAction('🔓 Temp Ban Ended', `<@${userId}> has been automatically unbanned`);
        }
    });
}

function checkGiveaways() {
    const now = Date.now();
    giveaways.forEach((giveaway, messageId) => {
        if (giveaway.endTime <= now) {
            endGiveaway(messageId);
        }
    });
}

function updateBotStats() {
    botStats.uptime = Date.now() - botStats.startTime;
}

// ==================== DATA FUNCTIONS ====================
function saveData() {
    try {
        const data = {
            warnings: Array.from(warnings.entries()),
            economy: Array.from(economy.entries()),
            levels: Array.from(levels.entries()),
            customCommands: Array.from(customCommands.entries()),
            reactionRoles: Array.from(reactionRoles.entries()),
            dailyRewards: Array.from(dailyRewards.entries()),
            tempBans: Array.from(tempBans.entries()),
            userActivity: Array.from(userActivity.entries()),
            serverStats: serverStats,
            botStats: botStats
        };
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

function loadData() {
    try {
        if (fs.existsSync('./data.json')) {
            const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
            if (data.warnings) warnings = new Collection(data.warnings);
            if (data.economy) economy = new Collection(data.economy);
            if (data.levels) levels = new Collection(data.levels);
            if (data.customCommands) customCommands = new Collection(data.customCommands);
            if (data.reactionRoles) reactionRoles = new Collection(data.reactionRoles);
            if (data.dailyRewards) dailyRewards = new Collection(data.dailyRewards);
            if (data.tempBans) tempBans = new Collection(data.tempBans);
            if (data.userActivity) userActivity = new Collection(data.userActivity);
            if (data.serverStats) serverStats = data.serverStats;
            if (data.botStats) botStats = data.botStats;
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function logAction(title, description) {
    const channel = client.channels.cache.get(config.logChannelId);
    if (!channel) return;
    
    const embed = createEmbed(title, description);
    await channel.send({ embeds: [embed] }).catch(() => {});
}

function logToStaff(title, description) {
    const log = {
        title,
        description,
        timestamp: Date.now()
    };
    staffLogs.set(Date.now(), log);
    if (staffLogs.size > 100) {
        const firstKey = staffLogs.firstKey();
        staffLogs.delete(firstKey);
    }
}

// ==================== INTERACTION HANDLER ====================
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
    } else if (interaction.isCommand()) {
        await handleCommand(interaction);
    }
});

// ==================== BUTTON HANDLER ====================
async function handleButton(interaction) {
    const { customId } = interaction;
    
    if (customId.startsWith('ticket_')) {
        const type = customId.split('_')[1];
        await createTicket(interaction, type);
    } else if (customId === 'close_ticket') {
        await closeTicket(interaction);
    } else if (customId === 'delete_ticket') {
        await deleteTicket(interaction);
    } else if (customId === 'claim_ticket') {
        await claimTicket(interaction);
    } else if (customId === 'add_user') {
        await addUserToTicket(interaction);
    } else if (customId === 'remove_user') {
        await removeUserFromTicket(interaction);
    } else if (customId === 'verify_start') {
        await startVerification(interaction);
    } else if (customId === 'enter_giveaway') {
        await enterGiveaway(interaction);
    } else if (customId === 'claim_drop') {
        await claimDrop(interaction);
    } else if (customId.startsWith('vote_')) {
        await handleVote(interaction);
    } else if (customId === 'suggest_upvote') {
        await handleSuggestionVote(interaction, 'upvote');
    } else if (customId === 'suggest_downvote') {
        await handleSuggestionVote(interaction, 'downvote');
    } else if (customId === 'view_tickets') {
        await viewAllTickets(interaction);
    } else if (customId === 'staff_logs') {
        await viewStaffLogs(interaction);
    } else if (customId === 'staff_stats') {
        await viewStaffStats(interaction);
    } else if (customId === 'accept_appeal') {
        await acceptAppeal(interaction);
    } else if (customId === 'deny_appeal') {
        await denyAppeal(interaction);
    } else if (customId === 'view_warnings') {
        await viewAllWarnings(interaction);
    } else if (customId === 'view_bans') {
        await viewAllBans(interaction);
    } else if (customId === 'view_kicks') {
        await viewAllKicks(interaction);
    } else if (customId === 'view_mutes') {
        await viewAllMutes(interaction);
    }
}

// ==================== TICKET SYSTEM ====================
async function createTicket(interaction, type) {
    const guild = interaction.guild;
    const member = interaction.member;
    const category = guild.channels.cache.get(config.ticketCategoryId);
    
    // Cooldown check
    const cooldown = ticketCooldowns.get(member.id) || 0;
    if (Date.now() - cooldown < 300000) {
        return interaction.reply({ 
            content: '⏰ You can only create one ticket every 5 minutes!', 
            ephemeral: true 
        });
    }
    
    try {
        const channel = await guild.channels.create({
            name: `ticket-${member.user.username}-${Date.now().toString().slice(-4)}`,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: config.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
                { id: config.modRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });
        
        tickets.set(channel.id, {
            user: member.id,
            type: type,
            created: Date.now(),
            claimed: null,
            messages: [],
            users: [member.id],
            status: 'open'
        });
        
        ticketCooldowns.set(member.id, Date.now());
        botStats.ticketsCreated++;
        serverStats.tickets++;
        
        const embed = createEmbed('🎫 Ticket Created',
            `**Type:** ${type}\n**Created by:** ${member.user.tag}\n**Created at:** ${new Date().toLocaleString()}\n**ID:** ${channel.id}\n\nPlease describe your issue in detail.`
        );
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('📌'),
            new ButtonBuilder().setCustomId('add_user').setLabel('Add User').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('remove_user').setLabel('Remove User').setStyle(ButtonStyle.Danger).setEmoji('➖'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );
        
        await channel.send({ 
            content: `${member.user}`, 
            embeds: [embed], 
            components: [row] 
        });
        
        await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
        await logAction('🎫 Ticket Created', `${member.user.tag} created a ${type} ticket\nChannel: ${channel.name}\nID: ${channel.id}`);
        logToStaff('Ticket Created', `${member.user.tag} created a ${type} ticket`);
        
    } catch (error) {
        console.error('Error creating ticket:', error);
        await interaction.reply({ 
            content: '❌ Failed to create ticket. Please check bot permissions.', 
            ephemeral: true 
        });
    }
}

async function closeTicket(interaction) {
    const channel = interaction.channel;
    const ticket = tickets.get(channel.id);
    if (!ticket) return;
    
    if (ticket.status === 'closed') {
        return interaction.reply({ content: '❌ This ticket is already closed!', ephemeral: true });
    }
    
    const embed = createEmbed('🔒 Ticket Closed',
        `Closed by ${interaction.user.tag}\nReason: Not provided\nTotal messages: ${ticket.messages.length}\nDuration: ${Math.floor((Date.now() - ticket.created) / 60000)} minutes`
    );
    
    await interaction.reply({ embeds: [embed] });
    await channel.permissionOverwrites.set([]);
    ticket.status = 'closed';
    tickets.set(channel.id, ticket);
    serverStats.tickets--;
    
    await logAction('🔒 Ticket Closed', `${interaction.user.tag} closed ticket in ${channel.name}\nID: ${channel.id}`);
    logToStaff('Ticket Closed', `${interaction.user.tag} closed a ticket`);
}

async function deleteTicket(interaction) {
    const channel = interaction.channel;
    const ticket = tickets.get(channel.id);
    
    await interaction.reply({ content: '🗑️ Deleting ticket in 5 seconds...' });
    
    if (ticket) {
        await logAction('🗑️ Ticket Deleted', `${interaction.user.tag} deleted ticket in ${channel.name}\nID: ${channel.id}`);
        tickets.delete(channel.id);
    }
    
    setTimeout(() => channel.delete().catch(() => {}), 5000);
}

async function claimTicket(interaction) {
    const channel = interaction.channel;
    const ticket = tickets.get(channel.id);
    if (!ticket) return;
    
    if (ticket.claimed) {
        return interaction.reply({ content: '❌ This ticket is already claimed!', ephemeral: true });
    }
    
    ticket.claimed = interaction.user.id;
    tickets.set(channel.id, ticket);
    
    await interaction.reply({ content: '✅ You claimed this ticket!', ephemeral: true });
    await channel.send(`📌 ${interaction.user.tag} claimed this ticket`);
    
    await logAction('📌 Ticket Claimed', `${interaction.user.tag} claimed ticket in ${channel.name}`);
}

async function addUserToTicket(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_user_modal')
        .setTitle('Add User to Ticket');
    
    const userInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('User ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter user ID');
    
    modal.addComponents(new ActionRowBuilder().addComponents(userInput));
    await interaction.showModal(modal);
}

async function removeUserFromTicket(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('remove_user_modal')
        .setTitle('Remove User from Ticket');
    
    const userInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('User ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter user ID');
    
    modal.addComponents(new ActionRowBuilder().addComponents(userInput));
    await interaction.showModal(modal);
}

// ==================== VERIFICATION SYSTEM ====================
async function startVerification(interaction) {
    const cooldown = verifyCooldowns.get(interaction.user.id) || 0;
    if (Date.now() - cooldown < 300000) {
        return interaction.reply({ 
            content: '⏰ Please wait 5 minutes before trying again!', 
            ephemeral: true 
        });
    }
    
    const modal = new ModalBuilder()
        .setCustomId('verify_modal')
        .setTitle('🔐 Verification');
    
    const q1 = new TextInputBuilder()
        .setCustomId('answer1')
        .setLabel('What is the server name?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter the server name');
    
    const q2 = new TextInputBuilder()
        .setCustomId('answer2')
        .setLabel('What is the owner\'s name?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter the owner name');
    
    const q3 = new TextInputBuilder()
        .setCustomId('answer3')
        .setLabel('What year was the server created?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter the creation year');
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(q1),
        new ActionRowBuilder().addComponents(q2),
        new ActionRowBuilder().addComponents(q3)
    );
    
    await interaction.showModal(modal);
}

// ==================== MODAL HANDLER ====================
async function handleModal(interaction) {
    if (interaction.customId === 'verify_modal') {
        const answer1 = interaction.fields.getTextInputValue('answer1');
        const answer2 = interaction.fields.getTextInputValue('answer2');
        const answer3 = interaction.fields.getTextInputValue('answer3');
        const guild = interaction.guild;
        const member = interaction.member;
        
        let correct = 0;
        if (answer1.toLowerCase() === 'my server') correct++;
        if (answer2.toLowerCase() === 'owner name') correct++;
        if (answer3 === '2024') correct++;
        
        if (correct >= 2) {
            try {
                await member.roles.add(config.verifyRoleId);
                const embed = createEmbed('✅ Verification Successful', 
                    `You have been verified!\nCorrect answers: ${correct}/3\nWelcome to the server!`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                
                const welcomeChannel = guild.channels.cache.get(config.welcomeChannelId);
                if (welcomeChannel) {
                    const welcomeEmbed = createEmbed('👋 Welcome to the Server!',
                        `Please welcome ${member.user.tag} to our community!\nThey joined on ${new Date().toLocaleDateString()}\nVerified: ${new Date().toLocaleString()}`
                    );
                    await welcomeChannel.send({ content: `${member.user}`, embeds: [welcomeEmbed] });
                }
                
                await logAction('✅ Verification Passed', `${member.user.tag} passed verification\nCorrect answers: ${correct}/3`);
                verifyCooldowns.set(interaction.user.id, Date.now());
                
            } catch (error) {
                console.error('Error verifying user:', error);
                await interaction.reply({ 
                    content: '❌ Failed to assign verification role. Please contact staff.', 
                    ephemeral: true 
                });
            }
        } else {
            const embed = createEmbed('❌ Verification Failed', 
                `You failed verification.\nCorrect answers: ${correct}/3\nPlease try again in 5 minutes.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            await logAction('❌ Verification Failed', `${member.user.tag} failed verification\nCorrect answers: ${correct}/3`);
        }
    }
    
    if (interaction.customId === 'add_user_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
        const channel = interaction.channel;
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ User not found!', ephemeral: true });
        
        try {
            await channel.permissionOverwrites.create(user.id, { 
                ViewChannel: true, 
                SendMessages: true, 
                ReadMessageHistory: true 
            });
            
            const ticket = tickets.get(channel.id);
            if (ticket) {
                if (!ticket.users.includes(user.id)) {
                    ticket.users.push(user.id);
                    tickets.set(channel.id, ticket);
                }
            }
            
            await interaction.reply({ content: `✅ Added ${user.tag} to the ticket!`, ephemeral: true });
            await channel.send(`➕ ${user.tag} was added to the ticket by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('Error adding user to ticket:', error);
            await interaction.reply({ content: '❌ Failed to add user. Please check permissions.', ephemeral: true });
        }
    }
    
    if (interaction.customId === 'remove_user_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
        const channel = interaction.channel;
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ User not found!', ephemeral: true });
        
        try {
            await channel.permissionOverwrites.delete(user.id).catch(() => {});
            
            const ticket = tickets.get(channel.id);
            if (ticket) {
                ticket.users = ticket.users.filter(id => id !== user.id);
                tickets.set(channel.id, ticket);
            }
            
            await interaction.reply({ content: `✅ Removed ${user.tag} from the ticket!`, ephemeral: true });
            await channel.send(`➖ ${user.tag} was removed from the ticket by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error('Error removing user from ticket:', error);
            await interaction.reply({ content: '❌ Failed to remove user.', ephemeral: true });
        }
    }
}

// ==================== COMMAND HANDLER ====================
async function handleCommand(interaction) {
    const { commandName, options, user, guild, member } = interaction;
    
    botStats.commandsUsed++;
    
    try {
        switch(commandName) {
            case 'ticket': await showTicketMenu(interaction); break;
            case 'verify': await showVerifyMenu(interaction); break;
            case 'staff': await showStaffPanel(interaction); break;
            case 'panel': await showAdminPanel(interaction); break;
            case 'config': await showConfigPanel(interaction); break;
            case 'top': await showTopTen(interaction); break;
            case 'help': await handleHelp(interaction); break;
            case 'ping': await handlePing(interaction); break;
            case 'serverinfo': await handleServerInfo(interaction); break;
            case 'userinfo': await handleUserInfo(interaction); break;
            case 'avatar': await handleAvatar(interaction); break;
            case 'say': await handleSay(interaction); break;
            case 'poll': await handlePoll(interaction); break;
            case 'announce': await handleAnnounce(interaction); break;
            case 'purge': await handlePurge(interaction); break;
            case 'slowmode': await handleSlowmode(interaction); break;
            case 'lockdown': await handleLockdown(interaction); break;
            case 'unlock': await handleUnlock(interaction); break;
            case 'warn': await handleWarn(interaction); break;
            case 'kick': await handleKick(interaction); break;
            case 'ban': await handleBan(interaction); break;
            case 'mute': await handleMute(interaction); break;
            case 'unmute': await handleUnmute(interaction); break;
            case 'setnick': await handleSetNick(interaction); break;
            case 'addrole': await handleAddRole(interaction); break;
            case 'removerole': await handleRemoveRole(interaction); break;
            case 'clearwarns': await handleClearWarns(interaction); break;
            case 'warnings': await handleViewWarnings(interaction); break;
            case 'suggest': await handleSuggestion(interaction); break;
            case 'report': await handleReport(interaction); break;
            case 'appeal': await handleAppeal(interaction); break;
            case 'daily': await handleDaily(interaction); break;
            case 'balance': await handleBalance(interaction); break;
            case 'level': await handleLevel(interaction); break;
            case 'leaderboard': await handleLeaderboard(interaction); break;
            case 'reactionrole': await handleReactionRole(interaction); break;
            case 'customcmd': await handleCustomCommand(interaction); break;
            case 'giveaway': await handleGiveaway(interaction); break;
            case 'drop': await handleDrop(interaction); break;
            case 'vote': await handleVoteCommand(interaction); break;
            case 'stats': await handleStats(interaction); break;
            case 'botinfo': await handleBotInfo(interaction); break;
            case 'uptime': await handleUptime(interaction); break;
            case 'invite': await handleInvite(interaction); break;
            case 'support': await handleSupport(interaction); break;
            case 'feedback': await handleFeedback(interaction); break;
            case 'suggestion': await handleSuggestion(interaction); break;
            case 'bugreport': await handleBugReport(interaction); break;
            case 'feature': await handleFeature(interaction); break;
            case 'about': await handleAbout(interaction); break;
            case 'credits': await handleCredits(interaction); break;
            case 'donate': await handleDonate(interaction); break;
            case 'premium': await handlePremium(interaction); break;
            case 'terms': await handleTerms(interaction); break;
            case 'privacy': await handlePrivacy(interaction); break;
            default: break;
        }
    } catch (error) {
        console.error(`Error handling command ${commandName}:`, error);
        await interaction.reply({ 
            content: '❌ An error occurred while executing this command.', 
            ephemeral: true 
        }).catch(() => {});
    }
}

// ==================== MENU FUNCTIONS ====================
async function showTicketMenu(interaction) {
    const embed = createEmbed('🎫 Support Tickets',
        'Select a ticket type to get started:\n\n' +
        '**Support** - General support and help\n' +
        '**Report** - Report a user or issue\n' +
        '**Suggestion** - Submit a suggestion\n' +
        '**Other** - Other issues or questions\n\n' +
        '⚠️ Do not create multiple tickets for the same issue.'
    );
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_Support').setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('🆘'),
        new ButtonBuilder().setCustomId('ticket_Report').setLabel('Report').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
        new ButtonBuilder().setCustomId('ticket_Suggestion').setLabel('Suggestion').setStyle(ButtonStyle.Success).setEmoji('💡'),
        new ButtonBuilder().setCustomId('ticket_Other').setLabel('Other').setStyle(ButtonStyle.Secondary).setEmoji('📌')
    );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showVerifyMenu(interaction) {
    const embed = createEmbed('🔐 Verification',
        '**Welcome to the server!**\n\n' +
        'To gain access to all channels, please complete the verification process.\n' +
        'Click the button below to start.\n\n' +
        '**Requirements:**\n' +
        '• Answer 3 questions correctly\n' +
        '• Get at least 2 correct answers\n' +
        '• Wait 5 minutes between attempts\n\n' +
        '**Benefits of verifying:**\n' +
        '• Full access to all channels\n' +
        '• Ability to participate in giveaways\n' +
        '• Access to economy system\n' +
        '• Level up and earn rewards'
    );
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_start').setLabel('Start Verification').setStyle(ButtonStyle.Success).setEmoji('✅')
    );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ==================== PANEL FUNCTIONS ====================
async function showAdminPanel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator permissions!', ephemeral: true });
    }
    
    const embed = createEmbed('⚙️ Admin Panel', '**Server Management Dashboard**')
        .addFields(
            { name: '📊 Server Stats', value: `Members: ${serverStats.members}\nOnline: ${serverStats.online}\nVoice: ${serverStats.voice}\nBoosts: ${serverStats.boosts}`, inline: true },
            { name: '🎫 Tickets', value: `Open: ${tickets.size}\nCreated: ${botStats.ticketsCreated}`, inline: true },
            { name: '🎉 Giveaways', value: `Active: ${giveaways.size}\nCreated: ${botStats.giveawaysCreated}`, inline: true },
            { name: '📦 Drops', value: `Active: ${drops.size}\nCreated: ${botStats.dropsCreated}`, inline: true },
            { name: '📊 Votes', value: `Active: ${votes.size}\nCreated: ${botStats.votesCreated}`, inline: true },
            { name: '👥 Users', value: `Total: ${serverStats.members}\nWarnings: ${warnings.size}`, inline: true },
            { name: '📋 Moderation', value: `Bans: ${botStats.bansIssued}\nKicks: ${botStats.kicksIssued}\nMutes: ${botStats.mutesIssued}`, inline: true },
            { name: '🤖 Bot Stats', value: `Commands: ${botStats.commandsUsed}\nUptime: ${getUptime()}`, inline: true }
        );
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('view_tickets').setLabel('View Tickets').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
        new ButtonBuilder().setCustomId('staff_stats').setLabel('Staff Stats').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
        new ButtonBuilder().setCustomId('view_warnings').setLabel('View Warnings').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
    );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showConfigPanel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator permissions!', ephemeral: true });
    }
    
    const embed = createEmbed('⚙️ Configuration', '**Current Server Configuration**')
        .addFields(
            { name: '📌 Ticket Category', value: `<#${config.ticketCategoryId}>`, inline: true },
            { name: '📋 Log Channel', value: `<#${config.logChannelId}>`, inline: true },
            { name: '👋 Welcome Channel', value: `<#${config.welcomeChannelId}>`, inline: true },
            { name: '👑 Admin Role', value: `<@&${config.adminRoleId}>`, inline: true },
            { name: '🛡️ Mod Role', value: `<@&${config.modRoleId}>`, inline: true },
            { name: '✅ Verify Role', value: `<@&${config.verifyRoleId}>`, inline: true },
            { name: '🎉 Giveaways Channel', value: `<#${config.giveawaysChannelId}>`, inline: true },
            { name: '📦 Drops Channel', value: `<#${config.dropsChannelId}>`, inline: true },
            { name: '📊 Vote Channel', value: `<#${config.voteChannelId}>`, inline: true },
            { name: '📊 Suggestions Channel', value: `<#${config.suggestionsChannelId}>`, inline: true },
            { name: '👥 Member Count Channel', value: `<#${config.memberCountChannelId}>`, inline: true }
        );
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showStaffPanel(interaction) {
    const staff = interaction.guild.members.cache.filter(m => 
        m.roles.cache.has(config.adminRoleId) || m.roles.cache.has(config.modRoleId)
    );
    const onlineStaff = staff.filter(m => m.presence?.status !== 'offline');
    
    const embed = createEmbed('🛡️ Staff Panel', '**Staff Management Dashboard**')
        .addFields(
            { name: '👥 Online Staff', value: `${onlineStaff.size}/${staff.size}`, inline: true },
            { name: '🎫 Open Tickets', value: tickets.size.toString(), inline: true },
            { name: '🎉 Active Giveaways', value: giveaways.size.toString(), inline: true },
            { name: '📦 Active Drops', value: drops.size.toString(), inline: true },
            { name: '📊 Active Votes', value: votes.size.toString(), inline: true },
            { name: '📋 Pending Appeals', value: appeals.size.toString(), inline: true }
        );
    
    const staffList = staff.map(m => `${m.displayName} (${m.presence?.status || 'offline'})`).join('\n');
    if (staffList) {
        embed.addFields({ name: '📋 Staff List', value: staffList.substring(0, 1024), inline: false });
    }
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('view_tickets').setLabel('View Tickets').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
        new ButtonBuilder().setCustomId('staff_logs').setLabel('View Logs').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId('staff_stats').setLabel('Stats').setStyle(ButtonStyle.Success).setEmoji('📊')
    );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ==================== MODERATION COMMANDS ====================
async function handleWarn(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    
    if (user.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You cannot warn yourself!', ephemeral: true });
    }
    
    if (user.id === client.user.id) {
        return interaction.reply({ content: '❌ You cannot warn the bot!', ephemeral: true });
    }
    
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You cannot warn an administrator!', ephemeral: true });
    }
    
    if (!warnings.has(user.id)) warnings.set(user.id, []);
    const userWarnings = warnings.get(user.id);
    userWarnings.push({ 
        reason, 
        by: interaction.user.id, 
        date: new Date().toISOString(),
        id: Date.now().toString()
    });
    warnings.set(user.id, userWarnings);
    botStats.warningsIssued++;
    serverStats.warnings++;
    
    const embed = createEmbed('⚠️ Warning Issued', 
        `**User:** ${user.tag}\n**Reason:** ${reason}\n**By:** ${interaction.user.tag}\n**Total Warnings:** ${userWarnings.length}`
    );
    
    await interaction.reply({ embeds: [embed] });
    await user.send(`⚠️ You have been warned in **${interaction.guild.name}**\n**Reason:** ${reason}\n**Total Warnings:** ${userWarnings.length}`).catch(() => {});
    await logAction('⚠️ Warning Issued', `${interaction.user.tag} warned ${user.tag}: ${reason}\nTotal: ${userWarnings.length}`);
    logToStaff('Warning Issued', `${interaction.user.tag} warned ${user.tag}`);
    
    // Auto moderation - mute if 3 warnings
    if (userWarnings.length >= 3) {
        try {
            await member.timeout(3600000, 'Auto-mute: 3 warnings');
            await interaction.channel.send(`🔇 ${user.tag} has been auto-muted for 1 hour due to 3 warnings.`);
            await logAction('🔇 Auto-Mute', `${user.tag} was auto-muted for 1 hour (3 warnings)`);
        } catch (error) {
            console.error('Error auto-muting user:', error);
        }
    }
}

async function handleKick(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: '❌ You need Kick Members permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (user.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You cannot kick yourself!', ephemeral: true });
    }
    
    if (user.id === client.user.id) {
        return interaction.reply({ content: '❌ You cannot kick the bot!', ephemeral: true });
    }
    
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You cannot kick an administrator!', ephemeral: true });
    }
    
    try {
        await member.kick(`${reason} (kicked by ${interaction.user.tag})`);
        botStats.kicksIssued++;
        serverStats.kicks++;
        
        await interaction.reply({ content: `✅ ${user.tag} has been kicked. Reason: ${reason}` });
        await user.send(`👢 You have been kicked from **${interaction.guild.name}**\n**Reason:** ${reason}`).catch(() => {});
        await logAction('👢 Member Kicked', `${interaction.user.tag} kicked ${user.tag}: ${reason}`);
        logToStaff('Member Kicked', `${interaction.user.tag} kicked ${user.tag}`);
        
    } catch (error) {
        console.error('Error kicking user:', error);
        await interaction.reply({ content: '❌ Failed to kick user. Check bot permissions.', ephemeral: true });
    }
}

async function handleBan(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ You need Ban Members permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (user.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You cannot ban yourself!', ephemeral: true });
    }
    
    if (user.id === client.user.id) {
        return interaction.reply({ content: '❌ You cannot ban the bot!', ephemeral: true });
    }
    
    try {
        await interaction.guild.members.ban(user, { 
            reason: `${reason} (banned by ${interaction.user.tag})` 
        });
        botStats.bansIssued++;
        serverStats.bans++;
        
        await interaction.reply({ content: `✅ ${user.tag} has been banned. Reason: ${reason}` });
        await user.send(`🔨 You have been banned from **${interaction.guild.name}**\n**Reason:** ${reason}`).catch(() => {});
        await logAction('🔨 Member Banned', `${interaction.user.tag} banned ${user.tag}: ${reason}`);
        logToStaff('Member Banned', `${interaction.user.tag} banned ${user.tag}`);
        
    } catch (error) {
        console.error('Error banning user:', error);
        await interaction.reply({ content: '❌ Failed to ban user. Check bot permissions.', ephemeral: true });
    }
}

async function handleMute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (user.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You cannot mute yourself!', ephemeral: true });
    }
    
    if (user.id === client.user.id) {
        return interaction.reply({ content: '❌ You cannot mute the bot!', ephemeral: true });
    }
    
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You cannot mute an administrator!', ephemeral: true });
    }
    
    try {
        await member.timeout(duration * 60000, `${reason} (muted by ${interaction.user.tag})`);
        botStats.mutesIssued++;
        serverStats.mutes++;
        
        await interaction.reply({ content: `✅ ${user.tag} has been muted for ${duration} minutes. Reason: ${reason}` });
        await user.send(`🔇 You have been muted in **${interaction.guild.name}**\n**Duration:** ${duration} minutes\n**Reason:** ${reason}`).catch(() => {});
        await logAction('🔇 Member Muted', `${interaction.user.tag} muted ${user.tag} for ${duration} minutes: ${reason}`);
        logToStaff('Member Muted', `${interaction.user.tag} muted ${user.tag}`);
        
    } catch (error) {
        console.error('Error muting user:', error);
        await interaction.reply({ content: '❌ Failed to mute user. Check bot permissions.', ephemeral: true });
    }
}

async function handleUnmute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    try {
        await member.timeout(null);
        await interaction.reply({ content: `✅ ${user.tag} has been unmuted.` });
        await user.send(`🔊 You have been unmuted in **${interaction.guild.name}**`).catch(() => {});
        await logAction('🔊 Member Unmuted', `${interaction.user.tag} unmuted ${user.tag}`);
        
    } catch (error) {
        console.error('Error unmuting user:', error);
        await interaction.reply({ content: '❌ Failed to unmute user.', ephemeral: true });
    }
}

async function handleSetNick(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({ content: '❌ You need Manage Nicknames permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    try {
        await member.setNickname(nickname);
        await interaction.reply({ content: `✅ ${user.tag}'s nickname has been set to ${nickname}` });
        await logAction('✏️ Nickname Changed', `${interaction.user.tag} changed ${user.tag}'s nickname to ${nickname}`);
        
    } catch (error) {
        console.error('Error changing nickname:', error);
        await interaction.reply({ content: '❌ Failed to change nickname.', ephemeral: true });
    }
}

async function handleAddRole(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ You need Manage Roles permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    if (role.position >= interaction.member.roles.highest.position) {
        return interaction.reply({ content: '❌ You cannot assign a role higher than your highest role!', ephemeral: true });
    }
    
    try {
        await member.roles.add(role);
        await interaction.reply({ content: `✅ Added ${role.name} to ${user.tag}` });
        await logAction('➕ Role Added', `${interaction.user.tag} added ${role.name} to ${user.tag}`);
        
    } catch (error) {
        console.error('Error adding role:', error);
        await interaction.reply({ content: '❌ Failed to add role. Check bot permissions.', ephemeral: true });
    }
}

async function handleRemoveRole(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ You need Manage Roles permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not found in server!', ephemeral: true });
    
    if (role.position >= interaction.member.roles.highest.position) {
        return interaction.reply({ content: '❌ You cannot remove a role higher than your highest role!', ephemeral: true });
    }
    
    try {
        await member.roles.remove(role);
        await interaction.reply({ content: `✅ Removed ${role.name} from ${user.tag}` });
        await logAction('➖ Role Removed', `${interaction.user.tag} removed ${role.name} from ${user.tag}`);
        
    } catch (error) {
        console.error('Error removing role:', error);
        await interaction.reply({ content: '❌ Failed to remove role.', ephemeral: true });
    }
}

async function handleClearWarns(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    warnings.delete(user.id);
    await interaction.reply({ content: `✅ Cleared all warnings for ${user.tag}` });
    await logAction('🧹 Warnings Cleared', `${interaction.user.tag} cleared warnings for ${user.tag}`);
}

async function handleViewWarnings(interaction) {
    const user = interaction.options.getUser('user');
    const userWarnings = warnings.get(user.id) || [];
    
    if (userWarnings.length === 0) {
        return interaction.reply({ content: `✅ ${user.tag} has no warnings.` });
    }
    
    const embed = createEmbed('📋 Warnings', `**User:** ${user.tag}\n**Total Warnings:** ${userWarnings.length}`);
    userWarnings.slice(0, 10).forEach((w, i) => {
        embed.addFields({ 
            name: `Warning #${i + 1}`, 
            value: `Reason: ${w.reason}\nBy: <@${w.by}>\nDate: ${new Date(w.date).toLocaleString()}`, 
            inline: false 
        });
    });
    
    if (userWarnings.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${userWarnings.length} warnings` });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// ==================== SUGGESTION SYSTEM ====================
async function handleSuggestion(interaction) {
    const suggestion = interaction.options.getString('suggestion');
    const cooldown = suggestCooldowns.get(interaction.user.id) || 0;
    
    if (Date.now() - cooldown < 600000) {
        return interaction.reply({ 
            content: '⏰ You can only submit one suggestion every 10 minutes!', 
            ephemeral: true 
        });
    }
    
    const embed = createEmbed('💡 New Suggestion', `**By:** ${interaction.user.tag}\n**Suggestion:** ${suggestion}`)
        .setFooter({ text: 'Upvote or downvote this suggestion' });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('suggest_upvote').setLabel('Upvote').setStyle(ButtonStyle.Success).setEmoji('👍'),
        new ButtonBuilder().setCustomId('suggest_downvote').setLabel('Downvote').setStyle(ButtonStyle.Danger).setEmoji('👎')
    );
    
    const channel = interaction.guild.channels.cache.get(config.suggestionsChannelId || config.giveawaysChannelId);
    if (!channel) {
        return interaction.reply({ 
            content: '❌ Suggestions channel not configured!', 
            ephemeral: true 
        });
    }
    
    try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        suggestions.set(msg.id, { 
            author: interaction.user.id, 
            suggestion, 
            upvotes: [], 
            downvotes: [],
            created: Date.now()
        });
        botStats.suggestionsSubmitted++;
        suggestCooldowns.set(interaction.user.id, Date.now());
        await interaction.reply({ content: '✅ Suggestion submitted!', ephemeral: true });
        await logAction('💡 Suggestion Submitted', `${interaction.user.tag} submitted a suggestion`);
        
    } catch (error) {
        console.error('Error submitting suggestion:', error);
        await interaction.reply({ content: '❌ Failed to submit suggestion.', ephemeral: true });
    }
}

async function handleSuggestionVote(interaction, type) {
    const suggestion = suggestions.get(interaction.message.id);
    if (!suggestion) return;
    
    if (interaction.user.id === suggestion.author) {
        return interaction.reply({ content: '❌ You cannot vote on your own suggestion!', ephemeral: true });
    }
    
    if (type === 'upvote') {
        if (suggestion.downvotes.includes(interaction.user.id)) {
            suggestion.downvotes = suggestion.downvotes.filter(id => id !== interaction.user.id);
        }
        if (suggestion.upvotes.includes(interaction.user.id)) {
            suggestion.upvotes = suggestion.upvotes.filter(id => id !== interaction.user.id);
            await interaction.reply({ content: '✅ Removed your upvote', ephemeral: true });
        } else {
            suggestion.upvotes.push(interaction.user.id);
            await interaction.reply({ content: '✅ Added your upvote', ephemeral: true });
        }
    } else {
        if (suggestion.upvotes.includes(interaction.user.id)) {
            suggestion.upvotes = suggestion.upvotes.filter(id => id !== interaction.user.id);
        }
        if (suggestion.downvotes.includes(interaction.user.id)) {
            suggestion.downvotes = suggestion.downvotes.filter(id => id !== interaction.user.id);
            await interaction.reply({ content: '✅ Removed your downvote', ephemeral: true });
        } else {
            suggestion.downvotes.push(interaction.user.id);
            await interaction.reply({ content: '✅ Added your downvote', ephemeral: true });
        }
    }
    
    suggestions.set(interaction.message.id, suggestion);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `Upvotes: ${suggestion.upvotes.length} | Downvotes: ${suggestion.downvotes.length}` });
    await interaction.message.edit({ embeds: [embed] });
}

// ==================== REPORT & APPEAL ====================
async function handleReport(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const cooldown = reportCooldowns.get(interaction.user.id) || 0;
    
    if (Date.now() - cooldown < 600000) {
        return interaction.reply({ 
            content: '⏰ You can only submit one report every 10 minutes!', 
            ephemeral: true 
        });
    }
    
    if (user.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You cannot report yourself!', ephemeral: true });
    }
    
    const embed = createEmbed('📋 Report Submitted', 
        `**Reported User:** ${user.tag}\n**Reason:** ${reason}\n**Reported by:** ${interaction.user.tag}\n**Date:** ${new Date().toLocaleString()}`
    );
    
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) {
        await logChannel.send({ embeds: [embed] });
        botStats.reportsSubmitted++;
        reportCooldowns.set(interaction.user.id, Date.now());
        await interaction.reply({ content: '✅ Report submitted! Staff will review it.', ephemeral: true });
        await logAction('📋 Report Submitted', `${interaction.user.tag} reported ${user.tag}: ${reason}`);
        
    } else {
        await interaction.reply({ content: '❌ Report channel not configured!', ephemeral: true });
    }
}

async function handleAppeal(interaction) {
    const reason = interaction.options.getString('reason');
    
    const embed = createEmbed('📝 Ban Appeal', 
        `**Appellant:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Status:** Pending review\n**Date:** ${new Date().toLocaleString()}`
    );
    
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) {
        const msg = await logChannel.send({ 
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('accept_appeal').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('deny_appeal').setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌')
                )
            ]
        });
        appeals.set(msg.id, { 
            user: interaction.user.id, 
            reason: reason, 
            status: 'pending',
            messageId: msg.id
        });
        botStats.appealsSubmitted++;
        await interaction.reply({ content: '✅ Appeal submitted! You will be contacted.', ephemeral: true });
        await logAction('📝 Appeal Submitted', `${interaction.user.tag} submitted an appeal`);
        
    } else {
        await interaction.reply({ content: '❌ Appeal channel not configured!', ephemeral: true });
    }
}

async function acceptAppeal(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ You need Ban Members permission!', ephemeral: true });
    }
    
    const appeal = appeals.get(interaction.message.id);
    if (!appeal) return;
    
    try {
        await interaction.guild.members.unban(appeal.user);
        appeal.status = 'accepted';
        appeals.set(interaction.message.id, appeal);
        
        const user = await client.users.fetch(appeal.user).catch(() => null);
        if (user) {
            await user.send('✅ Your ban appeal has been accepted! You have been unbanned.').catch(() => {});
        }
        
        await interaction.reply({ content: '✅ Appeal accepted! User has been unbanned.' });
        await logAction('✅ Appeal Accepted', `${interaction.user.tag} accepted ${user?.tag || appeal.user}'s appeal`);
        
    } catch (error) {
        console.error('Error accepting appeal:', error);
        await interaction.reply({ content: '❌ Failed to accept appeal.', ephemeral: true });
    }
}

async function denyAppeal(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ You need Ban Members permission!', ephemeral: true });
    }
    
    const appeal = appeals.get(interaction.message.id);
    if (!appeal) return;
    
    appeal.status = 'denied';
    appeals.set(interaction.message.id, appeal);
    
    const user = await client.users.fetch(appeal.user).catch(() => null);
    if (user) {
        await user.send('❌ Your ban appeal has been denied. Please wait before submitting another appeal.').catch(() => {});
    }
    
    await interaction.reply({ content: '❌ Appeal denied.' });
    await logAction('❌ Appeal Denied', `${interaction.user.tag} denied ${user?.tag || appeal.user}'s appeal`);
}

// ==================== ECONOMY ====================
async function handleDaily(interaction) {
    const userId = interaction.user.id;
    const lastClaim = dailyRewards.get(userId) || 0;
    const cooldown = 86400000;
    
    if (Date.now() - lastClaim < cooldown) {
        const remaining = new Date(lastClaim + cooldown - Date.now());
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return interaction.reply({ 
            content: `⏰ Come back in ${hours}h ${minutes}m ${seconds}s.`, 
            ephemeral: true 
        });
    }
    
    const reward = 100 + Math.floor(Math.random() * 100);
    economy.set(userId, (economy.get(userId) || 0) + reward);
    dailyRewards.set(userId, Date.now());
    botStats.dailyClaims++;
    
    const embed = createEmbed('💰 Daily Reward', 
        `You claimed your daily reward!\n**Amount:** $${reward}\n**New Balance:** $${economy.get(userId)}\n**Next claim:** ${new Date(Date.now() + cooldown).toLocaleString()}`
    );
    
    await interaction.reply({ embeds: [embed] });
    await logAction('💰 Daily Claim', `${interaction.user.tag} claimed $${reward}`);
}

async function handleBalance(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const balance = economy.get(user.id) || 0;
    
    const embed = createEmbed('💰 Balance', 
        `**User:** ${user.tag}\n**Balance:** $${balance}\n**Rank:** ${getEconomyRank(user.id)}`
    );
    
    await interaction.reply({ embeds: [embed] });
}

function getEconomyRank(userId) {
    const sorted = Array.from(economy.entries()).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([id]) => id === userId) + 1;
    return rank > 0 ? `#${rank}` : 'N/A';
}

// ==================== LEVELING ====================
async function handleLevel(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const levelData = levels.get(user.id) || { xp: 0, level: 1 };
    const neededXP = levelData.level * 100;
    const progress = Math.floor((levelData.xp / neededXP) * 100);
    
    const embed = createEmbed('📊 Level', 
        `**User:** ${user.tag}\n**Level:** ${levelData.level}\n**XP:** ${levelData.xp}/${neededXP}\n**Progress:** ${progress}%`
    );
    
    await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
    const sorted = Array.from(levels.entries())
        .sort((a, b) => b[1].xp - a[1].xp)
        .slice(0, 10);
    
    const embed = createEmbed('🏆 Level Leaderboard', 'Top 10 members by XP');
    
    sorted.forEach(([userId, data], i) => {
        const user = client.users.cache.get(userId);
        embed.addFields({ 
            name: `#${i + 1}`, 
            value: `${user?.tag || 'Unknown'} - Level ${data.level} (${data.xp} XP)`, 
            inline: false 
        });
    });
    
    await interaction.reply({ embeds: [embed] });
}

// ==================== REACTION ROLES ====================
async function handleReactionRole(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ You need Manage Roles permission!', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    const messageId = interaction.options.getString('message');
    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji');
    
    try {
        const msg = await channel.messages.fetch(messageId);
        await msg.react(emoji);
        reactionRoles.set(`${msg.id}_${emoji}`, { 
            roleId: role.id, 
            channelId: channel.id, 
            messageId: msg.id, 
            emoji 
        });
        botStats.reactionRolesSet++;
        await interaction.reply({ content: `✅ Reaction role setup: ${emoji} = ${role.name} in ${channel.name}`, ephemeral: true });
        await logAction('🎨 Reaction Role Setup', `${interaction.user.tag} set up reaction role: ${emoji} = ${role.name}`);
        
    } catch (error) {
        console.error('Error setting up reaction role:', error);
        await interaction.reply({ content: '❌ Failed to setup reaction role. Check message ID and permissions.', ephemeral: true });
    }
}

// ==================== CUSTOM COMMANDS ====================
async function handleCustomCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need Manage Guild permission!', ephemeral: true });
    }
    
    const name = interaction.options.getString('name');
    const response = interaction.options.getString('response');
    
    if (name.length > 20) {
        return interaction.reply({ content: '❌ Command name cannot exceed 20 characters!', ephemeral: true });
    }
    
    if (response.length > 2000) {
        return interaction.reply({ content: '❌ Response cannot exceed 2000 characters!', ephemeral: true });
    }
    
    customCommands.set(name.toLowerCase(), response);
    botStats.customCommandsSet++;
    await interaction.reply({ content: `✅ Custom command created: !${name}`, ephemeral: true });
    await logAction('🔧 Custom Command Created', `${interaction.user.tag} created custom command: !${name}`);
}

// ==================== GIVEAWAY ====================
async function handleGiveaway(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
        return interaction.reply({ content: '❌ You need Manage Events permission!', ephemeral: true });
    }
    
    const prize = interaction.options.getString('prize');
    const duration = interaction.options.getInteger('duration');
    const winners = interaction.options.getInteger('winners');
    
    if (duration > 1440) {
        return interaction.reply({ content: '❌ Maximum duration is 24 hours (1440 minutes)!', ephemeral: true });
    }
    
    if (winners > 10) {
        return interaction.reply({ content: '❌ Maximum winners is 10!', ephemeral: true });
    }
    
    const embed = createEmbed('🎉 Giveaway', 
        `**Prize:** ${prize}\n**Winners:** ${winners}\n**Duration:** ${duration} minutes\n**Hosted by:** ${interaction.user.tag}\n**Ends:** ${new Date(Date.now() + duration * 60000).toLocaleString()}`
    );
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('enter_giveaway').setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎯')
    );
    
    const channel = interaction.guild.channels.cache.get(config.giveawaysChannelId);
    if (!channel) {
        return interaction.reply({ content: '❌ Giveaways channel not configured!', ephemeral: true });
    }
    
    try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        giveaways.set(msg.id, { 
            prize, 
            winners, 
            endTime: Date.now() + duration * 60000, 
            host: interaction.user.id, 
            entries: [], 
            messageId: msg.id,
            created: Date.now()
        });
        botStats.giveawaysCreated++;
        serverStats.giveaways++;
        await interaction.reply({ content: '✅ Giveaway created!', ephemeral: true });
        await logAction('🎉 Giveaway Created', `${interaction.user.tag} created a giveaway for ${prize}`);
        
    } catch (error) {
        console.error('Error creating giveaway:', error);
        await interaction.reply({ content: '❌ Failed to create giveaway.', ephemeral: true });
    }
}

// ==================== DROP ====================
async function handleDrop(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    const item = interaction.options.getString('item');
    const amount = interaction.options.getInteger('amount');
    
    if (amount > 100) {
        return interaction.reply({ content: '❌ Maximum amount is 100!', ephemeral: true });
    }
    
    const embed = createEmbed('📦 Drop', 
        `**Item:** ${item}\n**Amount:** ${amount}\n**Status:** Active\n**Hosted by:** ${interaction.user.tag}\n**Claim:** Click the button below to claim!`
    );
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_drop').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🎁')
    );
    
    const channel = interaction.guild.channels.cache.get(config.dropsChannelId);
    if (!channel) {
        return interaction.reply({ content: '❌ Drops channel not configured!', ephemeral: true });
    }
    
    try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        drops.set(msg.id, { 
            item, 
            amount, 
            claimed: [], 
            remaining: amount, 
            host: interaction.user.id,
            created: Date.now()
        });
        botStats.dropsCreated++;
        serverStats.drops++;
        await interaction.reply({ content: '✅ Drop created!', ephemeral: true });
        await logAction('📦 Drop Created', `${interaction.user.tag} created a drop for ${item}`);
        
    } catch (error) {
        console.error('Error creating drop:', error);
        await interaction.reply({ content: '❌ Failed to create drop.', ephemeral: true });
    }
}

// ==================== VOTE ====================
async function handleVoteCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const question = interaction.options.getString('question');
    const optionsStr = interaction.options.getString('options');
    const optArray = optionsStr.split('|').map(o => o.trim());
    
    if (optArray.length < 2) {
        return interaction.reply({ content: '❌ You need at least 2 options!', ephemeral: true });
    }
    
    if (optArray.length > 5) {
        return interaction.reply({ content: '❌ Maximum 5 options!', ephemeral: true });
    }
    
    const embed = createEmbed('📊 Vote', 
        `**Question:** ${question}\n\n${optArray.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nClick a button below to vote!\n**Hosted by:** ${interaction.user.tag}`
    );
    
    const row = new ActionRowBuilder();
    optArray.forEach((opt, i) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`vote_${i}`)
                .setLabel(`${i + 1}`)
                .setStyle(ButtonStyle.Primary)
        );
    });
    
    const channel = interaction.guild.channels.cache.get(config.voteChannelId);
    if (!channel) {
        return interaction.reply({ content: '❌ Vote channel not configured!', ephemeral: true });
    }
    
    try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        votes.set(msg.id, { 
            question, 
            options: optArray, 
            votes: {}, 
            voters: [], 
            host: interaction.user.id,
            created: Date.now()
        });
        botStats.votesCreated++;
        serverStats.votes++;
        await interaction.reply({ content: '✅ Vote created!', ephemeral: true });
        await logAction('📊 Vote Created', `${interaction.user.tag} created a vote: ${question}`);
        
    } catch (error) {
        console.error('Error creating vote:', error);
        await interaction.reply({ content: '❌ Failed to create vote.', ephemeral: true });
    }
}

// ==================== UTILITY COMMANDS ====================
async function handleSay(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel');
    
    if (message.length > 2000) {
        return interaction.reply({ content: '❌ Message cannot exceed 2000 characters!', ephemeral: true });
    }
    
    try {
        await channel.send(message);
        await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
        await logAction('📢 Message Sent', `${interaction.user.tag} sent a message in ${channel.name}`);
        
    } catch (error) {
        console.error('Error sending message:', error);
        await interaction.reply({ content: '❌ Failed to send message.', ephemeral: true });
    }
}

async function handlePurge(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) {
        return interaction.reply({ content: '❌ Please enter a number between 1 and 100!', ephemeral: true });
    }
    
    try {
        const messages = await interaction.channel.bulkDelete(amount);
        await interaction.reply({ content: `✅ Deleted ${messages.size} messages`, ephemeral: true });
        await logAction('🧹 Messages Purged', `${interaction.user.tag} purged ${messages.size} messages in ${interaction.channel.name}`);
        
    } catch (error) {
        console.error('Error purging messages:', error);
        await interaction.reply({ content: '❌ Failed to purge messages.', ephemeral: true });
    }
}

async function handleSlowmode(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    const seconds = interaction.options.getInteger('seconds');
    if (seconds < 0 || seconds > 21600) {
        return interaction.reply({ content: '❌ Seconds must be between 0 and 21600!', ephemeral: true });
    }
    
    try {
        await interaction.channel.setRateLimitPerUser(seconds);
        await interaction.reply({ content: `✅ Slowmode set to ${seconds} seconds` });
        await logAction('⏱️ Slowmode Set', `${interaction.user.tag} set slowmode to ${seconds} seconds in ${interaction.channel.name}`);
        
    } catch (error) {
        console.error('Error setting slowmode:', error);
        await interaction.reply({ content: '❌ Failed to set slowmode.', ephemeral: true });
    }
}

async function handleLockdown(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    try {
        await interaction.channel.permissionOverwrites.create(interaction.guild.id, { 
            SendMessages: false 
        });
        await interaction.reply({ content: '🔒 Channel locked!', ephemeral: true });
        await logAction('🔒 Channel Locked', `${interaction.user.tag} locked ${interaction.channel.name}`);
        
    } catch (error) {
        console.error('Error locking channel:', error);
        await interaction.reply({ content: '❌ Failed to lock channel.', ephemeral: true });
    }
}

async function handleUnlock(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    try {
        await interaction.channel.permissionOverwrites.delete(interaction.guild.id);
        await interaction.reply({ content: '🔓 Channel unlocked!', ephemeral: true });
        await logAction('🔓 Channel Unlocked', `${interaction.user.tag} unlocked ${interaction.channel.name}`);
        
    } catch (error) {
        console.error('Error unlocking channel:', error);
        await interaction.reply({ content: '❌ Failed to unlock channel.', ephemeral: true });
    }
}

async function handleAnnounce(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const embed = createEmbed(`📢 ${title}`, message);
    
    try {
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });
        await logAction('📢 Announcement Made', `${interaction.user.tag} made an announcement in ${interaction.channel.name}`);
        
    } catch (error) {
        console.error('Error sending announcement:', error);
        await interaction.reply({ content: '❌ Failed to send announcement.', ephemeral: true });
    }
}

async function handlePoll(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const question = interaction.options.getString('question');
    const optionsStr = interaction.options.getString('options');
    const optArray = optionsStr.split('|').map(o => o.trim());
    
    if (optArray.length < 2) {
        return interaction.reply({ content: '❌ You need at least 2 options!', ephemeral: true });
    }
    
    if (optArray.length > 5) {
        return interaction.reply({ content: '❌ Maximum 5 options!', ephemeral: true });
    }
    
    const embed = createEmbed('📊 Poll', 
        `**${question}**\n\n${optArray.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\n**Hosted by:** ${interaction.user.tag}`
    );
    
    try {
        const msg = await interaction.channel.send({ embeds: [embed] });
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        for (let i = 0; i < optArray.length; i++) {
            await msg.react(emojis[i]);
        }
        await interaction.reply({ content: '✅ Poll created!', ephemeral: true });
        await logAction('📊 Poll Created', `${interaction.user.tag} created a poll: ${question}`);
        
    } catch (error) {
        console.error('Error creating poll:', error);
        await interaction.reply({ content: '❌ Failed to create poll.', ephemeral: true });
    }
}

// ==================== INFO COMMANDS ====================
async function showTopTen(interaction) {
    if (topTen.size === 0) {
        return interaction.reply({ content: '❌ No data available yet.', ephemeral: true });
    }
    
    const embed = createEmbed('🏆 Top 10 Members', 'Based on join date');
    topTen.forEach((member, rank) => {
        embed.addFields({ 
            name: `#${rank}`, 
            value: `${member.displayName} (${member.username})\nJoined: ${member.joinDate?.toLocaleDateString()}`, 
            inline: false 
        });
    });
    await interaction.reply({ embeds: [embed] });
}

async function handleServerInfo(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch();
    await guild.channels.fetch();
    
    const embed = createEmbed('ℹ️ Server Information',
        `**Name:** ${guild.name}\n` +
        `**ID:** ${guild.id}\n` +
        `**Created:** ${guild.createdAt.toLocaleDateString()}\n` +
        `**Owner:** <@${guild.ownerId}>\n` +
        `**Members:** ${guild.memberCount}\n` +
        `**Online:** ${guild.members.cache.filter(m => m.presence?.status !== 'offline').size}\n` +
        `**Channels:** ${guild.channels.cache.size}\n` +
        `**Roles:** ${guild.roles.cache.size}\n` +
        `**Boosts:** ${guild.premiumSubscriptionCount || 0}`
    )
    .setThumbnail(guild.iconURL({ size: 1024 }));
    
    await interaction.reply({ embeds: [embed] });
}

async function handleUserInfo(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);
    
    const embed = createEmbed('ℹ️ User Information',
        `**Username:** ${user.tag}\n` +
        `**ID:** ${user.id}\n` +
        `**Created:** ${user.createdAt.toLocaleDateString()}\n` +
        `**Joined:** ${member.joinedAt?.toLocaleDateString()}\n` +
        `**Roles:** ${member.roles.cache.map(r => r.name).join(', ')}\n` +
        `**Status:** ${member.presence?.status || 'offline'}\n` +
        `**Boosting:** ${member.premiumSince ? 'Yes' : 'No'}`
    )
    .setThumbnail(user.displayAvatarURL({ size: 1024 }));
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAvatar(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = createEmbed('🖼️ Avatar', `**${user.tag}'s Avatar**`)
        .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }));
    await interaction.reply({ embeds: [embed] });
}

async function handleHelp(interaction) {
    const embed = createEmbed('❓ Help Menu', 
        '**📌 Ticket System:**\n' +
        '/ticket - Open a support ticket\n' +
        '/verify - Start verification process\n\n' +
        '**🛡️ Staff & Moderation:**\n' +
        '/staff - Staff panel\n' +
        '/panel - Admin panel\n' +
        '/config - Configuration\n' +
        '/warn - Warn a user\n' +
        '/kick - Kick a user\n' +
        '/ban - Ban a user\n' +
        '/mute - Mute a user\n' +
        '/unmute - Unmute a user\n' +
        '/purge - Delete messages\n' +
        '/lockdown - Lock channel\n' +
        '/unlock - Unlock channel\n\n' +
        '**💰 Economy & Leveling:**\n' +
        '/daily - Claim daily reward\n' +
        '/balance - Check balance\n' +
        '/level - Check level\n' +
        '/leaderboard - View leaderboard\n\n' +
        '**🎉 Events:**\n' +
        '/giveaway - Create a giveaway\n' +
        '/drop - Create a drop\n' +
        '/vote - Create a vote\n\n' +
        '**💡 Suggestions & Reports:**\n' +
        '/suggest - Submit a suggestion\n' +
        '/report - Report a user\n' +
        '/appeal - Submit an appeal\n\n' +
        '**📢 Utility:**\n' +
        '/say - Send message as bot\n' +
        '/poll - Create a poll\n' +
        '/announce - Make announcement\n' +
        '/top - View top 10\n\n' +
        '**ℹ️ Information:**\n' +
        '/serverinfo - Server info\n' +
        '/userinfo - User info\n' +
        '/avatar - View avatar\n' +
        '/ping - Check bot ping\n' +
        '/stats - Bot statistics\n' +
        '/botinfo - Bot information\n' +
        '/uptime - Bot uptime'
    );
    await interaction.reply({ embeds: [embed] });
}

async function handlePing(interaction) {
    const ping = client.ws.ping;
    const embed = createEmbed('🏓 Ping', 
        `**Bot Latency:** ${ping}ms\n**API Latency:** ${Date.now() - interaction.createdTimestamp}ms\n**Status:** ${ping < 100 ? '🟢 Excellent' : ping < 200 ? '🟡 Good' : '🔴 Poor'}`
    );
    await interaction.reply({ embeds: [embed] });
}

// ==================== BOT COMMANDS ====================
async function handleStats(interaction) {
    const embed = createEmbed('📊 Bot Statistics', '**Bot Performance & Usage**')
        .addFields(
            { name: '🤖 Bot Info', value: `Uptime: ${getUptime()}\nCommands: ${botStats.commandsUsed}\nMessages: ${botStats.messagesProcessed}`, inline: true },
            { name: '🎫 Tickets', value: `Created: ${botStats.ticketsCreated}\nOpen: ${tickets.size}`, inline: true },
            { name: '🎉 Events', value: `Giveaways: ${botStats.giveawaysCreated}\nDrops: ${botStats.dropsCreated}\nVotes: ${botStats.votesCreated}`, inline: true },
            { name: '⚠️ Moderation', value: `Warnings: ${botStats.warningsIssued}\nBans: ${botStats.bansIssued}\nKicks: ${botStats.kicksIssued}\nMutes: ${botStats.mutesIssued}`, inline: true },
            { name: '💡 Community', value: `Suggestions: ${botStats.suggestionsSubmitted}\nReports: ${botStats.reportsSubmitted}\nAppeals: ${botStats.appealsSubmitted}`, inline: true },
            { name: '💰 Economy', value: `Daily Claims: ${botStats.dailyClaims}\nLevel Ups: ${botStats.levelUps}`, inline: true }
        );
    await interaction.reply({ embeds: [embed] });
}

async function handleBotInfo(interaction) {
    const embed = createEmbed('🤖 Bot Information',
        `**Name:** ${client.user.tag}\n` +
        `**ID:** ${client.user.id}\n` +
        `**Created:** ${client.user.createdAt.toLocaleDateString()}\n` +
        `**Servers:** ${client.guilds.cache.size}\n` +
        `**Users:** ${client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)}\n` +
        `**Uptime:** ${getUptime()}\n` +
        `**Commands:** ${botStats.commandsUsed}\n` +
        `**Ping:** ${client.ws.ping}ms`
    )
    .setThumbnail(client.user.displayAvatarURL({ size: 1024 }));
    await interaction.reply({ embeds: [embed] });
}

async function handleUptime(interaction) {
    const embed = createEmbed('⏱️ Uptime', `**Bot Uptime:** ${getUptime()}\n**Started:** ${new Date(botStats.startTime).toLocaleString()}`);
    await interaction.reply({ embeds: [embed] });
}

async function handleInvite(interaction) {
    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
    const embed = createEmbed('🔗 Invite Link', `[Click here to invite the bot](${inviteLink})`);
    await interaction.reply({ embeds: [embed] });
}

async function handleSupport(interaction) {
    const embed = createEmbed('🆘 Support', 'Join our support server for help and assistance.\n[Support Server Link](https://discord.gg/your-support-server)');
    await interaction.reply({ embeds: [embed] });
}

async function handleFeedback(interaction) {
    const feedback = interaction.options.getString('feedback');
    const embed = createEmbed('💬 Feedback', `**From:** ${interaction.user.tag}\n**Feedback:** ${feedback}`);
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Feedback submitted! Thank you for your input.', ephemeral: true });
}

async function handleBugReport(interaction) {
    const bug = interaction.options.getString('bug');
    const embed = createEmbed('🐛 Bug Report', `**Reported by:** ${interaction.user.tag}\n**Bug:** ${bug}`);
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Bug report submitted! We will look into it.', ephemeral: true });
}

async function handleFeature(interaction) {
    const feature = interaction.options.getString('feature');
    const embed = createEmbed('✨ Feature Request', `**Requested by:** ${interaction.user.tag}\n**Feature:** ${feature}`);
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Feature request submitted!', ephemeral: true });
}

async function handleAbout(interaction) {
    const embed = createEmbed('📖 About', 
        '**Black & Red Bot**\n\n' +
        'A feature-rich Discord bot designed for:\n' +
        '• Ticket Management\n' +
        '• Verification System\n' +
        '• Moderation Tools\n' +
        '• Economy & Leveling\n' +
        '• Giveaways & Events\n' +
        '• Suggestion & Report System\n' +
        '• And much more!\n\n' +
        `**Version:** 1.0.0\n` +
        `**Developer:** Your Name\n` +
        `**Created:** ${new Date().toLocaleDateString()}`
    );
    await interaction.reply({ embeds: [embed] });
}

async function handleCredits(interaction) {
    const embed = createEmbed('👏 Credits',
        '**Development:** Your Name\n' +
        '**Testing:** Server Staff Team\n' +
        '**Special Thanks:**\n' +
        '• Discord.js Library\n' +
        '• All server members for their support\n' +
        '• Open source community'
    );
    await interaction.reply({ embeds: [embed] });
}

async function handleDonate(interaction) {
    const embed = createEmbed('💖 Support the Bot',
        'If you enjoy using this bot, consider supporting its development:\n\n' +
        '**Donation Methods:**\n' +
        '• PayPal: your-paypal@email.com\n' +
        '• Patreon: patreon.com/your-bot\n' +
        '• Ko-fi: ko-fi.com/your-bot\n\n' +
        'Your support helps keep the bot running!'
    );
    await interaction.reply({ embeds: [embed] });
}

async function handlePremium(interaction) {
    const embed = createEmbed('⭐ Premium Features',
        '**Premium Benefits:**\n\n' +
        '• Unlimited Tickets\n' +
        '• Custom Embed Colors\n' +
        '• Advanced Moderation Tools\n' +
        '• Priority Support\n' +
        '• Custom Bot Prefix\n' +
        '• And More!\n\n' +
        'Contact server staff for premium access.'
    );
    await interaction.reply({ embeds: [embed] });
}

async function handleTerms(interaction) {
    const embed = createEmbed('📜 Terms of Service',
        '**Terms of Service:**\n\n' +
        '1. Use the bot responsibly\n' +
        '2. Do not abuse bot features\n' +
        '3. Follow Discord\'s Terms of Service\n' +
        '4. Staff have the right to revoke access\n' +
        '5. By using the bot, you agree to these terms'
    );
    await interaction.reply({ embeds: [embed] });
}

async function handlePrivacy(interaction) {
    const embed = createEmbed('🔒 Privacy Policy',
        '**Privacy Policy:**\n\n' +
        '• We collect minimal user data\n' +
        '• Data is stored securely\n' +
        '• We do not share your data\n' +
        '• You can request data deletion\n' +
        '• Data is used for bot functionality'
    );
    await interaction.reply({ embeds: [embed] });
}

function getUptime() {
    const uptime = Date.now() - botStats.startTime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

// ==================== GIVEAWAY END ====================
async function endGiveaway(messageId) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway) return;
    
    const winners = [];
    const entries = giveaway.entries;
    const shuffled = [...entries];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    for (let i = 0; i < Math.min(giveaway.winners, shuffled.length); i++) {
        winners.push(shuffled[i]);
    }
    
    const channel = client.channels.cache.get(config.giveawaysChannelId);
    if (!channel) {
        giveaways.delete(messageId);
        return;
    }
    
    try {
        const msg = await channel.messages.fetch(messageId);
        const embed = createEmbed('🎉 Giveaway Ended',
            `**Prize:** ${giveaway.prize}\n` +
            `**Winners:** ${winners.map(w => `<@${w}>`).join(', ') || 'No winners'}\n` +
            `**Total Entries:** ${entries.length}\n` +
            `**Hosted by:** <@${giveaway.host}>`
        );
        
        await msg.edit({ embeds: [embed], components: [] });
        giveaways.delete(messageId);
        serverStats.giveaways--;
        
        if (winners.length > 0) {
            await channel.send(`🎉 **Congratulations** ${winners.map(w => `<@${w}>`).join(', ')}! You won: **${giveaway.prize}**`);
        } else {
            await channel.send(`❌ No winners for **${giveaway.prize}**`);
        }
        
        await logAction('🎉 Giveaway Ended', `Giveaway for ${giveaway.prize} ended with ${entries.length} entries`);
        
    } catch (error) {
        console.error('Error ending giveaway:', error);
        giveaways.delete(messageId);
    }
}

// ==================== DROP CLAIM ====================
async function claimDrop(interaction) {
    const drop = drops.get(interaction.message.id);
    if (!drop) return;
    
    if (drop.claimed.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ You already claimed this drop!', ephemeral: true });
    }
    
    if (drop.remaining <= 0) {
        return interaction.reply({ content: '❌ No items left in this drop!', ephemeral: true });
    }
    
    drop.claimed.push(interaction.user.id);
    drop.remaining--;
    drops.set(interaction.message.id, drop);
    serverStats.drops--;
    
    await interaction.reply({ content: `✅ You claimed: ${drop.item}`, ephemeral: true });
    
    if (drop.remaining <= 0) {
        const embed = createEmbed('📦 Drop Ended', 
            `All items have been claimed!\n**Item:** ${drop.item}\n**Total Claimed:** ${drop.claimed.length}\n**Hosted by:** <@${drop.host}>`
        );
        await interaction.message.edit({ embeds: [embed], components: [] });
        await logAction('📦 Drop Ended', `Drop for ${drop.item} ended with ${drop.claimed.length} claims`);
    }
}

// ==================== VOTE HANDLE ====================
async function handleVote(interaction) {
    const vote = votes.get(interaction.message.id);
    if (!vote) return;
    
    if (vote.voters.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ You already voted!', ephemeral: true });
    }
    
    const optionIndex = parseInt(interaction.customId.split('_')[1]);
    if (optionIndex >= vote.options.length) {
        return interaction.reply({ content: '❌ Invalid option!', ephemeral: true });
    }
    
    const option = vote.options[optionIndex];
    if (!vote.votes[option]) vote.votes[option] = 0;
    vote.votes[option]++;
    vote.voters.push(interaction.user.id);
    votes.set(interaction.message.id, vote);
    
    await interaction.reply({ content: `✅ You voted for: ${option}`, ephemeral: true });
    
    const totalVotes = vote.voters.length;
    if (totalVotes > 0) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setFooter({ text: `Total Votes: ${totalVotes}` });
        await interaction.message.edit({ embeds: [embed] });
    }
}

// ==================== GIVEAWAY ENTER ====================
async function enterGiveaway(interaction) {
    const giveaway = giveaways.get(interaction.message.id);
    if (!giveaway) {
        return interaction.reply({ content: '❌ This giveaway has ended!', ephemeral: true });
    }
    
    if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ You already entered!', ephemeral: true });
    }
    
    giveaway.entries.push(interaction.user.id);
    giveaways.set(interaction.message.id, giveaway);
    await interaction.reply({ content: '✅ You entered the giveaway!', ephemeral: true });
}

// ==================== VIEW FUNCTIONS ====================
async function viewAllTickets(interaction) {
    if (tickets.size === 0) {
        return interaction.reply({ content: '📭 No open tickets.', ephemeral: true });
    }
    
    const embed = createEmbed('🎫 All Tickets', `**Total Open:** ${tickets.size}`);
    tickets.forEach((ticket, channelId) => {
        const channel = interaction.guild.channels.cache.get(channelId);
        embed.addFields({ 
            name: `#${channel?.name || 'Unknown'}`, 
            value: `User: <@${ticket.user}>\nType: ${ticket.type}\nClaimed: ${ticket.claimed ? `<@${ticket.claimed}>` : 'No'}\nStatus: ${ticket.status || 'open'}`, 
            inline: false 
        });
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function viewStaffLogs(interaction) {
    if (staffLogs.size === 0) {
        return interaction.reply({ content: '📭 No staff logs available.', ephemeral: true });
    }
    
    const embed = createEmbed('📋 Staff Logs', 'Recent staff actions');
    const logs = Array.from(staffLogs.values()).reverse().slice(0, 10);
    logs.forEach(log => {
        embed.addFields({ 
            name: log.title, 
            value: `${log.description}\n${new Date(log.timestamp).toLocaleString()}`, 
            inline: false 
        });
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function viewStaffStats(interaction) {
    const staff = interaction.guild.members.cache.filter(m => 
        m.roles.cache.has(config.adminRoleId) || m.roles.cache.has(config.modRoleId)
    );
    
    const embed = createEmbed('📊 Staff Statistics',
        `**Total Staff:** ${staff.size}\n` +
        `**Online:** ${staff.filter(m => m.presence?.status !== 'offline').size}\n` +
        `**Tickets:** ${tickets.size}\n` +
        `**Giveaways:** ${giveaways.size}\n` +
        `**Drops:** ${drops.size}\n` +
        `**Votes:** ${votes.size}\n` +
        `**Warnings:** ${warnings.size}\n` +
        `**Appeals:** ${appeals.size}`
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function viewAllWarnings(interaction) {
    if (warnings.size === 0) {
        return interaction.reply({ content: '📭 No warnings issued.', ephemeral: true });
    }
    
    const embed = createEmbed('⚠️ All Warnings', `**Total Users with Warnings:** ${warnings.size}`);
    warnings.forEach((userWarnings, userId) => {
        const user = client.users.cache.get(userId);
        embed.addFields({ 
            name: `${user?.tag || 'Unknown'}`, 
            value: `Warnings: ${userWarnings.length}\nLatest: ${userWarnings[userWarnings.length - 1]?.reason || 'N/A'}`, 
            inline: false 
        });
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function viewAllBans(interaction) {
    const bans = await interaction.guild.bans.fetch();
    if (bans.size === 0) {
        return interaction.reply({ content: '📭 No bans.', ephemeral: true });
    }
    
    const embed = createEmbed('🔨 All Bans', `**Total Bans:** ${bans.size}`);
    bans.forEach(ban => {
        embed.addFields({ 
            name: ban.user.tag, 
            value: `Reason: ${ban.reason || 'No reason provided'}`, 
            inline: false 
        });
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function viewAllKicks(interaction) {
    const embed = createEmbed('👢 Kick Logs', 'Kick history will be displayed here');
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function viewAllMutes(interaction) {
    const embed = createEmbed('🔇 Mute Logs', 'Mute history will be displayed here');
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ==================== SELECT MENU ====================
async function handleSelectMenu(interaction) {
    // Handle select menus if needed
}

// ==================== MESSAGE EVENTS ====================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    botStats.messagesProcessed++;
    
    // Leveling
    const userId = message.author.id;
    const levelData = levels.get(userId) || { xp: 0, level: 1 };
    levelData.xp += Math.floor(Math.random() * 10) + 5;
    const neededXP = levelData.level * 100;
    
    if (levelData.xp >= neededXP) {
        levelData.xp -= neededXP;
        levelData.level++;
        botStats.levelUps++;
        
        const embed = createEmbed('📊 Level Up!', 
            `🎉 ${message.author.tag} just reached level ${levelData.level}!`
        );
        await message.channel.send({ embeds: [embed] }).catch(() => {});
        await logAction('📊 Level Up', `${message.author.tag} reached level ${levelData.level}`);
    }
    
    levels.set(userId, levelData);
    
    // Custom commands
    if (message.content.startsWith('!')) {
        const cmd = message.content.slice(1).split(' ')[0].toLowerCase();
        const response = customCommands.get(cmd);
        if (response) {
            await message.channel.send(response).catch(() => {});
        }
    }
    
    // Auto-moderation - anti-spam
    const userMessages = userActivity.get(message.author.id) || [];
    const now = Date.now();
    const recent = userMessages.filter(t => now - t < 5000);
    recent.push(now);
    userActivity.set(message.author.id, recent);
    
    if (recent.length > 5) {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        if (member && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            try {
                await member.timeout(300000, 'Auto-mod: Spam detection');
                await message.channel.send(`🔇 ${message.author.tag} has been muted for 5 minutes (spam detection)`);
                await logAction('🔇 Auto-Mute (Spam)', `${message.author.tag} was muted for spam`);
            } catch (error) {
                console.error('Error auto-muting spammer:', error);
            }
        }
    }
});

// ==================== REACTION ROLE EVENTS ====================
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (!reaction.message.guild) return;
    
    const key = `${reaction.message.id}_${reaction.emoji.toString()}`;
    const roleConfig = reactionRoles.get(key);
    if (!roleConfig) return;
    
    try {
        const member = await reaction.message.guild.members.fetch(user.id);
        const role = reaction.message.guild.roles.cache.get(roleConfig.roleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }
    } catch (error) {
        console.error('Error adding reaction role:', error);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (!reaction.message.guild) return;
    
    const key = `${reaction.message.id}_${reaction.emoji.toString()}`;
    const roleConfig = reactionRoles.get(key);
    if (!roleConfig) return;
    
    try {
        const member = await reaction.message.guild.members.fetch(user.id);
        const role = reaction.message.guild.roles.cache.get(roleConfig.roleId);
        if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
        }
    } catch (error) {
        console.error('Error removing reaction role:', error);
    }
});

// ==================== VOICE & PRESENCE EVENTS ====================
client.on('voiceStateUpdate', (oldState, newState) => {
    updateStatus();
    if (oldState.channelId !== newState.channelId) {
        // Voice state change logging
    }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
    updateStatus();
});

client.on('guildMemberAdd', async member => {
    updateStatus();
    updateMemberCount();
    
    const embed = createEmbed('👋 New Member', 
        `Welcome ${member.user.tag} to the server!\n` +
        `Created: ${member.user.createdAt.toLocaleDateString()}\n` +
        `We now have ${member.guild.memberCount} members!`
    );
    
    const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (welcomeChannel) {
        await welcomeChannel.send({ content: `${member.user}`, embeds: [embed] });
    }
    
    // Add default welcome role if configured
    if (config.welcomeRoleId && config.welcomeRoleId !== 'WELCOME_ROLE_ID') {
        try {
            await member.roles.add(config.welcomeRoleId);
        } catch (error) {
            console.error('Error adding welcome role:', error);
        }
    }
});

client.on('guildMemberRemove', member => {
    updateStatus();
    updateMemberCount();
    
    const embed = createEmbed('👋 Member Left', 
        `${member.user.tag} has left the server.\n` +
        `We now have ${member.guild.memberCount} members.`
    );
    
    const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (welcomeChannel) {
        welcomeChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down...');
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    saveData();
    process.exit(0);
});

// ==================== LOGIN ====================
client.login(config.token);

console.log('🔥 Black & Red Theme Bot is starting...');
console.log('📌 Features: Tickets, Verification, Giveaways, Drops, Voting, Staff Panel, Economy, Leveling, Moderation, and more!');
console.log('📊 Total Commands: 40+');
console.log('⚠️ Make sure DISCORD_TOKEN is set in Render environment variables!');
console.log('🚀 Bot is ready to serve!');
