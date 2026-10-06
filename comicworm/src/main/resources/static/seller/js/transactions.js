/**
 * ComicHub / BookMooch - Lịch sử giao dịch (Transactions Logic)
 * Phục vụ riêng cho: transactions.html
 * Các hiệu ứng:
 * 1. Sắp xếp bảng: click header cột -> sắp xếp tăng/giảm có icon mũi tên xoay 180°
 * 2. Filter dropdown động & tabs: mở/đóng và lọc giao dịch không reload
 * 3. Highlight row on hover
 * 4. Date range picker calendar popup tương tác
 * 5. Export loading state: hiện spinner xoay khi xuất file, toast khi xong
 */

document.addEventListener('DOMContentLoaded', () => {
  initTransactionsModule();
});

function initTransactionsModule() {
  initTableSorting();
  initTransactionFilter();
  initDatePickerPopup();
  initExportButtonState();
}

/**
 * 1. Sắp xếp bảng: Click header cột -> Sắp xếp tăng/giảm có icon mũi tên xoay
 */
function initTableSorting() {
  const tables = document.querySelectorAll('.data-table');
  tables.forEach(table => {
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, colIdx) => {
      const title = th.textContent.trim();
      if (!title || title === 'Thao tác' || th.querySelector('input')) return;

      th.classList.add('sortable');
      if (!th.querySelector('.sort-icon')) {
        const sortIcon = document.createElement('span');
        sortIcon.className = 'material-symbols-outlined sort-icon';
        sortIcon.textContent = 'arrow_upward';
        th.appendChild(sortIcon);
      }

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
  const dataRows = rows.filter(r => !r.classList.contains('order-detail-row'));

  dataRows.sort((a, b) => {
    const aCell = a.cells[colIdx]?.textContent.trim() || '';
    const bCell = b.cells[colIdx]?.textContent.trim() || '';

    const aNum = typeof parseFormattedNumber === 'function' ? parseFormattedNumber(aCell) : 0;
    const bNum = typeof parseFormattedNumber === 'function' ? parseFormattedNumber(bCell) : 0;

    if (aNum > 0 && bNum > 0) {
      return asc ? aNum - bNum : bNum - aNum;
    }

    return asc ? aCell.localeCompare(bCell, 'vi') : bCell.localeCompare(aCell, 'vi');
  });

  dataRows.forEach(row => {
    tbody.appendChild(row);
    const code = row.querySelector('.order-code span')?.textContent.replace('#', '');
    if (code) {
      const detail = document.getElementById(`detail-${code}`);
      if (detail) tbody.appendChild(detail);
    }
  });

  if (typeof showToast === 'function') {
    showToast(`Đã sắp xếp danh sách theo: ${table.querySelectorAll('thead th')[colIdx]?.textContent.trim()}`, 'info');
  }
}

/**
 * 2. Filter dropdown động & filter tabs không reload
 */
function initTransactionFilter() {
  const searchInput = document.getElementById('txnFilterInput');
  const tabsContainer = document.querySelector('.filter-tabs-bar');
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
        r.classList.remove('row-hidden');
        r.classList.remove('row-animating-in');
        void r.offsetWidth; // Force layout
        r.classList.add('row-animating-in');
        r.style.animationDelay = `${visibleCount * 25}ms`;
        visibleCount++;
      } else {
        r.classList.remove('row-animating-in');
        r.classList.add('row-hidden');
        setTimeout(() => {
          if (r.classList.contains('row-hidden')) {
            r.style.display = 'none';
          }
        }, 180);
      }
    });
  }

  if (searchInput && typeof debounce === 'function') {
    searchInput.addEventListener('input', debounce(filterTxn, 200));
  } else if (searchInput) {
    searchInput.addEventListener('input', filterTxn);
  }

  if (tabsContainer && typeof initSlidingTabs === 'function') {
    initSlidingTabs(tabsContainer, (tab) => {
      filterTxn();
      if (typeof showToast === 'function') {
        showToast(`Lọc giao dịch: ${tab.textContent.trim()}`, 'info');
      }
    });
  } else if (tabsContainer) {
    tabsContainer.querySelectorAll('button[data-tx]').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsContainer.querySelectorAll('button[data-tx]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filterTxn();
        if (typeof showToast === 'function') {
          showToast(`Lọc giao dịch: ${tab.textContent.trim()}`, 'info');
        }
      });
    });
  }
}

/**
 * 3. Date range picker calendar popup tương tác
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

  if (typeof showToast === 'function') {
    showToast(`Đã chọn khoảng thời gian: ${title} (${rangeText})`, 'success');
  }
}

function applyCustomDateRange() {
  const popup = document.getElementById('datePickerPopup');
  if (popup) popup.classList.remove('show');
  if (typeof showToast === 'function') {
    showToast('Đã áp dụng bộ lọc ngày tùy chỉnh!', 'success');
  }
}

/**
 * 4. Export loading state: hiện spinner khi xuất file, toast khi xong
 */
function initExportButtonState() {
  const exportBtn = document.getElementById('exportTxnBtn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', () => {
    exportBtn.classList.add('btn-loading');
    exportBtn.disabled = true;

    setTimeout(() => {
      exportBtn.classList.remove('btn-loading');
      exportBtn.disabled = false;
      if (typeof showToast === 'function') {
        showToast('✅ Đã xuất dữ liệu Excel / CSV thành công! File đang được tải xuống.', 'success');
      }
    }, 1200);
  });
}
