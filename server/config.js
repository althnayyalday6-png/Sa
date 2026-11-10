require('dotenv').config();

const e = (k, d = '') => (process.env[k] ?? d).trim();
const baseUrl = e('BASE_URL', 'http://localhost:3000').replace(/\/$/, '');

module.exports = {
  port: Number(e('PORT', '3000')),
  baseUrl,
  sessionSecret: e('SESSION_SECRET', 'dev-only-secret-change-me'),
  discord: {
    clientId: e('DISCORD_CLIENT_ID'),
    clientSecret: e('DISCORD_CLIENT_SECRET'),
    botToken: e('DISCORD_BOT_TOKEN'),
    guildId: e('DISCORD_GUILD_ID'),
    merchantRoomId: e('MERCHANT_CHANNEL_ID'),
    ticketCategoryId: e('TICKET_CATEGORY_ID'),
    ownerId: e('OWNER_ID'),
    staffIds: e('STAFF_IDS').split(',').map(s => s.trim()).filter(Boolean),
  },
  bank: {
    name: e('BANK_NAME', 'البنك'),
    iban: e('BANK_IBAN'),
    holder: e('BANK_HOLDER', 'متجر أوربت'),
  },
};
