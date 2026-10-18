/**
 * ComicHub / BookMooch - Quản lý đơn hàng Người bán (Seller Orders Logic)
 * Tích hợp REST API /api/seller/orders
 * Tự động Fallback sang Mock Data khi chạy profile preview hoặc offline
 */

let orderToCancelId = null;
let isLiveSellerApiConnected = false;
let currentOrderPage = 0;
let totalOrderPages = 1;
let totalOrderRecords = 0;
let cachedCsrfToken = null;

const orderStatusMeta = {
  waiting_payment: { label: 'Chờ thanh toán', badge: 'secondary', tab: 'processing' },
  waiting_confirm: { label: 'Chờ xác nhận', badge: 'warning', tab: 'processing' },
  packing: { label: 'Cần đóng gói', badge: 'warning', tab: 'processing' },
  shipping: { label: 'Đang giao hàng', badge: 'info', tab: 'shipping' },
  delivered: { label: 'Đã giao hàng', badge: 'info', tab: 'completed' },
  completed: { label: 'Hoàn thành', badge: 'success', tab: 'completed' },
  cancelled: { label: 'Đã hủy', badge: 'danger', tab: 'cancelled' },
};

document.addEventListener('DOMContentLoaded', () => {
  initSelectAllCheckboxes();
  initOrdersModule();
  loadSellerOrderStats();
  loadSellerOrders(0);
});

function initOrdersModule() {
  initOrderFilterTabs();
  initOrderLiveSearch();
  initOrderSortSelect();
}

/**
 * Lấy CSRF token cho các thao tác POST / PATCH / DELETE
 */
async function getSellerCsrf() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/seller/orders/csrf', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.Result === 'OK') {
        cachedCsrfToken = { header: data.headerName, token: data.token };
        return cachedCsrfToken;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * 1. Tải chỉ số KPI từ API
 */
async function loadSellerOrderStats() {
  try {
    const res = await fetch('/api/seller/orders/stats');
    if (!res.ok) throw new Error('API offline');
    const stats = await res.json();

    const payoutEl = document.getElementById('kpiPendingPayout');
    if (payoutEl) {
      const val = Number(stats.pendingPayout || 0);
      payoutEl.textContent = val.toLocaleString('vi-VN') + ' ₫';
    }

    const packingEl = document.getElementById('kpiPackingCount');
    if (packingEl) {
      packingEl.textContent = (stats.packingCount < 10 ? '0' : '') + stats.packingCount + ' đơn';
    }

    const shippingEl = document.getElementById('kpiShippingCount');
    if (shippingEl) {
      shippingEl.textContent = stats.shippingCount + ' kiện';
    }

    const rateEl = document.getElementById('kpiCompletionRate');
    if (rateEl) {
      rateEl.textContent = stats.completionRate || '100.0%';
    }
  } catch (e) {
    // Chế độ preview: Giữ nguyên mock
  }
}

/**
 * 2. Tải danh sách đơn hàng từ API
 */
