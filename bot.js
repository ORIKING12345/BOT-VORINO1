const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
    memberCountChannelId: 'MEMBER_COUNT_CHANNEL_ID',
    botChannelId: 'BOT_CHANNEL_ID'
};

// Collections
const tickets = new Collection();
const giveaways = new Collection();
const drops = new Collection();
const votes = new Collection();
const staffPanel = new Collection();
const verificationQueue = new Collection();
const userActivity = new Collection();
const warnings = new Collection();
const suggestions = new Collection();
const reports = new Collection();
const appeals = new Collection();
const dailyRewards = new Collection();
const economy = new Collection();
const levels = new Collection();
const autoMod = new Collection();
const reactionRoles = new Collection();
const customCommands = new Collection();
const tempBans = new Collection();

// Server stats
let serverStats = {
    members: 0,
    online: 0,
    voice: 0,
    boosts: 0,
    channels: 0,
    roles: 0
};

// Top 10 system
const topTen = new Collection();

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} is online!`);
    console.log(`🎯 Red & Black theme loaded!`);
    
    // Register slash commands
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
        new SlashCommandBuilder().setName('ping').setDescription('🏓 Check bot ping')
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
});

function updateStatus() {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    
    const memberCount = guild.memberCount;
    client.user.setPresence({
        activities: [{ 
            name: `${memberCount} members 🔥`, 
            type: 3 
        }],
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
            displayName: m.displayName
        });
    });
}

async function updateMemberCount() {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    
    const channel = guild.channels.cache.get(config.memberCountChannelId);
    if (channel) {
        await channel.setName(`👥 ${guild.memberCount} Members`);
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

function saveData() {
    try {
        const data = {
            warnings: Array.from(warnings.entries()),
            economy: Array.from(economy.entries()),
            levels: Array.from(levels.entries()),
            customCommands: Array.from(customCommands.entries()),
            reactionRoles: Array.from(reactionRoles.entries()),
            userActivity: Array.from(userActivity.entries())
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
            warnings = new Collection(data.warnings);
            economy = new Collection(data.economy);
            levels = new Collection(data.levels);
            customCommands = new Collection(data.customCommands);
            reactionRoles = new Collection(data.reactionRoles);
            userActivity = new Collection(data.userActivity);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Black & Red Theme Embed
function createEmbed(title, description, color = '#ff0000') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: '🔥 Black & Red Server', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
}

// Main interaction handler
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

async function handleButton(interaction) {
    const { customId, user, guild } = interaction;
    
    // Ticket buttons
    if (customId.startsWith('ticket_')) {
        const type = customId.split('_')[1];
        await createTicket(interaction, type);
    }
    
    if (customId === 'close_ticket') {
        await closeTicket(interaction);
    }
    
    if (customId === 'delete_ticket') {
        await deleteTicket(interaction);
    }
    
    if (customId === 'claim_ticket') {
        await claimTicket(interaction);
    }
    
    if (customId === 'add_user') {
        await addUserToTicket(interaction);
    }
    
    if (customId === 'remove_user') {
        await removeUserFromTicket(interaction);
    }
    
    // Verification buttons
    if (customId === 'verify_start') {
        await startVerification(interaction);
    }
    
    if (customId === 'verify_accept') {
        await acceptVerification(interaction);
    }
    
    if (customId === 'verify_deny') {
        await denyVerification(interaction);
    }
    
    // Giveaway buttons
    if (customId === 'enter_giveaway') {
        await enterGiveaway(interaction);
    }
    
    // Drop buttons
    if (customId === 'claim_drop') {
        await claimDrop(interaction);
    }
    
    // Vote buttons
    if (customId.startsWith('vote_')) {
        await handleVote(interaction);
    }
    
    // Suggestion buttons
    if (customId === 'suggest_upvote') {
        await handleSuggestionVote(interaction, 'upvote');
    }
    
    if (customId === 'suggest_downvote') {
        await handleSuggestionVote(interaction, 'downvote');
    }
    
    // Appeal buttons
    if (customId === 'appeal_submit') {
        await submitAppeal(interaction);
    }
    
    // Staff panel buttons
    if (customId === 'view_tickets') {
        await viewAllTickets(interaction);
    }
    
    if (customId === 'staff_logs') {
        await viewStaffLogs(interaction);
    }
    
    if (customId === 'staff_stats') {
        await viewStaffStats(interaction);
    }
}

async function createTicket(interaction, type) {
    const guild = interaction.guild;
    const member = interaction.member;
    const category = guild.channels.cache.get(config.ticketCategoryId);
    
    const channel = await guild.channels.create({
        name: `ticket-${member.user.username}-${Date.now().toString().slice(-4)}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: member.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            },
            {
                id: config.adminRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
            },
            {
                id: config.modRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            }
        ]
    });
    
    tickets.set(channel.id, {
        user: member.id,
        type: type,
        created: Date.now(),
        claimed: null,
        messages: [],
        users: [member.id]
    });
    
    const embed = createEmbed(
        '🎫 Ticket Created',
        `**Type:** ${type}\n**Created by:** ${member.user.tag}\n**Created at:** ${new Date().toLocaleString()}\n\nPlease describe your issue in detail.`
    );
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Claim')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌'),
            new ButtonBuilder()
                .setCustomId('add_user')
                .setLabel('Add User')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('remove_user')
                .setLabel('Remove User')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('➖'),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('delete_ticket')
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );
    
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    
    logAction('🎫 Ticket Created', `${member.user.tag} created a ${type} ticket\nChannel: ${channel.name}`);
}

