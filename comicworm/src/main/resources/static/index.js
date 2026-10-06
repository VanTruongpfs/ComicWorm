/**
 * ComicHub / BookMooch - Seller Center Interactive JS Suite
 * Cung cấp đầy đủ các hiệu ứng JavaScript theo yêu cầu:
 * 1. Quản lý đơn hàng (Sliding tab indicator, Debounce live search, Modal confirm hủy đơn, Toast, Skeleton loading, Accordion chi tiết)
 * 2. Quản lý đánh giá (Filter sao mượt mà, "Xem thêm" text clamp, Optimistic UI phản hồi, Load more, Rating bar animation)
 * 3. Quản lý ví (Count-up số dư, Tooltip giải thích tiền giam, Chart tương tác hover, Progress bar đếm ngược giải ngân)
 * 4. Lịch sử giao dịch (Sort table mũi tên xoay, Filter dropdown động, Highlight row hover, Date range picker calendar, Export spinner loading)
 * 5. Yêu cầu rút tiền (Validate realtime + Shake animation, Format số tự động có dấu chấm, Radio card selection, Stepper modal 4 bước)
 * 6. Thống kê doanh thu (Count-up KPI, Chart animate on load, Toggle thời gian 7 ngày/30 ngày/Năm, Hover tooltip, Sort top sản phẩm)
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadSidebarComponent();
  initSidebarToggle();
  initSelectAllCheckboxes();
  initToastSystem();

  // Khởi tạo các module chuyên biệt
  initOrdersModule();
  initReviewsModule();
  initWalletModule();
  initTransactionsModule();
  initWithdrawModule();
  initRevenueModule();

  // Khởi tạo SPA hash router nếu có
  initViewRouterFromHash();
});

/* ==========================================================================
   0. SHARED HELPERS & UTILITIES
   ========================================================================== */

/**
 * Hiệu ứng đếm số (Count-up) mượt mà với 60fps ease-out
 */