async function loadSellerOrders(page = 0) {
  const activeTab = document.querySelector('#orderFilterTabs .tab-chip.active');
  const filter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
  const keyword = (document.getElementById('orderGlobalSearch')?.value || '').trim();
  const sort = document.getElementById('orderSortSelect')?.value || 'newest';

  try {
    const params = new URLSearchParams({
      filter: filter,
      keyword: keyword,
      sort: sort,
      page: page,
      size: 10
    });

    const res = await fetch(`/api/seller/orders?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch from live API');

    const data = await res.json();
    isLiveSellerApiConnected = true;
    currentOrderPage = data.CurrentPage;
    totalOrderPages = data.TotalPages;
    totalOrderRecords = data.TotalRecordCount;

    renderLiveOrders(data.Records || []);
    renderPagination(data.CurrentPage, data.TotalPages, data.TotalRecordCount);

    // Cập nhật tab count nếu có
    const activeTabCount = document.querySelector('#orderFilterTabs .tab-chip.active .tab-count');
    if (activeTabCount) {
      activeTabCount.textContent = totalOrderRecords;
    }
  } catch (err) {
    // Chế độ preview: Giữ nguyên các hàng tĩnh có sẵn trong HTML và dùng bộ lọc client
    isLiveSellerApiConnected = false;
    initOrderAccordion();
  }
}

function renderLiveOrders(records) {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:36px; color:var(--text-muted);">Không tìm thấy đơn hàng nào trong mục này</td></tr>`;
    return;
  }

  let html = '';
  records.forEach((order) => {
    const statusKey = (order.status || 'WAITING_CONFIRM').toLowerCase();
    const meta = orderStatusMeta[statusKey] || { label: order.status, badge: 'secondary' };
    const dateStr = order.createdAt ? formatDateTime(order.createdAt) : '—';
    const totalFormatted = Number(order.totalAmount || 0).toLocaleString('vi-VN') + ' ₫';
    const shippingFormatted = Number(order.shippingFee || 0).toLocaleString('vi-VN') + ' ₫';

    const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
    const coverUrl = firstItem?.imageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&auto=format&fit=crop';
    const title = firstItem?.productTitle || 'Sản phẩm truyện tranh';
    const qty = firstItem?.quantity || 1;
    const moreCount = order.items && order.items.length > 1 ? ` (+${order.items.length - 1} cuốn khác)` : '';

    const isCancelled = order.status === 'CANCELLED';
    const isCompleted = order.status === 'COMPLETED' || order.status === 'DELIVERED';

    // Thao tác nút bấm
    let actionButtons = '';
    if (order.status === 'WAITING_CONFIRM') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="changeOrderStatus(${order.id}, 'PACKING', 'Xác nhận đơn và chuẩn bị đóng gói', event)">
          <span class="material-symbols-outlined" style="font-size: 16px;">check</span> Xác nhận
        </button>
        <button class="btn btn-outline btn-sm btn-cancel-order" style="color: var(--danger); border-color: #fca5a5;" onclick="openCancelOrderModal('${order.id}', event, '${order.orderCode}')">
          <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span> Hủy
        </button>
      `;
    } else if (order.status === 'PACKING') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="changeOrderStatus(${order.id}, 'SHIPPING', 'Bàn giao cho đơn vị vận chuyển', event)">
          <span class="material-symbols-outlined" style="font-size: 16px;">local_shipping</span> Bàn giao
        </button>
        <button class="btn btn-outline btn-sm" onclick="printOrderLabel('${order.orderCode}', event)">
          <span class="material-symbols-outlined" style="font-size: 16px;">print</span> In
        </button>
        <button class="btn btn-outline btn-sm btn-cancel-order" style="color: var(--danger); border-color: #fca5a5;" onclick="openCancelOrderModal('${order.id}', event, '${order.orderCode}')">
          Hủy
        </button>
      `;
    } else if (order.status === 'SHIPPING') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="changeOrderStatus(${order.id}, 'COMPLETED', 'Xác nhận khách đã nhận hàng', event)">
          <span class="material-symbols-outlined" style="font-size: 16px;">done_all</span> Đã giao
        </button>
        <button class="btn btn-outline btn-sm" onclick="printOrderLabel('${order.orderCode}', event)">
          <span class="material-symbols-outlined" style="font-size: 16px;">print</span> In
        </button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-outline btn-sm" onclick="printOrderLabel('${order.orderCode}', event)">
          <span class="material-symbols-outlined" style="font-size: 16px;">print</span> In đơn
        </button>
      `;
    }

    // Row chính
    html += `
    <tr data-status="${statusKey}" data-id="${order.id}">
      <td><input type="checkbox" class="custom-checkbox order-checkbox" data-id="${order.orderCode}"></td>
      <td>
        <div class="order-id-cell">
          <div class="order-code">
            <span style="${isCancelled ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">#${escapeHtml(order.orderCode)}</span>
            <button class="copy-btn" title="Sao chép mã đơn" onclick="copyText('${order.orderCode}')">
              <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
            </button>
          </div>
          <div class="order-date">
            <span class="material-symbols-outlined" style="font-size: 14px;">schedule</span>
            ${dateStr}
          </div>
        </div>
      </td>
      <td>
        <div class="product-cell">
          <img src="${escapeHtml(coverUrl)}" alt="Bìa truyện" class="comic-thumbnail" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&auto=format&fit=crop'">
          <div class="product-meta">
            <div class="product-title">${escapeHtml(title)}</div>
            <div class="product-tags">
              <span class="tag-badge">Tình trạng: ${firstItem?.conditionPercent || 100}%</span>
              <span>x${qty} cuốn${moreCount}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Đã bọc màng co bảo vệ</div>
          </div>
        </div>
      </td>
      <td>
        <div class="customer-cell">
          <span class="customer-name">${escapeHtml(order.recipientName || 'Khách hàng')}</span>
          <span class="customer-sub">${escapeHtml(order.recipientPhone || '—')}</span>
        </div>
      </td>
      <td>
        <div class="price-cell">
          <span class="price-amount">${totalFormatted}</span>
          <span class="price-note">Ship: ${shippingFormatted}</span>
        </div>
      </td>
      <td style="text-align: center;">
        <span class="badge badge-${meta.badge}">
          <span class="badge-dot"></span>
          ${meta.label}
        </span>
      </td>
      <td style="text-align: center;">
        <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
          ${actionButtons}
        </div>
      </td>
    </tr>

    <!-- ROW ACCORDION CHI TIẾT -->
    <tr class="order-detail-row" id="detail-${order.id}">
      <td colspan="7">
        <div class="order-detail-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              <span class="material-symbols-outlined" style="color: var(--primary-container);">local_shipping</span>
              Chi tiết đơn hàng #${escapeHtml(order.orderCode)}
            </h4>
            <span class="badge badge-${meta.badge}">${meta.label}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 16px; margin-top: 14px; background: #fff; padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 0.82rem;">
            <div>
              <div style="color: var(--text-muted); font-weight: 600;">Địa chỉ giao hàng:</div>
              <div style="font-weight: 700; color: var(--text-main); margin-top: 2px;">${escapeHtml(order.recipientName)} • ${escapeHtml(order.recipientPhone)}</div>
              <div style="color: var(--text-secondary); margin-top: 2px;">${escapeHtml(order.shippingAddress || 'Chưa có địa chỉ cụ thể')}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-weight: 600;">Ghi chú người mua:</div>
              <div style="color: var(--text-secondary); margin-top: 2px; font-style: italic;">
                "${escapeHtml(order.buyerNote || 'Không có ghi chú thêm từ khách hàng')}"
              </div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-weight: 600;">Chi tiết thanh toán:</div>
              <div style="color: var(--text-secondary); margin-top: 2px;">Tiền hàng: ${Number(order.subtotalAmount || 0).toLocaleString('vi-VN')} ₫</div>
              <div style="color: var(--text-secondary);">Phí vận chuyển: ${shippingFormatted}</div>
              <div style="font-weight: 700; color: var(--primary); margin-top: 2px;">Tổng thu: ${totalFormatted} (${order.paymentStatus === 'PAID' ? 'Đã thanh toán online' : 'Thu COD'})</div>
            </div>
          </div>

          <div style="margin-top: 14px;">
            <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Danh sách truyện trong đơn:</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${(order.items || []).map(it => `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #fafafa; padding: 8px 12px; border-radius: 6px; font-size: 0.82rem;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${escapeHtml(it.imageUrl || coverUrl)}" style="width: 32px; height: 42px; object-fit: cover; border-radius: 4px;">
                    <span style="font-weight: 600;">${escapeHtml(it.productTitle)}</span>
                    <span style="color: var(--text-muted);">x${it.quantity}</span>
                  </div>
                  <span style="font-weight: 700;">${Number(it.subtotal || 0).toLocaleString('vi-VN')} ₫</span>
                </div>
              `).join('')}
            </div>
          </div>
          ${isCancelled && order.cancelReason ? `
            <div style="margin-top: 12px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 10px 14px; font-size: 0.82rem; color: #991b1b;">
              <strong>Lý do hủy đơn:</strong> ${escapeHtml(order.cancelReason)}
            </div>
          ` : ''}
        </div>
      </td>
    </tr>
    `;
  });

  tbody.innerHTML = html;
  initOrderAccordion();
}

/**
 * 3. Phân trang
 */
function renderPagination(currPage, totalPages, totalElements) {
  const infoEl = document.getElementById('ordersPaginationInfo');
  const controlsEl = document.getElementById('ordersPaginationControls');
  if (!infoEl || !controlsEl) return;

  const start = totalElements === 0 ? 0 : currPage * 10 + 1;
  const end = Math.min((currPage + 1) * 10, totalElements);
  infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> của <strong>${totalElements.toLocaleString('vi-VN')}</strong> đơn hàng`;

  let html = '';
  const hasPrev = currPage > 0;
  const hasNext = currPage < totalPages - 1;

  html += `<button class="page-btn" ${!hasPrev ? 'disabled' : ''} onclick="loadSellerOrders(${currPage - 1})"><span class="material-symbols-outlined" style="font-size: 16px;">chevron_left</span></button>`;

  for (let p = 0; p < totalPages; p++) {
    if (p === 0 || p === totalPages - 1 || (p >= currPage - 1 && p <= currPage + 1)) {
      html += `<button class="page-btn ${p === currPage ? 'active' : ''}" onclick="loadSellerOrders(${p})">${p + 1}</button>`;
    } else if (p === currPage - 2 || p === currPage + 2) {
      html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
    }
  }

  html += `<button class="page-btn" ${!hasNext ? 'disabled' : ''} onclick="loadSellerOrders(${currPage + 1})"><span class="material-symbols-outlined" style="font-size: 16px;">chevron_right</span></button>`;
  controlsEl.innerHTML = html;
}

/**
 * 4. Chuyển đổi trạng thái đơn hàng (Xác nhận, Giao hàng, Hoàn tất)
 */
async function changeOrderStatus(orderId, newStatus, defaultNote, event) {
  if (event) event.stopPropagation();

  if (isLiveSellerApiConnected) {
    try {
      const csrf = await getSellerCsrf();
      const headers = { 'Content-Type': 'application/json' };
      if (csrf) headers[csrf.header] = csrf.token;

      const res = await fetch(`/api/seller/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          status: newStatus,
          note: defaultNote
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Không thể cập nhật trạng thái đơn hàng');
      }

      showToast(`Đã chuyển trạng thái đơn hàng thành công!`, 'success');
      loadSellerOrders(currentOrderPage);
      loadSellerOrderStats();
      return;
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'danger');
      return;
    }
  }

  // Mock UI update
  showToast(`Đã cập nhật đơn #${orderId}: ${defaultNote}`, 'success');
}

/**
 * 5. Checkbox Select All
 */
function initSelectAllCheckboxes() {
  const selectAll = document.getElementById('selectAllOrders');
  const countSpan = document.getElementById('selectedCount');
  const batchBtn = document.getElementById('batchDispatchBtn');

  if (!selectAll) return;

  function updateSelectedCount() {
    const checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    const count = checkedBoxes.length;
    if (countSpan) countSpan.textContent = count;
    if (batchBtn) {
      batchBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  selectAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.order-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });
    updateSelectedCount();
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('order-checkbox')) {
      const allCbs = document.querySelectorAll('.order-checkbox');
      const allChecked = Array.from(allCbs).every(c => c.checked);
      selectAll.checked = allChecked;
      updateSelectedCount();
    }
  });
}

/**
 * 6. Filter Tab chuyển động & API trigger
 */
function initOrderFilterTabs() {
  const tabsContainer = document.getElementById('orderFilterTabs');
  if (!tabsContainer) return;

  if (typeof initSlidingTabs === 'function') {
    initSlidingTabs(tabsContainer, () => {
      loadSellerOrders(0);
    });
  } else {
    tabsContainer.querySelectorAll('.tab-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadSellerOrders(0);
      });
    });
  }
}

