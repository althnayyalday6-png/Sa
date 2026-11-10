const express = require('express');
const { read, update } = require('../db');
const { requireLinked } = require('../auth');
const events = require('../events');
const cfg = require('../config');

const r = express.Router();

// المنتجات للكل (بدون الأكواد)
r.get('/products', (req, res) => {
  res.json(read().products.map(p => ({
    id: p.id, name: p.name, price: p.price, desc: p.desc, stock: p.stock.length,
  })));
});

// بيانات التحويل
r.get('/payment-info', (req, res) => {
  res.json({ name: cfg.bank.name, iban: cfg.bank.iban, holder: cfg.bank.holder });
});

// طلبات المستخدم المربوط
r.get('/orders/mine', requireLinked, (req, res) => {
  res.json(read().orders
    .filter(o => o.userId === req.session.uid)
    .reverse()
    .map(o => ({
      id: o.id,
      productName: o.productName,
      price: o.price,
      status: o.status,
      reason: o.reason || null,
      item: o.status === 'delivered' ? o.item : null,
      createdAt: o.createdAt,
    })));
});

// إنشاء طلب من الموقع (لازم ربط + إيصال)
r.post('/orders', requireLinked, async (req, res) => {
  const { productId, receipt } = req.body || {};
  if (typeof receipt !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(receipt)) {
    return res.status(400).json({ error: 'receipt_required' });
  }

  const out = await update(db => {
    const p = db.products.find(x => x.id === productId);
    if (!p) return { error: 'not_found' };
    if (!p.stock.length) return { error: 'out_of_stock' };
    const u = db.users[req.session.uid];
    const o = {
      id: 'ORB-' + (++db.seq),
      userId: req.session.uid,
      userName: u?.name || '',
      productId: p.id,
      productName: p.name,
      price: p.price,
      receipt,
      status: 'pending',
      source: 'site',
      createdAt: Date.now(),
      item: null,
    };
    db.orders.push(o);
    return { order: o };
  });

  if (out.error) return res.status(out.error === 'not_found' ? 404 : 409).json(out);
  events.emit('order:review', out.order.id);
  res.json({ ok: true, orderId: out.order.id });
});

module.exports = r;
