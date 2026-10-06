// Dữ liệu doanh thu theo từng mốc lọc ngày (7 / 30 / 90 ngày gần nhất).
const revenueByRange = {
    7: [
        { label: 'T2', gmv: 58, commission: 4.6 },
        { label: 'T3', gmv: 66, commission: 5.2 },
        { label: 'T4', gmv: 54, commission: 4.1 },
        { label: 'T5', gmv: 78, commission: 6.1 },
        { label: 'T6', gmv: 85, commission: 6.8 },
        { label: 'T7', gmv: 100, commission: 8.1 },
        { label: 'CN', gmv: 72, commission: 5.6 },
    ],
    30: [
        { label: 'Tuần 1', gmv: 62, commission: 5 },
        { label: 'Tuần 2', gmv: 78, commission: 6.4 },
        { label: 'Tuần 3', gmv: 70, commission: 5.7 },
        { label: 'Tuần 4', gmv: 92, commission: 7.4 },
        { label: 'Tuần 5', gmv: 100, commission: 8.1 },
    ],
    90: [
        { label: 'Tháng 7', gmv: 72, commission: 5.6 },
        { label: 'Tháng 8', gmv: 86, commission: 6.9 },
        { label: 'Tháng 9', gmv: 100, commission: 8.1 },
    ],
};

const revenueByCategory = [
    { name: 'Truyện tranh / Manga', percent: 30, value: '1.285.950.000 ₫' },
    { name: 'Manhwa / Manhua', percent: 16, value: '685.840.000 ₫' },
    { name: 'Tiểu thuyết / Truyện dài', percent: 15, value: '642.975.000 ₫' },
    { name: 'Truyện ngôn tình', percent: 13, value: '557.245.000 ₫' },
    { name: 'Light Novel', percent: 10, value: '428.650.000 ₫' },
    { name: 'Truyện trinh thám / Kinh dị', percent: 8, value: '342.920.000 ₫' },
    { name: 'Truyện thiếu nhi', percent: 5, value: '214.325.000 ₫' },
    { name: 'Truyện hiếm / Bản sưu tầm', percent: 3, value: '128.595.000 ₫' },
];

// Dữ liệu chi tiết từng cửa hàng (dùng cho bảng thống kê + modal xem chi tiết)
const storeStats = [
    { id: 'ST01', name: 'Tiệm Truyện Vũ Trụ', owner: 'Trần Đăng Khoa', email: 'tiemtruyenvutru@bookmooch.vn', phone: '0901 234 567', address: 'Quận 3, TP.HCM', joined: '12/03/2023', rating: 4.8, orders: 682, revenue: 340600000, commission: 25545000, trend: 12.4, monthlyTrend: [58, 66, 62, 78, 90, 100] },
    { id: 'ST02', name: 'Comic Corner HN', owner: 'Ngô Hải Đăng', email: 'comiccorner.hn@bookmooch.vn', phone: '0912 345 678', address: 'Quận Cầu Giấy, Hà Nội', joined: '05/07/2022', rating: 4.6, orders: 415, revenue: 128400000, commission: 9630000, trend: -4.1, monthlyTrend: [82, 78, 90, 74, 68, 62] },
    { id: 'ST03', name: 'Nhà Sách Ngọc Anh', owner: 'Phạm Thị Ngọc', email: 'nhasachngocanh@bookmooch.vn', phone: '0987 654 321', address: 'Quận Hải Châu, Đà Nẵng', joined: '20/01/2024', rating: 4.9, orders: 210, revenue: 56700000, commission: 4252000, trend: 8.7, monthlyTrend: [40, 48, 55, 60, 68, 78] },
    { id: 'ST04', name: 'Kho Sách Miền Tây', owner: 'Lê Văn Phát', email: 'khosachmientay@bookmooch.vn', phone: '0934 567 890', address: 'TP. Cần Thơ', joined: '02/11/2023', rating: 4.5, orders: 98, revenue: 48900000, commission: 3667000, trend: 2.1, monthlyTrend: [55, 58, 52, 60, 63, 65] },
    { id: 'ST05', name: 'Sách Cũ Sài Gòn', owner: 'Đỗ Minh Anh', email: 'sachcusaigon@bookmooch.vn', phone: '0977 888 999', address: 'Quận Bình Thạnh, TP.HCM', joined: '15/06/2024', rating: 4.3, orders: 61, revenue: 22100000, commission: 1657000, trend: -1.5, monthlyTrend: [50, 46, 52, 44, 42, 38] },
];

// Bộ lọc ngày/tháng/năm đang áp dụng cho bảng doanh thu cửa hàng (null = xem toàn thời gian)
let storeDateFilterActive = null;