async function closeTicket(interaction) {
    const channel = interaction.channel;
    const ticket = tickets.get(channel.id);
    if (!ticket) return;
    
    const embed = createEmbed(
        '🔒 Ticket Closed',
        `Closed by ${interaction.user.tag}\nReason: Not provided\nTotal messages: ${ticket.messages.length}`
    );
    
    await interaction.reply({ embeds: [embed] });
    await channel.permissionOverwrites.set([]);
    tickets.delete(channel.id);
    
    logAction('🔒 Ticket Closed', `${interaction.user.tag} closed ticket in ${channel.name}`);
}

async function deleteTicket(interaction) {
    const channel = interaction.channel;
    await interaction.reply({ content: '🗑️ Deleting ticket in 5 seconds...' });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
}

async function claimTicket(interaction) {
    const channel = interaction.channel;
    const ticket = tickets.get(channel.id);
    if (!ticket) return;
    
    ticket.claimed = interaction.user.id;
    tickets.set(channel.id, ticket);
    
    await interaction.reply({ content: '✅ You claimed this ticket!', ephemeral: true });
    await channel.send(`📌 ${interaction.user.tag} claimed this ticket`);
    
    logAction('📌 Ticket Claimed', `${interaction.user.tag} claimed ticket in ${channel.name}`);
}

async function addUserToTicket(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_user_modal')
        .setTitle('Add User to Ticket');
    
    const userInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('User ID or @mention')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(userInput);
    modal.addComponents(row);
    
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
        .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(userInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
}

// Verification System
async function startVerification(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('verify_modal')
        .setTitle('🔐 Verification');
    
    const question1 = new TextInputBuilder()
        .setCustomId('answer1')
        .setLabel('What is the server name?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const question2 = new TextInputBuilder()
        .setCustomId('answer2')
        .setLabel('What is the owner\'s name?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const question3 = new TextInputBuilder()
        .setCustomId('answer3')
        .setLabel('What year was the server created?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const row1 = new ActionRowBuilder().addComponents(question1);
    const row2 = new ActionRowBuilder().addComponents(question2);
    const row3 = new ActionRowBuilder().addComponents(question3);
    modal.addComponents(row1, row2, row3);
    
    await interaction.showModal(modal);
}

async function handleModal(interaction) {
    if (interaction.customId === 'verify_modal') {
        const answer1 = interaction.fields.getTextInputValue('answer1');
        const answer2 = interaction.fields.getTextInputValue('answer2');
        const answer3 = interaction.fields.getTextInputValue('answer3');
        const guild = interaction.guild;
        const member = interaction.member;
        
        // Verification checks
        let correct = 0;
        if (answer1.toLowerCase() === 'my server') correct++;
        if (answer2.toLowerCase() === 'owner name') correct++;
        if (answer3 === '2024') correct++;
        
        if (correct >= 2) {
            await member.roles.add(config.verifyRoleId);
            const embed = createEmbed(
                '✅ Verification Successful',
                `You have been verified!\nCorrect answers: ${correct}/3`
            );
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
            const welcomeChannel = guild.channels.cache.get(config.welcomeChannelId);
            if (welcomeChannel) {
                const welcomeEmbed = createEmbed(
                    '👋 Welcome to the Server!',
                    `Please welcome ${member.user.tag} to our community!\nThey joined on ${new Date().toLocaleDateString()}`
                );
                await welcomeChannel.send({ content: `${member.user}`, embeds: [welcomeEmbed] });
            }
            
            logAction('✅ Verification Passed', `${member.user.tag} passed verification`);
        } else {
            const embed = createEmbed(
                '❌ Verification Failed',
                `You failed verification.\nCorrect answers: ${correct}/3\nPlease try again.`
            );
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
            logAction('❌ Verification Failed', `${member.user.tag} failed verification`);
        }
    }
    
    if (interaction.customId === 'add_user_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
        const channel = interaction.channel;
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: '❌ User not found!', ephemeral: true });
        }
        
        await channel.permissionOverwrites.create(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });
        
        const ticket = tickets.get(channel.id);
        if (ticket) {
            ticket.users.push(user.id);
            tickets.set(channel.id, ticket);
        }
        
        await interaction.reply({ content: `✅ Added ${user.tag} to the ticket!`, ephemeral: true });
        await channel.send(`➕ ${user.tag} was added to the ticket by ${interaction.user.tag}`);
    }
    
    if (interaction.customId === 'remove_user_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
        const channel = interaction.channel;
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: '❌ User not found!', ephemeral: true });
        }
        
        await channel.permissionOverwrites.delete(user.id).catch(() => {});
        
        const ticket = tickets.get(channel.id);
        if (ticket) {
            ticket.users = ticket.users.filter(id => id !== user.id);
            tickets.set(channel.id, ticket);
        }
        
        await interaction.reply({ content: `✅ Removed ${user.tag} from the ticket!`, ephemeral: true });
        await channel.send(`➖ ${user.tag} was removed from the ticket by ${interaction.user.tag}`);
    }
}

