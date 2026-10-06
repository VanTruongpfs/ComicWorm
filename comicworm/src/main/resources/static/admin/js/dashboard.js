/**
 * BOOKMOOCH ADMIN CONSOLE - DASHBOARD JAVASCRIPT
 * Xử lý tương tác: Animate KPI, Biểu đồ SVG tương tác đa mốc thời gian,
 * Bộ lọc Audit Trail, Command Palette (Ctrl+K), Dropdown Thông báo.
 */

document.addEventListener('DOMContentLoaded', () => {
  initGreeting();
  initKpiCounters('today');
  initTimeFilter();
  initMetricToggle();
  initInteractiveSvgChart();
  initAuditTrail();
  initCommandPalette();
  initNotificationDropdown();
  initExportButtons();
});

/* --------------------------------------------------------------------------
   1. GREETING & ADMIN PROFILE
   -------------------------------------------------------------------------- */
function initGreeting() {
  const name = localStorage.getItem('bm_admin_name') || 'Admin';
  const greetEl = document.getElementById('greetName');
  if (greetEl) {
    const lastName = name.trim().split(' ').slice(-1)[0] || 'Admin';
    greetEl.textContent = lastName;
  }
}

/* --------------------------------------------------------------------------
   2. KPI COUNTERS & TIME RANGE DATA
   -------------------------------------------------------------------------- */
const kpiDatasets = {
  today: {
    revenue: 86400000,
    orders: 2318,
    users: 128940,
    commission: 6912000,
    revTrend: '+12.6% vs hôm qua',
    ordTrend: '+8.4% • 96.2% hoàn thành',
    userTrend: '+412 hôm nay',
    commTrend: 'Hoa hồng bình quân 8.0%'
  },
  '7d': {
    revenue: 549640000,
    orders: 15420,
    users: 128940,
    commission: 43971200,
    revTrend: '+15.2% vs 7 ngày trước',
    ordTrend: '+9.1% • 96.8% hoàn thành',
    userTrend: '+2.850 tuần này',
    commTrend: 'Hoa hồng bình quân 8.0%'
  },
  '30d': {
    revenue: 2356000000,
    orders: 68450,
    users: 128940,
    commission: 188480000,
    revTrend: '+18.4% vs tháng trước',
    ordTrend: '+14.2% • 97.1% hoàn thành',
    userTrend: '+11.200 tháng này',
    commTrend: 'Hoa hồng bình quân 8.0%'
  },
  month: {
    revenue: 1845000000,
    orders: 52100,
    users: 128940,
    commission: 147600000,
    revTrend: '+10.5% MTD',
    ordTrend: '+7.8% • 96.5% hoàn thành',
    userTrend: '+8.900 MTD',
    commTrend: 'Hoa hồng bình quân 8.0%'
  }
};

let currentRange = 'today';
let currentMetric = 'revenue'; // 'revenue' or 'orders'

function initKpiCounters(rangeKey = 'today') {
  const data = kpiDatasets[rangeKey] || kpiDatasets.today;
  const revEl = document.getElementById('kpiRevenue');
  const ordEl = document.getElementById('kpiOrders');
  const userEl = document.getElementById('kpiUsers');
  const commEl = document.getElementById('kpiCommission');

  if (revEl && typeof animateCountUp === 'function') animateCountUp(revEl, data.revenue, 900, true);
  if (ordEl && typeof animateCountUp === 'function') animateCountUp(ordEl, data.orders, 800, false, 0, ' đơn');
  if (userEl && typeof animateCountUp === 'function') animateCountUp(userEl, data.users, 1000, false);
  if (commEl && typeof animateCountUp === 'function') animateCountUp(commEl, data.commission, 900, true);

  const revTrendEl = document.getElementById('kpiRevenueTrend');
  const ordTrendEl = document.getElementById('kpiOrdersTrend');
  const userTrendEl = document.getElementById('kpiUsersTrend');
  const commTrendEl = document.getElementById('kpiCommTrend');

  if (revTrendEl) revTrendEl.innerHTML = `<span class="material-symbols-outlined">trending_up</span> ${data.revTrend}`;
  if (ordTrendEl) ordTrendEl.innerHTML = `<span class="material-symbols-outlined">trending_up</span> ${data.ordTrend}`;
  if (userTrendEl) userTrendEl.innerHTML = `<span class="material-symbols-outlined">person_add</span> ${data.userTrend}`;
  if (commTrendEl) commTrendEl.innerHTML = `<span class="material-symbols-outlined">percent</span> ${data.commTrend}`;
}

