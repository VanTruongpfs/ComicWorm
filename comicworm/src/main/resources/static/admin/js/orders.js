/**
 * BookMooch Admin Console - Quản lý đơn hàng (orders.html)
 * Danh sách đơn toàn sàn, lọc theo trạng thái, xem chi tiết & hoà giải tranh chấp.
 */

const ordersData = [
    { code: 'ORD-90512', buyer: 'Nguyễn Thị Hồng', buyerId: 'U-10589', seller: 'Trần Đăng Khoa', sellerId: 'U-10231', product: 'Doraemon - Trọn bộ 45 tập', productCode: 'SP-20458', coverTone: 'orange', coverIcon: 'auto_stories', amount: 890000, status: 'processing', placed: 'Hôm nay, 09:15' },
    { code: 'ORD-90498', buyer: 'Vũ Tuấn Kiệt', buyerId: 'U-11045', seller: 'Phạm Thị Ngọc', sellerId: 'U-11290', product: 'Nhà Giả Kim (bìa cứng)', productCode: 'SP-20461', coverTone: 'blue', coverIcon: 'menu_book', amount: 145000, status: 'processing', placed: 'Hôm nay, 08:40' },
    { code: 'ORD-90480', buyer: 'Hoàng Gia Bảo', buyerId: 'U-11384', seller: 'Ngô Hải Đăng', sellerId: 'U-11623', product: 'Sapiens - Lược sử loài người', productCode: 'SP-20473', coverTone: 'green', coverIcon: 'import_contacts', amount: 1240000, status: 'shipping', placed: 'Hôm qua, 19:30' },
    { code: 'ORD-90465', buyer: 'Bùi Thu Trang', buyerId: 'U-11501', seller: 'Lê Văn Phát', sellerId: 'U-10902', product: 'Conan - Tập 1 đến 20', productCode: 'SP-20479', coverTone: 'orange', coverIcon: 'auto_stories', amount: 620000, status: 'shipping', placed: 'Hôm qua, 15:05' },
    { code: 'ORD-90441', buyer: 'Trịnh Bảo Châu', buyerId: 'U-11740', seller: 'Đỗ Minh Anh', sellerId: 'U-11402', product: 'Atomic Habits (bản dịch)', productCode: 'SP-20488', coverTone: 'purple', coverIcon: 'menu_book', amount: 128000, status: 'completed', placed: '2 ngày trước' },
    { code: 'ORD-90420', buyer: 'Đỗ Minh Anh', buyerId: 'U-11402', seller: 'Trần Đăng Khoa', sellerId: 'U-10231', product: 'One Piece - Tập 90-100', productCode: 'SP-20495', coverTone: 'orange', coverIcon: 'auto_stories', amount: 340000, status: 'completed', placed: '2 ngày trước' },
    { code: 'ORD-90402', buyer: 'Ngô Hải Đăng', buyerId: 'U-11623', seller: 'Phạm Thị Ngọc', sellerId: 'U-11290', product: 'Tuổi Trẻ Đáng Giá Bao Nhiêu', productCode: 'SP-20502', coverTone: 'blue', coverIcon: 'menu_book', amount: 98000, status: 'completed', placed: '3 ngày trước' },
    { code: 'ORD-90211', buyer: 'Lê Văn Phát', buyerId: 'U-10902', seller: 'Bùi Thu Trang', sellerId: 'U-11501', product: 'Harry Potter - Trọn bộ 7 tập', productCode: 'SP-20510', coverTone: 'green', coverIcon: 'import_contacts', amount: 1560000, status: 'disputed', placed: '3 ngày trước', disputeReason: 'Người mua báo nhận sách bị rách bìa, sai mô tả tình trạng.' },
    { code: 'ORD-90188', buyer: 'Phạm Thị Ngọc', buyerId: 'U-11290', seller: 'Vũ Tuấn Kiệt', sellerId: 'U-11045', product: 'Đắc Nhân Tâm', productCode: 'SP-20517', coverTone: 'purple', coverIcon: 'menu_book', amount: 76000, status: 'disputed', placed: '4 ngày trước', disputeReason: 'Người bán khiếu nại người mua yêu cầu hoàn tiền sau khi đã nhận hàng đúng mô tả.' },
    { code: 'ORD-90150', buyer: 'Nguyễn Thị Hồng', buyerId: 'U-10589', seller: 'Ngô Hải Đăng', sellerId: 'U-11623', product: 'Cây Cam Ngọt Của Tôi', productCode: 'SP-20523', coverTone: 'orange', coverIcon: 'import_contacts', amount: 89000, status: 'cancelled', placed: '5 ngày trước' },
];