const withdrawRequests = [
    { id: 'WD-88231', seller: 'Tiệm Truyện Vũ Trụ', amount: 12000000, bank: 'Vietcombank •••• 8829', time: '09:42 hôm nay', status: 'pending' },
    { id: 'WD-88229', seller: 'Nhà Sách Ngọc Anh', amount: 8500000, bank: 'Techcombank •••• 2201', time: '08:55 hôm nay', status: 'pending' },
    { id: 'WD-88220', seller: 'Comic Corner HN', amount: 24000000, bank: 'MB Bank •••• 5567', time: 'Hôm qua, 20:12', status: 'pending' },
    { id: 'WD-88218', seller: 'Sách Cũ Sài Gòn', amount: 3200000, bank: 'ACB •••• 9081', time: 'Hôm qua, 16:40', status: 'pending' },
    { id: 'WD-88215', seller: 'Kho Sách Miền Tây', amount: 15600000, bank: 'Vietinbank •••• 3345', time: 'Hôm qua, 14:05', status: 'pending' },
    { id: 'WD-88205', seller: 'Tiệm Truyện Vũ Trụ', amount: 9800000, bank: 'Vietcombank •••• 8829', time: '2 ngày trước', status: 'approved' },
    { id: 'WD-88198', seller: 'Nhà Sách Ngọc Anh', amount: 5400000, bank: 'Techcombank •••• 2201', time: '2 ngày trước', status: 'approved' },
    { id: 'WD-88190', seller: 'Comic Corner HN', amount: 41000000, bank: 'MB Bank •••• 5567', time: '3 ngày trước', status: 'rejected' },
];

const cashflowDays = [
    { label: 'T2', inflow: 68, outflow: 40 },
    { label: 'T3', inflow: 74, outflow: 52 },
    { label: 'T4', inflow: 60, outflow: 38 },
    { label: 'T5', inflow: 88, outflow: 61 },
    { label: 'T6', inflow: 95, outflow: 70 },
    { label: 'T7', inflow: 100, outflow: 55 },
    { label: 'CN', inflow: 82, outflow: 46 },
];

const cashflowEntries = [
    { time: '09:42 hôm nay', type: 'Thanh toán đơn hàng', desc: '#ORD-90512 · Buyer thanh toán qua Ví', amount: 890000, dir: 'in' },
    { time: '09:15 hôm nay', type: 'Hoa hồng sàn', desc: 'Trích hoa hồng 7.5% đơn #ORD-90512', amount: 66750, dir: 'in' },
    { time: '08:50 hôm nay', type: 'Rút tiền người bán', desc: '#WD-88205 · Tiệm Truyện Vũ Trụ', amount: 9800000, dir: 'out' },
    { time: 'Hôm qua, 22:10', type: 'Hoàn tiền đơn huỷ', desc: '#ORD-90211 · Hoàn về ví buyer', amount: 45000, dir: 'out' },
    { time: 'Hôm qua, 19:30', type: 'Thanh toán đơn hàng', desc: '#ORD-90480 · Thanh toán COD đối soát', amount: 1240000, dir: 'in' },
    { time: 'Hôm qua, 15:02', type: 'Phí rút tiền', desc: 'Phí giao dịch #WD-88198', amount: 27000, dir: 'in' },
];

document.addEventListener('DOMContentLoaded', () => {
    renderRevenueChart(30);
    renderRevenueByCategory();
    populateStoreDateSelects();
    resetStoreDateFilter();
    renderWithdrawTable();
    renderCashflowChart();
    renderCashflowTable();

    initSlidingTabs(document.getElementById('revenueRangeFilter'), (tab) => {
        renderRevenueChart(parseInt(tab.dataset.range, 10));
    });

    initSlidingTabs(document.getElementById('financeSegControl'), (tab) => {
        const view = tab.dataset.view;
        document.getElementById('financeViewOverview').style.display = view === 'overview' ? 'block' : 'none';
        document.getElementById('financeViewWithdraw').style.display = view === 'withdraw' ? 'block' : 'none';
        document.getElementById('financeViewCashflow').style.display = view === 'cashflow' ? 'block' : 'none';
    });

    initSlidingTabs(document.getElementById('withdrawFilterTabs'), applyWithdrawFilter);

    if (window.location.hash === '#withdraw') {
        setTimeout(() => document.getElementById('withdrawTabBtn').click(), 80);
    }
});

