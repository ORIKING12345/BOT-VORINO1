// ============================================================
// COG: giveaway.js — הגרלות, דרופים, נחש את המספר
// ============================================================
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const config = require('../config.json');

const giveaways = new Map();    // messageId -> { prize, entries: Set }
const drops = new Map();        // messageId -> { item, claimed }
const guessGames = new Map();   // channelId -> { number, prize }

module.exports = {
  load(client) {

    // ════════════════════════════════════
    // GIVEAWAYS
    // ════════════════════════════════════

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'giveaway-start') {
        if (!interaction.member.roles.cache.has(config.roles.giveawayRole)) {
          return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId('modal_giveaway').setTitle('🎉 פתיחת הגרלה');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('gw_prize').setLabel('הפרס').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('gw_duration').setLabel('משך ההגרלה (בדקות)').setStyle(TextInputStyle.Short).setRequired(true)
          ),
        );
        await interaction.showModal(modal);
      }
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isModalSubmit()) return;

      if (interaction.customId === 'modal_giveaway') {
        const prize = interaction.fields.getTextInputValue('gw_prize');
        const mins = parseInt(interaction.fields.getTextInputValue('gw_duration')) || 1;
        const endsAt = Date.now() + mins * 60 * 1000;

        const embed = new EmbedBuilder()
          .setTitle('🎉 הגרלה!')
          .setDescription(`**פרס:** ${prize}\n\n**מתי מסתיים:** <t:${Math.floor(endsAt / 1000)}:R>\n\nלחץ על הכפתור להשתתפות!`)
          .setColor(0xFF73FA).setTimestamp(endsAt);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('gw_enter').setLabel('🎟️ השתתף').setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();
        giveaways.set(msg.id, { prize, entries: new Set(), channel: interaction.channel.id });

        setTimeout(async () => {
          const gw = giveaways.get(msg.id);
          if (!gw) return;
          const entries = [...gw.entries];
          if (entries.length === 0) {
            return interaction.channel.send('😢 אף אחד לא השתתף בהגרלה...');
          }
          const winner = entries[Math.floor(Math.random() * entries.length)];
          const winEmbed = new EmbedBuilder()
            .setTitle('🏆 ההגרלה הסתיימה!')
            .setDescription(`הזוכה הוא: <@${winner}> 🎉\n**פרס:** ${gw.prize}`)
            .setColor(0xFEE75C);
          await interaction.channel.send({ embeds: [winEmbed] });
          giveaways.delete(msg.id);
        }, mins * 60 * 1000);
      }
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton() || interaction.customId !== 'gw_enter') return;
      const gw = giveaways.get(interaction.message.id);
      if (!gw) return interaction.reply({ content: '❌ הגרלה לא נמצאה.', ephemeral: true });
      if (gw.entries.has(interaction.user.id)) {
        return interaction.reply({ content: '✅ כבר נרשמת!', ephemeral: true });
      }
      gw.entries.add(interaction.user.id);
      return interaction.reply({ content: `🎟️ נרשמת להגרלה! סה"כ משתתפים: ${gw.entries.size}`, ephemeral: true });
    });

    // ════════════════════════════════════
    // DROPS
    // ════════════════════════════════════

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'drop') return;
      if (!interaction.member.roles.cache.has(config.roles.giveawayRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const item = interaction.options.getString('item');
      const embed = new EmbedBuilder()
        .setTitle('📦 DROP!')
        .setDescription(`**${item}** — הראשון שלוחץ מקבל!`)
        .setColor(0xED4245);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_drop').setLabel('⚡ תפוס!').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      const msg = await interaction.fetchReply();
      drops.set(msg.id, { item, claimed: false });
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton() || interaction.customId !== 'claim_drop') return;
      const drop = drops.get(interaction.message.id);
      if (!drop || drop.claimed) {
        return interaction.reply({ content: '💨 מישהו כבר תפס אותו!', ephemeral: true });
      }
      drop.claimed = true;
      const embed = new EmbedBuilder()
        .setTitle('✅ נתפס!')
        .setDescription(`<@${interaction.user.id}> תפס את **${drop.item}**! 🎉`)
        .setColor(0x57F287);
      await interaction.update({ embeds: [embed], components: [] });
    });

    // ════════════════════════════════════
    // GUESS THE NUMBER
    // ════════════════════════════════════

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'guess-start') return;
      if (!interaction.member.roles.cache.has(config.roles.giveawayRole)) {
        return interaction.reply({ content: '❌ אין לך הרשאה.', ephemeral: true });
      }

      const max = interaction.options.getInteger('max') || 100;
      const number = Math.floor(Math.random() * max) + 1;
      const prize = interaction.options.getString('prize') || 'ללא פרס';

      guessGames.set(interaction.channel.id, { number, prize, max, attempts: 0 });

      const embed = new EmbedBuilder()
        .setTitle('🔢 נחש את המספר!')
        .setDescription(`חשבתי על מספר בין **1** ל-**${max}**!\nשלח את הניחוש שלך בצ'אט.\n\n**פרס:** ${prize}`)
        .setColor(0x5865F2);

      await interaction.reply({ embeds: [embed] });
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      const game = guessGames.get(message.channel.id);
      if (!game) return;

      const guess = parseInt(message.content);
      if (isNaN(guess)) return;

      game.attempts++;

      if (guess === game.number) {
        const embed = new EmbedBuilder()
          .setTitle('🎉 נכון!')
          .setDescription(`<@${message.author.id}> ניחש את המספר **${game.number}** אחרי ${game.attempts} ניסיונות!\n**פרס:** ${game.prize}`)
          .setColor(0x57F287);
        await message.channel.send({ embeds: [embed] });
        guessGames.delete(message.channel.id);
      } else {
        const hint = guess < game.number ? '📈 גבוה יותר!' : '📉 נמוך יותר!';
        await message.reply(`❌ לא נכון! ${hint} (ניסיון ${game.attempts})`);
      }
    });

    // ── Register commands ────────────────────────────────────
    client.on('ready', () => {
      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) return;
      guild.commands.create({ name: 'giveaway-start', description: 'פתח הגרלה [צוות בלבד]' }).catch(() => {});
      guild.commands.create({
        name: 'drop', description: 'שלח DROP [צוות בלבד]',
        options: [{ name: 'item', description: 'מה לדרופ', type: 3, required: true }]
      }).catch(() => {});
      guild.commands.create({
        name: 'guess-start', description: 'פתח משחק ניחוש מספר [צוות בלבד]',
        options: [
          { name: 'max', description: 'המספר המקסימלי', type: 4, required: false },
          { name: 'prize', description: 'הפרס לנחש', type: 3, required: false },
        ]
      }).catch(() => {});
    });
  }
};
