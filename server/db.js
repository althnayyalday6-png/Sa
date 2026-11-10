const fs = require('fs');
const path = require('path');

const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

const SEED = {
  seq: 1000,
  users: {},
  orders: [],
  tickets: [],
  products: [
    { id: 'p1', name: 'نيترو 9 (قفت) شهر', price: 22, desc: 'اشتراك ديسكورد نيترو بسعر منافس وتسليم سريع بدون تأخير.', stock: [] },
    { id: 'p2', name: 'نيترو بيسك 3 أشهر', price: 49, desc: 'ثلاثة أشهر بمزايا نيترو بيسك كاملة.', stock: [] },
    { id: 'p3', name: 'بوست سيرفر × 2', price: 35, desc: 'بوستين لسيرفرك لمدة شهر كامل.', stock: [] },
  ],
};

let data = null;
let queue = Promise.resolve();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function load() {
  if (data) return data;
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    data = structuredClone(SEED);
    save();
  }
  return data;
}

// نسخة للقراءة فقط (ما تقدر تغير الداتا من برا)
const read = () => structuredClone(load());

// كل الكتابات تمشي بالترتيب عشان ما يصير تعارض
const update = fn => {
  const run = async () => {
    const db = load();
    const out = await fn(db);
    save();
    return out;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
};

module.exports = { read, update };
