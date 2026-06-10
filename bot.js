const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();
client.slashCommands = new Collection();

// Load all cogs
const cogsPath = path.join(__dirname, 'cogs');
const cogFiles = fs.readdirSync(cogsPath).filter(f => f.endsWith('.js'));



for (const file of cogFiles) {
  const cog = require(path.join(cogsPath, file));
  cog.load(client);
  console.log(`[COG] Loaded: ${file}`);
}

client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  // Update activity
  const updateActivity = async () => {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    await guild.members.fetch();
    const roleMembers = guild.roles.cache.get(config.roles.designRole)?.members.size || 0;
    client.user.setPresence({
      activities: [{ name: `🎨 Get a Design: ${roleMembers} אנשים`, type: 3 }],
      status: 'online',
    });
  };
  updateActivity();
  setInterval(updateActivity, 60000);
});

client.login(config.token);
