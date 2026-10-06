/**
 * ComicHub / BookMooch - Master Dashboard Hub SPA Logic
 * Phục vụ riêng cho: index.html (Master Hub)
 * Tích hợp điều hướng view SPA không reload, đồng bộ menu & thanh chuyển nhanh demo
 */

document.addEventListener('DOMContentLoaded', () => {
  initMasterDashboard();
  initViewRouterFromHash();
});

function initMasterDashboard() {
  if (typeof initOrdersModule === 'function') initOrdersModule();
  if (typeof initSelectAllCheckboxes === 'function') initSelectAllCheckboxes();
  if (typeof initReviewsModule === 'function') initReviewsModule();
  if (typeof initWalletModule === 'function') initWalletModule();
  if (typeof initTransactionsModule === 'function') initTransactionsModule();
  if (typeof initWithdrawModule === 'function') initWithdrawModule();
  if (typeof initRevenueModule === 'function') initRevenueModule();
}

let isSwitchingView = false;

/**
 * SPA View Switcher với hiệu ứng Cross-fade mượt mà, không giật màn hình
 */
function activateView(viewId, pillBtn) {
  const target = document.getElementById(viewId);
  if (!target) return;

  const currentActive = document.querySelector('.dashboard-view.active-view');
  if (currentActive === target) return;

  if (isSwitchingView) return;
  isSwitchingView = true;

  // Cập nhật navigation sidebar
  document.querySelectorAll('.app-sidebar .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Cập nhật demo pills
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
  if (window.scrollY > 80) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Cross-fade chuyển đổi mượt mà giữa 2 view
  if (currentActive) {
    currentActive.classList.add('view-exit');
    setTimeout(() => {
      currentActive.classList.remove('active-view', 'view-exit');
      currentActive.style.display = 'none';

      target.style.display = 'block';
      target.classList.add('active-view', 'view-enter');
      triggerViewSpecificAnimations(viewId);

      setTimeout(() => {
        target.classList.remove('view-enter');
        isSwitchingView = false;
      }, 320);
    }, 120);
  } else {
    target.style.display = 'block';
    target.classList.add('active-view');
    triggerViewSpecificAnimations(viewId);
    isSwitchingView = false;
  }
}

function triggerViewSpecificAnimations(viewId) {
  // Re-trigger animate tương ứng với view vừa mở
  if (viewId === 'view-revenue' && typeof initRevenueChartAnimation === 'function') {
    initRevenueChartAnimation();
  } else if (viewId === 'view-wallet' && typeof initWalletModule === 'function') {
    initWalletModule();
  } else if (viewId === 'view-reviews' && typeof initRatingBarsAnimation === 'function') {
    initRatingBarsAnimation();
  } else if (viewId === 'view-orders' && typeof initOrderFilterTabs === 'function') {
    initOrderFilterTabs();
  }

  // Cập nhật lại các sliding pill tabs trong view vừa mở
  const target = document.getElementById(viewId);
  if (target) {
    target.querySelectorAll('.filter-tabs-bar').forEach(bar => {
      const activeTab = bar.querySelector('.tab-chip.active');
      const pill = bar.querySelector('.tab-indicator-pill');
      if (activeTab && pill) {
        const tabRect = activeTab.getBoundingClientRect();
        const barRect = bar.getBoundingClientRect();
        pill.style.transform = `translate3d(${tabRect.left - barRect.left + bar.scrollLeft}px, ${tabRect.top - barRect.top + bar.scrollTop}px, 0)`;
        pill.style.width = `${tabRect.width}px`;
        pill.style.height = `${tabRect.height}px`;
      }
    });
  }
}

function initViewRouterFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) {
    activateView(hash);
  }
}