/**
 * 7. Live search debounce realtime
 */
function initOrderLiveSearch() {
  const searchInput = document.getElementById('orderGlobalSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', debounce(() => {
    loadSellerOrders(0);
  }, 300));
}

function initOrderSortSelect() {
  const sortSelect = document.getElementById('orderSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => loadSellerOrders(0));
  }
}

/**
 * 8. Expand / Collapse Accordion
 */
function initOrderAccordion() {
  const rows = document.querySelectorAll('#ordersTable tbody tr[data-status]:not(.order-detail-row)');
  rows.forEach(row => {
    // Tránh gán nhiều lần listener
    if (row.dataset.accordionInit === 'true') return;
    row.dataset.accordionInit = 'true';

    row.addEventListener('click', (e) => {
      if (
        e.target.closest('input[type="checkbox"]') ||
        e.target.closest('.copy-btn') ||
        e.target.closest('button')
      ) {
        return;
      }

      const id = row.getAttribute('data-id');
      const orderCodeElem = row.querySelector('.order-code span');
      const targetId = id || (orderCodeElem ? orderCodeElem.textContent.replace('#', '').trim() : null);
      if (targetId) {
        toggleOrderAccordionById(targetId, row);
      }
    });
  });
}

function toggleOrderAccordionById(orderId, parentRow) {
  const detailRow = document.getElementById(`detail-${orderId}`);
  if (!detailRow) return;

  const isOpen = detailRow.classList.contains('open');

  document.querySelectorAll('.order-detail-row.open').forEach(otherRow => {
    if (otherRow !== detailRow) {
      closeOrderAccordion(otherRow);
    }
  });

  if (!isOpen) {
    openOrderAccordion(detailRow, parentRow);
  } else {
    closeOrderAccordion(detailRow, parentRow);
  }
}