// Giveaway System
async function handleCommand(interaction) {
    const { commandName, options, user, guild, member } = interaction;
    
    if (commandName === 'giveaway') {
        if (!member.permissions.has(PermissionFlagsBits.ManageEvents)) {
            return interaction.reply({ content: '❌ You need Manage Events permission!', ephemeral: true });
        }
        
        const prize = options.getString('prize');
        const duration = options.getInteger('duration');
        const winners = options.getInteger('winners');
        
        const embed = createEmbed(
            '🎉 Giveaway',
            `**Prize:** ${prize}\n**Winners:** ${winners}\n**Duration:** ${duration} minutes\n**Hosted by:** ${user.tag}`
        );
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('enter_giveaway')
                    .setLabel('Enter')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎯')
            );
        
        const channel = guild.channels.cache.get(config.giveawaysChannelId);
        const msg = await channel.send({ embeds: [embed], components: [row] });
        
        giveaways.set(msg.id, {
            prize,
            winners,
            endTime: Date.now() + duration * 60000,
            host: user.id,
            entries: [],
            messageId: msg.id
        });
        
        await interaction.reply({ content: '✅ Giveaway created!', ephemeral: true });
        
        setTimeout(() => endGiveaway(msg.id), duration * 60000);
        logAction('🎉 Giveaway Created', `${user.tag} created a giveaway for ${prize}`);
    }
    
    if (commandName === 'drop') {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
        }
        
        const item = options.getString('item');
        const amount = options.getInteger('amount');
        
        const embed = createEmbed(
            '📦 Drop',
            `**Item:** ${item}\n**Amount:** ${amount}\n**Status:** Active\n**Claim:** Click the button below to claim!`
        );
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_drop')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎁')
            );
        
        const channel = guild.channels.cache.get(config.dropsChannelId);
        const msg = await channel.send({ embeds: [embed], components: [row] });
        
        drops.set(msg.id, {
            item,
            amount,
            claimed: [],
            remaining: amount,
            host: user.id
        });
        
        await interaction.reply({ content: '✅ Drop created!', ephemeral: true });
        logAction('📦 Drop Created', `${user.tag} created a drop for ${item}`);
    }
    
    if (commandName === 'vote') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
        }
        
        const question = options.getString('question');
        const optionsStr = options.getString('options');
        const optArray = optionsStr.split('|').map(o => o.trim());
        
        const embed = createEmbed(
            '📊 Vote',
            `**Question:** ${question}\n\n${optArray.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nClick a button below to vote!`
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
        
        const channel = guild.channels.cache.get(config.voteChannelId);
        const msg = await channel.send({ embeds: [embed], components: [row] });
        
        votes.set(msg.id, {
            question,
            options: optArray,
            votes: {},
            voters: [],
            host: user.id
        });
        
        await interaction.reply({ content: '✅ Vote created!', ephemeral: true });
        logAction('📊 Vote Created', `${user.tag} created a vote: ${question}`);
    }
    
    if (commandName === 'say') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
        }
        
        const message = options.getString('message');
        const channel = options.getChannel('channel');
        
        await channel.send(message);
        await interaction.reply({ content: '✅ Message sent!', ephemeral: true });
        logAction('📢 Message Sent', `${user.tag} sent a message in ${channel.name}`);
    }
    
    if (commandName === 'top') {
        const embed = createEmbed(
            '🏆 Top 10 Members',
            'Based on join date'
        );
        
        topTen.forEach((member, rank) => {
            embed.addFields({
                name: `#${rank}`,
                value: `${member.displayName} (${member.username})\nJoined: ${member.joinDate?.toLocaleDateString()}`,
                inline: false
            });
        });
        
        await interaction.reply({ embeds: [embed] });
    }
    
    if (commandName === 'panel') {
        await showAdminPanel(interaction);
    }
    
    if (commandName === 'config') {
        await showConfigPanel(interaction);
    }
    
    if (commandName === 'staff') {
        await showStaffPanel(interaction);
    }
    
    if (commandName === 'ticket') {
        await showTicketMenu(interaction);
    }
    
    if (commandName === 'verify') {
        await showVerifyMenu(interaction);
    }
    
    if (commandName === 'warn') {
        await handleWarn(interaction);
    }
    
    if (commandName === 'kick') {
        await handleKick(interaction);
    }
    
    if (commandName === 'ban') {
        await handleBan(interaction);
    }
    
    if (commandName === 'suggest') {
        await handleSuggestion(interaction);
    }
    
    if (commandName === 'report') {
        await handleReport(interaction);
    }
    
    if (commandName === 'appeal') {
        await handleAppeal(interaction);
    }
    
    if (commandName === 'daily') {
        await handleDaily(interaction);
    }
    
    if (commandName === 'balance') {
        await handleBalance(interaction);
    }
    
    if (commandName === 'level') {
        await handleLevel(interaction);
    }
    
    if (commandName === 'leaderboard') {
        await handleLeaderboard(interaction);
    }
    
    if (commandName === 'reactionrole') {
        await handleReactionRole(interaction);
    }
    
    if (commandName === 'customcmd') {
        await handleCustomCommand(interaction);
    }
    
    if (commandName === 'purge') {
        await handlePurge(interaction);
    }
    
    if (commandName === 'slowmode') {
        await handleSlowmode(interaction);
    }
    
    if (commandName === 'lockdown') {
        await handleLockdown(interaction);
    }
    
    if (commandName === 'unlock') {
        await handleUnlock(interaction);
    }
    
    if (commandName === 'announce') {
        await handleAnnounce(interaction);
    }
    
    if (commandName === 'poll') {
        await handlePoll(interaction);
    }
    
    if (commandName === 'mute') {
        await handleMute(interaction);
    }
    
    if (commandName === 'unmute') {
        await handleUnmute(interaction);
    }
    
    if (commandName === 'setnick') {
        await handleSetNick(interaction);
    }
    
    if (commandName === 'addrole') {
        await handleAddRole(interaction);
    }
    
    if (commandName === 'removerole') {
        await handleRemoveRole(interaction);
    }
    
    if (commandName === 'clearwarns') {
        await handleClearWarns(interaction);
    }
    
    if (commandName === 'warnings') {
        await handleViewWarnings(interaction);
    }
    
    if (commandName === 'serverinfo') {
        await handleServerInfo(interaction);
    }
    
    if (commandName === 'userinfo') {
        await handleUserInfo(interaction);
    }
    
    if (commandName === 'avatar') {
        await handleAvatar(interaction);
    }
    
    if (commandName === 'help') {
        await handleHelp(interaction);
    }
    
    if (commandName === 'ping') {
        await handlePing(interaction);
    }
}

