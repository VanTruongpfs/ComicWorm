const accountsData = [
    { id: 'U-10231', name: 'Trần Đăng Khoa', email: 'khoa.tran@gmail.com', phone: '0912.***.881', role: 'seller', joined: '12/03/2023', total: '486 đơn · 128.4tr ₫', status: 'active', reported: false, verified: true },
    { id: 'U-10589', name: 'Nguyễn Thị Hồng', email: 'hong.nguyen@gmail.com', phone: '0987.***.204', role: 'buyer', joined: '04/07/2024', total: '38 đơn · 4.2tr ₫', status: 'active', reported: false, verified: true },
    { id: 'U-10902', name: 'Lê Văn Phát', email: 'phat.le@gmail.com', phone: '0933.***.552', role: 'seller', joined: '19/01/2024', total: '212 đơn · 56.7tr ₫', status: 'reported', reported: true, verified: true },
    { id: 'U-11045', name: 'Vũ Tuấn Kiệt', email: 'kiet.vu@gmail.com', phone: '0912.***.112', role: 'buyer', joined: '30/09/2024', total: '5 đơn · 480k ₫', status: 'active', reported: false, verified: false },
    { id: 'U-11290', name: 'Phạm Thị Ngọc', email: 'ngoc.pham@gmail.com', phone: '0977.***.331', role: 'seller', joined: '02/02/2022', total: '1.204 đơn · 340.6tr ₫', status: 'active', reported: false, verified: true },
    { id: 'U-11384', name: 'Hoàng Gia Bảo', email: 'bao.hoang@gmail.com', phone: '0909.***.774', role: 'buyer', joined: '15/05/2025', total: '2 đơn · 190k ₫', status: 'active', reported: false, verified: false },
    { id: 'U-11402', name: 'Đỗ Minh Anh', email: 'anh.do@gmail.com', phone: '0966.***.128', role: 'seller', joined: '21/11/2023', total: '89 đơn · 22.1tr ₫', status: 'banned', reported: true, verified: true },
    { id: 'U-11501', name: 'Bùi Thu Trang', email: 'trang.bui@gmail.com', phone: '0945.***.660', role: 'buyer', joined: '08/08/2024', total: '61 đơn · 7.8tr ₫', status: 'active', reported: false, verified: true },
    { id: 'U-11623', name: 'Ngô Hải Đăng', email: 'dang.ngo@gmail.com', phone: '0918.***.903', role: 'seller', joined: '17/06/2024', total: '154 đơn · 48.9tr ₫', status: 'active', reported: false, verified: true },
    { id: 'U-11740', name: 'Trịnh Bảo Châu', email: 'chau.trinh@gmail.com', phone: '0938.***.417', role: 'buyer', joined: '01/01/2025', total: '14 đơn · 1.6tr ₫', status: 'active', reported: false, verified: true },
];

const statusMeta = {
    active: { label: 'Hoạt động', badge: 'success' },
    reported: { label: 'Bị báo cáo', badge: 'warning' },
    banned: { label: 'Đã khoá', badge: 'danger' },
};

let currentBanTarget = null;

/* ==========================================================================
   DUYỆT ĐĂNG KÝ NGƯỜI BÁN
   ========================================================================== */
const sellerApplications = [
    { id: 'SR-3001', applicantName: 'Đặng Thị Lan', applicantId: 'U-12001', email: 'lan.dang@gmail.com', phone: '0901.222.333', shopName: 'Góc Sách Xưa', category: 'Văn học trong nước, Truyện tranh', address: 'Quận 7, TP.HCM', idCardNo: '079204xxxxxx', submitted: '25/09/2026', status: 'pending' },
    { id: 'SR-3002', applicantName: 'Phan Gia Huy', applicantId: 'U-12045', email: 'huy.phan@gmail.com', phone: '0912.555.678', shopName: 'Huy Comic Store', category: 'Truyện tranh / Manga', address: 'Quận Tân Bình, TP.HCM', idCardNo: '079301xxxxxx', submitted: '24/09/2026', status: 'pending' },
    { id: 'SR-3003', applicantName: 'Lâm Ngọc Diễm', applicantId: 'U-12078', email: 'diem.lam@gmail.com', phone: '0987.111.222', shopName: 'Diễm Books Hà Nội', category: 'Truyện thiếu nhi, Light Novel', address: 'Quận Đống Đa, Hà Nội', idCardNo: '001199xxxxxx', submitted: '23/09/2026', status: 'pending' },
    { id: 'SR-3004', applicantName: 'Nguyễn Hữu Thịnh', applicantId: 'U-12090', email: 'thinh.nguyen@gmail.com', phone: '0933.444.555', shopName: 'Thịnh Sách Cũ', category: 'Truyện hiếm / Bản sưu tầm', address: 'TP. Cần Thơ', idCardNo: '092210xxxxxx', submitted: '22/09/2026', status: 'pending' },
    { id: 'SR-2988', applicantName: 'Vương Bảo Trân', applicantId: 'U-11987', email: 'tran.vuong@gmail.com', phone: '0977.222.111', shopName: 'Trân Book Corner', category: 'Tiểu thuyết / Truyện dài', address: 'Quận Hải Châu, Đà Nẵng', idCardNo: '048187xxxxxx', submitted: '18/09/2026', status: 'approved', decidedNote: 'Hồ sơ hợp lệ, đã cấp quyền người bán.' },
    { id: 'SR-2975', applicantName: 'Đinh Quang Vinh', applicantId: 'U-11955', email: 'vinh.dinh@gmail.com', phone: '0966.333.444', shopName: 'Vinh Truyện Tranh', category: 'Truyện tranh / Manga', address: 'Quận Bình Tân, TP.HCM', idCardNo: '079185xxxxxx', submitted: '15/09/2026', status: 'rejected', decidedNote: 'Giấy tờ tuỳ thân mờ, không xác minh được thông tin.' },
];