function openOrderAccordion(detailRow, parentRow) {
  const content = detailRow.querySelector('.order-detail-content');
  if (!content) return;

  detailRow.classList.add('open');
  if (parentRow) parentRow.classList.add('expanded');

  content.style.display = 'block';
  content.style.overflow = 'hidden';
  content.style.maxHeight = '0px';
  content.style.opacity = '0';
  content.style.paddingTop = '0px';
  content.style.paddingBottom = '0px';

  const targetH = content.scrollHeight + 44;
  void content.offsetHeight;

  content.style.transition = 'max-height 0.35s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease, padding 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)';

  requestAnimationFrame(() => {
    content.style.maxHeight = `${targetH}px`;
    content.style.opacity = '1';
    content.style.paddingTop = '20px';
    content.style.paddingBottom = '24px';
  });

  setTimeout(() => {
    if (detailRow.classList.contains('open')) {
      content.style.maxHeight = 'none';
      content.style.overflow = 'visible';
    }
  }, 360);
}

function closeOrderAccordion(detailRow, parentRow) {
  const content = detailRow.querySelector('.order-detail-content');
  if (!content) return;

  const currentH = content.scrollHeight;
  content.style.maxHeight = `${currentH}px`;
  content.style.overflow = 'hidden';
  void content.offsetHeight;

  content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease, padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

  requestAnimationFrame(() => {
    content.style.maxHeight = '0px';
    content.style.opacity = '0';
    content.style.paddingTop = '0px';
    content.style.paddingBottom = '0px';
  });

  if (parentRow) {
    parentRow.classList.remove('expanded');
  }

  setTimeout(() => {
    if (!detailRow.classList.contains('open')) {
      detailRow.classList.remove('open');
      content.style.maxHeight = '0px';
    }
  }, 300);
  detailRow.classList.remove('open');
}