function renderRevenueChart(range = 30) {
    const el = document.getElementById('revenueChart');
    const data = revenueByRange[range] || revenueByRange[30];
    el.innerHTML = data.map((w) => `
    <div class="mini-bar-col">
      <div class="mini-bar-stack" style="height:${w.gmv}%;">
        <div class="mini-bar-in" style="height:100%; background: linear-gradient(180deg, var(--primary-container), var(--primary));"></div>
      </div>
      <div class="mini-bar-label">${w.label}</div>
    </div>
  `).join('');
}

function renderRevenueByCategory() {
    const el = document.getElementById('revenueByCategory');
    el.innerHTML = revenueByCategory.map((c) => `
    <div class="category-row">
      <div class="cat-name">${c.name}</div>
      <div class="cat-track"><div class="cat-fill" style="width:${c.percent}%;"></div></div>
      <div class="cat-value">${c.value}</div>
    </div>
  `).join('');
}

function renderTopSellers() {
    // Đã thay bằng bảng "Doanh thu theo cửa hàng" (xem renderStoreRevenue bên dưới).
}

/* ==========================================================================
   DOANH THU THEO CỬA HÀNG - lọc theo ngày/tháng/năm + xem chi tiết
   ========================================================================== */
function populateStoreDateSelects() {
    const daySel = document.getElementById('storeFilterDay');
    const monthSel = document.getElementById('storeFilterMonth');
    const yearSel = document.getElementById('storeFilterYear');

    daySel.innerHTML = Array.from({ length: 31 }, (_, i) => i + 1)
        .map((d) => `<option value="${d}">Ngày ${String(d).padStart(2, '0')}</option>`).join('');
    monthSel.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
        .map((m) => `<option value="${m}">Tháng ${m}</option>`).join('');
    const currentYear = 2026;
    yearSel.innerHTML = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i)
        .map((y) => `<option value="${y}">${y}</option>`).join('');

    // Mặc định chọn sẵn ngày hiện tại của hệ thống.
    daySel.value = '26';
    monthSel.value = '9';
    yearSel.value = String(currentYear);
}

// PRNG có seed (mulberry32) để mô phỏng số liệu theo ngày một cách nhất quán -
// cùng 1 ngày luôn ra cùng 1 kết quả, khác ngày sẽ ra số khác.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getStoreDisplayData(store) {
    if (!storeDateFilterActive) {
        return { orders: store.orders, revenue: store.revenue, commission: store.commission, trend: store.trend };
    }
    const { day, month, year } = storeDateFilterActive;
    const seed = day * 3571 + month * 104729 + year * 15485867 + store.id.charCodeAt(2) * 97;
    const rng = mulberry32(seed);
    // Ước lượng tỷ trọng doanh thu của 1 ngày trong tổng luỹ kế của cửa hàng.
    const scale = 0.012 + rng() * 0.026;
    const orders = Math.max(0, Math.round(store.orders * scale));
    const revenue = Math.round((store.revenue * scale) / 10000) * 10000;
    const commission = Math.round(revenue * (store.commission / store.revenue));
    const trend = Math.round((rng() * 44 - 18) * 10) / 10;
    return { orders, revenue, commission, trend };
}