async function showTicketMenu(interaction) {
    const embed = createEmbed(
        '🎫 Support Tickets',
        'Select a ticket type to get started:\n\n**Support** - General support\n**Report** - Report a user\n**Suggestion** - Submit a suggestion\n**Other** - Other issues'
    );
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_Support')
                .setLabel('Support')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🆘'),
            new ButtonBuilder()
                .setCustomId('ticket_Report')
                .setLabel('Report')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️'),
            new ButtonBuilder()
                .setCustomId('ticket_Suggestion')
                .setLabel('Suggestion')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💡'),
            new ButtonBuilder()
                .setCustomId('ticket_Other')
                .setLabel('Other')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📌')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showVerifyMenu(interaction) {
    const embed = createEmbed(
        '🔐 Verification',
        '**Welcome to the server!**\n\nTo gain access to all channels, please complete the verification process.\nClick the button below to start.\n\n**Requirements:**\n• Answer 3 questions\n• Get at least 2 correct\n• Be patient'
    );
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('verify_start')
                .setLabel('Start Verification')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showAdminPanel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator permissions!', ephemeral: true });
    }
    
    const embed = createEmbed(
        '⚙️ Admin Panel',
        '**Server Management**'
    )
    .addFields(
        { name: '📊 Server Stats', value: `Members: ${serverStats.members}\nOnline: ${serverStats.online}\nVoice: ${serverStats.voice}\nBoosts: ${serverStats.boosts}`, inline: true },
        { name: '🎫 Tickets', value: `Open: ${tickets.size}`, inline: true },
        { name: '🎉 Giveaways', value: `Active: ${giveaways.size}`, inline: true },
        { name: '📦 Drops', value: `Active: ${drops.size}`, inline: true },
        { name: '📊 Votes', value: `Active: ${votes.size}`, inline: true },
        { name: '👥 Users', value: `Total: ${serverStats.members}`, inline: true },
        { name: '📋 Channels', value: `Total: ${serverStats.channels}`, inline: true },
        { name: '🎭 Roles', value: `Total: ${serverStats.roles}`, inline: true }
    );
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('view_tickets')
                .setLabel('View Tickets')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫'),
            new ButtonBuilder()
                .setCustomId('staff_stats')
                .setLabel('Staff Stats')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function showConfigPanel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator permissions!', ephemeral: true });
    }
    
    const embed = createEmbed(
        '⚙️ Configuration',
        '**Current Server Configuration**'
    )
    .addFields(
        { name: '📌 Ticket Category', value: `<#${config.ticketCategoryId}>`, inline: true },
        { name: '📋 Log Channel', value: `<#${config.logChannelId}>`, inline: true },
        { name: '👋 Welcome Channel', value: `<#${config.welcomeChannelId}>`, inline: true },
        { name: '👑 Admin Role', value: `<@&${config.adminRoleId}>`, inline: true },
        { name: '🛡️ Mod Role', value: `<@&${config.modRoleId}>`, inline: true },
        { name: '✅ Verify Role', value: `<@&${config.verifyRoleId}>`, inline: true },
        { name: '🎉 Giveaways Channel', value: `<#${config.giveawaysChannelId}>`, inline: true },
        { name: '📦 Drops Channel', value: `<#${config.dropsChannelId}>`, inline: true },
        { name: '📊 Vote Channel', value: `<#${config.voteChannelId}>`, inline: true }
    );
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showStaffPanel(interaction) {
    const staff = interaction.guild.members.cache.filter(m => 
        m.roles.cache.has(config.adminRoleId) || m.roles.cache.has(config.modRoleId)
    );
    
    const onlineStaff = staff.filter(m => m.presence?.status !== 'offline');
    
    const embed = createEmbed(
        '🛡️ Staff Panel',
        '**Staff Management**'
    )
    .addFields(
        { name: '👥 Online Staff', value: `${onlineStaff.size}/${staff.size}`, inline: true },
        { name: '🎫 Open Tickets', value: tickets.size.toString(), inline: true },
        { name: '📋 Active Giveaways', value: giveaways.size.toString(), inline: true },
        { name: '📦 Active Drops', value: drops.size.toString(), inline: true },
        { name: '📊 Active Votes', value: votes.size.toString(), inline: true }
    );
    
    const staffList = staff.map(m => `${m.displayName}`).join('\n');
    if (staffList) {
        embed.addFields({ name: '📋 Staff List', value: staffList.substring(0, 1024), inline: false });
    }
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('view_tickets')
                .setLabel('View Tickets')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫'),
            new ButtonBuilder()
                .setCustomId('staff_logs')
                .setLabel('View Logs')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📋'),
            new ButtonBuilder()
                .setCustomId('staff_stats')
                .setLabel('Stats')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📊')
        );
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// Moderation Commands
async function handleWarn(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const reason = options.getString('reason');
    const member = await interaction.guild.members.fetch(user.id);
    
    if (!warnings.has(user.id)) {
        warnings.set(user.id, []);
    }
    
    const userWarnings = warnings.get(user.id);
    userWarnings.push({
        reason: reason,
        by: interaction.user.id,
        date: new Date().toISOString()
    });
    warnings.set(user.id, userWarnings);
    
    const embed = createEmbed(
        '⚠️ Warning Issued',
        `**User:** ${user.tag}\n**Reason:** ${reason}\n**By:** ${interaction.user.tag}\n**Total Warnings:** ${userWarnings.length}`
    );
    
    await interaction.reply({ embeds: [embed] });
    await user.send(`You have been warned in ${interaction.guild.name}: ${reason}`).catch(() => {});
    logAction('⚠️ Warning Issued', `${interaction.user.tag} warned ${user.tag}: ${reason}`);
}