const orderStatusMeta = {
    processing: { label: 'Đang xử lý', badge: 'info', icon: 'hourglass_top' },
    shipping: { label: 'Đang giao', badge: 'warning', icon: 'local_shipping' },
    completed: { label: 'Hoàn tất', badge: 'success', icon: 'check_circle' },
    disputed: { label: 'Tranh chấp', badge: 'danger', icon: 'gavel' },
    cancelled: { label: 'Đã huỷ', badge: 'secondary', icon: 'cancel' },
};

let disputeTargetCode = null;
const ORDERS_PAGE_SIZE = 4;
let currentOrdersPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    renderOrdersTable();
    initSlidingTabs(document.getElementById('orderFilterTabs'), () => {
        currentOrdersPage = 1;
        renderOrdersTable();
    });
    document.getElementById('orderSearch').addEventListener('input', debounce(() => {
        currentOrdersPage = 1;
        renderOrdersTable();
    }, 200));

    if (window.location.hash === '#disputes') {
        setTimeout(() => document.getElementById('disputedTabBtn').click(), 80);
    }
});

function getFilteredOrders() {
    const activeTab = document.querySelector('#orderFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    const query = document.getElementById('orderSearch').value.trim().toLowerCase();
    return ordersData.filter((o) => {
        let visible = filter === 'all' || o.status === filter;
        if (visible && query) {
            visible = o.code.toLowerCase().includes(query)
                || o.buyer.toLowerCase().includes(query)
                || o.seller.toLowerCase().includes(query);
        }
        return visible;
    });
}

function renderOrdersTable() {
    const filtered = getFilteredOrders();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PAGE_SIZE));
    if (currentOrdersPage > totalPages) currentOrdersPage = totalPages;
    const start = (currentOrdersPage - 1) * ORDERS_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + ORDERS_PAGE_SIZE);

    const body = document.getElementById('ordersTableBody');
    body.innerHTML = pageItems.length ? pageItems.map((o) => {
        const meta = orderStatusMeta[o.status];
        return `
    <tr>
      <td>
        <div class="order-id-cell">
          <div class="order-code">${o.code} <button class="copy-btn" onclick="copyText('${o.code}')" title="Sao chép mã đơn"><span class="material-symbols-outlined" style="font-size:15px;">content_copy</span></button></div>
          <div class="order-date"><span class="material-symbols-outlined" style="font-size:13px;">schedule</span> ${o.placed}</div>
        </div>
      </td>
      <td><div class="identity-name" style="font-size:.86rem;">${escapeHtml(o.buyer)}</div><div class="identity-sub">${o.buyerId}</div></td>
      <td><div class="identity-name" style="font-size:.86rem;">${escapeHtml(o.seller)}</div><div class="identity-sub">${o.sellerId}</div></td>
      <td style="color:var(--text-muted); max-width:240px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="product-cover tone-${o.coverTone}" style="width:34px; height:44px; border-radius:6px;"><span class="material-symbols-outlined" style="font-size:16px;">${o.coverIcon}</span></div>
          <span>${escapeHtml(o.product)}</span>
        </div>
      </td>
      <td style="text-align:right; font-weight:700; color:var(--text-main); white-space:nowrap;">${formatNumber(o.amount)} ₫</td>
      <td style="text-align:center;">
        <span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span>
      </td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" onclick="viewOrderDetail('${o.code}')">Xem</button>
          ${o.status === 'disputed' ? `<button class="btn btn-primary btn-sm" onclick="openDisputeModal('${o.code}')">Hoà giải</button>` : ''}
        </div>
      </td>
    </tr>`;
    }).join('') : `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">Không tìm thấy đơn hàng phù hợp</td></tr>`;

    renderOrdersPagination(filtered.length, start, pageItems.length, totalPages);
}

