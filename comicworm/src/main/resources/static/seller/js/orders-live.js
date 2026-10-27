/* Quản lý đơn hàng người bán: dữ liệu, quyền thao tác và trạng thái được lấy từ server. */
(function () {
  'use strict';
  const api = window.BookMoochOrdersApi;
  const tbody = document.querySelector('#ordersTable tbody');
  if (!api || !tbody) return;
  const PAGE_SIZE = 10;
  const state = { group: 'all', q: '', page: 0, sort: 'newest', updating: false, pending: null, counts: {} };
  const detailDialog = document.getElementById('sellerOrderDetailModal');
  const statusDialog = document.getElementById('sellerOrderStatusModal');
  const submitButton = document.getElementById('sellerOrderStatusSubmit');
  let requestSeq = 0, detailSeq = 0, searchTimer;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
  const when = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '';
  const label = (s) => api.LABELS[s] || s;
  const badge = (s) => ({ SHIPPING: 'info', DELIVERED: 'info', COMPLETED: 'success', CANCELLED: 'danger' }[s] || 'warning');
  const safeImg = (u) => typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '';
  const message = (text) => `<tr><td colspan="7" class="orders-message">${esc(text)}</td></tr>`;
  const notify = (text, type = 'info') => showToast(esc(text), type);
  function updateSidebarCount() {
    const badge = document.querySelector('#appSidebar [data-page="orders"] .nav-badge');
    if (badge) badge.textContent = state.counts.all ?? '—';
  }
  new MutationObserver(updateSidebarCount).observe(document.querySelector('.app-container'), { childList: true });

  function handleError(error) {
    if (error.loginRequired) { window.location.href = '/auth/login'; return; }
    notify(error.message, 'warning');
  }
  function advanceButton(o) {
    return o.nextStatus ? `<button class="btn btn-primary btn-sm" data-act="advance" data-code="${esc(o.orderCode)}" data-next="${esc(o.nextStatus)}">${esc(api.NEXT_ACTION[o.nextStatus] || 'Cập nhật trạng thái')}</button>` : '';
  }
  function row(o, index) {
    const first = o.items[0] || {}, img = safeImg(first.imageUrl);
    return `<tr data-code="${esc(o.orderCode)}" data-status="${esc(o.status)}">
      <td>${state.page * PAGE_SIZE + index + 1}</td>
      <td><div class="order-id-cell"><button class="order-code orders-code-button" data-act="detail" data-code="${esc(o.orderCode)}">#${esc(o.orderCode)}</button><div class="order-date">${esc(when(o.createdAt))}</div></div></td>
      <td><div class="product-cell">${img ? `<img src="${esc(img)}" alt="${esc(first.title)}" class="comic-thumbnail" loading="lazy">` : ''}<div class="product-meta"><div class="product-title">${esc(first.title || 'Đơn hàng')}${o.items.length > 1 ? ` (+${o.items.length - 1})` : ''}</div><div class="product-tags">${esc(o.itemCount)} cuốn</div></div></div></td>
      <td><div class="customer-cell"><span class="customer-name">${esc(o.recipientName)}</span><span class="customer-sub">${esc(o.buyerName)}</span></div></td>
      <td><div class="price-cell"><span class="price-amount">${money(o.totalAmount)}</span><span class="price-note">Phí giao hàng: ${money(o.shippingFee)}</span></div></td>
      <td style="text-align:center;"><span class="badge badge-${badge(o.status)}"><span class="badge-dot"></span>${esc(label(o.status))}</span></td>
      <td><div class="orders-row-actions"><button class="btn btn-outline btn-sm" data-act="detail" data-code="${esc(o.orderCode)}">Chi tiết</button>${advanceButton(o)}</div></td>
    </tr>`;
  }
  function renderPager(p) {
    const info = document.getElementById('ordersPaginationInfo'), controls = document.getElementById('ordersPaginationControls');
    if (!p.totalElements) { info.textContent = 'Không có đơn hàng phù hợp'; controls.innerHTML = ''; return; }
    const from = p.page * p.size + 1;
    info.textContent = `Hiển thị ${from} – ${from + p.content.length - 1} của ${p.totalElements} đơn hàng`;
    const pages = [...new Set([0, p.page - 1, p.page, p.page + 1, p.totalPages - 1])].filter((n) => n >= 0 && n < p.totalPages).sort((a, b) => a - b);
    let numbers = '', previous = -1;
    for (const n of pages) {
      if (n > previous + 1) numbers += '<span aria-hidden="true">…</span>';
      numbers += `<button class="page-btn ${n === p.page ? 'active' : ''}" data-page="${n}" ${n === p.page ? 'aria-current="page"' : ''}>${n + 1}</button>`;
      previous = n;
    }
    controls.innerHTML = `<button class="page-btn" data-page="${p.page - 1}" ${p.page === 0 ? 'disabled' : ''} aria-label="Trang trước">‹</button>${numbers}<button class="page-btn" data-page="${p.page + 1}" ${p.page >= p.totalPages - 1 ? 'disabled' : ''} aria-label="Trang sau">›</button>`;
  }
  async function load() {
    const mine = ++requestSeq;
    tbody.setAttribute('aria-busy', 'true');
    tbody.innerHTML = message('Đang tải đơn hàng...');
    document.getElementById('refreshOrdersBtn').disabled = true;
    try {
      const p = await api.seller({ status: state.group, q: state.q, page: state.page, size: PAGE_SIZE, sort: state.sort });
      if (mine !== requestSeq) return;
      if (state.page > 0 && state.page >= p.totalPages) { state.page = Math.max(0, p.totalPages - 1); return load(); }
      state.counts = p.counts;
      updateSidebarCount();
      tbody.innerHTML = p.content.length ? p.content.map(row).join('') : message('Không có đơn hàng phù hợp.');
      document.querySelectorAll('#orderFilterTabs [data-filter]').forEach((tab) => { tab.querySelector('.tab-count').textContent = p.counts[tab.dataset.filter] ?? 0; });
      document.querySelectorAll('[data-order-count]').forEach((el) => { el.textContent = Number(p.counts[el.dataset.orderCount] || 0).toLocaleString('vi-VN'); });
      document.getElementById('ordersUpdatedAt').textContent = `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`;
      renderPager(p);
    } catch (error) {
      if (mine !== requestSeq) return;
      tbody.innerHTML = message(error.message);
      document.getElementById('ordersPaginationInfo').textContent = 'Không tải được danh sách. Bấm Làm mới để thử lại.';
      document.getElementById('ordersPaginationControls').innerHTML = '';
      handleError(error);
    } finally {
      if (mine === requestSeq) { tbody.setAttribute('aria-busy', 'false'); document.getElementById('refreshOrdersBtn').disabled = false; }
    }
  }
  async function openDetail(code) {
    const mine = ++detailSeq;
    const target = document.getElementById('sellerOrderDetailBody'), actions = document.getElementById('sellerOrderDetailActions');
    target.textContent = 'Đang tải chi tiết...'; actions.innerHTML = ''; detailDialog.showModal();
    try {
      const d = await api.detail(code);
      if (mine !== detailSeq || !detailDialog.open) return;
      const s = d.summary;
      const history = d.history.map((h) => `<li><strong>${esc(label(h.newStatus))}</strong><div>${esc(when(h.createdAt))} · ${esc(h.changedByName || 'Hệ thống')}</div>${h.note ? `<p>${esc(h.note)}</p>` : ''}</li>`).join('');
      target.innerHTML = `<div class="orders-detail-summary"><strong>#${esc(s.orderCode)}</strong><span class="badge badge-${badge(s.status)}">${esc(label(s.status))}</span></div>
        <dl class="orders-detail-fields"><dt>Người mua</dt><dd>${esc(s.buyerName)}</dd><dt>Người nhận</dt><dd>${esc(s.recipientName)} · ${esc(d.recipientPhone)}</dd><dt>Địa chỉ giao hàng</dt><dd>${esc(d.shippingAddress)}</dd><dt>Thanh toán</dt><dd>${esc(({ PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', REFUNDED: 'Đã hoàn tiền', PARTIALLY_REFUNDED: 'Đã hoàn một phần' })[s.paymentStatus] || s.paymentStatus)}</dd></dl>
        <h3>Sản phẩm</h3><ul class="orders-detail-items">${s.items.map((i) => `<li><span>${esc(i.title)} · ${esc(i.quantity)} × ${money(i.unitPrice)}</span><strong>${money(i.lineTotal)}</strong></li>`).join('')}</ul>
        <p>Tạm tính: ${money(s.subtotalAmount)} · Phí giao hàng: ${money(s.shippingFee)}</p><p><strong>Tổng thanh toán: ${money(s.totalAmount)}</strong></p>
        ${d.buyerNote ? `<p>Ghi chú người mua: ${esc(d.buyerNote)}</p>` : ''}${d.cancelReason ? `<p>Lý do hủy: ${esc(d.cancelReason)}</p>` : ''}
        <h3>Lịch sử trạng thái</h3><ol class="orders-history">${history}</ol>`;
      actions.innerHTML = advanceButton(s);
    } catch (error) {
      if (mine !== detailSeq || !detailDialog.open) return;
      target.textContent = error.message; handleError(error);
    }
  }
  function openStatus(button) {
    if (state.updating) return;
    state.pending = { code: button.dataset.code, next: button.dataset.next };
    detailDialog.close();
    document.getElementById('sellerOrderStatusDescription').textContent = `Chuyển đơn #${state.pending.code} sang “${label(state.pending.next)}”?`;
    document.getElementById('sellerOrderStatusNote').value = '';
    document.getElementById('sellerOrderStatusError').textContent = '';
    submitButton.disabled = false; statusDialog.showModal();
  }
  document.getElementById('sellerOrderStatusForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.updating || !state.pending || submitButton.disabled) return;
    const { code, next } = state.pending;
    state.updating = true; submitButton.disabled = true; submitButton.textContent = 'Đang cập nhật...';
    document.getElementById('sellerOrderStatusError').textContent = '';
    statusDialog.querySelector('[data-close-dialog]').disabled = true;
    try {
      await api.updateSellerStatus(code, next, document.getElementById('sellerOrderStatusNote').value.trim());
      statusDialog.close(); notify(`Đơn #${code} đã chuyển sang “${label(next)}”.`, 'success'); await load();
    } catch (error) {
      document.getElementById('sellerOrderStatusError').textContent = error.message;
      if (error.status === 409 || error.status === 404) await load();
      else submitButton.disabled = false;
      if (error.loginRequired) handleError(error);
    } finally {
      state.updating = false; submitButton.textContent = 'Xác nhận cập nhật';
      statusDialog.querySelector('[data-close-dialog]').disabled = false;
    }
  });
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close-dialog]');
    if (close) close.closest('dialog').close();
    const button = event.target.closest('[data-act]');
    if (button?.dataset.act === 'detail') openDetail(button.dataset.code);
    if (button?.dataset.act === 'advance') openStatus(button);
    const page = event.target.closest('#ordersPaginationControls [data-page]');
    if (page && !page.disabled) { state.page = Number(page.dataset.page); load(); }
  });
  statusDialog.addEventListener('cancel', (event) => { if (state.updating) event.preventDefault(); });
  document.getElementById('orderFilterTabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-filter]');
    if (!tab) return;
    state.group = tab.dataset.filter; state.page = 0;
    document.querySelectorAll('#orderFilterTabs [data-filter]').forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-pressed', String(t === tab)); });
    load();
  });
  document.getElementById('orderGlobalSearch').addEventListener('input', (event) => {
    clearTimeout(searchTimer); const query = event.target.value.trim();
    searchTimer = setTimeout(() => { state.q = query; state.page = 0; load(); }, 250);
  });
  document.getElementById('ordersSort').addEventListener('change', (event) => { state.sort = event.target.value; state.page = 0; load(); });
  document.getElementById('refreshOrdersBtn').addEventListener('click', load);
  api.account().then((account) => {
    document.getElementById('ordersSellerName').textContent = account.fullName || 'Người bán';
    document.getElementById('ordersStoreName').textContent = account.fullName || 'Kênh người bán';
  }).catch(handleError);
  load();
})();