async function handleKick(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: '❌ You need Kick Members permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id);
    
    await member.kick(reason);
    await interaction.reply({ content: `✅ ${user.tag} has been kicked. Reason: ${reason}` });
    logAction('👢 Member Kicked', `${interaction.user.tag} kicked ${user.tag}: ${reason}`);
}

async function handleBan(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '❌ You need Ban Members permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason provided';
    
    await interaction.guild.members.ban(user, { reason });
    await interaction.reply({ content: `✅ ${user.tag} has been banned. Reason: ${reason}` });
    logAction('🔨 Member Banned', `${interaction.user.tag} banned ${user.tag}: ${reason}`);
}

async function handleMute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const duration = options.getInteger('duration');
    const reason = options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id);
    
    await member.timeout(duration * 60000, reason);
    await interaction.reply({ content: `✅ ${user.tag} has been muted for ${duration} minutes. Reason: ${reason}` });
    logAction('🔇 Member Muted', `${interaction.user.tag} muted ${user.tag} for ${duration} minutes: ${reason}`);
}

async function handleUnmute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);
    
    await member.timeout(null);
    await interaction.reply({ content: `✅ ${user.tag} has been unmuted.` });
    logAction('🔊 Member Unmuted', `${interaction.user.tag} unmuted ${user.tag}`);
}

async function handleSetNick(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({ content: '❌ You need Manage Nicknames permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const nickname = options.getString('nickname');
    const member = await interaction.guild.members.fetch(user.id);
    
    await member.setNickname(nickname);
    await interaction.reply({ content: `✅ ${user.tag}'s nickname has been set to ${nickname}` });
    logAction('✏️ Nickname Changed', `${interaction.user.tag} changed ${user.tag}'s nickname to ${nickname}`);
}

async function handleAddRole(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ You need Manage Roles permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const role = options.getRole('role');
    const member = await interaction.guild.members.fetch(user.id);
    
    await member.roles.add(role);
    await interaction.reply({ content: `✅ Added ${role.name} to ${user.tag}` });
    logAction('➕ Role Added', `${interaction.user.tag} added ${role.name} to ${user.tag}`);
}

async function handleRemoveRole(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ You need Manage Roles permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    const role = options.getRole('role');
    const member = await interaction.guild.members.fetch(user.id);
    
    await member.roles.remove(role);
    await interaction.reply({ content: `✅ Removed ${role.name} from ${user.tag}` });
    logAction('➖ Role Removed', `${interaction.user.tag} removed ${role.name} from ${user.tag}`);
}

async function handleClearWarns(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ You need Moderate Members permission!', ephemeral: true });
    }
    
    const user = options.getUser('user');
    warnings.delete(user.id);
    await interaction.reply({ content: `✅ Cleared all warnings for ${user.tag}` });
    logAction('🧹 Warnings Cleared', `${interaction.user.tag} cleared warnings for ${user.tag}`);
}

async function handleViewWarnings(interaction) {
    const user = options.getUser('user');
    const userWarnings = warnings.get(user.id) || [];
    
    if (userWarnings.length === 0) {
        return interaction.reply({ content: `✅ ${user.tag} has no warnings.` });
    }
    
    const embed = createEmbed(
        '📋 Warnings',
        `**User:** ${user.tag}\n**Total Warnings:** ${userWarnings.length}`
    );
    
    userWarnings.forEach((w, i) => {
        embed.addFields({
            name: `Warning #${i + 1}`,
            value: `Reason: ${w.reason}\nBy: <@${w.by}>\nDate: ${new Date(w.date).toLocaleString()}`,
            inline: false
        });
    });
    
    await interaction.reply({ embeds: [embed] });
}

// Suggestion System
async function handleSuggestion(interaction) {
    const suggestion = options.getString('suggestion');
    
    const embed = createEmbed(
        '💡 New Suggestion',
        `**By:** ${interaction.user.tag}\n**Suggestion:** ${suggestion}`
    )
    .setFooter({ text: 'Upvote or downvote this suggestion' });
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('suggest_upvote')
                .setLabel('Upvote')
                .setStyle(ButtonStyle.Success)
                .setEmoji('👍'),
            new ButtonBuilder()
                .setCustomId('suggest_downvote')
                .setLabel('Downvote')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👎')
        );
    
    const channel = interaction.guild.channels.cache.get(config.suggestionsChannelId || config.giveawaysChannelId);
    const msg = await channel.send({ embeds: [embed], components: [row] });
    
    suggestions.set(msg.id, {
        author: interaction.user.id,
        suggestion: suggestion,
        upvotes: [],
        downvotes: []
    });
    
    await interaction.reply({ content: '✅ Suggestion submitted!', ephemeral: true });
}

