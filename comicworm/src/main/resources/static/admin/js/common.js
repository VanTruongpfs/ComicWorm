/**
 * BookMooch Admin Console - Shared Utilities & Common Logic
 * Dùng chung cho tất cả các trang Quản trị (Admin/Manager):
 * Nạp Sidebar, Toggle Mobile Menu, Toast Notification, Format Số, Clipboard, Sliding Tabs.
 */

document.addEventListener('DOMContentLoaded', async () => {
    await loadSidebarComponent();
    initSidebarToggle();
    initToastSystem();
    guardAdminSession();
});

/* ==========================================================================
   0. GUARD PHIÊN ĐĂNG NHẬP (mock) - nếu chưa đăng nhập thì đá về login.html
   ========================================================================== */
function guardAdminSession() {
    const isLoginPage = document.body.hasAttribute('data-public-page');
    if (isLoginPage) return;
    const session = localStorage.getItem('bm_admin_session');
    if (!session) {
        // Không chặn cứng khi xem demo trực tiếp file, chỉ cảnh báo nhẹ trên UI nếu có khung banner.
        const banner = document.getElementById('sessionWarnBanner');
        if (banner) banner.style.display = 'flex';
    }
}

/* ==========================================================================
   1. SIDEBAR COMPONENT LOADER (Tách sidebar thành file riêng)
   ========================================================================== */
async function loadSidebarComponent() {
    const container = document.getElementById('sidebarContainer');
    if (!container) return;

    const activePage = container.getAttribute('data-active') || '';
    let htmlContent = '';

    try {
        const response = await fetch('sidebar.html');
        if (response.ok) {
            htmlContent = await response.text();
        } else {
            throw new Error('Fallback inline sidebar');
        }
    } catch (err) {
        htmlContent = getFallbackSidebarTemplate();
    }

    container.outerHTML = htmlContent;

    const navItems = document.querySelectorAll('.app-sidebar .nav-item');
    navItems.forEach((item) => {
        const pageKey = item.getAttribute('data-page');
        item.classList.toggle('active', pageKey === activePage);
    });

    const adminName = localStorage.getItem('bm_admin_name') || 'Quản trị viên';
    const adminRole = localStorage.getItem('bm_admin_role') || 'Super Admin';
    const nameEl = document.querySelector('[data-admin-name]');
    const roleEl = document.querySelector('[data-admin-role]');
    if (nameEl) nameEl.textContent = adminName;
    if (roleEl) roleEl.textContent = adminRole;

    initSidebarToggle();
}

function getFallbackSidebarTemplate() {
    return `
  <aside class="app-sidebar" id="appSidebar">
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <div class="brand-icon"><span class="material-symbols-outlined">shield_person</span></div>
        <div class="brand-info"><h1>BookMooch</h1><span>Admin Console</span></div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-title">Tổng quan</div>
      <a href="dashboard.html" class="nav-item" data-page="dashboard">
        <div class="nav-item-content"><span class="material-symbols-outlined">space_dashboard</span><span>Admin Dashboard</span></div>
      </a>
      <div class="nav-section-title">Quản trị hệ thống</div>
      <a href="accounts.html" class="nav-item" data-page="accounts">
        <div class="nav-item-content"><span class="material-symbols-outlined">manage_accounts</span><span>Quản lý tài khoản</span></div>
      </a>
      <a href="staff.html" class="nav-item" data-page="staff">
        <div class="nav-item-content"><span class="material-symbols-outlined">badge</span><span>Nhân sự &amp; phân quyền</span></div>
      </a>
      <a href="fees.html" class="nav-item" data-page="fees">
        <div class="nav-item-content"><span class="material-symbols-outlined">request_quote</span><span>Biểu phí &amp; chính sách</span></div>
      </a>
      <a href="vouchers.html" class="nav-item" data-page="vouchers">
        <div class="nav-item-content"><span class="material-symbols-outlined">local_activity</span><span>Voucher toàn hệ thống</span></div>
      </a>
      <div class="nav-section-title">Tài chính &amp; vận hành</div>
      <a href="finance.html" class="nav-item" data-page="finance">
        <div class="nav-item-content"><span class="material-symbols-outlined">finance</span><span>Doanh thu &amp; dòng tiền</span></div>
      </a>
      <a href="orders.html" class="nav-item" data-page="orders">
        <div class="nav-item-content"><span class="material-symbols-outlined">package_2</span><span>Quản lý đơn hàng</span></div>
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="store-status-pill">
        <div class="status-indicator"><span class="pulse-dot"></span><span>Hệ thống: Hoạt động ổn định</span></div>
        <span class="material-symbols-outlined" style="font-size: 16px; color: #94a3b8;">dns</span>
      </div>
      <div class="sidebar-actions">
        <a href="#" class="sidebar-action-btn" onclick="showToast('Mở cài đặt tài khoản quản trị')">
          <span class="material-symbols-outlined" style="font-size: 18px;">settings</span><span>Cài đặt</span>
        </a>
        <a href="login.html" class="sidebar-action-btn logout" onclick="localStorage.removeItem('bm_admin_session')">
          <span class="material-symbols-outlined" style="font-size: 18px;">logout</span><span>Đăng xuất</span>
        </a>
      </div>
    </div>
  </aside>`;
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
    } else if (type === 'danger' || message.includes('thất bại') || message.includes('lỗi') || message.includes('từ chối')) {
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
        setTimeout(() => toast.parentNode && toast.parentNode.removeChild(toast), 300);
    }, 3400);
}

/* ==========================================================================
   4. CLIPBOARD COPY UTILITY
   ========================================================================== */
function copyText(text) {
    const done = () => showToast(`Đã sao chép: ${text}`, 'success');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text));
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
    showToast(`Đã sao chép: ${text}`, 'success');
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
        if (progress < 1) requestAnimationFrame(update);
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
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
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
        pill.style.transition = animate
            ? 'transform 0.35s cubic-bezier(0.2, 0.9, 0.25, 1), width 0.35s cubic-bezier(0.2, 0.9, 0.25, 1), height 0.35s cubic-bezier(0.2, 0.9, 0.25, 1)'
            : 'none';
        pill.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        pill.style.width = `${tabRect.width}px`;
        pill.style.height = `${tabRect.height}px`;
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

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            updatePill(tab, true);
            if (typeof onTabChange === 'function') onTabChange(tab);
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
        },
    };
}

/* ==========================================================================
   7. MODAL HELPERS DÙNG CHUNG
   ========================================================================== */
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}