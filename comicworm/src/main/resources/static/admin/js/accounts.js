/**
 * Quản lý tài khoản - ComicWorm Admin Console
 * Hỗ trợ cả 2 chế độ:
 * 1. Chế độ LIVE (MySQL): Gọi REST API /api/admin/users
 * 2. Chế độ PREVIEW / OFFLINE: Tự động fallback sang mock data tĩnh
 */

const accountsData = [
    { id: '10231', name: 'Trần Đăng Khoa', email: 'khoa.tran@gmail.com', phone: '0912.***.881', role: 'seller', joined: '12/03/2023', total: '486 đơn · 128.4tr ₫', status: 'active', reported: false, verified: true },
    { id: '10589', name: 'Nguyễn Thị Hồng', email: 'hong.nguyen@gmail.com', phone: '0987.***.204', role: 'buyer', joined: '04/07/2024', total: '38 đơn · 4.2tr ₫', status: 'active', reported: false, verified: true },
    { id: '10902', name: 'Lê Văn Phát', email: 'phat.le@gmail.com', phone: '0933.***.552', role: 'seller', joined: '19/01/2024', total: '212 đơn · 56.7tr ₫', status: 'reported', reported: true, verified: true },
    { id: '11045', name: 'Vũ Tuấn Kiệt', email: 'kiet.vu@gmail.com', phone: '0912.***.112', role: 'buyer', joined: '30/09/2024', total: '5 đơn · 480k ₫', status: 'active', reported: false, verified: false },
    { id: '11290', name: 'Phạm Thị Ngọc', email: 'ngoc.pham@gmail.com', phone: '0977.***.331', role: 'seller', joined: '02/02/2022', total: '1.204 đơn · 340.6tr ₫', status: 'active', reported: false, verified: true },
    { id: '11384', name: 'Hoàng Gia Bảo', email: 'bao.hoang@gmail.com', phone: '0909.***.774', role: 'buyer', joined: '15/05/2025', total: '2 đơn · 190k ₫', status: 'active', reported: false, verified: false },
    { id: '11402', name: 'Đỗ Minh Anh', email: 'anh.do@gmail.com', phone: '0966.***.128', role: 'seller', joined: '21/11/2023', total: '89 đơn · 22.1tr ₫', status: 'banned', reported: true, verified: true },
    { id: '11501', name: 'Bùi Thu Trang', email: 'trang.bui@gmail.com', phone: '0945.***.660', role: 'buyer', joined: '08/08/2024', total: '61 đơn · 7.8tr ₫', status: 'active', reported: false, verified: true },
    { id: '11623', name: 'Ngô Hải Đăng', email: 'dang.ngo@gmail.com', phone: '0918.***.903', role: 'seller', joined: '17/06/2024', total: '154 đơn · 48.9tr ₫', status: 'active', reported: false, verified: true },
    { id: '11740', name: 'Trịnh Bảo Châu', email: 'chau.trinh@gmail.com', phone: '0938.***.417', role: 'buyer', joined: '01/01/2025', total: '14 đơn · 1.6tr ₫', status: 'active', reported: false, verified: true },
];

const statusMeta = {
    active: { label: 'Hoạt động', badge: 'success' },
    reported: { label: 'Bị báo cáo', badge: 'warning' },
    banned: { label: 'Đã khoá', badge: 'danger' },
    locked: { label: 'Đã khoá', badge: 'danger' },
    pending_verify: { label: 'Chờ kích hoạt', badge: 'warning' },
};

let currentBanTarget = null;
let isLiveApiConnected = false;
let currentPagination = {
    page: 0,
    size: 10,
    totalPages: 1,
    totalRecords: 0
};
let liveLoadedRecords = [];

/* ==========================================================================
   DUYỆT ĐĂNG KÝ NGƯỜI BÁN — /api/admin/seller-applications
   ========================================================================== */
const SELLER_APP_API = '/api/admin/seller-applications';

const sellerAppStatusMeta = {
    PENDING: { label: 'Chờ duyệt', badge: 'warning' },
    APPROVED: { label: 'Đã duyệt', badge: 'success' },
    REJECTED: { label: 'Đã từ chối', badge: 'danger' },
};
const sellerAppFilterStatus = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };

let sellerAppRows = [];
let currentSellerAppTarget = null;
let sellerAppBusy = false;