function animateCountUp(element, targetValue, duration = 1200, isCurrency = true, decimals = 0, suffix = '') {
  if (!element) return;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Cubic ease-out curve
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (targetValue - start) * easeOut;

    if (isCurrency) {
      element.textContent = new Intl.NumberFormat('vi-VN').format(Math.round(current)) + (suffix || ' ₫');
    } else if (decimals > 0) {
      element.textContent = current.toFixed(decimals) + (suffix || '');
    } else {
      element.textContent = Math.round(current).toLocaleString('vi-VN') + (suffix || '');
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Debounce Function để tối ưu live search realtime
 */
function debounce(fn, delay = 250) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Format số với dấu chấm phân tách hàng nghìn (Việt Nam)
 */
function formatNumber(num) {
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}

/**
 * Chuyển đổi chuỗi số có dấu chấm/phẩy thành số nguyên
 */
function parseFormattedNumber(str) {
  if (!str) return 0;
  return parseInt(str.toString().replace(/\D/g, ''), 10) || 0;
}

/**
 * Hệ thống Toast Notification
 */
function initToastSystem() {
  if (!document.getElementById('toastContainer')) {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'info';
  let iconColor = 'var(--primary-container)';
  if (type === 'success' || message.includes('thành công') || message.includes('✅')) {
    icon = 'check_circle';
    iconColor = 'var(--success)';
  } else if (type === 'danger' || message.includes('thất bại') || message.includes('lỗi') || message.includes('vượt quá')) {
    icon = 'error';
    iconColor = 'var(--danger)';
  } else if (type === 'warning' || message.includes('Lưu ý') || message.includes('Cảnh báo')) {
    icon = 'warning';
    iconColor = 'var(--warning)';
  }

  toast.innerHTML = `
    <span class="material-symbols-outlined" style="color: ${iconColor}; font-size: 20px;">${icon}</span>
    <span style="font-size: 0.88rem; font-weight: 500;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3400);
}

/**
 * Sao chép mã vào clipboard
 */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Đã sao chép mã: #${text}`, 'success');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  showToast(`Đã sao chép mã: #${text}`, 'success');
}

/* ==========================================================================
   1. SIDEBAR COMPONENT LOADER & TOGGLE
   ========================================================================== */
async function loadSidebarComponent() {
  const container = document.getElementById('sidebarContainer');
  if (!container) return;

  const activePage = container.getAttribute('data-active') || '';
  const isSpaMode = container.getAttribute('data-mode') === 'spa';

  let htmlContent = '';

  try {
    const response = await fetch('sidebar.html');
    if (response.ok) {
      htmlContent = await response.text();
    } else {
      throw new Error('Fallback inline sidebar');
    }
  } catch (err) {
    htmlContent = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-icon">
            <span class="material-symbols-outlined">auto_stories</span>
          </div>
          <div class="brand-info">
            <h1>ComicHub</h1>
            <span>Seller Portal</span>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Kênh Bán Hàng</div>
        <a href="seller/html/orders.html" class="nav-item" data-page="orders" data-view="view-orders">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">package_2</span>
            <span>Quản lý đơn hàng</span>
          </div>
          <span class="nav-badge">12</span>
        </a>
        <a href="seller/html/reviews.html" class="nav-item" data-page="reviews" data-view="view-reviews">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">star_rate</span>
            <span>Quản lý đánh giá</span>
          </div>
        </a>
        <a href="seller/html/wallet.html" class="nav-item" data-page="wallet" data-view="view-wallet">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">account_balance_wallet</span>
            <span>Quản lý ví</span>
          </div>
        </a>
        <a href="seller/html/transactions.html" class="nav-item" data-page="transactions" data-view="view-transactions">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">receipt_long</span>
            <span>Lịch sử giao dịch</span>
          </div>
        </a>
        <a href="seller/html/withdraw.html" class="nav-item" data-page="withdraw" data-view="view-withdraw">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">payments</span>
            <span>Yêu cầu rút tiền</span>
          </div>
        </a>
        <a href="seller/html/revenue.html" class="nav-item" data-page="revenue" data-view="view-revenue">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">monitoring</span>
            <span>Thống kê doanh thu</span>
          </div>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="store-status-pill">
          <div class="status-indicator">
            <span class="pulse-dot"></span>
            <span>Gian hàng: Đang mở</span>
          </div>
          <span class="material-symbols-outlined" style="font-size: 16px; color: #94a3b8;">storefront</span>
        </div>
        <div class="sidebar-actions">
          <a href="#" class="sidebar-action-btn" onclick="showToast('Mở cài đặt gian hàng')">
            <span class="material-symbols-outlined" style="font-size: 18px;">settings</span>
            <span>Cài đặt</span>
          </a>
          <a href="#" class="sidebar-action-btn logout" onclick="showToast('Đã đăng xuất an toàn', 'success')">
            <span class="material-symbols-outlined" style="font-size: 18px;">logout</span>
            <span>Đăng xuất</span>
          </a>
        </div>
      </div>
    </aside>`;
  }

  container.outerHTML = htmlContent;

  const navItems = document.querySelectorAll('.app-sidebar .nav-item');
  navItems.forEach(item => {
    const pageKey = item.getAttribute('data-page');
    if (pageKey === activePage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }

    if (isSpaMode) {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.getAttribute('data-view');
        if (viewId && typeof activateView === 'function') {
          activateView(viewId);
        }
      });
    }
  });

  initSidebarToggle();
}

function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('appSidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    };

    document.onclick = (e) => {
      if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
          sidebar.classList.remove('open');
        }
      }
    };
  }
}

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

/* ==========================================================================
   2. MODULE 1: QUẢN LÝ ĐƠN HÀNG (ORDERS)
   ========================================================================== */
let orderToCancelId = null;

function initOrdersModule() {
  initOrderFilterTabs();
  initOrderLiveSearch();
  initOrderAccordion();
  initOrdersKpiCountUp();
}

/**
 * Filter tab chuyển động: underline / highlight trượt mượt mà
 * Kèm Skeleton Loading khi chuyển tab
 */
function initOrderFilterTabs() {
  const tabsContainer = document.getElementById('orderFilterTabs');
  if (!tabsContainer) return;

  const tabs = tabsContainer.querySelectorAll('.tab-chip');
  const table = document.getElementById('ordersTable');
  if (!tabs.length || !table) return;

  // Tạo thanh trượt chỉ báo (Sliding Indicator) nếu chưa có
  let indicator = tabsContainer.querySelector('.tab-indicator-slider');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'tab-indicator-slider';
    tabsContainer.appendChild(indicator);
  }

  function updateIndicator(activeTab) {
    const tabRect = activeTab.getBoundingClientRect();
    const containerRect = tabsContainer.getBoundingClientRect();
    const left = tabRect.left - containerRect.left;
    const width = tabRect.width;

    indicator.style.left = `${left}px`;
    indicator.style.width = `${width}px`;
  }

  const currentActive = tabsContainer.querySelector('.tab-chip.active') || tabs[0];
  if (currentActive) {
    setTimeout(() => updateIndicator(currentActive), 100);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateIndicator(tab);

      const filter = tab.getAttribute('data-filter') || 'all';
      triggerOrderSkeletonLoading(filter);
    });
  });

  window.addEventListener('resize', () => {
    const active = tabsContainer.querySelector('.tab-chip.active');
    if (active) updateIndicator(active);
  });
}

/**
 * Skeleton Loading khi lọc danh sách đơn hàng
 */
function triggerOrderSkeletonLoading(filter) {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-status]');
  const detailRows = tbody.querySelectorAll('.order-detail-row');

  // Đóng các accordion đang mở
  detailRows.forEach(dr => dr.classList.remove('open'));
  rows.forEach(r => r.classList.remove('expanded'));

  // Ẩn tạm các hàng thật
  rows.forEach(r => (r.style.display = 'none'));

  // Tạo 3 hàng skeleton shimmer giả lập
  const skeletonRows = [];
  for (let i = 0; i < 3; i++) {
    const skRow = document.createElement('tr');
    skRow.className = 'skeleton-placeholder-row';
    skRow.innerHTML = `
      <td><div class="skeleton" style="width: 18px; height: 18px; border-radius: 4px;"></div></td>
      <td>
        <div class="skeleton skeleton-text" style="width: 90px; height: 16px;"></div>
        <div class="skeleton skeleton-text" style="width: 65px; height: 12px; margin-top: 4px;"></div>
      </td>
      <td>
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="skeleton skeleton-thumb" style="width: 48px; height: 64px;"></div>
          <div>
            <div class="skeleton skeleton-text" style="width: 180px; height: 16px;"></div>
            <div class="skeleton skeleton-text" style="width: 110px; height: 12px; margin-top: 6px;"></div>
          </div>
        </div>
      </td>
      <td>
        <div class="skeleton skeleton-text" style="width: 120px; height: 15px;"></div>
        <div class="skeleton skeleton-text" style="width: 80px; height: 12px; margin-top: 4px;"></div>
      </td>
      <td style="text-align: right;">
        <div class="skeleton skeleton-text" style="width: 85px; height: 18px; margin-left: auto;"></div>
      </td>
      <td style="text-align: center;">
        <div class="skeleton" style="width: 85px; height: 24px; border-radius: 9999px;"></div>
      </td>
      <td style="text-align: center;">
        <div class="skeleton" style="width: 70px; height: 30px; border-radius: 6px;"></div>
      </td>
    `;
    tbody.appendChild(skRow);
    skeletonRows.push(skRow);
  }

  // Sau 320ms, gỡ bỏ skeleton và hiển thị các hàng thực tế phù hợp
  setTimeout(() => {
    skeletonRows.forEach(sk => sk.remove());

    let matchCount = 0;
    rows.forEach(row => {
      const status = row.getAttribute('data-status');
      if (filter === 'all' || status === filter) {
        row.style.display = '';
        row.style.animation = 'fadeIn 0.25s ease';
        matchCount++;
      } else {
        row.style.display = 'none';
      }
    });

    showToast(`Đã lọc hiển thị ${matchCount} đơn hàng`, 'info');
  }, 320);
}

/**
 * Live search với debounce
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
        matches++;
      } else {
        row.style.display = 'none';
        // Đóng detail row liên quan
        const id = row.querySelector('.order-code span')?.textContent.replace('#', '');
        if (id) {
          const detail = document.getElementById(`detail-${id}`);
          if (detail) detail.classList.remove('open');
          row.classList.remove('expanded');
        }
      }
    });

    if (matches === 0 && query) {
      showToast(`Không tìm thấy đơn hàng nào khớp với "${query}"`, 'warning');
    }
  }, 250);

  searchInput.addEventListener('input', handleSearch);
}

/**
 * Expand/Collapse Accordion chi tiết đơn hàng trực tiếp trong table
 */
function initOrderAccordion() {
  const rows = document.querySelectorAll('#ordersTable tbody tr[data-status]');
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      // Tránh trigger khi click vào checkbox, nút copy hoặc các button hành động
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

  if (isOpen) {
    detailRow.classList.remove('open');
    if (parentRow) parentRow.classList.remove('expanded');
  } else {
    detailRow.classList.add('open');
    if (parentRow) parentRow.classList.add('expanded');
  }
}

/**
 * Modal confirm hủy đơn hàng (Fade/Scale)
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

    // Cập nhật trạng thái của hàng tương ứng trong bảng
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
      // Gạch ngang mã đơn
      const codeSpan = targetRow.querySelector('.order-code span');
      if (codeSpan) {
        codeSpan.style.textDecoration = 'line-through';
        codeSpan.style.color = 'var(--text-muted)';
      }
      // Đổi badge sang "Đã hủy"
      const badgeCell = targetRow.querySelector('td:nth-child(6)');
      if (badgeCell) {
        badgeCell.innerHTML = `
          <span class="badge badge-danger">
            <span class="badge-dot"></span>
            Đã hủy
          </span>
        `;
      }
      // Đổi nút hành động sang chi tiết
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
    showToast(`✅ Đã hủy đơn hàng #${orderToCancelId} thành công! Hệ thống đã kích hoạt hoàn tiền tự động cho khách.`, 'success');
  }, 500);
}


/* ==========================================================================
   3. MODULE 2: QUẢN LÝ ĐÁNH GIÁ (REVIEWS)
   ========================================================================== */
function initReviewsModule() {
  initRatingBarsAnimation();
  initReviewStarFilter();
  initCommentTextClamping();
}

/**
 * Thanh Rating progress bar chạy mượt mà khi tải trang
 */
function initRatingBarsAnimation() {
  const progressFills = document.querySelectorAll('.rating-bars .progress-fill');
  if (!progressFills.length) return;

  progressFills.forEach(fill => {
    const targetWidth = fill.style.width || '0%';
    fill.style.width = '0%';
    setTimeout(() => {
      fill.style.width = targetWidth;
    }, 200);
  });
}

/**
 * Filter đánh giá theo số sao với hiệu ứng fade in/out card
 */
function initReviewStarFilter() {
  const filterButtons = document.querySelectorAll('.filter-tabs-bar .tab-chip');
  const reviewCards = document.querySelectorAll('.review-card');

  if (!filterButtons.length || !reviewCards.length) return;

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const text = btn.textContent.toLowerCase();
      let starTarget = 0;
      if (text.includes('5 sao')) starTarget = 5;
      else if (text.includes('4 sao')) starTarget = 4;
      else if (text.includes('3 sao')) starTarget = 3;
      else if (text.includes('chưa phản hồi')) starTarget = -1;

      reviewCards.forEach(card => {
        const starIcons = card.querySelectorAll('.review-stars .material-symbols-outlined.fill');
        const starCount = starIcons.length;
        const needsReply = card.querySelector('.badge-danger');

        let match = false;
        if (starTarget === 0) {
          match = true;
        } else if (starTarget === -1) {
          match = !!needsReply;
        } else {
          match = (starCount === starTarget);
        }

        if (match) {
          card.style.display = 'block';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.98)';
          setTimeout(() => {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
          }, 10);
        } else {
          card.style.transition = 'all 0.2s ease';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.98)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 200);
        }
      });

      showToast(`Đã lọc đánh giá: ${btn.textContent.trim()}`, 'info');
    });
  });
}

