import { api, esc, money, toast } from './api.js';

const root = document.getElementById('dash');
const STATUS = { awaiting_receipt: 'بانتظار الإيصال', pending: 'بانتظار المراجعة', delivered: 'تم التسليم', rejected: 'مرفوض' };

async function load() {
  const { user } = await api('/auth/me');
  if (!user) {
    root.innerHTML = `<section class="card center"><h2>اربط حسابك بديسكورد</h2>
      <p class="mu">لوحة التحكم تفتح بعد ربط حساب ديسكورد.</p>
      <a class="btn" href="/auth/login">ربط حساب ديسكورد</a></section>`;
    return;
  }

  let summary, orders, products;
  try {
    [summary, orders, products] = await Promise.all([
      api('/api/dashboard/summary'),
      api('/api/dashboard/orders'),
      api('/api/dashboard/products'),
    ]);
  } catch {
    root.innerHTML = `<section class="card center"><h2>ما عندك صلاحية</h2>
      <p class="mu">حساب <b>${esc(user.name)}</b> ما عنده صلاحية لوحة التحكم.</p>
      <a class="btn ghost" href="/">رجوع للمتجر</a></section>`;
    return;
  }

  root.innerHTML = `
    <section class="card"><div class="row"><h2>مرحباً ${esc(user.name)}</h2><span class="badge">الإدارة</span></div></section>

    <section class="stats">
      <div class="card"><span class="mu">الطلبات</span><b>${summary.orders}</b></div>
      <div class="card"><span class="mu">بانتظار المراجعة</span><b>${summary.pending}</b></div>
      <div class="card"><span class="mu">الإيراد</span><b>${money(summary.revenue)}</b></div>
      <div class="card"><span class="mu">المخزون</span><b>${summary.stock}</b></div>
      <div class="card"><span class="mu">العملاء</span><b>${summary.customers}</b></div>
    </section>

    <section class="card">
      <h2>إضافة منتج</h2>
      <form id="addp">
        <input name="name" placeholder="اسم المنتج" required>
        <input name="price" type="number" min="1" placeholder="السعر بالريال" required>
        <textarea name="desc" rows="2" placeholder="وصف مختصر"></textarea>
        <textarea name="stock" rows="3" placeholder="أكواد المخزون (سطر لكل كود)"></textarea>
        <button class="btn" type="submit">حفظ المنتج</button>
      </form>
    </section>

    <section class="card">
      <h2>المنتجات</h2>
      <div class="scroll"><table>
        <tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th></th></tr>
        ${products.map(p => `<tr>
          <td>${esc(p.name)}</td><td>${money(p.price)}</td><td>${p.stock}</td>
          <td class="toolbar">
            <button class="btn ghost" data-act="addstock" data-id="${esc(p.id)}">+ مخزون</button>
            <button class="btn danger" data-act="delproduct" data-id="${esc(p.id)}">حذف</button>
          </td></tr>`).join('') || '<tr><td colspan="4" class="mu">ما فيه منتجات</td></tr>'}
      </table></div>
    </section>

    <section class="card">
      <h2>الطلبات</h2>
      <div class="scroll"><table>
        <tr><th>الطلب</th><th>العميل</th><th>المنتج</th><th>المبلغ</th><th>الإيصال</th><th>الحالة</th><th></th></tr>
        ${orders.map(o => `<tr>
          <td>${esc(o.id)}</td><td>${esc(o.userName)}</td><td>${esc(o.productName)}</td><td>${money(o.price)}</td>
          <td>${o.receipt ? `<img class="rc" src="${esc(o.receipt)}" alt="">` : '—'}</td>
          <td><span class="badge">${STATUS[o.status] || o.status}</span></td>
          <td class="toolbar">${o.status === 'pending'
            ? `<button class="btn" data-act="approve" data-id="${esc(o.id)}">قبول</button>
               <button class="btn danger" data-act="reject" data-id="${esc(o.id)}">رفض</button>`
            : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="mu">ما فيه طلبات</td></tr>'}
      </table></div>
    </section>`;
}

root.addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  try {
    if (act === 'approve') await api(`/api/dashboard/orders/${id}/approve`, { method: 'POST' });
    if (act === 'reject') await api(`/api/dashboard/orders/${id}/reject`, { method: 'POST', body: { reason: 'الإيصال غير صحيح' } });
    if (act === 'delproduct') {
      if (!confirm('تبي تحذف المنتج؟')) return;
      await api(`/api/dashboard/products/${id}`, { method: 'DELETE' });
    }
    if (act === 'addstock') {
      const stock = prompt('أضف أكواد المخزون (سطر لكل كود):');
      if (!stock) return;
      await api(`/api/dashboard/products/${id}/stock`, { method: 'POST', body: { stock } });
    }
    toast('تم ✓');
    load();
  } catch (err) {
    toast('صار خطأ: ' + (err.data?.error || err.message));
  }
});

root.addEventListener('submit', async e => {
  if (e.target.id !== 'addp') return;
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try {
    await api('/api/dashboard/products', { method: 'POST', body });
    toast('تم حفظ المنتج ✓');
    load();
  } catch (err) {
    toast('تأكد من البيانات');
  }
});

load().catch(e => console.error(e));