const sellerAppStatusMeta = {
    pending: { label: 'Chờ duyệt', badge: 'warning' },
    approved: { label: 'Đã duyệt', badge: 'success' },
    rejected: { label: 'Đã từ chối', badge: 'danger' },
};

let currentSellerAppTarget = null;

function renderSellerApps() {
    const activeTab = document.querySelector('#sellerAppFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'pending';
    const rows = sellerApplications.filter((a) => a.status === filter);

    const body = document.getElementById('sellerAppTableBody');
    body.innerHTML = rows.length ? rows.map((a) => {
        const meta = sellerAppStatusMeta[a.status];
        const initials = a.applicantName.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
        return `
    <tr>
      <td>
        <div class="identity-cell">
          <div class="avatar-chip role-seller">${initials}</div>
          <div class="identity-text">
            <span class="identity-name">${escapeHtml(a.applicantName)}</span>
            <span class="identity-sub">${a.applicantId} · ${escapeHtml(a.email)}</span>
          </div>
        </div>
      </td>
      <td style="font-weight:700; color:var(--text-main);">${escapeHtml(a.shopName)}</td>
      <td style="color:var(--text-muted);">${escapeHtml(a.category)}</td>
      <td style="color:var(--text-muted); white-space:nowrap;">${a.submitted}</td>
      <td style="text-align:center;"><span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span></td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" onclick="viewSellerAppDetail('${a.id}')">Xem hồ sơ</button>
          ${a.status === 'pending' ? `
          <button class="btn btn-primary btn-sm" onclick="openApproveAppModal('${a.id}')">Duyệt</button>
          <button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openRejectAppModal('${a.id}')">Từ chối</button>` : ''}
        </div>
      </td>
    </tr>`;
    }).join('') : `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">Không có hồ sơ nào ở trạng thái này</td></tr>`;

    const pendingCount = sellerApplications.filter((a) => a.status === 'pending').length;
    const badgeEl = document.getElementById('sellerAppPendingCount');
    if (badgeEl) badgeEl.textContent = pendingCount;
    const tabCountEl = document.getElementById('sellerAppPendingTabCount');
    if (tabCountEl) tabCountEl.textContent = pendingCount;
}

function viewSellerAppDetail(id) {
    const a = sellerApplications.find((x) => x.id === id);
    if (!a) return;
    const meta = sellerAppStatusMeta[a.status];
    document.getElementById('sellerAppDetailBody').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
      <div class="avatar-chip role-seller" style="width:52px; height:52px; font-size:1.05rem;">${a.applicantName.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}</div>
      <div>
        <div style="font-weight:800; font-size:1.05rem; color:var(--text-main);">${escapeHtml(a.applicantName)}</div>
        <div style="font-size:.8rem; color:var(--text-muted);">${a.applicantId} · Nộp ngày ${a.submitted}</div>
      </div>
      <span class="badge badge-${meta.badge}" style="margin-left:auto;"><span class="badge-dot"></span>${meta.label}</span>
    </div>
    <div class="stat-mini-row" style="margin-bottom:14px;">
      <div class="stat-mini"><h5>Tên gian hàng</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.shopName)}</div></div>
      <div class="stat-mini"><h5>Danh mục kinh doanh</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.category)}</div></div>
      <div class="stat-mini"><h5>Email</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.email)}</div></div>
      <div class="stat-mini"><h5>Số điện thoại</h5><div class="val" style="font-size:.86rem;">${a.phone}</div></div>
      <div class="stat-mini"><h5>Địa chỉ gian hàng</h5><div class="val" style="font-size:.86rem;">${escapeHtml(a.address)}</div></div>
      <div class="stat-mini"><h5>Số CMND/CCCD</h5><div class="val" style="font-size:.86rem;">${a.idCardNo}</div></div>
    </div>
    ${a.decidedNote ? `<div style="padding:12px 14px; border-radius:var(--radius-md); background:${a.status === 'approved' ? 'var(--success-bg)' : 'var(--danger-bg)'}; color:${a.status === 'approved' ? 'var(--success-text)' : 'var(--danger-text)'}; font-size:.82rem; line-height:1.55;"><strong>${a.status === 'approved' ? 'Đã duyệt:' : 'Đã từ chối:'}</strong> ${escapeHtml(a.decidedNote)}</div>` : ''}
  `;
    const actions = document.getElementById('sellerAppDetailActions');
    actions.innerHTML = a.status === 'pending'
        ? `<button class="btn btn-outline" onclick="closeModal('sellerAppDetailModal')">Đóng</button>
           <button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="closeModal('sellerAppDetailModal'); openRejectAppModal('${a.id}');">Từ chối</button>
           <button class="btn btn-primary" onclick="closeModal('sellerAppDetailModal'); openApproveAppModal('${a.id}');">Duyệt gian hàng</button>`
        : `<button class="btn btn-outline" onclick="closeModal('sellerAppDetailModal')">Đóng</button>`;
    openModal('sellerAppDetailModal');
}

function openApproveAppModal(id) {
    const a = sellerApplications.find((x) => x.id === id);
    if (!a) return;
    currentSellerAppTarget = id;
    document.getElementById('approveAppShopName').textContent = a.shopName;
    document.getElementById('approveAppApplicant').textContent = a.applicantName;
    openModal('sellerAppApproveModal');
}

function confirmApproveApp() {
    if (!currentSellerAppTarget) return;
    const a = sellerApplications.find((x) => x.id === currentSellerAppTarget);
    if (a) {
        a.status = 'approved';
        a.decidedNote = 'Hồ sơ hợp lệ, đã cấp quyền người bán.';

        const existingAcc = accountsData.find((acc) => acc.id === a.applicantId);
        if (existingAcc) {
            existingAcc.role = 'seller';
        } else {
            accountsData.unshift({
                id: a.applicantId, name: a.applicantName, email: a.email, phone: a.phone,
                role: 'seller', joined: new Date().toLocaleDateString('vi-VN'), total: '0 đơn · 0 ₫',
                status: 'active', reported: false, verified: true,
            });
        }
        renderAccounts();
        applyFilters();
        renderSellerApps();
        showToast(`Đã duyệt gian hàng "${a.shopName}" cho ${a.applicantName}`, 'success');
    }
    closeModal('sellerAppApproveModal');
    currentSellerAppTarget = null;
}

function openRejectAppModal(id) {
    const a = sellerApplications.find((x) => x.id === id);
    if (!a) return;
    currentSellerAppTarget = id;
    document.getElementById('rejectAppShopName').textContent = a.shopName;
    openModal('sellerAppRejectModal');
}

function confirmRejectApp() {
    if (!currentSellerAppTarget) return;
    const a = sellerApplications.find((x) => x.id === currentSellerAppTarget);
    if (a) {
        const reasonSelect = document.getElementById('rejectAppReasonSelect');
        const reasonText = reasonSelect.options[reasonSelect.selectedIndex].text;
        a.status = 'rejected';
        a.decidedNote = reasonText;
        renderSellerApps();
        showToast(`Đã từ chối đăng ký gian hàng "${a.shopName}"`, 'danger');
    }
    closeModal('sellerAppRejectModal');
    currentSellerAppTarget = null;
}

document.addEventListener('DOMContentLoaded', () => {
    renderAccounts();
    renderSellerApps();
    initSlidingTabs(document.getElementById('accFilterTabs'), applyFilters);
    initSlidingTabs(document.getElementById('sellerAppFilterTabs'), renderSellerApps);
    initSlidingTabs(document.getElementById('accountsSegControl'), (tab) => {
        const view = tab.dataset.view;
        document.getElementById('accountsListView').style.display = view === 'list' ? 'block' : 'none';
        document.getElementById('sellerAppView').style.display = view === 'sellerApps' ? 'block' : 'none';
    });
    document.getElementById('accountSearch').addEventListener('input', debounce(applyFilters, 200));
    document.getElementById('selectAllAcc').addEventListener('change', (e) => {
        document.querySelectorAll('.acc-checkbox').forEach((cb) => { cb.checked = e.target.checked; });
    });
});

function renderAccounts() {
    const body = document.getElementById('accountsTableBody');
    body.innerHTML = accountsData.map((acc) => {
        const meta = statusMeta[acc.status];
        const roleLabel = acc.role === 'seller' ? 'Người bán' : 'Người mua';
        const initials = acc.name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
        return `
    <tr data-status="${acc.status}" data-role="${acc.role}" data-reported="${acc.reported}" data-name="${acc.name.toLowerCase()}" data-email="${acc.email.toLowerCase()}">
      <td><input type="checkbox" class="custom-checkbox acc-checkbox" data-id="${acc.id}"></td>
      <td>
        <div class="identity-cell">
          <div class="avatar-chip role-${acc.role}">${initials}</div>
          <div class="identity-text">
            <span class="identity-name">${escapeHtml(acc.name)} ${acc.verified ? '<span class="material-symbols-outlined" style="font-size:14px; color:var(--info); vertical-align:middle;" title="Đã xác minh">verified</span>' : ''}</span>
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
            ? `<button class="btn btn-primary btn-sm" onclick="openBanModal('${acc.id}', 'unban')">Mở khoá</button>`
            : `<button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openBanModal('${acc.id}', 'ban')">Khoá</button>`}
        </div>
      </td>
    </tr>`;
    }).join('');
}

function applyFilters() {
    const activeTab = document.querySelector('#accFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    const query = document.getElementById('accountSearch').value.trim().toLowerCase();

    document.querySelectorAll('#accountsTableBody tr').forEach((row) => {
        let visible = true;
        if (filter === 'buyer') visible = row.dataset.role === 'buyer';
        else if (filter === 'seller') visible = row.dataset.role === 'seller';
        else if (filter === 'reported') visible = row.dataset.reported === 'true';
        else if (filter === 'banned') visible = row.dataset.status === 'banned';

        if (visible && query) {
            visible = row.dataset.name.includes(query) || row.dataset.email.includes(query);
        }

        row.classList.toggle('row-hidden', !visible);
    });
}

function viewAccountDetail(id) {
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
    ${acc.reported ? `<div style="margin-top:16px; background:var(--warning-bg); border:1px solid #fde68a; border-radius:var(--radius-md); padding:12px 14px; font-size:.82rem; color:var(--warning-text);">⚠️ Tài khoản này hiện có báo cáo vi phạm đang chờ xác minh từ đội kiểm duyệt.</div>` : ''}
  `;
    const primaryBtn = document.getElementById('detailPrimaryAction');
    primaryBtn.textContent = acc.verified ? 'Đã xác minh' : 'Xác minh tài khoản';
    primaryBtn.disabled = acc.verified;
    primaryBtn.onclick = () => { showToast(`Đã xác minh tài khoản ${acc.name}`, 'success'); closeModal('accountDetailModal'); };
    openModal('accountDetailModal');
}