/**
 * "Xem thêm / Thu gọn" cho bình luận dài với transition mượt mà
 */
function initCommentTextClamping() {
  const commentTexts = document.querySelectorAll('.review-content-text');
  commentTexts.forEach(p => {
    // Nếu comment dài trên 120 ký tự thì clamp và thêm nút xem thêm
    if (p.textContent.trim().length > 120 && !p.nextElementSibling?.classList.contains('btn-see-more')) {
      p.classList.add('clamped');
      const seeMoreBtn = document.createElement('span');
      seeMoreBtn.className = 'btn-see-more';
      seeMoreBtn.textContent = 'Xem thêm ▾';
      seeMoreBtn.onclick = () => {
        if (p.classList.contains('clamped')) {
          p.classList.remove('clamped');
          p.classList.add('expanded');
          seeMoreBtn.textContent = 'Thu gọn ▴';
        } else {
          p.classList.remove('expanded');
          p.classList.add('clamped');
          seeMoreBtn.textContent = 'Xem thêm ▾';
        }
      };
      p.parentNode.insertBefore(seeMoreBtn, p.nextSibling);
    }
  });
}

/**
 * Mở form phản hồi đánh giá
 */
function toggleReplyForm(btn) {
  const card = btn.closest('.review-card');
  if (!card) return;

  let formContainer = card.querySelector('.inline-reply-container');
  if (!formContainer) {
    formContainer = document.createElement('div');
    formContainer.className = 'inline-reply-container open';
    formContainer.innerHTML = `
      <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 6px; color: var(--text-main);">
        Viết phản hồi công khai từ Gian Hàng:
      </div>
      <textarea class="inline-reply-textarea" placeholder="Nhập lời cảm ơn hoặc giải đáp của shop dành cho độc giả..."></textarea>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.inline-reply-container').classList.remove('open')">Hủy bỏ</button>
        <button class="btn btn-primary btn-sm" onclick="submitOptimisticReply(this)">
          <span class="material-symbols-outlined" style="font-size: 16px;">send</span>
          Gửi phản hồi ngay
        </button>
      </div>
    `;
    card.appendChild(formContainer);
    formContainer.querySelector('textarea').focus();
  } else {
    formContainer.classList.toggle('open');
    if (formContainer.classList.contains('open')) {
      formContainer.querySelector('textarea').focus();
    }
  }
}