function renderOrdersPagination(total, start, count, totalPages) {
    const info = document.getElementById('ordersPaginationInfo');
    info.innerHTML = total === 0
        ? 'Không có đơn hàng nào phù hợp với bộ lọc hiện tại'
        : `Hiển thị <strong>${start + 1} - ${start + count}</strong> của <strong>${total}</strong> đơn hàng`;

    const controls = document.getElementById('ordersPaginationControls');
    let pageButtons = '';
    for (let p = 1; p <= totalPages; p++) {
        pageButtons += `<button class="page-btn ${p === currentOrdersPage ? 'active' : ''}" onclick="goToOrdersPage(${p})">${p}</button>`;
    }
    controls.innerHTML = `
      <button class="page-btn" ${currentOrdersPage <= 1 ? 'disabled' : ''} onclick="goToOrdersPage(${currentOrdersPage - 1})"><span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span></button>
      ${pageButtons}
      <button class="page-btn" ${currentOrdersPage >= totalPages ? 'disabled' : ''} onclick="goToOrdersPage(${currentOrdersPage + 1})"><span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></button>
    `;
}

function goToOrdersPage(p) {
    currentOrdersPage = p;
    renderOrdersTable();
}

const orderStepsByStatus = {
    processing: 1,
    shipping: 2,
    completed: 3,
    disputed: 2,
    cancelled: 0,
};