async function sellerAppRequest(path, options = {}) {
    const res = await fetch(SELLER_APP_API + path, {
        ...options,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        const error = new Error((body && body.message) || (res.status === 401 || res.status === 403
            ? 'Phiên đăng nhập quản trị đã hết hạn. Vui lòng tải lại trang.'
            : `Yêu cầu thất bại (mã ${res.status}).`));
        error.status = res.status;
        throw error;
    }
    return body;
}

// A fresh token per write: CSRF tokens rotate on login/logout (AuthController).
async function sellerAppWrite(path, body) {
    const csrf = await sellerAppRequest('/csrf');
    const headers = { [csrf.headerName]: csrf.token };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return sellerAppRequest(path, { method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function sellerAppInitials(name) {
    return String(name || '?').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
}

function formatAppDate(value) {
    if (!value) return '—';
    const [y, m, d] = String(value).split('T')[0].split('-');
    return d && m && y ? `${d}/${m}/${y}` : escapeHtml(value);
}

function formatAppDateTime(value) {
    if (!value) return '—';
    const time = String(value).split('T')[1] || '';
    return `${escapeHtml(time.slice(0, 5))} ${formatAppDate(value)}`.trim();
}

function currentSellerAppStatus() {
    const activeTab = document.querySelector('#sellerAppFilterTabs .tab-chip.active');
    return sellerAppFilterStatus[activeTab ? activeTab.dataset.filter : 'pending'] || 'PENDING';
}

function setSellerAppPendingCount(count) {
    const badgeEl = document.getElementById('sellerAppPendingCount');
    if (badgeEl) badgeEl.textContent = count;
    const tabCountEl = document.getElementById('sellerAppPendingTabCount');
    if (tabCountEl) tabCountEl.textContent = count;
    const kpiEl = document.getElementById('kpiPendingSellerApps');
    if (kpiEl) kpiEl.textContent = count;
}

async function refreshSellerAppPendingCount() {
    try {
        const pending = await sellerAppRequest('?status=PENDING');
        setSellerAppPendingCount(pending.length);
    } catch (_) { /* the table already shows load errors */ }
}

async function renderSellerApps() {
    const body = document.getElementById('sellerAppTableBody');
    if (!body) return;
    const status = currentSellerAppStatus();
    body.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">Đang tải hồ sơ...</td></tr>`;
    let rows;
    try {
        rows = await sellerAppRequest(`?status=${status}`);
    } catch (err) {
        if (status !== currentSellerAppStatus()) return;
        sellerAppRows = [];
        body.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--danger-text);">Không tải được hồ sơ: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    // The admin may have switched filter while this request was in flight.
    if (status !== currentSellerAppStatus()) return;
    sellerAppRows = rows;
    if (status === 'PENDING') setSellerAppPendingCount(rows.length);
    else refreshSellerAppPendingCount();

    body.innerHTML = rows.length ? rows.map((a) => {
        const meta = sellerAppStatusMeta[a.status] || { label: escapeHtml(a.status), badge: 'info' };
        return `
    <tr>
      <td>
        <div class="identity-cell">
          <div class="avatar-chip role-buyer">${escapeHtml(sellerAppInitials(a.userFullName))}</div>
          <div class="identity-text">
            <span class="identity-name">${escapeHtml(a.userFullName || '—')}</span>
            <span class="identity-sub">#${Number(a.userId)}</span>
          </div>
        </div>
      </td>
      <td style="color:var(--text-muted);">${escapeHtml(a.userEmail || '—')}</td>
      <td style="font-weight:700; color:var(--text-main); font-variant-numeric:tabular-nums;">${escapeHtml(a.idNumber)}</td>
      <td style="color:var(--text-muted); white-space:nowrap;">${formatAppDateTime(a.submittedAt)}</td>
      <td style="text-align:center;"><span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span></td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" onclick="viewSellerAppDetail(${Number(a.id)})">Xem hồ sơ</button>
          ${a.status === 'PENDING' ? `
          <button class="btn btn-primary btn-sm" onclick="openApproveAppModal(${Number(a.id)})">Duyệt</button>
          <button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openRejectAppModal(${Number(a.id)})">Từ chối</button>` : ''}
        </div>
      </td>
    </tr>`;
    }).join('') : `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">Không có hồ sơ nào ở trạng thái này</td></tr>`;
}

function findSellerApp(id) {
    return sellerAppRows.find((x) => x.id === id);
}

function sellerAppDisplayName(a) {
    return a.userFullName || a.userEmail || `#${a.userId}`;
}

function viewSellerAppDetail(id) {
    const a = findSellerApp(id);
    if (!a) return;
    const meta = sellerAppStatusMeta[a.status] || { label: escapeHtml(a.status), badge: 'info' };
    document.getElementById('sellerAppDetailBody').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
      <div class="avatar-chip role-buyer" style="width:52px; height:52px; font-size:1.05rem;">${escapeHtml(sellerAppInitials(a.userFullName))}</div>
      <div>
        <div style="font-weight:800; font-size:1.05rem; color:var(--text-main);">${escapeHtml(a.userFullName || '—')}</div>
        <div style="font-size:.8rem; color:var(--text-muted);">#${Number(a.userId)} · ${escapeHtml(a.userEmail || '')} · Gửi lúc ${formatAppDateTime(a.submittedAt)}</div>
      </div>
      <span class="badge badge-${meta.badge}" style="margin-left:auto;"><span class="badge-dot"></span>${meta.label}</span>
    </div>
    <div class="stat-mini-row" style="margin-bottom:14px;">
      <div class="stat-mini"><h5>Số CCCD</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.idNumber)}</div></div>
      <div class="stat-mini"><h5>Họ tên trên CCCD</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.idFullName)}</div></div>
      <div class="stat-mini"><h5>Ngày sinh</h5><div class="val" style="font-size:.86rem;">${formatAppDate(a.idDateOfBirth)}</div></div>
      <div class="stat-mini"><h5>Ngày cấp</h5><div class="val" style="font-size:.86rem;">${formatAppDate(a.idIssueDate)}</div></div>
      <div class="stat-mini" style="grid-column:1 / -1;"><h5>Nơi cấp</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.idIssuePlace)}</div></div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
      <img src="/user/images/cccd-sample-front.svg" alt="Ảnh minh họa CCCD mẫu mặt trước" style="width:100%; border:1px solid var(--border-color); border-radius:8px;">
      <img src="/user/images/cccd-sample-back.svg" alt="Ảnh minh họa CCCD mẫu mặt sau" style="width:100%; border:1px solid var(--border-color); border-radius:8px;">
    </div>
    <p style="font-size:.76rem; color:var(--text-muted); margin:0 0 12px;">Thông tin CCCD hiện là dữ liệu mẫu để demo; ảnh chỉ để minh họa.</p>
    ${a.status === 'REJECTED' && a.reviewNote ? `<div style="padding:12px 14px; border-radius:var(--radius-md); background:var(--danger-bg); color:var(--danger-text); font-size:.82rem; line-height:1.55;"><strong>Lý do từ chối:</strong> ${escapeHtml(a.reviewNote)}</div>` : ''}
    ${a.status === 'APPROVED' ? `<div style="padding:12px 14px; border-radius:var(--radius-md); background:var(--success-bg); color:var(--success-text); font-size:.82rem; line-height:1.55;"><strong>Đã duyệt:</strong> tài khoản đã được cấp quyền Người bán.</div>` : ''}
  `;
    const actions = document.getElementById('sellerAppDetailActions');
    actions.innerHTML = a.status === 'PENDING'
        ? `<button class="btn btn-outline" onclick="closeModal('sellerAppDetailModal')">Đóng</button>
           <button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="closeModal('sellerAppDetailModal'); openRejectAppModal(${Number(a.id)});">Từ chối</button>
           <button class="btn btn-primary" onclick="closeModal('sellerAppDetailModal'); openApproveAppModal(${Number(a.id)});">Duyệt hồ sơ</button>`
        : `<button class="btn btn-outline" onclick="closeModal('sellerAppDetailModal')">Đóng</button>`;
    openModal('sellerAppDetailModal');
}

function openApproveAppModal(id) {
    const a = findSellerApp(id);
    if (!a) return;
    currentSellerAppTarget = id;
    document.getElementById('approveAppApplicant').textContent = sellerAppDisplayName(a);
    openModal('sellerAppApproveModal');
}

function openRejectAppModal(id) {
    const a = findSellerApp(id);
    if (!a) return;
    currentSellerAppTarget = id;
    document.getElementById('rejectAppApplicant').textContent = sellerAppDisplayName(a);
    const reason = document.getElementById('rejectAppReason');
    reason.value = '';
    document.getElementById('rejectAppReasonError').textContent = '';
    openModal('sellerAppRejectModal');
    reason.focus();
}

async function decideSellerApp(modalId, path, body, successMessage) {
    if (!currentSellerAppTarget || sellerAppBusy) return;
    sellerAppBusy = true;
    try {
        await sellerAppWrite(`/${currentSellerAppTarget}/${path}`, body);
        closeModal(modalId);
        currentSellerAppTarget = null;
        showToast(successMessage, 'success');
        await renderSellerApps();
    } catch (err) {
        showToast(err.message, 'danger');
        // Already handled by another admin, or gone: close and show the current list.
        if (err.status === 409 || err.status === 404) {
            closeModal(modalId);
            currentSellerAppTarget = null;
            await renderSellerApps();
        }
    } finally {
        sellerAppBusy = false;
    }
}

function confirmApproveApp() {
    const a = findSellerApp(currentSellerAppTarget);
    const name = a ? sellerAppDisplayName(a) : '';
    decideSellerApp('sellerAppApproveModal', 'approve', undefined, `Đã duyệt hồ sơ và cấp quyền Người bán cho ${name}.`);
}

function confirmRejectApp() {
    const reason = document.getElementById('rejectAppReason').value.trim();
    const errorEl = document.getElementById('rejectAppReasonError');
    if (!reason) { errorEl.textContent = 'Vui lòng nhập lý do từ chối.'; return; }
    if (reason.length > 500) { errorEl.textContent = 'Lý do từ chối tối đa 500 ký tự.'; return; }
    errorEl.textContent = '';
    decideSellerApp('sellerAppRejectModal', 'reject', { reason }, 'Đã từ chối hồ sơ đăng ký Người bán.');
}

/* ==========================================================================
   QUẢN LÝ TÀI KHOẢN (API LIVE + FALLBACK PREVIEW)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadAccountsPage(0);
    loadStats();

    renderSellerApps();
    initSlidingTabs(document.getElementById('accFilterTabs'), () => loadAccountsPage(0));
    initSlidingTabs(document.getElementById('sellerAppFilterTabs'), renderSellerApps);
    initSlidingTabs(document.getElementById('accountsSegControl'), (tab) => {
        const view = tab.dataset.view;
        document.getElementById('accountsListView').style.display = view === 'list' ? 'block' : 'none';
        document.getElementById('sellerAppView').style.display = view === 'sellerApps' ? 'block' : 'none';
    });

    const searchInput = document.getElementById('accountSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => loadAccountsPage(0), 300));
    }

    const selectAll = document.getElementById('selectAllAcc');
    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            document.querySelectorAll('.acc-checkbox').forEach((cb) => { cb.checked = e.target.checked; });
        });
    }
});

/**
 * Tải số liệu thống kê KPI từ /api/admin/users/stats
 */
async function loadStats() {
    try {
        const res = await fetch('/api/admin/users/stats');
        if (!res.ok) throw new Error('API error');
        const stats = await res.json();

        const totalEl = document.getElementById('kpiTotalUsers');
        if (totalEl) totalEl.textContent = stats.totalUsers.toLocaleString('vi-VN');

        const sellerEl = document.getElementById('kpiActiveSellers');
        if (sellerEl) sellerEl.textContent = stats.activeSellers.toLocaleString('vi-VN');

        const lockedEl = document.getElementById('kpiLockedUsers');
        if (lockedEl) lockedEl.textContent = stats.lockedUsers.toLocaleString('vi-VN');

        const newTodayEl = document.getElementById('kpiNewToday');
        if (newTodayEl) newTodayEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">trending_up</span> +${stats.newUsersToday} hôm nay`;
    } catch (err) {
        // Chế độ preview: Giữ nguyên số liệu mock tĩnh ban đầu
    }
}