/**
 * Optimistic UI: Phản hồi xuất hiện tức thì trước khi server xác nhận
 */
function submitOptimisticReply(submitBtn) {
  const container = submitBtn.closest('.inline-reply-container');
  const card = submitBtn.closest('.review-card');
  if (!container || !card) return;

  const textarea = container.querySelector('textarea');
  const message = textarea ? textarea.value.trim() : '';

  if (!message) {
    showToast('Vui lòng nhập nội dung phản hồi!', 'warning');
    return;
  }

  // 1. Optimistic UI: Gắn ngay khung phản hồi vào giao diện lập tức
  let existingReply = card.querySelector('.shop-reply-box');
  if (!existingReply) {
    existingReply = document.createElement('div');
    existingReply.className = 'shop-reply-box';
    card.insertBefore(existingReply, container);
  }

  existingReply.innerHTML = `
    <div class="shop-reply-header">
      <div class="shop-reply-author">
        <span class="material-symbols-outlined" style="font-size: 16px;">storefront</span>
        Phản hồi từ Shop: Tiệm Truyện Vũ Trụ
      </div>
      <span class="shop-reply-time">Vừa xong (Optimistic UI)</span>
    </div>
    <p class="shop-reply-text">${escapeHtml(message)}</p>
  `;
  existingReply.style.animation = 'fadeIn 0.3s ease';

  // 2. Cập nhật nhãn trạng thái từ "Cần phản hồi" sang "Đã phản hồi"
  const dangerBadge = card.querySelector('.badge-danger');
  if (dangerBadge) {
    dangerBadge.className = 'badge badge-success';
    dangerBadge.innerHTML = '<span class="badge-dot"></span> Đã phản hồi';
  }

  // 3. Đóng form phản hồi
  container.classList.remove('open');
  textarea.value = '';

  showToast('✅ Đã gửi phản hồi thành công! Độc giả sẽ nhận được thông báo.', 'success');
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Load more đánh giá với loading spinner
 */
function loadMoreReviews(btn) {
  if (!btn) return;
  btn.classList.add('btn-loading');

  setTimeout(() => {
    btn.classList.remove('btn-loading');

    const cardContainer = btn.closest('.content-body') || document.querySelector('.content-body');
    if (!cardContainer) return;

    const newCard = document.createElement('div');
    newCard.className = 'review-card';
    newCard.style.animation = 'slideDownFade 0.3s ease';
    newCard.innerHTML = `
      <div class="review-card-header">
        <div class="reviewer-profile">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="Avatar Lan" class="reviewer-avatar">
          <div class="reviewer-info">
            <h4>
              Mai Phương Lan
              <span class="badge badge-success" style="font-size: 0.72rem; padding: 2px 7px;">Đã mua hàng</span>
            </h4>
            <div class="meta-time">5 phút trước • Đơn hàng #CH-99280</div>
          </div>
        </div>
        <button class="nav-icon-btn" style="width: 32px; height: 32px;"><span class="material-symbols-outlined">more_horiz</span></button>
      </div>
      <div class="review-stars">
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
      </div>
      <div class="review-product-attached">
        <span class="material-symbols-outlined" style="font-size: 16px;">menu_book</span>
        Chainsaw Man – Thợ Săn Quỷ Tập 11 &nbsp;|&nbsp; Phân loại: Bản Bìa Giới Hạn
      </div>
      <p class="review-content-text">
        Chất lượng truyện của tiệm chưa bao giờ làm mình thất vọng! Truyện mới tinh nguyên seal nilon, màng bọc khí rất dày. Bạn chủ shop còn tặng kèm 2 sticker Makima siêu nét. Sẽ tiếp tục theo dõi các đợt phát hành mới của tiệm.
      </p>
      <div class="shop-reply-box">
        <div class="shop-reply-header">
          <div class="shop-reply-author">
            <span class="material-symbols-outlined" style="font-size: 16px;">storefront</span>
            Phản hồi từ Shop: Tiệm Truyện Vũ Trụ
          </div>
          <span class="shop-reply-time">Vừa xong</span>
        </div>
        <p class="shop-reply-text">Tiệm cảm ơn bạn Lan nhiều nhé! Chúc bạn có trải nghiệm đọc truyện tuyệt vời nha.</p>
      </div>
    `;

    const pagination = cardContainer.querySelector('.pagination-wrapper');
    if (pagination) {
      cardContainer.insertBefore(newCard, pagination);
    } else {
      cardContainer.appendChild(newCard);
    }

    showToast('✅ Đã tải thêm đánh giá mới thành công!', 'success');
  }, 500);
}

/* ==========================================================================
   4. MODULE 3: QUẢN LÝ VÍ & SỐ DƯ GIAM (WALLET & ESCROW)
   ========================================================================== */
function initWalletModule() {
  initWalletTooltip();
  initEscrowCountdownBars();
}

/**
 * Tooltip on hover giải thích vì sao tiền bị giam và ngày giải ngân dự kiến
 */
function initWalletTooltip() {
  const escrowLabel = document.querySelector('.wallet-card.escrow .wallet-amount-label');
  if (escrowLabel) {
    escrowLabel.style.display = 'inline-flex';
    escrowLabel.style.alignItems = 'center';
    escrowLabel.style.gap = '6px';
    escrowLabel.innerHTML = `
      <span>Tổng số dư đang giam giữ</span>
      <span class="tooltip-container">
        <span class="material-symbols-outlined" style="font-size: 16px; color: #ea580c; cursor: pointer;">help</span>
        <span class="tooltip-bubble">
          <strong>Vì sao tiền bị giam?</strong><br>
          Tiền được bảo lưu trong tài khoản ký quỹ ComicHub Escrow 72h sau khi người mua nhận sách để đảm bảo quyền lợi khiếu nại cấn móp, tráo bìa. Hết thời hạn, tiền tự động mở khóa về Ví chính.
        </span>
      </span>
    `;
  }
}

/**
 * Thanh Progress bar đếm ngược ngày giải ngân cho từng khoản đang giam
 */
function initEscrowCountdownBars() {
  const rows = document.querySelectorAll('#escrowTableSection table tbody tr');
  rows.forEach((row, idx) => {
    const timeCell = row.querySelector('td:nth-child(5)');
    if (!timeCell) return;

    // Tùy theo row gán % tiến trình
    const percent = idx === 0 ? 88 : idx === 1 ? 65 : 35;
    const hoursRemain = idx === 0 ? 'Còn 4 giờ nữa' : idx === 1 ? 'Còn 1 ngày nữa' : 'Còn 2 ngày nữa';

    const existingBadge = timeCell.querySelector('.badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const countdownBox = document.createElement('div');
    countdownBox.className = 'escrow-countdown-box';
    countdownBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
        <span style="color: #ea580c; font-weight: 700;">${hoursRemain}</span>
        <span>${percent}%</span>
      </div>
      <div class="countdown-track">
        <div class="countdown-fill" style="width: 0%;" data-target="${percent}%"></div>
      </div>
    `;
    timeCell.appendChild(countdownBox);
  });

  // Kích hoạt animate chạy thanh tiến trình
  setTimeout(() => {
    document.querySelectorAll('.countdown-fill').forEach(bar => {
      bar.style.width = bar.getAttribute('data-target') || '50%';
    });
  }, 250);
}

/* ==========================================================================
   5. MODULE 4: LỊCH SỬ GIAO DỊCH (TRANSACTIONS)
   ========================================================================== */
function initTransactionsModule() {
  initTableSorting();
  initTransactionFilter();
  initDatePickerPopup();
  initExportButtonState();
}

/**
 * Sắp xếp bảng: Click header cột -> Sắp xếp tăng/giảm có icon mũi tên xoay
 */
function initTableSorting() {
  const tables = document.querySelectorAll('.data-table');
  tables.forEach(table => {
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, colIdx) => {
      // Chỉ gán sắp xếp cho các cột dữ liệu (không gán cột checkbox hoặc thao tác)
      const title = th.textContent.trim();
      if (!title || title === 'Thao tác' || th.querySelector('input')) return;

      th.classList.add('sortable');
      const sortIcon = document.createElement('span');
      sortIcon.className = 'material-symbols-outlined sort-icon';
      sortIcon.textContent = 'arrow_upward';
      th.appendChild(sortIcon);

      th.addEventListener('click', () => {
        const isAsc = th.classList.contains('sort-asc');
        ths.forEach(t => t.classList.remove('sort-asc', 'sort-desc'));

        if (isAsc) {
          th.classList.add('sort-desc');
        } else {
          th.classList.add('sort-asc');
        }

        sortTableByColumn(table, colIdx, !isAsc);
      });
    });
  });
}

function sortTableByColumn(table, colIdx, asc = true) {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  // Lọc ra các hàng dữ liệu chính (bỏ qua detail rows nếu có)
  const dataRows = rows.filter(r => !r.classList.contains('order-detail-row'));

  dataRows.sort((a, b) => {
    const aCell = a.cells[colIdx]?.textContent.trim() || '';
    const bCell = b.cells[colIdx]?.textContent.trim() || '';

    // Kiểm tra xem có phải định dạng tiền tệ hoặc số
    const aNum = parseFormattedNumber(aCell);
    const bNum = parseFormattedNumber(bCell);

    if (aNum > 0 && bNum > 0) {
      return asc ? aNum - bNum : bNum - aNum;
    }

    return asc ? aCell.localeCompare(bCell, 'vi') : bCell.localeCompare(aCell, 'vi');
  });

  dataRows.forEach(row => {
    tbody.appendChild(row);
    // Nếu có row accordion theo kèm thì chuyển theo
    const code = row.querySelector('.order-code span')?.textContent.replace('#', '');
    if (code) {
      const detail = document.getElementById(`detail-${code}`);
      if (detail) tbody.appendChild(detail);
    }
  });

  showToast(`Đã sắp xếp danh sách theo: ${table.querySelectorAll('thead th')[colIdx]?.textContent.trim()}`, 'info');
}

/**
 * Filter dropdown động & tabs không reload
 */
function initTransactionFilter() {
  const searchInput = document.getElementById('txnFilterInput');
  const tabs = document.querySelectorAll('.filter-tabs-bar button[data-tx]');
  const tbody = document.querySelector('.content-card table.data-table tbody');

  if (!tbody) return;

  function filterTxn() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const activeTab = document.querySelector('.filter-tabs-bar button[data-tx].active');
    const filterType = activeTab ? activeTab.getAttribute('data-tx') : 'all';

    const rows = tbody.querySelectorAll('tr');
    let visibleCount = 0;

    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      const badgeText = r.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';

      let matchesTab = true;
      if (filterType === 'sale') matchesTab = badgeText.includes('bán hàng');
      else if (filterType === 'withdraw') matchesTab = badgeText.includes('rút tiền');
      else if (filterType === 'escrow') matchesTab = badgeText.includes('bảo lãnh') || badgeText.includes('hoàn tiền');
      else if (filterType === 'fee') matchesTab = badgeText.includes('phí');

      const matchesSearch = !query || text.includes(query);

      if (matchesTab && matchesSearch) {
        r.style.display = '';
        visibleCount++;
      } else {
        r.style.display = 'none';
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterTxn, 200));
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterTxn();
      showToast(`Lọc giao dịch: ${tab.textContent.trim()}`, 'info');
    });
  });
}

/**
 * Date range picker calendar popup tương tác
 */
function initDatePickerPopup() {
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('datePickerPopup');
    const triggerBtn = document.getElementById('datePickerBtn');
    if (!popup || !triggerBtn) return;

    if (!popup.contains(e.target) && !triggerBtn.contains(e.target)) {
      popup.classList.remove('show');
    }
  });
}

function toggleDatePicker(e) {
  if (e) e.stopPropagation();
  const popup = document.getElementById('datePickerPopup');
  if (popup) {
    popup.classList.toggle('show');
  }
}

function selectDateRange(rangeText, title) {
  const label = document.getElementById('datePickerLabel');
  if (label) label.textContent = rangeText;

  document.querySelectorAll('.date-preset-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  const popup = document.getElementById('datePickerPopup');
  if (popup) popup.classList.remove('show');

  showToast(`Đã chọn khoảng thời gian: ${title} (${rangeText})`, 'success');
}

function applyCustomDateRange() {
  const popup = document.getElementById('datePickerPopup');
  if (popup) popup.classList.remove('show');
  showToast('Đã áp dụng bộ lọc ngày tùy chỉnh!', 'success');
}

/**
 * Export button loading state (spinner + toast)
 */
function initExportButtonState() {
  const exportBtns = [
    document.getElementById('exportTxnBtn'),
    document.getElementById('exportOrdersBtn')
  ];

  exportBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.classList.add('btn-loading');
      btn.disabled = true;

      setTimeout(() => {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        showToast('✅ Đã xuất dữ liệu Excel / CSV thành công! File đang được tải xuống.', 'success');
      }, 1200);
    });
  });
}

/* ==========================================================================
   6. MODULE 5: YÊU CẦU RÚT TIỀN (WITHDRAWAL)
   ========================================================================== */
const MAX_AVAILABLE_BALANCE = 48650000;

function initWithdrawModule() {
  const input = document.getElementById('withdrawAmountInput');
  if (!input) return;

  // Realtime validate + auto-format number khi gõ
  input.addEventListener('input', (e) => {
    let cursorPosition = input.selectionStart;
    let rawValue = parseFormattedNumber(input.value);

    // Format số có dấu chấm
    input.value = rawValue > 0 ? formatNumber(rawValue) : '';

    validateWithdrawAmount(rawValue);
  });

  // Chạy validate ban đầu
  validateWithdrawAmount(parseFormattedNumber(input.value));
}

/**
 * Validate realtime: Nếu vượt quá số dư -> Shake animation + Border đỏ + Báo lỗi ngay
 */
function validateWithdrawAmount(amount) {
  const input = document.getElementById('withdrawAmountInput');
  const errorHint = document.getElementById('withdrawErrorHint');
  const successHint = document.getElementById('withdrawSuccessHint');
  const remainText = document.getElementById('withdrawRemainText');
  const submitBtn = document.getElementById('submitWithdrawBtn');

  if (!input) return;

  if (amount > MAX_AVAILABLE_BALANCE) {
    input.classList.add('shake-error');
    if (errorHint) errorHint.style.display = 'flex';
    if (successHint) successHint.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;

    // Gỡ class shake sau khi animation kết thúc để có thể lặp lại
    setTimeout(() => {
      input.classList.remove('shake-error');
      input.style.borderColor = '#ef4444';
    }, 450);
  } else {
    input.style.borderColor = '';
    if (errorHint) errorHint.style.display = 'none';

    if (amount >= 50000) {
      if (successHint) successHint.style.display = 'flex';
      const remain = MAX_AVAILABLE_BALANCE - amount;
      if (remainText) remainText.textContent = `Số dư còn lại dự kiến: ${formatNumber(remain)} ₫`;
      if (submitBtn) submitBtn.disabled = false;
    } else {
      if (successHint) successHint.style.display = 'none';
    }
  }
}

function addAmount(amount) {
  const input = document.getElementById('withdrawAmountInput');
  if (!input) return;
  const current = parseFormattedNumber(input.value);
  const next = current + amount;
  input.value = formatNumber(next);
  validateWithdrawAmount(next);
  showToast(`Đã thêm +${formatNumber(amount)} ₫ vào số tiền rút`, 'info');
}

function setAllAmount(total) {
  const input = document.getElementById('withdrawAmountInput');
  if (!input) return;
  input.value = formatNumber(total);
  validateWithdrawAmount(total);
  showToast(`Đã chọn rút toàn bộ số dư: ${formatNumber(total)} ₫`, 'info');
}

function selectBank(card) {
  document.querySelectorAll('.bank-option-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const bankTitle = card.querySelector('.bank-text h4');
  const bankName = bankTitle ? bankTitle.childNodes[0].textContent.trim() : 'Ngân hàng đã chọn';
  showToast(`Đã chọn phương thức: ${bankName}`, 'info');
}

/**
 * Xử lý Submit rút tiền với Button Loading + Progress Stepper Modal 4 bước
 */
function handleWithdrawSubmit() {
  const input = document.getElementById('withdrawAmountInput');
  const amount = parseFormattedNumber(input ? input.value : 0);

  if (amount < 50000) {
    showToast('Số tiền rút tối thiểu là 50.000 ₫!', 'warning');
    return;
  }

  if (amount > MAX_AVAILABLE_BALANCE) {
    showToast('Số tiền rút vượt quá số dư khả dụng!', 'danger');
    return;
  }

  const submitBtn = document.getElementById('submitWithdrawBtn');
  if (submitBtn) {
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;
  }

  const selectedBank = document.querySelector('.bank-option-card.selected .bank-text h4');
  const bankName = selectedBank ? selectedBank.childNodes[0].textContent.trim() : 'Vietcombank';

  // Khởi chạy Stepper Modal sau 400ms loading button
  setTimeout(() => {
    if (submitBtn) {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
    openWithdrawStepperModal(amount, bankName);
  }, 400);
}

function openWithdrawStepperModal(amount, bankName) {
  const modal = document.getElementById('withdrawStepperModal');
  if (!modal) {
    showToast(`✅ Lệnh rút ${formatNumber(amount)} ₫ về ${bankName} thành công qua Napas 247!`, 'success');
    return;
  }

  const amountDisplay = document.getElementById('modalWithdrawAmount');
  const bankDisplay = document.getElementById('modalWithdrawBank');
  const lineFill = document.getElementById('stepperLineFill');
  const statusText = document.getElementById('stepperStatusText');
  const completeBtn = document.getElementById('stepperCompleteBtn');

  if (amountDisplay) amountDisplay.textContent = `${formatNumber(amount)} ₫`;
  if (bankDisplay) bankDisplay.textContent = `Về tài khoản: ${bankName}`;
  if (completeBtn) completeBtn.style.display = 'none';

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);

  // RESET CÁC BƯỚC STEPPER
  const steps = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
    document.getElementById('step4')
  ];

  steps.forEach(s => {
    if (s) {
      s.classList.remove('active', 'completed');
    }
  });

  // BƯỚC 1: KHỞI TẠO (0s)
  if (steps[0]) steps[0].classList.add('active');
  if (lineFill) lineFill.style.width = '0%';
  if (statusText) statusText.innerHTML = '🔄 <strong>Bước 1/4:</strong> Đang khởi tạo mã giao dịch bảo mật và xác thực OTP...';

  // BƯỚC 2: DUYỆT SÀN (1.0s)
  setTimeout(() => {
    if (steps[0]) { steps[0].classList.remove('active'); steps[0].classList.add('completed'); }
    if (steps[1]) steps[1].classList.add('active');
    if (lineFill) lineFill.style.width = '33%';
    if (statusText) statusText.innerHTML = '🛡️ <strong>Bước 2/4:</strong> Hệ thống kiểm tra số dư và tự động duyệt lệnh...';
  }, 1000);

  // BƯỚC 3: NAPAS 247 (2.0s)
  setTimeout(() => {
    if (steps[1]) { steps[1].classList.remove('active'); steps[1].classList.add('completed'); }
    if (steps[2]) steps[2].classList.add('active');
    if (lineFill) lineFill.style.width = '66%';
    if (statusText) statusText.innerHTML = '⚡ <strong>Bước 3/4:</strong> Đang gửi lệnh chuyển tiền tức thì qua cổng Napas 24/7...';
  }, 2000);

  // BƯỚC 4: THÀNH CÔNG (3.0s)
  setTimeout(() => {
    steps.forEach(s => { if (s) { s.classList.remove('active'); s.classList.add('completed'); } });
    if (lineFill) lineFill.style.width = '100%';
    if (statusText) statusText.innerHTML = '🎉 <strong style="color: var(--success);">Hoàn tất!</strong> Tiền đã chuyển thẳng vào tài khoản ngân hàng của bạn.';
    if (completeBtn) completeBtn.style.display = 'inline-flex';

    showToast(`✅ Đã giải ngân thành công ${formatNumber(amount)} ₫ vào tài khoản ${bankName}!`, 'success');
  }, 3000);
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdrawStepperModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 250);
  }
}

/* ==========================================================================
   7. MODULE 6: THỐNG KÊ DOANH THU (REVENUE)
   ========================================================================== */
function initRevenueModule() {
  initRevenueChartAnimation();
  initChartHoverTooltips();
}

/**
 * Chart Animate on load (cột mọc từ dưới lên, đường cong vẽ từ trái sang phải)
 */
function initRevenueChartAnimation() {
  const chartWrapper = document.getElementById('chartWrapper');
  if (!chartWrapper) return;

  const bars = chartWrapper.querySelectorAll('rect[fill*="barGrad"]');
  bars.forEach((bar, index) => {
    const targetH = parseFloat(bar.getAttribute('height')) || 100;
    const targetY = parseFloat(bar.getAttribute('y')) || 160;

    // Ban đầu thu về y đáy và chiều cao = 0
    const baseY = targetY + targetH;
    bar.setAttribute('height', '0');
    bar.setAttribute('y', baseY);
    bar.style.transition = `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.06}s`;

    setTimeout(() => {
      bar.setAttribute('height', targetH);
      bar.setAttribute('y', targetY);
    }, 150);
  });

  const splinePath = chartWrapper.querySelector('path[stroke="#0b1c30"]');
  if (splinePath) {
    const length = splinePath.getTotalLength ? splinePath.getTotalLength() : 800;
    splinePath.style.strokeDasharray = length;
    splinePath.style.strokeDashoffset = length;
    splinePath.style.transition = 'stroke-dashoffset 1.4s ease-out';

    setTimeout(() => {
      splinePath.style.strokeDashoffset = '0';
    }, 200);
  }
}

/**
 * Chuyển đổi bộ lọc thời gian biểu đồ (7 ngày / 30 ngày / Năm) với transition mượt mà
 */
const chartDataPresets = {
  daily: {
    title: 'Theo ngày (30 ngày vừa qua)',
    bars: [100, 120, 140, 80, 150, 200, 170, 190],
    curve: 'M 97,175 C 145,150 160,110 197,125 C 240,140 260,95 297,85 C 340,75 360,170 397,185 C 440,200 460,130 497,95 C 540,60 560,140 597,55 C 640,30 660,130 697,60 C 740,20 760,120 797,75',
    points: [
      { cx: 97, cy: 175, date: '01/10', rev: '3.2Tr', orders: '18 đơn' },
      { cx: 197, cy: 125, date: '05/10', rev: '4.5Tr', orders: '26 đơn' },
      { cx: 297, cy: 85, date: '10/10', rev: '5.8Tr', orders: '34 đơn' },
      { cx: 397, cy: 185, date: '15/10', rev: '2.6Tr', orders: '14 đơn' },
      { cx: 497, cy: 95, date: '20/10', rev: '5.2Tr', orders: '30 đơn' },
      { cx: 597, cy: 55, date: '25/10 (Hội sách)', rev: '7.3Tr - Đỉnh điểm', orders: '48 đơn' },
      { cx: 697, cy: 60, date: '28/10', rev: '6.1Tr', orders: '38 đơn' },
      { cx: 797, cy: 75, date: '30/10', rev: '6.8Tr', orders: '42 đơn' }
    ]
  },
  weekly: {
    title: 'Theo tuần (4 tuần gần nhất)',
    bars: [140, 180, 220, 160, 190, 230, 210, 240],
    curve: 'M 97,140 C 150,110 200,90 297,70 C 350,120 400,100 497,60 C 550,40 600,80 697,50 C 750,30 780,45 797,40',
    points: [
      { cx: 97, cy: 140, date: 'Tuần 1', rev: '28.4Tr', orders: '152 đơn' },
      { cx: 197, cy: 105, date: 'Tuần 2', rev: '34.8Tr', orders: '190 đơn' },
      { cx: 297, cy: 70, date: 'Tuần 3', rev: '42.1Tr', orders: '235 đơn' },
      { cx: 397, cy: 90, date: 'Tuần 4', rev: '38.6Tr', orders: '204 đơn' },
      { cx: 497, cy: 60, date: 'Tuần 5', rev: '46.0Tr', orders: '260 đơn' },
      { cx: 597, cy: 45, date: 'Tuần 6', rev: '52.3Tr - Kỷ lục', orders: '310 đơn' },
      { cx: 697, cy: 50, date: 'Tuần 7', rev: '48.9Tr', orders: '280 đơn' },
      { cx: 797, cy: 40, date: 'Tuần 8', rev: '54.2Tr', orders: '325 đơn' }
    ]
  }
};

function toggleChartMode(btn, mode) {
  const container = btn.closest('.filter-tabs-bar');
  if (container) {
    container.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');

  const chartWrapper = document.getElementById('chartWrapper');
  if (!chartWrapper) return;

  const data = chartDataPresets[mode] || chartDataPresets.daily;

  // Cập nhật đường cong spline
  const path = chartWrapper.querySelector('path[stroke="#0b1c30"]');
  if (path) {
    path.style.transition = 'all 0.5s ease-in-out';
    path.setAttribute('d', data.curve);
  }

  // Cập nhật các cột bar
  const bars = chartWrapper.querySelectorAll('rect[fill*="barGrad"]');
  bars.forEach((bar, idx) => {
    const h = data.bars[idx] || 120;
    const y = 260 - h;
    bar.style.transition = 'all 0.4s ease-in-out';
    bar.setAttribute('height', h);
    bar.setAttribute('y', y);
  });

  // Cập nhật các điểm chart points
  const points = chartWrapper.querySelectorAll('.chart-point');
  points.forEach((point, idx) => {
    const pData = data.points[idx];
    if (pData) {
      point.setAttribute('cx', pData.cx);
      point.setAttribute('cy', pData.cy);
      point.setAttribute('data-date', pData.date);
      point.setAttribute('data-rev', pData.rev);
      point.setAttribute('data-orders', pData.orders);
    }
  });

  showToast(`Chế độ xem biểu đồ: ${data.title}`, 'info');
}

/**
 * Hover Tooltip trên điểm biểu đồ
 */
function initChartHoverTooltips() {
  const points = document.querySelectorAll('.chart-point');
  const tooltip = document.getElementById('chartTooltip');

  if (!points.length || !tooltip) return;

  points.forEach(point => {
    point.addEventListener('mouseenter', (e) => {
      const date = point.getAttribute('data-date') || '';
      const rev = point.getAttribute('data-rev') || '';
      const orders = point.getAttribute('data-orders') || '';

      tooltip.innerHTML = `
        <div style="font-weight:700; color:#fb923c; margin-bottom:2px;">${date}</div>
        <div>Doanh thu: <strong>${rev}</strong></div>
        <div style="color:#94a3b8; font-size:0.75rem;">Sản lượng: ${orders}</div>
      `;

      const rect = point.getBoundingClientRect();
      const parentWrapper = point.closest('.chart-wrapper');
      if (!parentWrapper) return;
      const parentRect = parentWrapper.getBoundingClientRect();

      const left = rect.left - parentRect.left + rect.width / 2;
      const top = rect.top - parentRect.top - 10;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.classList.add('show');
    });

    point.addEventListener('mouseleave', () => {
      tooltip.classList.remove('show');
    });
  });
}

/* ==========================================================================
   8. MASTER SPA VIEW ROUTER (Dành cho index.html chuyển tab)
   ========================================================================== */
function activateView(viewId, pillBtn) {
  document.querySelectorAll('.dashboard-view').forEach(v => {
    v.classList.remove('active-view');
  });

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active-view');
  }

  document.querySelectorAll('.app-sidebar .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (pillBtn) {
    document.querySelectorAll('.demo-pill-btn').forEach(b => b.classList.remove('active'));
    pillBtn.classList.add('active');
  } else {
    document.querySelectorAll('.demo-pill-btn').forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(viewId)) {
        document.querySelectorAll('.demo-pill-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      }
    });
  }

  window.location.hash = viewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Re-trigger animate tương ứng với view vừa mở
  if (viewId === 'view-revenue') {
    initRevenueKpiCountUp();
    initRevenueChartAnimation();
  } else if (viewId === 'view-wallet') {
    initWalletModule();
  } else if (viewId === 'view-reviews') {
    initRatingBarsAnimation();
  }
}

function initViewRouterFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) {
    activateView(hash);
  }
}