/**
 * 9. Modal Confirm Hủy đơn hàng
 */
function openCancelOrderModal(orderId, event, orderCode) {
  if (event) event.stopPropagation();
  orderToCancelId = orderId;

  const modal = document.getElementById('cancelOrderModal');
  const idDisplay = document.getElementById('cancelModalOrderId');
  if (idDisplay) idDisplay.textContent = `#${orderCode || orderId}`;

  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }
}

function closeCancelOrderModal() {
  const modal = document.getElementById('cancelOrderModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
      orderToCancelId = null;
    }, 250);
  }
}

async function confirmCancelOrder() {
  if (!orderToCancelId) return;

  const confirmBtn = document.getElementById('confirmCancelBtn');
  if (confirmBtn) confirmBtn.classList.add('btn-loading');

  const reasonSelect = document.getElementById('cancelReasonSelect');
  const reasonText = reasonSelect ? reasonSelect.options[reasonSelect.selectedIndex].text : 'Người bán hủy đơn';

  if (isLiveSellerApiConnected) {
    try {
      const csrf = await getSellerCsrf();
      const headers = { 'Content-Type': 'application/json' };
      if (csrf) headers[csrf.header] = csrf.token;

      const res = await fetch(`/api/seller/orders/${orderToCancelId}/cancel`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ reason: reasonText })
      });

      if (confirmBtn) confirmBtn.classList.remove('btn-loading');

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Không thể hủy đơn hàng');
      }

      closeCancelOrderModal();
      showToast(`Đã hủy đơn hàng thành công và tự động hoàn trả số lượng sách về kho!`, 'success');
      loadSellerOrders(currentOrderPage);
      loadSellerOrderStats();
      return;
    } catch (err) {
      if (confirmBtn) confirmBtn.classList.remove('btn-loading');
      showToast('Lỗi: ' + err.message, 'danger');
      return;
    }
  }

  // Fallback Mock UI
  setTimeout(() => {
    if (confirmBtn) confirmBtn.classList.remove('btn-loading');
    closeCancelOrderModal();
    showToast(`Đã hủy đơn hàng thành công! (Chế độ xem trước)`, 'success');
  }, 400);
}

function printOrderLabel(orderCode, event) {
  if (event) event.stopPropagation();
  showToast(`Đang tạo và tải phiếu gửi hàng cho đơn #${orderCode}...`, 'info');
}

function formatDateTime(isoString) {
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN');
    return `${time}, ${date}`;
  } catch (_) {
    return isoString;
  }
}