async function handleSuggestionVote(interaction, type) {
    const suggestion = suggestions.get(interaction.message.id);
    if (!suggestion) return;
    
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
    
    const embed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(embed)
        .setFooter({ text: `Upvotes: ${suggestion.upvotes.length} | Downvotes: ${suggestion.downvotes.length}` });
    
    await interaction.message.edit({ embeds: [updatedEmbed] });
}

// Report System
async function handleReport(interaction) {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    
    const embed = createEmbed(
        '📋 Report Submitted',
        `**Reported User:** ${user.tag}\n**Reason:** ${reason}\n**Reported by:** ${interaction.user.tag}`
    );
    
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) {
        await logChannel.send({ embeds: [embed] });
    }
    
    await interaction.reply({ content: '✅ Report submitted! Staff will review it.', ephemeral: true });
    logAction('📋 Report Submitted', `${interaction.user.tag} reported ${user.tag}: ${reason}`);
}

// Appeal System
async function handleAppeal(interaction) {
    const reason = options.getString('reason');
    
    const embed = createEmbed(
        '📝 Ban Appeal',
        `**Appellant:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Status:** Pending review`
    );
    
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel) {
        const msg = await logChannel.send({ embeds: [embed] });
        appeals.set(msg.id, {
            user: interaction.user.id,
            reason: reason,
            status: 'pending'
        });
    }
    
    await interaction.reply({ content: '✅ Appeal submitted! You will be contacted.', ephemeral: true });
}

// Economy System
async function handleDaily(interaction) {
    const userId = interaction.user.id;
    const lastClaim = dailyRewards.get(userId) || 0;
    const cooldown = 86400000; // 24 hours
    
    if (Date.now() - lastClaim < cooldown) {
        const remaining = new Date(lastClaim + cooldown - Date.now());
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return interaction.reply({ 
            content: `⏰ You already claimed your daily reward! Come back in ${hours}h ${minutes}m.`, 
            ephemeral: true 
        });
    }
    
    const reward = 100 + Math.floor(Math.random() * 100);
    economy.set(userId, (economy.get(userId) || 0) + reward);
    dailyRewards.set(userId, Date.now());
    
    const embed = createEmbed(
        '💰 Daily Reward',
        `You claimed your daily reward!\n**Amount:** $${reward}\n**New Balance:** $${economy.get(userId)}`
    );
    
    await interaction.reply({ embeds: [embed] });
}

async function handleBalance(interaction) {
    const userId = interaction.user.id;
    const balance = economy.get(userId) || 0;
    
    const embed = createEmbed(
        '💰 Balance',
        `**User:** ${interaction.user.tag}\n**Balance:** $${balance}`
    );
    
    await interaction.reply({ embeds: [embed] });
}

// Leveling System
async function handleLevel(interaction) {
    const userId = interaction.user.id;
    const levelData = levels.get(userId) || { xp: 0, level: 1 };
    
    const embed = createEmbed(
        '📊 Level',
        `**User:** ${interaction.user.tag}\n**Level:** ${levelData.level}\n**XP:** ${levelData.xp}/${levelData.level * 100}`
    );
    
    await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
    const sorted = Array.from(levels.entries())
        .sort((a, b) => b[1].xp - a[1].xp)
        .slice(0, 10);
    
    const embed = createEmbed(
        '🏆 Level Leaderboard',
        'Top 10 members by XP'
    );
    
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

// Reaction Roles
async function handleReactionRole(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: '❌ You need Manage Roles permission!', ephemeral: true });
    }
    
    const channel = options.getChannel('channel');
    const messageId = options.getString('message');
    const role = options.getRole('role');
    const emoji = options.getString('emoji');
    
    const msg = await channel.messages.fetch(messageId);
    await msg.react(emoji);
    
    reactionRoles.set(`${msg.id}_${emoji}`, {
        roleId: role.id,
        channelId: channel.id,
        messageId: msg.id,
        emoji: emoji
    });
    
    await interaction.reply({ content: `✅ Reaction role setup: ${emoji} = ${role.name} in ${channel.name}`, ephemeral: true });
}

// Custom Commands
async function handleCustomCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ You need Manage Guild permission!', ephemeral: true });
    }
    
    const name = options.getString('name');
    const response = options.getString('response');
    
    customCommands.set(name.toLowerCase(), response);
    await interaction.reply({ content: `✅ Custom command created: !${name}`, ephemeral: true });
}

// Utility Commands
async function handlePurge(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const amount = options.getInteger('amount');
    if (amount > 100) return interaction.reply({ content: '❌ Maximum 100 messages', ephemeral: true });
    
    await interaction.channel.bulkDelete(amount);
    await interaction.reply({ content: `✅ Deleted ${amount} messages`, ephemeral: true });
}