function initTimeFilter() {
  const container = document.getElementById('timeFilterGroup');
  if (!container) return;

  const buttons = container.querySelectorAll('.filter-seg-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.getAttribute('data-range') || 'today';
      initKpiCounters(currentRange);
      renderInteractiveSvgChart();
      if (typeof showToast === 'function') {
        showToast(`Đã lọc dữ liệu theo: ${btn.textContent.trim()}`);
      }
    });
  });
}

function initMetricToggle() {
  const toggle = document.getElementById('chartMetricToggle');
  if (!toggle) return;

  const buttons = toggle.querySelectorAll('.chart-toggle-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMetric = btn.getAttribute('data-metric') || 'revenue';
      renderInteractiveSvgChart();
    });
  });
}

/* --------------------------------------------------------------------------
   3. INTERACTIVE SVG AREA CHART
   -------------------------------------------------------------------------- */
const chartDataByRange = {
  today: {
    revenue: [
      { label: '00:00', val: 1200000, display: '1.2M ₫', note: '+2.1%' },
      { label: '04:00', val: 800000, display: '800k ₫', note: '-1.4%' },
      { label: '08:00', val: 9500000, display: '9.5M ₫', note: '+14.2%' },
      { label: '11:00', val: 24200000, display: '24.2M ₫', note: '+22.5%' },
      { label: '14:00', val: 41800000, display: '41.8M ₫', note: '+18.0%' },
      { label: '17:00', val: 62500000, display: '62.5M ₫', note: '+15.4%' },
      { label: '20:00', val: 86400000, display: '86.4M ₫', note: '+12.6%' }
    ],
    orders: [
      { label: '00:00', val: 32, display: '32 đơn', note: 'Ban đêm' },
      { label: '04:00', val: 18, display: '18 đơn', note: 'Thấp điểm' },
      { label: '08:00', val: 280, display: '280 đơn', note: 'Bắt đầu tăng' },
      { label: '11:00', val: 710, display: '710 đơn', note: 'Cao điểm trưa' },
      { label: '14:00', val: 1190, display: '1.190 đơn', note: 'Ổn định' },
      { label: '17:00', val: 1680, display: '1.680 đơn', note: 'Tăng mạnh' },
      { label: '20:00', val: 2318, display: '2.318 đơn', note: 'Đỉnh điểm tối' }
    ]
  },
  '7d': {
    revenue: [
      { label: 'T2 (18/9)', val: 68500000, display: '68.5M ₫', note: '+5.2%' },
      { label: 'T3 (19/9)', val: 72400000, display: '72.4M ₫', note: '+5.7%' },
      { label: 'T4 (20/9)', val: 76800000, display: '76.8M ₫', note: '+6.1%' },
      { label: 'T5 (21/9)', val: 74200000, display: '74.2M ₫', note: '-3.4%' },
      { label: 'T6 (22/9)', val: 82100000, display: '82.1M ₫', note: '+10.6%' },
      { label: 'T7 (23/9)', val: 94800000, display: '94.8M ₫', note: 'Đỉnh tuần (+15.4%)' },
      { label: 'CN (24/9)', val: 86400000, display: '86.4M ₫', note: '+12.6%' }
    ],
    orders: [
      { label: 'T2 (18/9)', val: 1890, display: '1.890 đơn', note: 'Đầu tuần' },
      { label: 'T3 (19/9)', val: 1980, display: '1.980 đơn', note: '+4.7%' },
      { label: 'T4 (20/9)', val: 2090, display: '2.090 đơn', note: '+5.5%' },
      { label: 'T5 (21/9)', val: 2010, display: '2.010 đơn', note: '-3.8%' },
      { label: 'T6 (22/9)', val: 2280, display: '2.280 đơn', note: '+13.4%' },
      { label: 'T7 (23/9)', val: 2620, display: '2.620 đơn', note: 'Kỷ lục tuần' },
      { label: 'CN (24/9)', val: 2318, display: '2.318 đơn', note: '+8.4%' }
    ]
  },
  '30d': {
    revenue: [
      { label: 'Tuần 1', val: 510000000, display: '510M ₫', note: '+8.2%' },
      { label: 'Tuần 2', val: 565000000, display: '565M ₫', note: '+10.8%' },
      { label: 'Tuần 3', val: 620000000, display: '620M ₫', note: '+9.7%' },
      { label: 'Tuần 4', val: 661000000, display: '661M ₫', note: '+6.6%' }
    ],
    orders: [
      { label: 'Tuần 1', val: 14800, display: '14.8k đơn', note: 'Tuần 1' },
      { label: 'Tuần 2', val: 16400, display: '16.4k đơn', note: 'Tuần 2' },
      { label: 'Tuần 3', val: 17900, display: '17.9k đơn', note: 'Tuần 3' },
      { label: 'Tuần 4', val: 19350, display: '19.3k đơn', note: 'Tuần 4' }
    ]
  },
  month: {
    revenue: [
      { label: '01 - 07', val: 420000000, display: '420M ₫', note: 'Tuần đầu' },
      { label: '08 - 14', val: 490000000, display: '490M ₫', note: '+16.6%' },
      { label: '15 - 21', val: 520000000, display: '520M ₫', note: '+6.1%' },
      { label: '22 - nay', val: 415000000, display: '415M ₫', note: 'Đang tiếp diễn' }
    ],
    orders: [
      { label: '01 - 07', val: 12100, display: '12.1k đơn', note: 'Tuần đầu' },
      { label: '08 - 14', val: 13900, display: '13.9k đơn', note: '+14.8%' },
      { label: '15 - 21', val: 14800, display: '14.8k đơn', note: '+6.4%' },
      { label: '22 - nay', val: 11300, display: '11.3k đơn', note: 'Đang tiếp diễn' }
    ]
  }
};

