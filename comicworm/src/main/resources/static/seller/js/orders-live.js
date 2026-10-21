/* Đơn hàng của người bán: chỉ XEM đơn của mình (/api/orders/seller). Đổi trạng thái do ADMIN. */
(function () {
  'use strict';
  const api = window.BookMoochOrdersApi;
  const tbody = document.querySelector('#ordersTable tbody');
  if (!api || !tbody) return;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
  const group = (s) => ({
    WAITING_PAYMENT: 'pending', WAITING_CONFIRM: 'processing', PACKING: 'processing',
    SHIPPING: 'shipping', DELIVERED: 'shipping', COMPLETED: 'completed', CANCELLED: 'cancelled'
  }[s] || 'processing');
  const badge = (s) => ({
    WAITING_PAYMENT: 'badge-warning', WAITING_CONFIRM: 'badge-warning', PACKING: 'badge-warning',
    SHIPPING: 'badge-info', DELIVERED: 'badge-info', COMPLETED: 'badge-success', CANCELLED: 'badge-danger'
  }[s] || 'badge-warning');
  const safeImg = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');

  function row(o) {
    const first = o.items[0] || {};
    const img = safeImg(first.imageUrl);
    const date = o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '';
    return `
      <tr data-status="${group(o.status)}">
        <td></td>
        <td><div class="order-id-cell">
          <div class="order-code"><span>#${esc(o.orderCode)}</span></div>
          <div class="order-date">${esc(date)}</div></div></td>
        <td><div class="product-cell">
          ${img ? `<img src="${esc(img)}" alt="${esc(first.title)}" class="comic-thumbnail">` : ''}
          <div class="product-meta"><div class="product-title">${esc(first.title || '')}${o.items.length > 1 ? ` (+${o.items.length - 1})` : ''}</div>
          <div class="product-tags"><span>x${esc(o.itemCount)} cuốn</span></div></div></div></td>
        <td><div class="customer-cell"><span class="customer-name">${esc(o.recipientName)}</span></div></td>
        <td><div class="price-cell"><span class="price-amount">${money(o.totalAmount)}</span>
          <span class="price-note">Đã gồm ship: ${money(o.shippingFee)}</span></div></td>
        <td style="text-align:center;"><span class="badge ${badge(o.status)}"><span class="badge-dot"></span>${esc(api.LABELS[o.status] || o.status)}</span></td>
        <td style="text-align:center;color:var(--text-muted);font-size:.8rem;">Chỉ xem</td>
      </tr>`;
  }

  async function load() {
    try {
      const page = await api.seller({ status: 'all', page: 0, size: 50 });
      tbody.innerHTML = page.content.length
        ? page.content.map(row).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:28px;">Chưa có đơn hàng nào.</td></tr>';
    } catch (error) {
      if (error.loginRequired) { window.location.href = '../../auth/html/login.html'; return; }
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:#b42318;">${esc(error.message)}</td></tr>`;
    }
  }

  load();
})();