function openBanModal(id, mode) {
    const acc = accountsData.find((a) => a.id === id);
    if (!acc) return;
    currentBanTarget = { id, mode };
    document.getElementById('banModalUser').textContent = `${acc.name} (${acc.id})`;
    document.getElementById('banReasonWrap').style.display = mode === 'ban' ? 'block' : 'none';
    document.getElementById('banModalTitle').textContent = mode === 'ban' ? 'Xác nhận khoá tài khoản' : 'Xác nhận mở khoá tài khoản';
    document.getElementById('banModalDesc').innerHTML = mode === 'ban'
        ? `Bạn có chắc chắn muốn khoá tài khoản <strong id="banModalUser2">${acc.name}</strong> không? Người dùng sẽ không thể đăng nhập cho đến khi được mở khoá lại.`
        : `Mở khoá tài khoản <strong>${acc.name}</strong> và cho phép người dùng đăng nhập trở lại?`;
    openModal('banConfirmModal');
}

function confirmBanAction() {
    if (!currentBanTarget) return;
    const acc = accountsData.find((a) => a.id === currentBanTarget.id);
    if (acc) {
        acc.status = currentBanTarget.mode === 'ban' ? 'banned' : 'active';
        renderAccounts();
        applyFilters();
        showToast(currentBanTarget.mode === 'ban' ? `Đã khoá tài khoản ${acc.name}` : `Đã mở khoá tài khoản ${acc.name}`, currentBanTarget.mode === 'ban' ? 'danger' : 'success');
    }
    closeModal('banConfirmModal');
    currentBanTarget = null;
}

function createManualAccount() {
    const name = document.getElementById('newAccName').value.trim();
    const email = document.getElementById('newAccEmail').value.trim();
    const role = document.getElementById('newAccRole').value;
    if (!name || !email) {
        showToast('Vui lòng nhập đầy đủ họ tên và email', 'warning');
        return;
    }
    accountsData.unshift({
        id: `U-${Math.floor(10000 + Math.random() * 9999)}`, name, email, phone: '0900.***.000',
        role, joined: new Date().toLocaleDateString('vi-VN'), total: '0 đơn · 0 ₫', status: 'active', reported: false, verified: false,
    });
    renderAccounts();
    applyFilters();
    closeModal('createStaffAccModal');
    showToast(`Đã tạo tài khoản mới cho ${name}`, 'success');
}