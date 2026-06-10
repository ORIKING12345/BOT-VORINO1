// ============================================================
// COG: tickets.js — מערכת טיקטים
// ============================================================
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} = require('discord.js');
const config = require('../config.json');
const fs = require('fs');

const openTickets = new Map(); // userId -> channelId

module.exports = {
  load(client) {

    // ── /setup-tickets — רק ticketOpenRole ──────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'setup-tickets') {
        const member = interaction.member;
        if (!member.roles.cache.has(config.roles.ticketOpenRole)) {
          return interaction.reply({ content: '❌ אין לך הרשאה לפקודה זו.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('🎫 פתיחת טיקט')
          .setDescription('לחץ על הכפתור למטה כדי לפתוח טיקט תמיכה.')
          .setColor(0x5865F2)
          .setFooter({ text: 'מערכת טיקטים' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_ticket_menu')
            .setLabel('📩 פתח טיקט')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ פאנל טיקטים נשלח!', ephemeral: true });
      }
    });

    // ── לחיצה על פתח טיקט → תפריט אפשרויות ────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (interaction.customId !== 'open_ticket_menu') return;

      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_type_select')
        .setPlaceholder('בחר סוג טיקט...')
        .addOptions([
          { label: '🛠️ תמיכה טכנית', value: 'tech' },
          { label: '💰 תשלום / רכישה', value: 'billing' },
          { label: '🤝 שותפות', value: 'partner' },
          { label: '📋 כללי', value: 'general' },
        ]);

      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'בחר את סוג הטיקט:', components: [row], ephemeral: true });
    });

    // ── בחירת סוג טיקט → פתיחת חדר ─────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isStringSelectMenu()) return;
      if (interaction.customId !== 'ticket_type_select') return;

      const userId = interaction.user.id;
      if (openTickets.has(userId)) {
        return interaction.reply({ content: `❌ כבר יש לך טיקט פתוח: <#${openTickets.get(userId)}>`, ephemeral: true });
      }

      const type = interaction.values[0];
      const typeNames = { tech: 'תמיכה טכנית', billing: 'תשלום', partner: 'שותפות', general: 'כללי' };
      const guild = interaction.guild;

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: config.channels.ticketCategory || null,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: config.roles.ticketHandleRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      openTickets.set(userId, channel.id);

      const embed = new EmbedBuilder()
        .setTitle(`🎫 טיקט — ${typeNames[type]}`)
        .setDescription(`שלום <@${userId}>!\nהצוות שלנו יטפל בך בהקדם.\n\nסוג הפנייה: **${typeNames[type]}**`)
        .setColor(0x57F287)
        .setTimestamp();

      // פאנל לרול ticketHandleRole בלבד
      const panelEmbed = new EmbedBuilder()
        .setTitle('⚙️ פאנל ניהול טיקט')
        .setDescription('כלים לניהול הטיקט — גלוי לצוות בלבד')
        .setColor(0xFEE75C);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_rename_${userId}`).setLabel('✏️ שינוי שם').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_tag_${userId}`).setLabel('🏷️ תייג ממבר').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_need_more_${userId}`).setLabel('❓ צריך עוד משהו?').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_close_${userId}`).setLabel('🔒 סגור טיקט').setStyle(ButtonStyle.Danger),
      );

      await channel.send({ content: `<@${userId}> | <@&${config.roles.ticketHandleRole}>`, embeds: [embed] });
      await channel.send({ embeds: [panelEmbed], components: [row] });

      await interaction.reply({ content: `✅ הטיקט שלך נפתח: ${channel}`, ephemeral: true });
    });

    // ── כפתורי פאנל ניהול טיקט ──────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      const { customId, member, guild, channel } = interaction;

      // רק ticketHandleRole
      const isHandler = member.roles.cache.has(config.roles.ticketHandleRole);

      if (customId.startsWith('ticket_rename_')) {
        if (!isHandler) return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`modal_rename_${channel.id}`).setTitle('שינוי שם טיקט');
        const input = new TextInputBuilder().setCustomId('new_name').setLabel('שם חדש לחדר').setStyle(TextInputStyle.Short);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
      }

      if (customId.startsWith('ticket_tag_')) {
        if (!isHandler) return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
        const userId = customId.split('_')[2];
        await interaction.reply({ content: `🏷️ תיוג הממבר: <@${userId}>`, ephemeral: false });
      }

      if (customId.startsWith('ticket_need_more_')) {
        if (!isHandler) return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
        const userId = customId.split('_')[3];
        const embed = new EmbedBuilder()
          .setDescription(`<@${userId}> — האם אתה צריך עוד עזרה? אנא ענה בהודעה זו 😊`)
          .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed] });
      }

      if (customId.startsWith('ticket_close_')) {
        if (!isHandler) return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
        const userId = customId.split('_')[2];
        await interaction.reply({ content: '🔒 הטיקט נסגר. שולח טרנסקריפט...' });

        // שליחת טרנסקריפט
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(m =>
          `[${new Date(m.createdTimestamp).toLocaleString('he-IL')}] ${m.author.tag}: ${m.content || '[embed/attachment]'}`
        ).join('\n');

        const buffer = Buffer.from(transcript, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });

        try {
          const user = await guild.members.fetch(userId);
          const dmEmbed = new EmbedBuilder()
            .setTitle('🎫 הטיקט שלך נסגר')
            .setDescription(`הטיקט \`${channel.name}\` נסגר.\nמצורף טרנסקריפט השיחה.`)
            .setColor(0xED4245).setTimestamp();
          await user.user.send({ embeds: [dmEmbed], files: [attachment] });
        } catch (e) { console.log('Could not DM user.'); }

        openTickets.delete(userId);
        setTimeout(() => channel.delete().catch(() => {}), 3000);
      }
    });

    // ── Modal rename ─────────────────────────────────────────
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isModalSubmit()) return;
      if (!interaction.customId.startsWith('modal_rename_')) return;
      const newName = interaction.fields.getTextInputValue('new_name');
      await interaction.channel.setName(newName);
      await interaction.reply({ content: `✅ השם שונה ל: \`${newName}\``, ephemeral: true });
    });

    // ── Slash command registration ───────────────────────────
    client.on('ready', () => {
      registerCommand(client, {
        name: 'setup-tickets',
        description: 'שלח פאנל טיקטים לערוץ זה [צוות בלבד]',
      });
    });
  }
};

function registerCommand(client, data) {
  const guild = client.guilds.cache.get(config.guildId);
  if (guild) guild.commands.create(data).catch(() => {});
}