function getInitials(name) {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function renderStoreRevenue() {
    const body = document.getElementById('storeRevenueBody');
    body.innerHTML = [...storeStats]
        .sort((a, b) => getStoreDisplayData(b).revenue - getStoreDisplayData(a).revenue)
        .map((s) => {
            const d = getStoreDisplayData(s);
            const trendUp = d.trend >= 0;
            return `
    <tr>
      <td>
        <div class="identity-cell">
          <div class="avatar-chip role-seller">${getInitials(s.name)}</div>
          <div class="identity-text">
            <div class="identity-name">${escapeHtml(s.name)}</div>
            <div class="identity-sub">${s.id} · ${escapeHtml(s.owner)}</div>
          </div>
        </div>
      </td>
      <td style="text-align:right;">${d.orders.toLocaleString('vi-VN')}</td>
      <td style="text-align:right; font-weight:700; color:var(--text-main); white-space:nowrap;">${formatNumber(d.revenue)} ₫</td>
      <td style="text-align:right; color:var(--text-muted); white-space:nowrap;">${formatNumber(d.commission)} ₫</td>
      <td style="text-align:center;">
        <span class="badge badge-${trendUp ? 'success' : 'danger'}">
          <span class="material-symbols-outlined" style="font-size:13px;">${trendUp ? 'trending_up' : 'trending_down'}</span>${trendUp ? '+' : ''}${d.trend}%
        </span>
      </td>
      <td style="text-align:center;">
        <button class="btn btn-outline btn-sm" onclick="viewStoreDetail('${s.id}')">Xem chi tiết</button>
      </td>
    </tr>`;
        }).join('');
}

function applyStoreDateFilter() {
    const day = parseInt(document.getElementById('storeFilterDay').value, 10);
    const month = parseInt(document.getElementById('storeFilterMonth').value, 10);
    const year = parseInt(document.getElementById('storeFilterYear').value, 10);
    storeDateFilterActive = { day, month, year };
    renderStoreRevenue();
    const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    document.getElementById('storeFilterHint').innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;">event</span> Đang xem: ngày <strong>${dateStr}</strong>`;
    showToast(`Đã lọc doanh thu theo cửa hàng cho ngày ${dateStr}`, 'success');
}

function resetStoreDateFilter() {
    storeDateFilterActive = null;
    renderStoreRevenue();
    const hint = document.getElementById('storeFilterHint');
    if (hint) hint.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;">event</span> Đang xem: <strong>Toàn thời gian</strong> (luỹ kế tháng 09/2026)';
}

function viewStoreDetail(id) {
    const s = storeStats.find((x) => x.id === id);
    if (!s) return;
    const d = getStoreDisplayData(s);
    document.getElementById('storeDetailBody').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
      <div class="avatar-chip role-seller" style="width:52px; height:52px; font-size:1.05rem; flex-shrink:0;">${getInitials(s.name)}</div>
      <div style="min-width:0;">
        <div style="font-family:var(--font-heading); font-weight:700; font-size:1.05rem; color:var(--text-main);">${escapeHtml(s.name)}</div>
        <div class="identity-sub">Chủ cửa hàng: ${escapeHtml(s.owner)} · Tham gia ${s.joined}</div>
      </div>
      <span class="badge badge-info" style="margin-left:auto; flex-shrink:0;"><span class="material-symbols-outlined" style="font-size:13px;">star</span> ${s.rating}/5</span>
    </div>
    <div class="stat-mini-row" style="margin-bottom:18px;">
      <div class="stat-mini"><h5>${storeDateFilterActive ? 'Doanh thu ngày đã chọn' : 'Tổng doanh thu'}</h5><div class="val">${formatNumber(d.revenue)} ₫</div></div>
      <div class="stat-mini"><h5>Số đơn</h5><div class="val">${d.orders.toLocaleString('vi-VN')}</div></div>
      <div class="stat-mini"><h5>Hoa hồng sàn</h5><div class="val">${formatNumber(d.commission)} ₫</div></div>
      <div class="stat-mini"><h5>Xu hướng</h5><div class="val" style="color:${d.trend >= 0 ? 'var(--success-text)' : 'var(--danger-text)'};">${d.trend >= 0 ? '+' : ''}${d.trend}%</div></div>
    </div>
    <div style="margin-bottom:18px;">
      <div class="settings-section-title" style="font-size:.88rem; margin-bottom:10px;"><span class="material-symbols-outlined">show_chart</span> Xu hướng doanh thu 6 tháng gần nhất</div>
      <div class="mini-bar-chart" style="height:100px;">
        ${s.monthlyTrend.map((v, i) => `<div class="mini-bar-col"><div class="mini-bar-stack" style="height:${v}%;"><div class="mini-bar-in" style="height:100%;"></div></div><div class="mini-bar-label">T${i + 1}</div></div>`).join('')}
      </div>
    </div>
    <div class="stat-mini-row">
      <div class="stat-mini"><h5>Email liên hệ</h5><div class="val" style="font-size:.82rem; word-break:break-word;">${s.email}</div></div>
      <div class="stat-mini"><h5>Điện thoại</h5><div class="val" style="font-size:.82rem;">${s.phone}</div></div>
      <div class="stat-mini" style="grid-column: span 2;"><h5>Địa chỉ</h5><div class="val" style="font-size:.82rem;">${s.address}</div></div>
    </div>
  `;
    openModal('storeDetailModal');
}

const withdrawStatusMeta = {
    pending: { label: 'Chờ duyệt', badge: 'warning' },
    approved: { label: 'Đã duyệt', badge: 'success' },
    rejected: { label: 'Từ chối', badge: 'danger' },
};

let withdrawTarget = null;

function renderWithdrawTable() {
    const body = document.getElementById('withdrawTableBody');
    body.innerHTML = withdrawRequests.map((w) => {
        const meta = withdrawStatusMeta[w.status];
        return `
    <tr data-status="${w.status}">
      <td><strong>${escapeHtml(w.seller)}</strong><div class="identity-sub">${w.id}</div></td>
      <td style="font-weight:700; color:var(--text-main); white-space:nowrap;">${formatNumber(w.amount)} ₫</td>
      <td style="white-space:nowrap;">${w.bank}</td>
      <td style="color:var(--text-muted); white-space:nowrap;">${w.time}</td>
      <td style="text-align:center;"><span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span></td>
      <td style="text-align:center;">
        ${w.status === 'pending' ? `
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-primary btn-sm" onclick="openWithdrawAction('${w.id}', 'approve')">Duyệt</button>
          <button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openWithdrawAction('${w.id}', 'reject')">Từ chối</button>
        </div>` : `<button class="btn btn-outline btn-sm" onclick="showToast('Xem chi tiết yêu cầu ${w.id}')">Chi tiết</button>`}
      </td>
    </tr>`;
    }).join('');
}

function applyWithdrawFilter() {
    const activeTab = document.querySelector('#withdrawFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'pending';
    document.querySelectorAll('#withdrawTableBody tr').forEach((row) => {
        row.classList.toggle('row-hidden', row.dataset.status !== filter);
    });
}

function openWithdrawAction(id, action) {
    const req = withdrawRequests.find((w) => w.id === id);
    if (!req) return;
    withdrawTarget = { id, action };
    const icon = document.getElementById('withdrawModalIcon');
    icon.className = `modal-icon-circle ${action === 'approve' ? 'success' : 'danger'}`;
    icon.querySelector('.material-symbols-outlined').textContent = action === 'approve' ? 'check_circle' : 'cancel';
    document.getElementById('withdrawModalTitle').textContent = action === 'approve' ? 'Duyệt yêu cầu rút tiền' : 'Từ chối yêu cầu rút tiền';
    document.getElementById('withdrawModalDesc').innerHTML = `Xác nhận ${action === 'approve' ? 'duyệt' : 'từ chối'} yêu cầu rút tiền của <strong>${req.seller}</strong> - ${formatNumber(req.amount)} ₫?`;
    document.getElementById('withdrawRejectReasonWrap').style.display = action === 'reject' ? 'block' : 'none';
    const confirmBtn = document.getElementById('confirmWithdrawActionBtn');
    confirmBtn.className = `btn ${action === 'approve' ? 'btn-primary' : 'btn-danger'}`;
    confirmBtn.textContent = action === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối';
    openModal('withdrawActionModal');
}

function confirmWithdrawAction() {
    if (!withdrawTarget) return;
    const req = withdrawRequests.find((w) => w.id === withdrawTarget.id);
    if (req) {
        req.status = withdrawTarget.action === 'approve' ? 'approved' : 'rejected';
        renderWithdrawTable();
        applyWithdrawFilter();
        showToast(
            withdrawTarget.action === 'approve' ? `Đã duyệt rút tiền cho ${req.seller}` : `Đã từ chối yêu cầu rút tiền của ${req.seller}`,
            withdrawTarget.action === 'approve' ? 'success' : 'danger'
        );
    }
    closeModal('withdrawActionModal');
    withdrawTarget = null;
}

function renderCashflowChart() {
    const el = document.getElementById('cashflowChart');
    el.innerHTML = cashflowDays.map((d) => `
    <div class="mini-bar-col">
      <div style="display:flex; align-items:flex-end; gap:4px; height:100%;">
        <div class="mini-bar-stack" style="height:${d.inflow}%; width:16px;"><div class="mini-bar-in" style="height:100%;"></div></div>
        <div class="mini-bar-stack" style="height:${d.outflow}%; width:16px;"><div class="mini-bar-out" style="height:100%;"></div></div>
      </div>
      <div class="mini-bar-label">${d.label}</div>
    </div>
  `).join('');
}

function renderCashflowTable() {
    const body = document.getElementById('cashflowTableBody');
    body.innerHTML = cashflowEntries.map((c) => `
    <tr>
      <td style="color:var(--text-muted); white-space:nowrap;">${c.time}</td>
      <td>${c.type}</td>
      <td style="color:var(--text-muted);">${c.desc}</td>
      <td style="text-align:right; font-weight:700; color:${c.dir === 'in' ? 'var(--success-text)' : 'var(--danger-text)'};">${c.dir === 'in' ? '+' : '-'}${formatNumber(c.amount)} ₫</td>
      <td style="text-align:center;">
        <span class="badge badge-${c.dir === 'in' ? 'success' : 'danger'}">
          <span class="material-symbols-outlined" style="font-size:14px;">${c.dir === 'in' ? 'south_west' : 'north_east'}</span>
          ${c.dir === 'in' ? 'Vào' : 'Ra'}
        </span>
      </td>
    </tr>
  `).join('');
}