const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cfg = require('../server/config');
const panel = require('./panel');
const tickets = require('./tickets');

module.exports = async function startBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once('clientReady', async c => {
    console.log(`bot ready: ${c.user.tag}`);
    try {
      if (cfg.discord.guildId) {
        const guild = await c.guilds.fetch(cfg.discord.guildId);
        await guild.commands.set([panel.panelCommand]);
        console.log(`commands registered for guild ${guild.name}`);
      }
    } catch (e) {
      console.error('تعذر تسجيل أوامر السيرفر، تأكد من DISCORD_GUILD_ID وإن البوت داخل السيرفر:', e.message);
    }
  });

  client.on('interactionCreate', async i => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'panel') return await panel.registerPanel(i);
      if (!i.customId?.startsWith('orbit:')) return;
      if (await panel.handlePanel(i)) return;
      await tickets.handleTicketInteraction(i);
    } catch (e) {
      console.error('interaction error:', e);
      if (i.isRepliable()) {
        const msg = { content: 'صار خطأ، حاول مرة ثانية.', ephemeral: true };
        (i.replied || i.deferred) ? i.followUp(msg).catch(() => {}) : i.reply(msg).catch(() => {});
      }
    }
  });

  client.on('messageCreate', m => tickets.onMessage(m).catch(e => console.error('message error:', e)));

  tickets.wireEvents(client);
  await client.login(cfg.discord.botToken);
  return client;
};