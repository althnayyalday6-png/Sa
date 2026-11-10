const express = require('express');
const crypto = require('crypto');
const cfg = require('./config');
const { read, update } = require('./db');

const router = express.Router();
const REDIRECT = `${cfg.baseUrl}/auth/discord/callback`;

const isMerchant = id => id === cfg.discord.ownerId || cfg.discord.staffIds.includes(id);

// لازم يكون مربوط بديسكورد
function requireLinked(req, res, next) {
  if (!req.session.uid) return res.status(401).json({ error: 'link_required' });
  next();
}

// لازم مربوط + من الإدارة
function requireMerchant(req, res, next) {
  if (!req.session.uid) return res.status(401).json({ error: 'link_required' });
  if (!isMerchant(req.session.uid)) return res.status(403).json({ error: 'forbidden' });
  next();
}

router.get('/login', (req, res) => {
  if (!cfg.discord.clientId) return res.status(500).send('DISCORD_CLIENT_ID غير مضبوط');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const qs = new URLSearchParams({
    client_id: cfg.discord.clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  res.redirect('https://discord.com/oauth2/authorize?' + qs.toString());
});

router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send('انتهت صلاحية تسجيل الدخول، جرب مرة ثانية.');
    }

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.discord.clientId,
        client_secret: cfg.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT,
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) return res.status(400).send('فشل الربط مع ديسكورد');

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = await meRes.json();

    const avatar = me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(me.id) >> 22n) % 6n)}.png`;

    const user = { id: me.id, name: me.global_name || me.username, avatar, linkedAt: Date.now() };
    await update(db => {
      db.users[me.id] = { ...db.users[me.id], ...user };
    });

    delete req.session.oauthState;
    req.session.uid = me.id;
    res.redirect('/');
  } catch (e) {
    console.error('discord callback', e);
    res.status(500).send('صار خطأ أثناء الربط');
  }
});

router.get('/me', (req, res) => {
  const u = req.session.uid ? read().users[req.session.uid] : null;
  if (!u) return res.json({ user: null });
  res.json({ user: { ...u, isMerchant: isMerchant(u.id) } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = { router, isMerchant, requireLinked, requireMerchant };