function initInteractiveSvgChart() {
  renderInteractiveSvgChart();
  window.addEventListener('resize', debounce(renderInteractiveSvgChart, 200));
}

function renderInteractiveSvgChart() {
  const container = document.getElementById('svgChartViewport');
  const tooltip = document.getElementById('chartTooltip');
  if (!container) return;

  const dataset = (chartDataByRange[currentRange] || chartDataByRange.today)[currentMetric] || chartDataByRange.today.revenue;
  const isRevenue = currentMetric === 'revenue';
  const strokeColor = isRevenue ? '#10b981' : '#3b82f6';
  const fillColor = isRevenue ? 'url(#chartGradientRev)' : 'url(#chartGradientOrd)';

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 250;
  const padding = { top: 25, right: 30, bottom: 40, left: 55 };

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = dataset.map((d) => d.val);
  const minVal = Math.min(...values) * 0.75;
  const maxVal = Math.max(...values) * 1.1;

  // Calculate coordinates
  const points = dataset.map((d, i) => {
    const x = padding.left + (i / (dataset.length - 1)) * innerW;
    const y = padding.top + innerH - ((d.val - minVal) / (maxVal - minVal || 1)) * innerH;
    return { x, y, data: d };
  });

  // Build smooth Bezier path
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    pathD += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x},${padding.top + innerH} L ${points[0].x},${padding.top + innerH} Z`;

  // Gridlines & Y-Axis ticks (3 ticks)
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];
  const gridLines = yTicks.map((val) => {
    const y = padding.top + innerH - ((val - minVal) / (maxVal - minVal || 1)) * innerH;
    let labelText = '';
    if (isRevenue) {
      labelText = val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : `${(val / 1000).toFixed(0)}k`;
    } else {
      labelText = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`;
    }
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${padding.left - 10}" y="${y + 4}" fill="#94a3b8" font-size="11" text-anchor="end" font-weight="600">${labelText}</text>
    `;
  }).join('');

  // X-Axis labels
  const xLabels = points.map((p) => `
    <text x="${p.x}" y="${height - 12}" fill="#64748b" font-size="11" text-anchor="middle" font-weight="600">${escapeHtml(p.data.label)}</text>
  `).join('');

  // Dots
  const dots = points.map((p, idx) => `
    <circle class="chart-data-node" cx="${p.x}" cy="${p.y}" r="5" fill="#ffffff" stroke="${strokeColor}" stroke-width="3" style="cursor:pointer;" data-index="${idx}"/>
    <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" style="cursor:pointer;" data-index="${idx}"/>
  `).join('');

  const svgContent = `
    <svg class="svg-chart-element" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGradientRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="chartGradientOrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaD}" fill="${fillColor}"/>
      <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round"/>
      ${xLabels}
      ${dots}
    </svg>
  `;

  container.innerHTML = svgContent;

  // Attach hover events to nodes for tooltip
  const hitAreas = container.querySelectorAll('[data-index]');
  hitAreas.forEach((node) => {
    node.addEventListener('mouseenter', (e) => {
      const idx = parseInt(node.getAttribute('data-index'), 10);
      const pt = points[idx];
      if (!pt || !tooltip) return;

      const tDate = document.getElementById('tooltipDate');
      const tMetric = document.getElementById('tooltipMetric');
      const tNote = document.getElementById('tooltipNote');

      if (tDate) tDate.textContent = `${pt.data.label} (${currentMetric === 'revenue' ? 'Doanh thu' : 'Đơn hàng'})`;
      if (tMetric) {
        tMetric.textContent = pt.data.display;
        tMetric.style.color = strokeColor;
      }
      if (tNote) tNote.textContent = pt.data.note;

      tooltip.style.left = `${pt.x}px`;
      tooltip.style.top = `${pt.y - 12}px`;
      tooltip.classList.add('visible');
    });

    node.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.remove('visible');
    });
  });
}

/* --------------------------------------------------------------------------
   4. REAL-TIME AUDIT TRAIL
   -------------------------------------------------------------------------- */
const auditLogData = [
  {
    id: 1,
    time: '09:42 hôm nay',
    admin: 'Nguyễn Minh Admin',
    role: 'Super Admin',
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh&background=9d4300&color=fff',
    category: 'finance',
    action: 'Duyệt yêu cầu rút tiền',
    target: '#WD-88231 (12.000.000 ₫)',
    status: 'success',
    statusText: 'Đã hoàn tất',
    detail: 'Duyệt rút tiền cho Shop MangaXưa qua tài khoản VCB ****8921.'
  },
  {
    id: 2,
    time: '09:10 hôm nay',
    admin: 'Trần Thị Quản Lý',
    role: 'Manager',
    avatar: 'https://ui-avatars.com/api/?name=Tran+Thi&background=475569&color=fff',
    category: 'account',
    action: 'Khoá tài khoản vi phạm',
    target: 'seller_truyenxua92',
    status: 'danger',
    statusText: 'Đã khoá 14 ngày',
    detail: 'Khoá tạm thời do phát hiện hành vi tăng đánh giá ảo và từ chối giao đơn.'
  },
  {
    id: 3,
    time: '08:47 hôm nay',
    admin: 'Nguyễn Minh Admin',
    role: 'Super Admin',
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh&background=9d4300&color=fff',
    category: 'system',
    action: 'Cập nhật biểu phí hoa hồng',
    target: 'Manga & Comic: 8.0% → 7.5%',
    status: 'info',
    statusText: 'Đã áp dụng',
    detail: 'Áp dụng chính sách khuyến khích người bán truyện bản quyền quý 4.'
  },
  {
    id: 4,
    time: 'Hôm qua, 21:05',
    admin: 'Lê Văn Kiểm Duyệt',
    role: 'Moderator',
    avatar: 'https://ui-avatars.com/api/?name=Le+Van&background=2563eb&color=fff',
    category: 'voucher',
    action: 'Kích hoạt voucher sàn',
    target: 'SACH9 · Giảm 9% tối đa 50k',
    status: 'success',
    statusText: 'Đang hoạt động',
    detail: 'Ngân sách trợ giá: 25.000.000 ₫ cho chiến dịch Mùa Sách Mới.'
  },
  {
    id: 5,
    time: 'Hôm qua, 17:30',
    admin: 'Trần Thị Quản Lý',
    role: 'Manager',
    avatar: 'https://ui-avatars.com/api/?name=Tran+Thi&background=475569&color=fff',
    category: 'account',
    action: 'Cấp quyền nhân viên mới',
    target: 'pham.van.duy@bookmooch.vn',
    status: 'success',
    statusText: 'Thành công',
    detail: 'Thêm kiểm duyệt viên phụ trách danh mục Sách Hiếm và Đấu Giá.'
  },
  {
    id: 6,
    time: 'Hôm qua, 14:12',
    admin: 'Nguyễn Minh Admin',
    role: 'Super Admin',
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh&background=9d4300&color=fff',
    category: 'finance',
    action: 'Từ chối rút tiền nghi vấn',
    target: '#WD-88190 · 45.000.000 ₫',
    status: 'danger',
    statusText: 'Đã từ chối',
    detail: 'Phát hiện tài khoản nhận tiền không trùng khớp với CMND/CCCD đăng ký sàn.'
  }
];

let currentAuditFilter = 'all';
let currentAuditQuery = '';

function initAuditTrail() {
  renderAuditTable();

  // Filter Tabs
  const tabGroup = document.getElementById('auditTabsGroup');
  if (tabGroup) {
    const tabs = tabGroup.querySelectorAll('.audit-tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        currentAuditFilter = tab.getAttribute('data-filter') || 'all';
        renderAuditTable();
      });
    });
  }

  // Live Search Input
  const searchInput = document.getElementById('auditSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentAuditQuery = (e.target.value || '').trim().toLowerCase();
      renderAuditTable();
    }, 180));
  }
}

function renderAuditTable() {
  const tbody = document.getElementById('activityTableBody');
  const counter = document.getElementById('recordCounter');
  if (!tbody) return;

  const filtered = auditLogData.filter((row) => {
    // Category match
    if (currentAuditFilter !== 'all' && row.category !== currentAuditFilter) {
      return false;
    }
    // Search query match
    if (currentAuditQuery) {
      const matchText = `${row.admin} ${row.action} ${row.target} ${row.detail}`.toLowerCase();
      if (!matchText.includes(currentAuditQuery)) return false;
    }
    return true;
  });

  if (counter) {
    counter.textContent = `Hiển thị ${filtered.length} / ${auditLogData.length} hoạt động gần nhất`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 32px 16px; color: var(--text-muted);">
          <span class="material-symbols-outlined" style="font-size:32px; color:#cbd5e1; display:block; margin-bottom:6px;">search_off</span>
          Không tìm thấy nhật ký kiểm toán phù hợp với bộ lọc hiện tại.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((row) => {
    let catClass = 'system';
    let catLabel = 'Hệ thống';
    if (row.category === 'finance') { catClass = 'finance'; catLabel = 'Tài chính'; }
    else if (row.category === 'account') { catClass = 'account'; catLabel = 'Tài khoản'; }
    else if (row.category === 'voucher') { catClass = 'voucher'; catLabel = 'Voucher'; }

    return `
      <tr>
        <td style="color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">${escapeHtml(row.time)}</td>
        <td>
          <div class="admin-user-cell">
            <img src="${row.avatar}" class="admin-mini-avatar" alt="Avatar">
            <div class="admin-meta">
              <strong>${escapeHtml(row.admin)}</strong>
              <span>${escapeHtml(row.role)}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="action-type-pill ${catClass}">${catLabel}</span>
        </td>
        <td><strong>${escapeHtml(row.action)}</strong></td>
        <td>
          <code style="background:var(--surface-bg); padding:3px 7px; border-radius:4px; font-size:0.78rem; color:var(--text-main); font-weight:600;">
            ${escapeHtml(row.target)}
          </code>
        </td>
        <td style="text-align:center;">
          <span class="badge badge-${row.status}">
            <span class="badge-dot"></span>${escapeHtml(row.statusText)}
          </span>
        </td>
        <td style="text-align:right;">
          <button class="btn btn-outline btn-sm" onclick="showAuditDetail(${row.id})" title="Xem chi tiết hành động">
            Chi tiết
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.showAuditDetail = function(id) {
  const item = auditLogData.find((x) => x.id === id);
  if (!item) return;
  if (typeof showToast === 'function') {
    showToast(`[${item.action}] ${item.detail}`, item.status === 'danger' ? 'danger' : 'info');
  } else {
    alert(`Chi tiết nhật ký: ${item.action}\n${item.detail}`);
  }
};

