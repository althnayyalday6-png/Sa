const { update } = require('./db');

// قبول الطلب: يسحب كود من المخزون ويحوّل الحالة لتم التسليم
async function approve(id) {
  return update(db => {
    const o = db.orders.find(x => x.id === id);
    if (!o) return { error: 'not_found' };
    if (o.status !== 'pending') return { error: 'not_pending' };
    const p = db.products.find(x => x.id === o.productId);
    if (!p || !p.stock.length) {
      o.status = 'rejected';
      o.reason = 'out_of_stock';
      return { error: 'out_of_stock', order: o };
    }
    o.item = p.stock.shift();
    o.status = 'delivered';
    o.decidedAt = Date.now();
    return { order: o };
  });
}

async function reject(id, reason = 'rejected') {
  return update(db => {
    const o = db.orders.find(x => x.id === id);
    if (!o) return { error: 'not_found' };
    if (o.status !== 'pending') return { error: 'not_pending' };
    o.status = 'rejected';
    o.reason = reason;
    o.decidedAt = Date.now();
    return { order: o };
  });
}

module.exports = { approve, reject };