async function handleSlowmode(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    const seconds = options.getInteger('seconds');
    await interaction.channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `✅ Slowmode set to ${seconds} seconds` });
}

async function handleLockdown(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    await interaction.channel.permissionOverwrites.create(interaction.guild.id, {
        SendMessages: false
    });
    await interaction.reply({ content: '🔒 Channel locked!' });
}

async function handleUnlock(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ You need Manage Channels permission!', ephemeral: true });
    }
    
    await interaction.channel.permissionOverwrites.delete(interaction.guild.id);
    await interaction.reply({ content: '🔓 Channel unlocked!' });
}

async function handleAnnounce(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const title = options.getString('title');
    const message = options.getString('message');
    
    const embed = createEmbed(
        `📢 ${title}`,
        message
    );
    
    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });
}

async function handlePoll(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission!', ephemeral: true });
    }
    
    const question = options.getString('question');
    const optionsStr = options.getString('options');
    const optArray = optionsStr.split('|').map(o => o.trim());
    
    const embed = createEmbed(
        '📊 Poll',
        `**${question}**\n\n${optArray.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`
    );
    
    const msg = await interaction.channel.send({ embeds: [embed] });
    for (let i = 0; i < optArray.length; i++) {
        await msg.react(['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || '❓');
    }
    
    await interaction.reply({ content: '✅ Poll created!', ephemeral: true });
}

// Info Commands
async function handleServerInfo(interaction) {
    const guild = interaction.guild;
    const embed = createEmbed(
        'ℹ️ Server Information',
        `**Name:** ${guild.name}\n**ID:** ${guild.id}\n**Created:** ${guild.createdAt.toLocaleDateString()}\n**Owner:** ${guild.ownerId}\n**Members:** ${guild.memberCount}\n**Channels:** ${guild.channels.cache.size}\n**Roles:** ${guild.roles.cache.size}\n**Boosts:** ${guild.premiumSubscriptionCount || 0}`
    );
    
    await interaction.reply({ embeds: [embed] });
}

async function handleUserInfo(interaction) {
    const user = options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);
    
    const embed = createEmbed(
        'ℹ️ User Information',
        `**Username:** ${user.tag}\n**ID:** ${user.id}\n**Created:** ${user.createdAt.toLocaleDateString()}\n**Joined:** ${member.joinedAt?.toLocaleDateString()}\n**Roles:** ${member.roles.cache.map(r => r.name).join(', ')}\n**Status:** ${member.presence?.status || 'offline'}`
    );
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAvatar(interaction) {
    const user = options.getUser('user') || interaction.user;
    
    const embed = createEmbed(
        '🖼️ Avatar',
        `**${user.tag}'s Avatar**`
    )
    .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }));
    
    await interaction.reply({ embeds: [embed] });
}

async function handleHelp(interaction) {
    const embed = createEmbed(
        '❓ Help Menu',
        '**Commands:**\n\n**Ticket System:**\n/ticket - Open a ticket\n\n**Verification:**\n/verify - Start verification\n\n**Moderation:**\n/warn - Warn a user\n/kick - Kick a user\n/ban - Ban a user\n/mute - Mute a user\n/unmute - Unmute a user\n/purge - Delete messages\n/lockdown - Lock channel\n/unlock - Unlock channel\n\n**Economy:**\n/daily - Claim daily reward\n/balance - Check balance\n\n**Leveling:**\n/level - Check level\n/leaderboard - View leaderboard\n\n**Utility:**\n/say - Send message as bot\n/poll - Create a poll\n/announce - Make announcement\n/top - View top 10\n\n**Info:**\n/serverinfo - Server info\n/userinfo - User info\n/avatar - View avatar\n/ping - Check bot ping\n\n**Staff:**\n/staff - Staff panel\n/panel - Admin panel\n/config - Configuration`
    );
    
    await interaction.reply({ embeds: [embed] });
}

async function handlePing(interaction) {
    const ping = client.ws.ping;
    const embed = createEmbed(
        '🏓 Ping',
        `**Bot Latency:** ${ping}ms\n**API Latency:** ${Date.now() - interaction.createdTimestamp}ms`
    );
    
    await interaction.reply({ embeds: [embed] });
}

// Message events for leveling
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;
    
    // Leveling
    const userId = message.author.id;
    const levelData = levels.get(userId) || { xp: 0, level: 1 };
    levelData.xp += Math.floor(Math.random() * 10) + 5;
    
    const neededXP = levelData.level * 100;
    if (levelData.xp >= neededXP) {
        levelData.xp -= neededXP;
        levelData.level++;
        
        const embed = createEmbed(
            '📊 Level Up!',
            `🎉 ${message.author.tag} just reached level ${levelData.level}!`
        );
        await message.channel.send({ embeds: [embed] });
    }
    
    levels.set(userId, levelData);
    
    // Custom commands
    const content = message.content;
    if (content.startsWith('!')) {
        const cmd = content.slice(1).split(' ')[0].toLowerCase();
        const response = customCommands.get(cmd);
        if (response) {
            await message.channel.send(response);
        }
    }
});

// Reaction role handling
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    const key = `${reaction.message.id}_${reaction.emoji.toString()}`;
    const config = reactionRoles.get(key);
    if (!config) return;
    
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(config.roleId);
    if (role) {
        await member.roles.add(role);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    
    const key = `${reaction.message.id}_${reaction.emoji.toString()}`;
    const config = reactionRoles.get(key);
    if (!config) return;
    
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(config.roleId);
    if (role) {
        await member.roles.remove(role);
    }
});

