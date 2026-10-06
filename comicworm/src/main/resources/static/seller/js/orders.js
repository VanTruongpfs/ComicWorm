/**
 * ComicHub / BookMooch - Quản lý đơn hàng (Orders Logic)
 * Phục vụ riêng cho: orders.html
 * Các hiệu ứng:
 * 1. Filter tab chuyển động: underline trượt mượt mà theo tab được chọn
 * 2. Skeleton loading khi lọc danh sách đơn hàng
 * 3. Live search debounce realtime theo mã đơn, truyện, khách hàng
 * 4. Expand/collapse accordion xem chi tiết lộ trình vận đơn ngay trong danh sách
 * 5. Modal confirm (Fade/Scale) trước khi hủy đơn
 * 6. Toast notification và cập nhật badge đơn hàng sang Đã hủy
 */

let orderToCancelId = null;

document.addEventListener('DOMContentLoaded', () => {
  initSelectAllCheckboxes();
  initOrdersModule();
});

function initOrdersModule() {
  initOrderFilterTabs();
  initOrderLiveSearch();
  initOrderAccordion();
}

/**
 * 1. Checkbox Select All
 */
function initSelectAllCheckboxes() {
  const selectAll = document.getElementById('selectAllOrders');
  const rowCheckboxes = document.querySelectorAll('.order-checkbox');
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
    rowCheckboxes.forEach(cb => {
      cb.checked = isChecked;
    });
    updateSelectedCount();
  });

  rowCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const allChecked = Array.from(rowCheckboxes).every(c => c.checked);
      selectAll.checked = allChecked;
      updateSelectedCount();
    });
  });
}

/**
 * 2. Filter Tab chuyển động (Indicator trượt) & Cascade Animation
 */
function initOrderFilterTabs() {
  const tabsContainer = document.getElementById('orderFilterTabs');
  if (!tabsContainer) return;

  if (typeof initSlidingTabs === 'function') {
    initSlidingTabs(tabsContainer, (activeTab) => {
      const filter = activeTab.getAttribute('data-filter') || 'all';
      filterOrdersSmoothly(filter);
    });
  }
}

function filterOrdersSmoothly(filter) {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-status]');
  const detailRows = tbody.querySelectorAll('.order-detail-row');

  // Đóng các chi tiết đang mở mượt mà
  detailRows.forEach(dr => {
    if (dr.classList.contains('open')) {
      closeOrderAccordion(dr);
    }
  });

  let matchCount = 0;
  rows.forEach(row => {
    const status = row.getAttribute('data-status');
    const isMatch = (filter === 'all' || status === filter);

    if (isMatch) {
      row.style.display = '';
      row.classList.remove('row-hidden');
      row.classList.remove('row-animating-in');
      void row.offsetWidth; // Force layout
      row.classList.add('row-animating-in');
      row.style.animationDelay = `${matchCount * 30}ms`;
      matchCount++;
    } else {
      row.classList.remove('row-animating-in');
      row.classList.add('row-hidden');
      setTimeout(() => {
        if (row.classList.contains('row-hidden')) {
          row.style.display = 'none';
        }
      }, 200);
    }
  });

  if (typeof showToast === 'function') {
    showToast(`Đã lọc hiển thị ${matchCount} đơn hàng`, 'info');
  }
}

/**
 * 3. Live search debounce realtime
 */
function initOrderLiveSearch() {
  const searchInput = document.getElementById('orderGlobalSearch') || document.getElementById('orderTableSearch');
  const tbody = document.querySelector('#ordersTable tbody');
  if (!searchInput || !tbody) return;

  const handleSearch = debounce(() => {
    const query = searchInput.value.trim().toLowerCase();
    const rows = tbody.querySelectorAll('tr[data-status]');
    let matches = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        row.style.display = '';
        row.classList.remove('row-hidden');
        row.classList.add('row-animating-in');
        row.style.animationDelay = `${matches * 20}ms`;
        matches++;
      } else {
        row.classList.remove('row-animating-in');
        row.classList.add('row-hidden');
        setTimeout(() => {
          if (row.classList.contains('row-hidden')) {
            row.style.display = 'none';
          }
        }, 180);
        const id = row.querySelector('.order-code span')?.textContent.replace('#', '');
        if (id) {
          const detail = document.getElementById(`detail-${id}`);
          if (detail && detail.classList.contains('open')) {
            closeOrderAccordion(detail, row);
          }
        }
      }
    });

    if (matches === 0 && query && typeof showToast === 'function') {
      showToast(`Không tìm thấy đơn hàng nào khớp với "${query}"`, 'warning');
    }
  }, 220);

  searchInput.addEventListener('input', handleSearch);
}

