const path = require('path');
const express = require('express');
const session = require('express-session');
const cfg = require('./config');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));
app.use(session({
  secret: cfg.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.baseUrl.startsWith('https://'),
    maxAge: 30 * 24 * 3600 * 1000,
  },
}));

app.use('/auth', require('./auth').router);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/store'));

const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub));
app.get('/dashboard', (req, res) => res.sendFile(path.join(pub, 'dashboard.html')));

app.listen(cfg.port, () => console.log(`web: http://localhost:${cfg.port}`));

// البوت يشتغل بنفس العملية عشان يشارك نفس الداتا والأحداث
if (cfg.discord.botToken) {
  require('../bot')().catch(e => console.error('bot failed:', e.message));
} else {
  console.log('DISCORD_BOT_TOKEN غير موجود: البوت ما اشتغل');
}

module.exports = app;