/* --------------------------------------------------------------------------
   5. COMMAND PALETTE MODAL (Ctrl + K)
   -------------------------------------------------------------------------- */
function initCommandPalette() {
  const modal = document.getElementById('commandPaletteModal');
  const trigger = document.getElementById('headerSearchTrigger');
  const input = document.getElementById('paletteSearchInput');
  const results = document.getElementById('paletteResults');
  if (!modal) return;

  function openPalette() {
    modal.classList.add('open');
    if (input) {
      input.value = '';
      filterPaletteItems('');
      setTimeout(() => input.focus(), 50);
    }
  }

  function closePalette() {
    modal.classList.remove('open');
  }

  if (trigger) trigger.addEventListener('click', openPalette);

  // Keyboard shortcut Ctrl+K / Cmd+K and ESC
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (modal.classList.contains('open')) closePalette();
      else openPalette();
    } else if (e.key === 'Escape' && modal.classList.contains('open')) {
      closePalette();
    }
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePalette();
  });

  // Filter items in palette
  if (input && results) {
    input.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      filterPaletteItems(q);
    });
  }
}

function filterPaletteItems(query) {
  const results = document.getElementById('paletteResults');
  if (!results) return;
  const items = results.querySelectorAll('.palette-item');
  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    if (!query || text.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

/* --------------------------------------------------------------------------
   6. NOTIFICATION POPOVER DROPDOWN
   -------------------------------------------------------------------------- */
function initNotificationDropdown() {
  const notifBtn = document.getElementById('notifBtn');
  const dropdown = document.getElementById('notifDropdown');
  const markReadBtn = document.getElementById('markAllReadBtn');
  if (!notifBtn || !dropdown) return;

  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Click outside closes dropdown
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== notifBtn) {
      dropdown.classList.remove('open');
    }
  });

  if (markReadBtn) {
    markReadBtn.addEventListener('click', () => {
      const unreads = dropdown.querySelectorAll('.notif-item.unread');
      unreads.forEach((item) => item.classList.remove('unread'));
      const badge = notifBtn.querySelector('.notification-badge-dot');
      if (badge) badge.style.display = 'none';
      const countEl = dropdown.querySelector('.notif-badge-count');
      if (countEl) countEl.textContent = '0 mới';
      if (typeof showToast === 'function') {
        showToast('Đã đánh dấu đọc tất cả 5 thông báo', 'success');
      }
    });
  }
}

/* --------------------------------------------------------------------------
   7. EXPORT ACTIONS
   -------------------------------------------------------------------------- */
function initExportButtons() {
  const exportReportBtn = document.getElementById('exportReportBtn');
  const exportAuditBtn = document.getElementById('exportAuditBtn');

  if (exportReportBtn) {
    exportReportBtn.addEventListener('click', () => {
      if (typeof showToast === 'function') {
        showToast('Đang kết xuất tệp Báo cáo Điều hành sàn BookMooch (PDF)...');
        setTimeout(() => {
          showToast('✅ Đã tạo file Báo cáo Vận hành hôm nay: BookMooch-Admin-Daily.pdf', 'success');
        }, 1200);
      }
    });
  }

  if (exportAuditBtn) {
    exportAuditBtn.addEventListener('click', () => {
      if (typeof showToast === 'function') {
        showToast('Đang xuất tệp Nhật ký Kiểm toán (CSV)...');
        setTimeout(() => {
          showToast('✅ Đã xuất tệp Audit-Trail-BookMooch.csv thành công', 'success');
        }, 900);
      }
    });
  }
}