/**
 * 4. Expand / Collapse Accordion chi tiết đơn hàng (Tính toán ScrollHeight tự động 60fps)
 */
function initOrderAccordion() {
  const rows = document.querySelectorAll('#ordersTable tbody tr[data-status]');
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      if (
        e.target.closest('input[type="checkbox"]') ||
        e.target.closest('.copy-btn') ||
        e.target.closest('button')
      ) {
        return;
      }

      const orderCodeElem = row.querySelector('.order-code span');
      if (!orderCodeElem) return;
      const orderId = orderCodeElem.textContent.replace('#', '').trim();
      toggleOrderAccordionById(orderId, row);
    });
  });
}

function toggleOrderAccordionById(orderId, parentRow) {
  const detailRow = document.getElementById(`detail-${orderId}`);
  if (!detailRow) return;

  const isOpen = detailRow.classList.contains('open');

  // Đóng các accordion khác
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

  void content.offsetHeight; // Force reflow

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

  void content.offsetHeight; // Force reflow

  content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease, padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

  requestAnimationFrame(() => {
    content.style.maxHeight = '0px';
    content.style.opacity = '0';
    content.style.paddingTop = '0px';
    content.style.paddingBottom = '0px';
  });

  if (parentRow) {
    parentRow.classList.remove('expanded');
  } else {
    const code = detailRow.id.replace('detail-', '');
    document.querySelectorAll('#ordersTable tbody tr[data-status].expanded').forEach(r => {
      const span = r.querySelector('.order-code span');
      if (span && span.textContent.includes(code)) {
        r.classList.remove('expanded');
      }
    });
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
 * 5. Modal Confirm hủy đơn (Fade/Scale) & Toast
 */
function openCancelOrderModal(orderId, event) {
  if (event) event.stopPropagation();
  orderToCancelId = orderId;

  const modal = document.getElementById('cancelOrderModal');
  const idDisplay = document.getElementById('cancelModalOrderId');
  if (idDisplay) idDisplay.textContent = `#${orderId}`;

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

function confirmCancelOrder() {
  if (!orderToCancelId) return;

  const confirmBtn = document.getElementById('confirmCancelBtn');
  if (confirmBtn) {
    confirmBtn.classList.add('btn-loading');
  }

  setTimeout(() => {
    if (confirmBtn) confirmBtn.classList.remove('btn-loading');

    const rows = document.querySelectorAll('#ordersTable tbody tr[data-status]');
    let targetRow = null;
    rows.forEach(r => {
      const codeSpan = r.querySelector('.order-code span');
      if (codeSpan && codeSpan.textContent.includes(orderToCancelId)) {
        targetRow = r;
      }
    });

    if (targetRow) {
      targetRow.setAttribute('data-status', 'cancelled');
      const codeSpan = targetRow.querySelector('.order-code span');
      if (codeSpan) {
        codeSpan.style.textDecoration = 'line-through';
        codeSpan.style.color = 'var(--text-muted)';
      }
      const badgeCell = targetRow.querySelector('td:nth-child(6)');
      if (badgeCell) {
        badgeCell.innerHTML = `
          <span class="badge badge-danger">
            <span class="badge-dot"></span>
            Đã hủy
          </span>
        `;
      }
      const actionCell = targetRow.querySelector('td:nth-child(7)');
      if (actionCell) {
        actionCell.innerHTML = `
          <button class="btn btn-outline btn-sm" onclick="showToast('Đơn #${orderToCancelId} đã hủy bởi người bán')">
            Chi tiết
          </button>
        `;
      }
    }

    closeCancelOrderModal();
    if (typeof showToast === 'function') {
      showToast(`✅ Đã hủy đơn hàng #${orderToCancelId} thành công! Hệ thống đã kích hoạt hoàn tiền tự động cho khách.`, 'success');
    }
  }, 500);
}

