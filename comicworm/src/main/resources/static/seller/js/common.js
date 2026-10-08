/**
 * ComicHub / BookMooch - Shared Utilities & Common Logic
 * Dùng chung cho tất cả các trang: Nạp Sidebar, Toggle Mobile Menu, Toast Notification, Format Số, Clipboard
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadSidebarComponent();
  initSidebarToggle();
  initToastSystem();
});

/* ==========================================================================
   1. SIDEBAR COMPONENT LOADER (Tách sidebar thành file riêng)
   ========================================================================== */
async function loadSidebarComponent() {
  const container = document.getElementById('sidebarContainer');
  if (!container) return;

  const activePage = container.getAttribute('data-active') || '';
  const isSpaMode = container.getAttribute('data-mode') === 'spa';

  let htmlContent = '';

  try {
    let response;
    const candidates = [
      'sidebar.html',
      '/seller/html/sidebar.html',
      '/truong/html/sidebar.html',
      '../truong/html/sidebar.html'
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          response = res;
          break;
        }
      } catch (_) {}
    }
    if (response && response.ok) {
      htmlContent = await response.text();
    } else {
      throw new Error('Fallback inline sidebar');
    }
  } catch (err) {
    // Fallback template khi fetch bị chặn hoặc duyệt offline
    htmlContent = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header">
        <a href="../../buyer/html/home.html" class="sidebar-brand" style="text-decoration:none; color:inherit;">
          <div class="brand-icon">
            <span class="material-symbols-outlined">auto_stories</span>
          </div>
          <div class="brand-info">
            <h1>ComicHub</h1>
            <span>Seller Portal</span>
          </div>
        </a>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Kênh Bán Hàng (Trường)</div>
        <a href="orders.html" class="nav-item" data-page="orders" data-view="view-orders">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">package_2</span>
            <span>Quản lý đơn hàng</span>
          </div>
          <span class="nav-badge">12</span>
        </a>
        <a href="reviews.html" class="nav-item" data-page="reviews" data-view="view-reviews">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">star_rate</span>
            <span>Quản lý đánh giá</span>
          </div>
        </a>
        <a href="wallet.html" class="nav-item" data-page="wallet" data-view="view-wallet">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">account_balance_wallet</span>
            <span>Quản lý ví</span>
          </div>
        </a>
        <a href="transactions.html" class="nav-item" data-page="transactions" data-view="view-transactions">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">receipt_long</span>
            <span>Lịch sử giao dịch</span>
          </div>
        </a>
        <a href="withdraw.html" class="nav-item" data-page="withdraw" data-view="view-withdraw">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">payments</span>
            <span>Yêu cầu rút tiền</span>
          </div>
        </a>
        <a href="revenue.html" class="nav-item" data-page="revenue" data-view="view-revenue">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">monitoring</span>
            <span>Doanh thu &amp; bán chạy</span>
          </div>
        </a>

        <div class="nav-section-title">Bài Đăng & Sản Phẩm (Trường T)</div>
        <a href="dang-ban-truyen.html" class="nav-item" data-page="dang-ban-truyen">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">add_circle</span>
            <span>Đăng bán truyện</span>
          </div>
          <span class="nav-badge" style="background: rgba(234, 88, 12, 0.25); color: #ea580c;">+Mới</span>
        </a>
        <a href="quan-ly-bai-dang.html" class="nav-item" data-page="quan-ly-bai-dang">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">format_list_bulleted</span>
            <span>Quản lý bài đăng</span>
          </div>
          <span class="nav-badge">6</span>
        </a>
        <a href="chinh-sua-bai-dang.html" class="nav-item" data-page="chinh-sua-bai-dang">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">edit_note</span>
            <span>Chỉnh sửa bài đăng</span>
          </div>
        </a>
        <a href="an-xoa-bai-dang.html" class="nav-item" data-page="an-xoa-bai-dang">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">visibility_off</span>
            <span>Ẩn / Xóa bài đăng</span>
          </div>
        </a>
        <a href="quan-ly-san-pham.html" class="nav-item" data-page="quan-ly-san-pham">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">inventory_2</span>
            <span>Quản lý sản phẩm</span>
          </div>
        </a>
        <a href="quan-ly-voucher.html" class="nav-item" data-page="quan-ly-voucher">
          <div class="nav-item-content">
            <span class="material-symbols-outlined">confirmation_number</span>
            <span>Quản lý voucher</span>
          </div>
          <span class="nav-badge">4</span>
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
        <div class="sidebar-actions" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <a href="../../buyer/html/home.html" class="sidebar-action-btn" style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; background:rgba(255,255,255,0.05);">
            <span class="material-symbols-outlined" style="font-size: 18px; color:#3b82f6;">storefront</span>
            <span style="font-size:0.85rem;">&larr; Chợ ComicHub</span>
          </a>
          <a href="../../exchange/html/dealing-room.html" class="sidebar-action-btn" style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; background:rgba(255,255,255,0.05);">
            <span class="material-symbols-outlined" style="font-size: 18px; color:#10b981;">swap_horiz</span>
            <span style="font-size:0.85rem;">Sàn Đàm Phán & Đổi</span>
          </a>
          <a href="../../index.html" class="sidebar-action-btn" style="text-decoration:none; color:#ea580c; display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; background:rgba(234,88,12,0.1); font-weight:600;">
            <span class="material-symbols-outlined" style="font-size: 18px;">hub</span>
            <span style="font-size:0.85rem;">Master Portal &rarr;</span>
          </a>
        </div>
      </div>
    </aside>`;
  }

  // Nếu đang ở trang có depth 1 (như src/ttruongmap/index.html) thay vì depth 2 (như src/truong/html/ hay src/ttruongmap/subfolder/)
  const currentPath = (window.location.pathname || '').replace(/\\/g, '/');
  const isDepth1 = currentPath.endsWith('/ttruongmap/index.html') || (currentPath.includes('/ttruongmap/') && !currentPath.match(/\/ttruongmap\/[^\/]+\//));
  if (isDepth1) {
    htmlContent = htmlContent.replace(/href="\.\.\/\.\.\//g, 'href="../');
  }

  container.outerHTML = htmlContent;

  // Đánh dấu active item tương ứng với trang
  const currentView = isSpaMode ? document.querySelector('.dashboard-view.active-view') : null;
  const navItems = document.querySelectorAll('.app-sidebar .nav-item');
  navItems.forEach(item => {
    const pageKey = item.getAttribute('data-page');
    if (currentView ? item.getAttribute('data-view') === currentView.id : pageKey === activePage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }

    // Nếu ở chế độ SPA Master Hub (index.html), chặn chuyển trang và kích hoạt view nếu có data-view
    if (isSpaMode) {
      item.addEventListener('click', (e) => {
        const viewId = item.getAttribute('data-view');
        if (viewId && typeof activateView === 'function') {
          e.preventDefault();
          activateView(viewId);
        }
      });
    }
  });

  initSidebarToggle();
}

/* ==========================================================================
   2. SIDEBAR RESPONSIVE TOGGLE (Mobile / Tablet)
   ========================================================================== */
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

/* ==========================================================================
   3. TOAST NOTIFICATION SYSTEM
   ========================================================================== */
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

/* ==========================================================================
   4. CLIPBOARD COPY UTILITY
   ========================================================================== */
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
   5. NUMBER FORMATTERS & COUNT-UP ANIMATION
   ========================================================================== */
function formatNumber(num) {
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}

function parseFormattedNumber(str) {
  if (!str) return 0;
  return parseInt(str.toString().replace(/\D/g, ''), 10) || 0;
}

function animateCountUp(element, targetValue, duration = 1200, isCurrency = true, decimals = 0, suffix = '') {
  if (!element) return;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
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

function debounce(fn, delay = 250) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/* ==========================================================================
   6. REUSABLE SLIDING TABS & ACTIVE PILL INDICATOR
   ========================================================================== */
function initSlidingTabs(container, onTabChange) {
  if (!container) return null;

  const tabs = container.querySelectorAll('.tab-chip, .demo-pill-btn, .seg-btn');
  if (!tabs.length) return null;

  let pill = container.querySelector('.tab-indicator-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'tab-indicator-pill';
    container.insertBefore(pill, container.firstChild);
  }

  function updatePill(activeTab, animate = true) {
    if (!activeTab || !container) return;
    const tabRect = activeTab.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const left = tabRect.left - containerRect.left + container.scrollLeft;
    const top = tabRect.top - containerRect.top + container.scrollTop;
    const width = tabRect.width;
    const height = tabRect.height;

    if (!animate) {
      pill.style.transition = 'none';
    } else {
      pill.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.25, 1), width 0.35s cubic-bezier(0.2, 0.9, 0.25, 1), height 0.35s cubic-bezier(0.2, 0.9, 0.25, 1)';
    }

    pill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    pill.style.width = `${width}px`;
    pill.style.height = `${height}px`;

    if (!animate) {
      requestAnimationFrame(() => {
        pill.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.25, 1), width 0.35s cubic-bezier(0.2, 0.9, 0.25, 1), height 0.35s cubic-bezier(0.2, 0.9, 0.25, 1)';
      });
    }
  }

  const initialActive = container.querySelector('.tab-chip.active, .demo-pill-btn.active, .seg-btn.active') || tabs[0];
  if (initialActive) {
    requestAnimationFrame(() => updatePill(initialActive, false));
    setTimeout(() => updatePill(initialActive, false), 60);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updatePill(tab, true);

      if (typeof onTabChange === 'function') {
        onTabChange(tab);
      }
    });
  });

  window.addEventListener('resize', () => {
    const current = container.querySelector('.tab-chip.active, .demo-pill-btn.active, .seg-btn.active');
    if (current) updatePill(current, false);
  });

  return {
    update: (tab) => updatePill(tab, true),
    refresh: () => {
      const current = container.querySelector('.tab-chip.active, .demo-pill-btn.active, .seg-btn.active');
      if (current) updatePill(current, false);
    }
  };
}


