import { api, esc, money, toast, readFile } from './api.js';
import { state, needLink } from './shell.js';

let products = [];

export async function renderStore() {
  const root = document.getElementById('store');
  root.innerHTML = '<div class="grid" id="grid">جاري التحميل…</div>';
  products = await api('/api/products');

  const grid = document.getElementById('grid');
  grid.innerHTML = products.length
    ? products.map(p => `
      <article class="card">
        <div class="ico">🛒</div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.desc)}</p>
        <div class="row"><b>${money(p.price)}</b><span class="mu">متوفر: ${p.stock}</span></div>
        <button class="btn" data-buy="${esc(p.id)}" ${p.stock ? '' : 'disabled'}>${p.stock ? 'اشتر الآن' : 'غير متوفر'}</button>
      </article>`).join('')
    : '<p class="mu">ما فيه منتجات حالياً</p>';

  grid.onclick = e => {
    const id = e.target.dataset.buy;
    if (id) openCheckout(id);
  };
}

async function openCheckout(id) {
  if (!state.user) return needLink();
  const p = products.find(x => x.id === id);
  const pay = await api('/api/payment-info');
  const modal = document.getElementById('modal');

  modal.hidden = false;
  modal.innerHTML = `
    <div class="sheet">
      <button class="x" id="mx">×</button>
      <h2>${esc(p.name)}</h2>
      <p class="mu">المبلغ: <b>${money(p.price)}</b></p>
      <div class="pay">
        <div><small>البنك</small><b>${esc(pay.name)}</b></div>
        <div><small>الآيبان</small><code>${esc(pay.iban || 'قيد الإعداد')}</code></div>
        <div><small>المستفيد</small><b>${esc(pay.holder)}</b></div>
      </div>
      <button class="btn ghost" id="cp" ${pay.iban ? '' : 'disabled'}>نسخ الآيبان</button>
      <label class="up">ارفع صورة الإيصال<input type="file" id="rc" accept="image/*"></label>
      <button class="btn" id="send">إرسال الطلب</button>
    </div>`;

  document.getElementById('mx').onclick = () => (modal.hidden = true);
  document.getElementById('cp').onclick = () => {
    navigator.clipboard?.writeText(pay.iban).then(() => toast('تم النسخ ✓'), () => toast('انسخ يدوياً'));
  };
  document.getElementById('send').onclick = async () => {
    const f = document.getElementById('rc').files[0];
    if (!f) return toast('ارفع صورة الإيصال أولاً');
    if (f.size > 3 * 1024 * 1024) return toast('الصورة كبيرة، جرب صورة أصغر');
    try {
      const receipt = await readFile(f);
      await api('/api/orders', { method: 'POST', body: { productId: id, receipt } });
      modal.hidden = true;
      toast('تم إرسال الطلب، بنراجع الإيصال قريباً');
      document.querySelector('[data-view="orders"]').click();
    } catch (e) {
      toast(e.data?.error === 'out_of_stock' ? 'نفد المنتج' : 'صار خطأ، جرب مرة ثانية');
    }
  };
}

const STATUS = {
  pending: 'بانتظار المراجعة',
  awaiting_receipt: 'بانتظار الإيصال',
  delivered: 'تم التسليم',
  rejected: 'مرفوض',
};

export async function renderOrders() {
  const root = document.getElementById('orders');
  root.innerHTML = '<p class="mu">جاري التحميل…</p>';
  const list = await api('/api/orders/mine');
  root.innerHTML = list.length
    ? list.map(o => `
      <article class="card">
        <div class="row"><b>${esc(o.productName)}</b><span class="badge">${STATUS[o.status] || o.status}</span></div>
        <p class="mu">رقم الطلب: ${esc(o.id)} • ${money(o.price)}</p>
        ${o.item ? `<div class="pay"><small>بيانات المنتج</small><code>${esc(o.item)}</code></div>` : ''}
        ${o.reason ? `<p>السبب: ${esc(o.reason)}</p>` : ''}
      </article>`).join('')
    : '<p class="mu">ما عندك طلبات بعد</p>';
}
