/* Admin - Quản lý đơn hàng: xem mọi đơn, xem lịch sử trạng thái, cập nhật trạng thái (T03). */
(function () {
  'use strict';
  const api = window.BookMoochOrdersApi;
  const body = document.getElementById('ordersTableBody');
  if (!api || !body) return;

  const PAGE_SIZE = 10;
  const state = { group: 'all', q: '', page: 0 };
  let seq = 0;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
  const when = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '');
  const badge = (s) => ({
    WAITING_PAYMENT: 'warning', WAITING_CONFIRM: 'info', PACKING: 'info', SHIPPING: 'warning',
    DELIVERED: 'warning', COMPLETED: 'success', CANCELLED: 'secondary'
  }[s] || 'info');

  function rowHtml(o) {
    const first = o.items[0] || {};
    const extra = o.items.length > 1 ? ` (+${o.items.length - 1})` : '';
    const advance = o.nextStatus
      ? `<button class="btn btn-primary btn-sm" data-act="advance" data-code="${esc(o.orderCode)}" data-next="${esc(o.nextStatus)}">${esc(api.NEXT_ACTION[o.nextStatus] || 'Cập nhật')}</button>`
      : '';
    return `
      <tr>
        <td><strong>#${esc(o.orderCode)}</strong><div style="font-size:.75rem;color:#94a3b8;">${esc(when(o.createdAt))}</div></td>
        <td>${esc(o.buyerName)}</td>
        <td>${esc(o.sellerName)}</td>
        <td>${esc(first.title || '')}${esc(extra)}</td>
        <td style="text-align:right;">${money(o.totalAmount)}</td>
        <td style="text-align:center;"><span class="badge badge-${badge(o.status)}"><span class="badge-dot"></span>${esc(api.LABELS[o.status] || o.status)}</span></td>
        <td style="text-align:center;"><div style="display:flex;gap:6px;justify-content:center;">
          <button class="btn btn-outline btn-sm" data-act="detail" data-code="${esc(o.orderCode)}">Chi tiết</button>${advance}</div></td>
      </tr>`;
  }

  function renderPager(p) {
    const info = document.getElementById('ordersPaginationInfo');
    const controls = document.getElementById('ordersPaginationControls');
    if (p.totalElements === 0) {
      info.textContent = 'Không có đơn hàng nào phù hợp với bộ lọc hiện tại';
      controls.innerHTML = '';
      return;
    }
    const from = p.page * p.size + 1;
    info.innerHTML = `Hiển thị <strong>${from} - ${from + p.content.length - 1}</strong> của <strong>${p.totalElements}</strong> đơn hàng`;
    let pages = '';
    for (let i = 0; i < p.totalPages; i++) {
      pages += `<button class="page-btn ${i === p.page ? 'active' : ''}" data-page="${i}">${i + 1}</button>`;
    }
    controls.innerHTML = `
      <button class="page-btn" data-page="${p.page - 1}" ${p.page === 0 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span></button>
      ${pages}
      <button class="page-btn" data-page="${p.page + 1}" ${p.page >= p.totalPages - 1 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></button>`;
  }

  function fail(error) {
    if (error.loginRequired) { window.location.href = '../../auth/html/login.html'; return; }
    showToast(error.message, 'warning');
  }

  async function load() {
    const mine = ++seq;
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;">Đang tải đơn hàng...</td></tr>';
    try {
      const p = await api.admin({ status: state.group, q: state.q, page: state.page, size: PAGE_SIZE });
      if (mine !== seq) return;
      body.innerHTML = p.content.length ? p.content.map(rowHtml).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:28px;">Không có đơn hàng nào.</td></tr>';
      document.querySelectorAll('#orderFilterTabs .tab-chip').forEach((t) => {
        const c = t.querySelector('.tab-count');
        if (c) c.textContent = (p.counts || {})[t.dataset.filter] ?? 0;
      });
      renderPager(p);
    } catch (error) {
      if (mine !== seq) return;
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:#b42318;">${esc(error.message)}</td></tr>`;
      fail(error);
    }
  }

  async function openDetail(code) {
    const target = document.getElementById('orderDetailBody');
    const actions = document.getElementById('orderDetailExtraActions');
    target.innerHTML = '<p style="padding:16px;">Đang tải...</p>';
    actions.innerHTML = '';
    openModal('orderDetailModal');
    try {
      const d = await api.adminDetail(code);
      const s = d.summary;
      const items = s.items.map((i) => `<li>${esc(i.title)} — ${esc(i.quantity)} × ${money(i.unitPrice)}</li>`).join('');
      const history = d.history.map((h) => `
        <li><strong>${esc(api.LABELS[h.newStatus] || h.newStatus)}</strong>
          <span style="color:#94a3b8;"> — ${esc(when(h.createdAt))} • ${esc(h.changedByName || 'Hệ thống')}</span>
          ${h.note ? `<div style="font-size:.8rem;color:#64748b;">${esc(h.note)}</div>` : ''}</li>`).join('');
      target.innerHTML = `
        <div style="display:grid;gap:10px;font-size:.9rem;">
          <div><strong>#${esc(s.orderCode)}</strong> — ${esc(api.LABELS[s.status] || s.status)}</div>
          <div>Người mua: ${esc(s.buyerName)} • Người bán: ${esc(s.sellerName)}</div>
          <div>Người nhận: ${esc(s.recipientName)} • ${esc(d.recipientPhone)}<br>${esc(d.shippingAddress)}</div>
          <ul style="padding-left:18px;margin:0;">${items}</ul>
          <div>Tạm tính ${money(s.subtotalAmount)} • Ship ${money(s.shippingFee)} • <strong>Tổng ${money(s.totalAmount)}</strong></div>
          ${d.buyerNote ? `<div>Ghi chú: ${esc(d.buyerNote)}</div>` : ''}
          <div><strong>Lịch sử trạng thái</strong><ul style="padding-left:18px;margin:6px 0 0;">${history}</ul></div>
        </div>`;
      if (s.nextStatus) {
        actions.innerHTML = `<button class="btn btn-primary" data-act="advance" data-code="${esc(s.orderCode)}" data-next="${esc(s.nextStatus)}">${esc(api.NEXT_ACTION[s.nextStatus] || 'Cập nhật')}</button>`;
      }
    } catch (error) {
      target.innerHTML = `<p style="padding:16px;color:#b42318;">${esc(error.message)}</p>`;
      fail(error);
    }
  }

  async function advance(btn) {
    const code = btn.dataset.code;
    const label = api.LABELS[btn.dataset.next] || btn.dataset.next;
    const note = window.prompt(`Chuyển đơn #${code} sang "${label}".\nGhi chú (không bắt buộc):`, '');
    if (note === null) return; // bấm Hủy
    btn.disabled = true;
    try {
      await api.updateStatus(code, btn.dataset.next, note);
      showToast(`Đơn #${code} đã chuyển sang "${label}".`, 'success');
      closeModal('orderDetailModal');
      await load();
    } catch (error) {
      btn.disabled = false;
      fail(error);
    }
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-act]');
    if (btn && btn.dataset.act === 'detail') openDetail(btn.dataset.code);
    else if (btn && btn.dataset.act === 'advance') advance(btn);
    const pg = event.target.closest('#ordersPaginationControls [data-page]');
    if (pg && !pg.disabled) { state.page = Number(pg.dataset.page); load(); }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initSlidingTabs(document.getElementById('orderFilterTabs'), (tab) => {
      state.group = tab.getAttribute('data-filter') || 'all';
      state.page = 0;
      load();
    });
    document.getElementById('orderSearch')?.addEventListener('input', debounce((e) => {
      state.q = e.target.value.trim();
      state.page = 0;
      load();
    }, 300));
    load();
  });
})();