// Voice state update for stats
client.on('voiceStateUpdate', (oldState, newState) => {
    updateStatus();
});

// Presence update
client.on('presenceUpdate', (oldPresence, newPresence) => {
    updateStatus();
});

// Guild member add
client.on('guildMemberAdd', async member => {
    // Track activity
    updateStatus();
    updateMemberCount();
});

// Guild member remove
client.on('guildMemberRemove', member => {
    updateStatus();
    updateMemberCount();
});

// Log function
async function logAction(title, description) {
    const channel = client.channels.cache.get(config.logChannelId);
    if (!channel) return;
    
    const embed = createEmbed(
        title,
        description
    );
    
    await channel.send({ embeds: [embed] });
}

// Giveaway functions
async function endGiveaway(messageId) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway) return;
    
    const winners = [];
    const entries = giveaway.entries;
    
    for (let i = 0; i < Math.min(giveaway.winners, entries.length); i++) {
        const winner = entries[Math.floor(Math.random() * entries.length)];
        winners.push(winner);
    }
    
    const channel = client.channels.cache.get(config.giveawaysChannelId);
    const msg = await channel.messages.fetch(messageId);
    
    const embed = createEmbed(
        '🎉 Giveaway Ended',
        `**Prize:** ${giveaway.prize}\n**Winners:** ${winners.map(w => `<@${w}>`).join(', ') || 'No winners'}\n**Total Entries:** ${entries.length}`
    );
    
    await msg.edit({ embeds: [embed], components: [] });
    giveaways.delete(messageId);
    
    if (winners.length > 0) {
        await channel.send(`🎉 Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won: ${giveaway.prize}`);
    }
}

// Drop functions
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
    
    await interaction.reply({ content: `✅ You claimed: ${drop.item}`, ephemeral: true });
    
    if (drop.remaining <= 0) {
        const embed = createEmbed(
            '📦 Drop Ended',
            `All items have been claimed!\n**Item:** ${drop.item}\n**Total Claimed:** ${drop.claimed.length}`
        );
        await interaction.message.edit({ embeds: [embed], components: [] });
    }
}

// Vote functions
async function handleVote(interaction) {
    const vote = votes.get(interaction.message.id);
    if (!vote) return;
    
    if (vote.voters.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ You already voted!', ephemeral: true });
    }
    
    const optionIndex = parseInt(interaction.customId.split('_')[1]);
    const option = vote.options[optionIndex];
    
    if (!vote.votes[option]) vote.votes[option] = 0;
    vote.votes[option]++;
    vote.voters.push(interaction.user.id);
    
    votes.set(interaction.message.id, vote);
    
    await interaction.reply({ content: `✅ You voted for: ${option}`, ephemeral: true });
}

// Giveaway enter
async function enterGiveaway(interaction) {
    const giveaway = giveaways.get(interaction.message.id);
    if (!giveaway) return;
    
    if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ You already entered!', ephemeral: true });
    }
    
    giveaway.entries.push(interaction.user.id);
    giveaways.set(interaction.message.id, giveaway);
    
    await interaction.reply({ content: '✅ You entered the giveaway!', ephemeral: true });
}

// View all tickets
async function viewAllTickets(interaction) {
    if (tickets.size === 0) {
        return interaction.reply({ content: '📭 No open tickets.', ephemeral: true });
    }
    
    const embed = createEmbed(
        '🎫 All Tickets',
        `**Total:** ${tickets.size}`
    );
    
    tickets.forEach((ticket, channelId) => {
        const channel = interaction.guild.channels.cache.get(channelId);
        embed.addFields({
            name: `#${channel?.name || 'Unknown'}`,
            value: `User: <@${ticket.user}>\nType: ${ticket.type}\nClaimed: ${ticket.claimed ? `<@${ticket.claimed}>` : 'No'}`,
            inline: false
        });
    });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// View staff logs
async function viewStaffLogs(interaction) {
    const embed = createEmbed(
        '📋 Staff Logs',
        'Recent staff actions will appear here'
    );
    
    // Add recent log entries from a file or memory
    embed.addFields({
        name: 'Logs',
        value: 'Staff logs are being tracked',
        inline: false
    });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// View staff stats
async function viewStaffStats(interaction) {
    const guild = interaction.guild;
    const staff = guild.members.cache.filter(m => 
        m.roles.cache.has(config.adminRoleId) || m.roles.cache.has(config.modRoleId)
    );
    
    const embed = createEmbed(
        '📊 Staff Statistics',
        `**Total Staff:** ${staff.size}\n**Online:** ${staff.filter(m => m.presence?.status !== 'offline').size}\n**Tickets:** ${tickets.size}\n**Giveaways:** ${giveaways.size}\n**Drops:** ${drops.size}\n**Votes:** ${votes.size}`
    );
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Select menu handler
async function handleSelectMenu(interaction) {
    // Handle select menus if needed
}

// Error handling
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

// Load data on startup
loadData();

// Login
client.login(config.token);

console.log('🔥 Black & Red Theme Bot is starting...');
console.log('📌 Features: Tickets, Verification, Giveaways, Drops, Voting, Staff Panel, Economy, Leveling, Moderation, and more!');
console.log('⚠️ Make sure to configure the config object with your server IDs!');
