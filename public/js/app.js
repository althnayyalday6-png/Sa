import { initShell } from './shell.js';
import { renderStore, renderOrders } from './store.js';

initShell().then(renderStore).catch(e => console.error(e));

document.getElementById('navLinks').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  const view = b.dataset.view;
  document.querySelectorAll('#navLinks [data-view]').forEach(x => x.classList.toggle('on', x === b));
  document.getElementById('store').hidden = view !== 'store';
  document.getElementById('orders').hidden = view !== 'orders';
  if (view === 'orders') renderOrders().catch(console.error);
});