function viewOrderDetail(code) {
    const o = ordersData.find((x) => x.code === code);
    if (!o) return;
    const meta = orderStatusMeta[o.status];
    const step = orderStepsByStatus[o.status];
    const stepLabels = ['Đặt hàng', 'Người bán xác nhận', 'Đang giao', 'Hoàn tất'];

    document.getElementById('orderDetailBody').innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
      <div class="order-code" style="font-size:1.05rem;">${o.code}</div>
      <span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span>
    </div>

    <!-- THÔNG TIN SẢN PHẨM -->
    <div style="display:flex; gap:14px; padding:14px; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-bg); margin-bottom:18px;">
      <div class="product-cover tone-${o.coverTone}">
        <span class="material-symbols-outlined">${o.coverIcon}</span>
      </div>
      <div style="min-width:0;">
        <div style="color:var(--text-muted); font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px;">Sản phẩm</div>
        <div style="font-weight:700; color:var(--text-main); font-size:.94rem; margin-bottom:4px;">${escapeHtml(o.product)}</div>
        <div class="order-code" style="font-size:.8rem;">${o.productCode} <button class="copy-btn" onclick="copyText('${o.productCode}')" title="Sao chép mã sản phẩm"><span class="material-symbols-outlined" style="font-size:13px;">content_copy</span></button></div>
      </div>
    </div>

    <div class="stat-mini-row" style="margin-bottom:18px;">
      <div class="stat-mini">
        <h5>Người mua</h5>
        <div class="val" style="font-size:.86rem;">${escapeHtml(o.buyer)}</div>
        <div class="identity-sub" style="margin-top:2px;">${o.buyerId}</div>
      </div>
      <div class="stat-mini">
        <h5>Người bán</h5>
        <div class="val" style="font-size:.86rem;">${escapeHtml(o.seller)}</div>
        <div class="identity-sub" style="margin-top:2px;">${o.sellerId}</div>
      </div>
      <div class="stat-mini"><h5>Sản phẩm</h5><div class="val" style="font-size:.86rem;">${escapeHtml(o.product)}</div></div>
      <div class="stat-mini"><h5>Giá trị đơn</h5><div class="val" style="font-size:.86rem;">${formatNumber(o.amount)} ₫</div></div>
    </div>
    ${o.status !== 'cancelled' ? `
    <div class="stepper-progress">
      <div class="stepper-line"><div class="stepper-line-fill" style="width:${(step / 3) * 100}%;"></div></div>
      ${stepLabels.map((label, i) => `
        <div class="stepper-step ${i < step ? 'completed' : i === step ? 'active' : ''}">
          <div class="step-circle">${i < step ? '<span class="material-symbols-outlined" style="font-size:16px;">check</span>' : i + 1}</div>
          <div class="step-label">${label}</div>
        </div>
      `).join('')}
    </div>` : `<div style="padding:14px 16px; background:var(--surface-bg); border-radius:var(--radius-md); color:var(--text-muted); font-size:.84rem;">Đơn hàng đã bị huỷ, không còn tiến trình giao vận.</div>`}
    ${o.status === 'disputed' ? `<div style="margin-top:18px; background:var(--danger-bg); border:1px solid #fecaca; border-radius:var(--radius-md); padding:12px 14px; font-size:.82rem; color:var(--danger-text); line-height:1.55;"><strong>Lý do tranh chấp:</strong> ${escapeHtml(o.disputeReason || '—')}</div>` : ''}
    ${o.resolution ? `
    <div class="dispute-resolution-box">
      <strong><span class="material-symbols-outlined" style="font-size:15px; vertical-align:-3px;">task_alt</span> Đã xử lý tranh chấp</strong> — nghiêng về ${o.resolution.favor === 'buyer' ? 'người mua' : 'người bán'}, lúc ${o.resolution.resolvedAt}.
      <div style="margin-top:6px; color:var(--text-main);">Ghi chú: ${escapeHtml(o.resolution.note)}</div>
    </div>` : ''}
  `;

    const extraActions = document.getElementById('orderDetailExtraActions');
    extraActions.innerHTML = o.status === 'disputed'
        ? `<button class="btn btn-primary" onclick="closeModal('orderDetailModal'); openDisputeModal('${o.code}');">Xử lý tranh chấp</button>`
        : '';

    openModal('orderDetailModal');
}

/* ==========================================================================
   QUY TRÌNH HOÀ GIẢI TRANH CHẤP - 3 bước:
   1) Xem lại nội dung khiếu nại  2) Chọn hướng xử lý  3) Ghi chú & xác nhận
   ========================================================================== */
function openDisputeModal(code) {
    const o = ordersData.find((x) => x.code === code);
    if (!o) return;
    disputeTargetCode = code;
    document.getElementById('disputeOrderCode').textContent = code;
    document.getElementById('disputeReasonBox').innerHTML = `<strong>Khiếu nại:</strong> ${escapeHtml(o.disputeReason || 'Không có mô tả')}`;
    document.getElementById('disputeNote').value = '';
    document.querySelectorAll('input[name="disputeChoice"]').forEach((r) => { r.checked = false; });
    document.getElementById('disputeChoiceHint').style.display = 'none';
    document.getElementById('disputeConfirmBtn').disabled = true;
    openModal('disputeModal');
}

function onDisputeChoiceChange() {
    const picked = document.querySelector('input[name="disputeChoice"]:checked');
    const note = document.getElementById('disputeNote').value.trim();
    const hint = document.getElementById('disputeChoiceHint');

    if (picked) {
        hint.style.display = 'flex';
        hint.innerHTML = picked.value === 'buyer'
            ? '<span class="material-symbols-outlined">info</span> Hệ thống sẽ hoàn tiền cho người mua và đóng đơn ở trạng thái đã xử lý.'
            : '<span class="material-symbols-outlined">info</span> Hệ thống sẽ giải ngân tiền cho người bán và đóng đơn ở trạng thái đã xử lý.';
    } else {
        hint.style.display = 'none';
    }

    document.getElementById('disputeConfirmBtn').disabled = !(picked && note);
}

function confirmResolveDispute() {
    const picked = document.querySelector('input[name="disputeChoice"]:checked');
    const note = document.getElementById('disputeNote').value.trim();
    if (!disputeTargetCode || !picked || !note) return;

    const o = ordersData.find((x) => x.code === disputeTargetCode);
    if (o) {
        o.status = 'completed';
        o.resolution = {
            favor: picked.value,
            note,
            resolvedAt: 'vừa xong',
        };
        renderOrdersTable();
        showToast(`Đã xử lý tranh chấp đơn ${o.code}, quyết định nghiêng về ${picked.value === 'buyer' ? 'người mua' : 'người bán'}`, 'success');
    }
    closeModal('disputeModal');
    disputeTargetCode = null;
}