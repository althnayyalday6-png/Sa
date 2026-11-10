import { api, esc, toast } from './api.js';

export const state = { user: null };

// يعرض حالة الربط في الهيدر، ويظهر لوحة التحكم بس بعد الربط
export async function initShell() {
  const { user } = await api('/auth/me');
  state.user = user;
  const box = document.getElementById('userBox');

  if (user) {
    box.innerHTML = `<div class="me"><img src="${esc(user.avatar)}" alt=""><span>${esc(user.name)}</span><button class="nb" id="logout">خروج</button></div>`;
    document.getElementById('logout').onclick = async () => {
      await api('/auth/logout', { method: 'POST' });
      location.reload();
    };
    const dash = document.getElementById('dashLink');
    if (dash) dash.hidden = false;
    const orders = document.querySelector('[data-view="orders"]');
    if (orders) orders.hidden = false;
  } else {
    box.innerHTML = `<a class="btn" href="/auth/login">ربط حساب ديسكورد</a>`;
  }
  return user;
}

export const needLink = () => {
  toast('لازم تربط حسابك بديسكورد أول');
  setTimeout(() => (location.href = '/auth/login'), 900);
};
