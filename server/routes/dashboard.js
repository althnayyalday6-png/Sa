const express = require('express');
const { read, update } = require('../db');
const { requireMerchant } = require('../auth');
const events = require('../events');
const { approve, reject } = require('../orders');

const r = express.Router();
r.use(requireMerchant);

const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);

r.get('/summary', (req, res) => {
  const db = read();
  const delivered = db.orders.filter(o => o.status === 'delivered');
  res.json({
    orders: db.orders.length,
    pending: db.orders.filter(o => o.status === 'pending').length,
    revenue: delivered.reduce((s, o) => s + o.price, 0),
    products: db.products.length,
    stock: db.products.reduce((s, p) => s + p.stock.length, 0),
    customers: Object.keys(db.users).length,
  });
});

r.get('/orders', (req, res) => res.json(read().orders.slice().reverse()));

r.get('/products', (req, res) => {
  res.json(read().products.map(p => ({
    id: p.id, name: p.name, price: p.price, desc: p.desc, stock: p.stock.length,
  })));
});

r.post('/orders/:id/approve', async (req, res) => {
  const out = await approve(req.params.id);
  if (out.error) return res.status(409).json(out);
  events.emit('order:delivered', out.order.id);
  res.json(out.order);
});

r.post('/orders/:id/reject', async (req, res) => {
  const out = await reject(req.params.id, String(req.body?.reason || 'rejected').slice(0, 200));
  if (out.error) return res.status(409).json(out);
  events.emit('order:rejected', out.order.id);
  res.json(out.order);
});

r.post('/products', async (req, res) => {
  const { name, price, desc, stock } = req.body || {};
  if (!name || !(Number(price) > 0)) return res.status(400).json({ error: 'invalid' });
  const p = await update(db => {
    const np = {
      id: 'p' + (++db.seq),
      name: String(name).slice(0, 80),
      price: Number(price),
      desc: String(desc || '').slice(0, 300),
      stock: lines(stock),
    };
    db.products.push(np);
    return np;
  });
  res.json(p);
});

r.post('/products/:id/stock', async (req, res) => {
  const codes = lines(req.body?.stock);
  const p = await update(db => {
    const pr = db.products.find(x => x.id === req.params.id);
    if (!pr) return null;
    pr.stock.push(...codes);
    return pr;
  });
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json({ id: p.id, stock: p.stock.length });
});

r.delete('/products/:id', async (req, res) => {
  await update(db => { db.products = db.products.filter(p => p.id !== req.params.id); });
  res.json({ ok: true });
});

module.exports = r;