/**
 * Tải danh sách người dùng từ /api/admin/users
 */
async function loadAccountsPage(page = 0) {
    const activeTab = document.querySelector('#accFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    const keyword = (document.getElementById('accountSearch')?.value || '').trim();

    let roleParam = 'ALL';
    let statusParam = 'ALL';

    if (filter === 'buyer') roleParam = 'BUYER';
    else if (filter === 'seller') roleParam = 'SELLER';
    else if (filter === 'banned') statusParam = 'LOCKED';

    try {
        const params = new URLSearchParams({
            page: page,
            size: currentPagination.size,
            keyword: keyword,
            role: roleParam,
            status: statusParam
        });

        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch from live API');

        const data = await res.json();
        isLiveApiConnected = true;
        currentPagination.page = data.CurrentPage;
        currentPagination.totalPages = data.TotalPages;
        currentPagination.totalRecords = data.TotalRecordCount;
        liveLoadedRecords = data.Records || [];

        renderLiveAccounts(liveLoadedRecords);
        renderPaginationControls();
    } catch (err) {
        // Fallback sang mock data (preview profile)
        isLiveApiConnected = false;
        renderMockAccounts();
    }
}

function renderLiveAccounts(records) {
    const body = document.getElementById('accountsTableBody');
    if (!body) return;

    if (!records || records.length === 0) {
        body.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">Không tìm thấy tài khoản nào phù hợp</td></tr>`;
        return;
    }

    body.innerHTML = records.map((acc) => {
        const statusKey = (acc.accountStatus || 'ACTIVE').toLowerCase();
        const meta = statusMeta[statusKey] || { label: acc.accountStatus, badge: 'secondary' };
        const roleLabel = acc.role === 'ADMIN' ? 'Quản trị' : (acc.isSeller ? 'Người bán' : 'Người mua');
        const roleBadgeClass = acc.role === 'ADMIN' ? 'danger' : (acc.isSeller ? 'primary' : 'secondary');
        const initials = (acc.fullName || 'User').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
        const joinedDate = acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('vi-VN') : '—';
        const isBanned = statusKey === 'locked' || statusKey === 'banned';

        return `
    <tr data-id="${acc.id}">
      <td><input type="checkbox" class="custom-checkbox acc-checkbox" data-id="${acc.id}"></td>
      <td>
        <div class="identity-cell">
          <div class="avatar-chip role-${acc.isSeller ? 'seller' : 'buyer'}">${initials}</div>
          <div class="identity-text">
            <span class="identity-name">${escapeHtml(acc.fullName)} ${acc.authProvider === 'Google' ? '<span class="badge badge-info" style="font-size:10px; margin-left:4px;">Google</span>' : ''}</span>
            <span class="identity-sub">ID: #${acc.id}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${roleBadgeClass}"><span class="badge-dot"></span>${roleLabel}</span></td>
      <td>
        <div class="identity-text">
          <span class="identity-sub">${escapeHtml(acc.email)}</span>
          <span class="identity-sub">${escapeHtml(acc.phone || 'Chưa cập nhật')}</span>
        </div>
      </td>
      <td style="color:var(--text-muted); white-space:nowrap;">${joinedDate}</td>
      <td style="white-space:nowrap;">${acc.totalOrders} đơn ${acc.isSeller ? `· ${acc.totalProducts} truyện` : ''}</td>
      <td style="text-align:center;"><span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span></td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" onclick="viewAccountDetail('${acc.id}')">Xem</button>
          ${isBanned
            ? `<button class="btn btn-primary btn-sm" onclick="openBanModal('${acc.id}', 'unban', '${escapeHtml(acc.fullName)}')">Mở khoá</button>`
            : `<button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openBanModal('${acc.id}', 'ban', '${escapeHtml(acc.fullName)}')">Khoá</button>`}
        </div>
      </td>
    </tr>`;
    }).join('');
}

function renderPaginationControls() {
    const infoEl = document.getElementById('accountsPaginationInfo');
    const controlsEl = document.getElementById('accountsPaginationControls');
    if (!infoEl || !controlsEl) return;

    const start = currentPagination.totalRecords === 0 ? 0 : currentPagination.page * currentPagination.size + 1;
    const end = Math.min((currentPagination.page + 1) * currentPagination.size, currentPagination.totalRecords);
    infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> của <strong>${currentPagination.totalRecords.toLocaleString('vi-VN')}</strong> tài khoản`;

    let html = '';
    const hasPrev = currentPagination.page > 0;
    const hasNext = currentPagination.page < currentPagination.totalPages - 1;

    html += `<button class="page-btn" ${!hasPrev ? 'disabled' : ''} onclick="loadAccountsPage(${currentPagination.page - 1})"><span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span></button>`;

    const total = currentPagination.totalPages;
    const curr = currentPagination.page;
    for (let p = 0; p < total; p++) {
        if (p === 0 || p === total - 1 || (p >= curr - 1 && p <= curr + 1)) {
            html += `<button class="page-btn ${p === curr ? 'active' : ''}" onclick="loadAccountsPage(${p})">${p + 1}</button>`;
        } else if (p === curr - 2 || p === curr + 2) {
            html += `<span style="padding:0 4px; color:var(--text-muted);">...</span>`;
        }
    }

    html += `<button class="page-btn" ${!hasNext ? 'disabled' : ''} onclick="loadAccountsPage(${currentPagination.page + 1})"><span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></button>`;
    controlsEl.innerHTML = html;
}

function renderMockAccounts() {
    const body = document.getElementById('accountsTableBody');
    if (!body) return;

    const activeTab = document.querySelector('#accFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    const query = (document.getElementById('accountSearch')?.value || '').trim().toLowerCase();

    let filtered = accountsData.filter((acc) => {
        let match = true;
        if (filter === 'buyer') match = acc.role === 'buyer';
        else if (filter === 'seller') match = acc.role === 'seller';
        else if (filter === 'reported') match = acc.reported === true;
        else if (filter === 'banned') match = acc.status === 'banned';

        if (match && query) {
            match = acc.name.toLowerCase().includes(query) || acc.email.toLowerCase().includes(query);
        }
        return match;
    });

    body.innerHTML = filtered.map((acc) => {
        const meta = statusMeta[acc.status] || { label: 'Hoạt động', badge: 'success' };
        const roleLabel = acc.role === 'seller' ? 'Người bán' : 'Người mua';
        const initials = acc.name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
        return `
    <tr data-status="${acc.status}" data-role="${acc.role}" data-id="${acc.id}">
      <td><input type="checkbox" class="custom-checkbox acc-checkbox" data-id="${acc.id}"></td>
      <td>
        <div class="identity-cell">
          <div class="avatar-chip role-${acc.role}">${initials}</div>
          <div class="identity-text">
            <span class="identity-name">${escapeHtml(acc.name)}</span>
            <span class="identity-sub">${acc.id}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${acc.role === 'seller' ? 'primary' : 'secondary'}"><span class="badge-dot"></span>${roleLabel}</span></td>
      <td>
        <div class="identity-text">
          <span class="identity-sub">${escapeHtml(acc.email)}</span>
          <span class="identity-sub">${acc.phone}</span>
        </div>
      </td>
      <td style="color:var(--text-muted); white-space:nowrap;">${acc.joined}</td>
      <td style="white-space:nowrap;">${acc.total}</td>
      <td style="text-align:center;"><span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span></td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" onclick="viewAccountDetail('${acc.id}')">Xem</button>
          ${acc.status === 'banned'
            ? `<button class="btn btn-primary btn-sm" onclick="openBanModal('${acc.id}', 'unban', '${escapeHtml(acc.name)}')">Mở khoá</button>`
            : `<button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openBanModal('${acc.id}', 'ban', '${escapeHtml(acc.name)}')">Khoá</button>`}
        </div>
      </td>
    </tr>`;
    }).join('');

    const infoEl = document.getElementById('accountsPaginationInfo');
    if (infoEl) infoEl.innerHTML = `Hiển thị <strong>${filtered.length}</strong> tài khoản (Chế độ xem trước)`;
}

/**
 * Xem chi tiết tài khoản
 */
async function viewAccountDetail(id) {
    if (isLiveApiConnected) {
        try {
            const res = await fetch(`/api/admin/users/${id}`);
            if (!res.ok) throw new Error('Không thể tải thông tin tài khoản');
            const acc = await res.json();

            const statusKey = (acc.accountStatus || 'ACTIVE').toLowerCase();
            const meta = statusMeta[statusKey] || { label: acc.accountStatus, badge: 'secondary' };
            const roleLabel = acc.role === 'ADMIN' ? 'Quản trị viên' : (acc.isSeller ? 'Người bán' : 'Người mua');
            const initials = (acc.fullName || 'User').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
            const joinedDate = acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('vi-VN') : '—';

            document.getElementById('accountDetailBody').innerHTML = `
            <div style="display:flex; gap:14px; align-items:center; margin-bottom:18px;">
              <div class="avatar-chip role-${acc.isSeller ? 'seller' : 'buyer'}" style="width:56px; height:56px; font-size:1.1rem;">${initials}</div>
              <div>
                <div style="font-weight:800; font-size:1.05rem; color:var(--text-main);">${escapeHtml(acc.fullName)}</div>
                <div style="font-size:.8rem; color:var(--text-muted);">Mã: #${acc.id} • ${roleLabel} • Đăng nhập: ${acc.authProvider}</div>
              </div>
              <span class="badge badge-${meta.badge}" style="margin-left:auto;"><span class="badge-dot"></span>${meta.label}</span>
            </div>
            <div class="stat-mini-row">
              <div class="stat-mini"><h5>Email</h5><div class="val" style="font-size:.86rem;">${escapeHtml(acc.email)}</div></div>
              <div class="stat-mini"><h5>Số điện thoại</h5><div class="val" style="font-size:.86rem;">${escapeHtml(acc.phone || 'Chưa có')}</div></div>
              <div class="stat-mini"><h5>Ngày tham gia</h5><div class="val" style="font-size:.86rem;">${joinedDate}</div></div>
              <div class="stat-mini"><h5>Tổng đơn hàng</h5><div class="val" style="font-size:.86rem;">${acc.totalOrders} đơn</div></div>
            </div>
            <div style="margin-top:14px; padding:12px; border-radius:var(--radius-md); background:var(--surface-color, #f8fafc); border:1px solid var(--border-color, #e2e8f0); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:.86rem; font-weight:700;">Quyền Người bán (Seller)</span>
                <p style="font-size:.78rem; color:var(--text-muted); margin:2px 0 0;">${acc.isSeller ? 'Tài khoản có quyền đăng bán và quản lý gian hàng truyện' : 'Tài khoản chỉ có quyền người mua sách'}</p>
              </div>
              <button class="btn btn-sm ${acc.isSeller ? 'btn-outline' : 'btn-primary'}" onclick="toggleSellerRole(${acc.id}, ${!acc.isSeller})">
                ${acc.isSeller ? 'Hạ quyền người bán' : 'Cấp quyền người bán'}
              </button>
            </div>
          `;
            const primaryBtn = document.getElementById('detailPrimaryAction');
            if (primaryBtn) primaryBtn.style.display = 'none'; // Không dùng nút thừa
            openModal('accountDetailModal');
            return;
        } catch (err) {
            // fallback
        }
    }

    // Mock detail
    const acc = accountsData.find((a) => a.id === id);
    if (!acc) return;
    const meta = statusMeta[acc.status];
    document.getElementById('accountDetailBody').innerHTML = `
    <div style="display:flex; gap:14px; align-items:center; margin-bottom:18px;">
      <div class="avatar-chip role-${acc.role}" style="width:56px; height:56px; font-size:1.1rem;">${acc.name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}</div>
      <div>
        <div style="font-weight:800; font-size:1.05rem; color:var(--text-main);">${escapeHtml(acc.name)}</div>
        <div style="font-size:.8rem; color:var(--text-muted);">${acc.id} • ${acc.role === 'seller' ? 'Người bán' : 'Người mua'}</div>
      </div>
      <span class="badge badge-${meta.badge}" style="margin-left:auto;"><span class="badge-dot"></span>${meta.label}</span>
    </div>
    <div class="stat-mini-row">
      <div class="stat-mini"><h5>Email</h5><div class="val" style="font-size:.86rem;">${escapeHtml(acc.email)}</div></div>
      <div class="stat-mini"><h5>Số điện thoại</h5><div class="val" style="font-size:.86rem;">${acc.phone}</div></div>
      <div class="stat-mini"><h5>Ngày tham gia</h5><div class="val" style="font-size:.86rem;">${acc.joined}</div></div>
      <div class="stat-mini"><h5>Tổng giao dịch</h5><div class="val" style="font-size:.86rem;">${acc.total}</div></div>
    </div>
  `;
    const primaryBtn = document.getElementById('detailPrimaryAction');
    if (primaryBtn) primaryBtn.style.display = 'none';
    openModal('accountDetailModal');
}

/**
 * Đổi quyền người bán
 */
async function toggleSellerRole(userId, newIsSeller) {
    try {
        const res = await fetch(`/api/admin/users/${userId}/seller-role?isSeller=${newIsSeller}`, {
            method: 'PATCH'
        });
        if (!res.ok) throw new Error('Không thể thay đổi quyền người bán');
        showToast(newIsSeller ? 'Đã cấp quyền người bán thành công' : 'Đã thu hồi quyền người bán', 'success');
        closeModal('accountDetailModal');
        loadAccountsPage(currentPagination.page);
        loadStats();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'danger');
    }
}

/**
 * Mở modal Khóa / Mở khóa
 */
function openBanModal(id, mode, userName) {
    currentBanTarget = { id, mode, userName };
    const displayName = userName || id;
    document.getElementById('banModalUser').textContent = `${displayName} (#${id})`;
    document.getElementById('banReasonWrap').style.display = mode === 'ban' ? 'block' : 'none';
    document.getElementById('banModalTitle').textContent = mode === 'ban' ? 'Xác nhận khoá tài khoản' : 'Xác nhận mở khoá tài khoản';
    document.getElementById('banModalDesc').innerHTML = mode === 'ban'
        ? `Bạn có chắc chắn muốn khoá tài khoản <strong>${escapeHtml(displayName)}</strong> không? Người dùng sẽ không thể đăng nhập cho đến khi được mở khoá lại.`
        : `Mở khoá tài khoản <strong>${escapeHtml(displayName)}</strong> và cho phép người dùng đăng nhập trở lại?`;
    openModal('banConfirmModal');
}

/**
 * Xác nhận Khóa / Mở khóa
 */
async function confirmBanAction() {
    if (!currentBanTarget) return;

    if (isLiveApiConnected) {
        try {
            const reasonSelect = document.getElementById('banReasonSelect');
            const reasonText = reasonSelect ? reasonSelect.options[reasonSelect.selectedIndex].text : '';
            const newStatus = currentBanTarget.mode === 'ban' ? 'LOCKED' : 'ACTIVE';

            const res = await fetch(`/api/admin/users/${currentBanTarget.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    reason: reasonText
                })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || 'Không thể cập nhật trạng thái');
            }

            showToast(currentBanTarget.mode === 'ban' ? `Đã khoá tài khoản ${currentBanTarget.userName}` : `Đã mở khoá tài khoản ${currentBanTarget.userName}`, currentBanTarget.mode === 'ban' ? 'danger' : 'success');
            closeModal('banConfirmModal');
            loadAccountsPage(currentPagination.page);
            loadStats();
            currentBanTarget = null;
            return;
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'danger');
            closeModal('banConfirmModal');
            currentBanTarget = null;
            return;
        }
    }

    // Mock action
    const acc = accountsData.find((a) => a.id === currentBanTarget.id);
    if (acc) {
        acc.status = currentBanTarget.mode === 'ban' ? 'banned' : 'active';
        renderMockAccounts();
        showToast(currentBanTarget.mode === 'ban' ? `Đã khoá tài khoản ${acc.name}` : `Đã mở khoá tài khoản ${acc.name}`, currentBanTarget.mode === 'ban' ? 'danger' : 'success');
    }
    closeModal('banConfirmModal');
    currentBanTarget = null;
}

/**
 * Tạo tài khoản mới từ Admin
 */
async function createManualAccount() {
    const name = document.getElementById('newAccName').value.trim();
    const email = document.getElementById('newAccEmail').value.trim();
    const phone = document.getElementById('newAccPhone')?.value.trim() || '';
    const password = document.getElementById('newAccPassword')?.value.trim() || '';
    const role = document.getElementById('newAccRole').value;

    if (!name || !email) {
        showToast('Vui lòng nhập đầy đủ họ tên và email', 'warning');
        return;
    }

    if (isLiveApiConnected) {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: name,
                    email: email,
                    phone: phone,
                    password: password,
                    role: role
                })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || 'Lỗi khi tạo tài khoản');
            }

            showToast(`Đã tạo tài khoản mới cho ${name}`, 'success');
            closeModal('createStaffAccModal');
            // Reset input
            document.getElementById('newAccName').value = '';
            document.getElementById('newAccEmail').value = '';
            if (document.getElementById('newAccPhone')) document.getElementById('newAccPhone').value = '';
            if (document.getElementById('newAccPassword')) document.getElementById('newAccPassword').value = '';

            loadAccountsPage(0);
            loadStats();
            return;
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'danger');
            return;
        }
    }

    // Mock creation
    accountsData.unshift({
        id: `${Math.floor(10000 + Math.random() * 9999)}`,
        name,
        email,
        phone: phone || '0900.***.000',
        role,
        joined: new Date().toLocaleDateString('vi-VN'),
        total: '0 đơn · 0 ₫',
        status: 'active',
        reported: false,
        verified: false,
    });
    renderMockAccounts();
    closeModal('createStaffAccModal');
    showToast(`Đã tạo tài khoản mới cho ${name}`, 'success');
}