let vouchersData = [
    { code: 'SACH9', name: 'Khuyến mãi mùa tựu trường', type: 'percent', value: 9, maxDiscount: 50000, minOrder: 200000, start: '01/09/2026', end: '30/09/2026', used: 3402, limit: 5000, status: 'running' },
    { code: 'FREESHIP50', name: 'Miễn phí vận chuyển', type: 'fixed', value: 50000, maxDiscount: 50000, minOrder: 150000, start: '01/09/2026', end: '15/10/2026', used: 8120, limit: 10000, status: 'running' },
    { code: 'NEWBIE20', name: 'Ưu đãi thành viên mới', type: 'percent', value: 20, maxDiscount: 100000, minOrder: 100000, start: '10/09/2026', end: '10/12/2026', used: 1890, limit: 3000, status: 'running' },
    { code: 'BOOKLOVER', name: 'Tri ân độc giả trung thành', type: 'percent', value: 12, maxDiscount: 80000, minOrder: 300000, start: '01/10/2026', end: '31/10/2026', used: 0, limit: 4000, status: 'scheduled' },
    { code: 'TET2026', name: 'Khuyến mãi Tết Nguyên Đán', type: 'fixed', value: 30000, maxDiscount: 30000, minOrder: 150000, start: '20/01/2026', end: '10/02/2026', used: 4500, limit: 4500, status: 'expired' },
    { code: 'SUMMER15', name: 'Sách hè sôi động', type: 'percent', value: 15, maxDiscount: 60000, minOrder: 200000, start: '01/06/2026', end: '31/08/2026', used: 4998, limit: 5000, status: 'expired' },
];

let editingCode = null;
let deleteTargetCode = null;

document.addEventListener('DOMContentLoaded', () => {
    renderVouchers();
    initSlidingTabs(document.getElementById('voucherFilterTabs'), applyVoucherFilter);
    document.getElementById('voucherSearch').addEventListener('input', debounce(applyVoucherFilter, 200));
    ['vCode', 'vName', 'vType', 'vValue', 'vMaxDiscount', 'vMinOrder'].forEach((id) => {
        document.getElementById(id).addEventListener('input', updateVoucherPreview);
        document.getElementById(id).addEventListener('change', updateVoucherPreview);
    });
});

const statusMetaV = {
    running: { label: 'Đang chạy', badge: 'success' },
    scheduled: { label: 'Lên lịch', badge: 'info' },
    expired: { label: 'Hết hạn', badge: 'secondary' },
};

function renderVouchers() {
    const body = document.getElementById('voucherTableBody');
    body.innerHTML = vouchersData.map((v) => {
        const meta = statusMetaV[v.status];
        const percentUsed = Math.min(100, Math.round((v.used / v.limit) * 100));
        const discountLabel = v.type === 'percent' ? `${v.value}% (tối đa ${formatNumber(v.maxDiscount)}₫)` : `${formatNumber(v.value)}₫`;
        return `
    <tr data-status="${v.status}" data-code="${v.code.toLowerCase()}" data-name="${v.name.toLowerCase()}">
      <td><span class="voucher-code-pill" style="font-size:.85rem; padding:5px 10px;">${v.code}</span></td>
      <td>
        <div class="identity-text"><span class="identity-name">${escapeHtml(v.name)}</span><span class="identity-sub">Đơn tối thiểu ${formatNumber(v.minOrder)}₫</span></div>
      </td>
      <td style="font-weight:700; color:var(--text-main); white-space:nowrap;">${discountLabel}</td>
      <td style="color:var(--text-muted); white-space:nowrap;">${v.start} → ${v.end}</td>
      <td>
        <div class="usage-progress">
          <div class="usage-progress-label">${formatNumber(v.used)} / ${formatNumber(v.limit)}</div>
          <div class="usage-progress-track"><div class="usage-progress-fill" style="width:${percentUsed}%;"></div></div>
        </div>
      </td>
      <td style="text-align:center;"><span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${meta.label}</span></td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" onclick="openEditVoucher('${v.code}')">Sửa</button>
          <button class="btn btn-sm" style="background:var(--danger-bg); color:var(--danger-text);" onclick="openDeleteVoucher('${v.code}')">Xoá</button>
        </div>
      </td>
    </tr>`;
    }).join('');
}

function applyVoucherFilter() {
    const activeTab = document.querySelector('#voucherFilterTabs .tab-chip.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    const query = document.getElementById('voucherSearch').value.trim().toLowerCase();
    document.querySelectorAll('#voucherTableBody tr').forEach((row) => {
        let visible = filter === 'all' || row.dataset.status === filter;
        if (visible && query) visible = row.dataset.code.includes(query) || row.dataset.name.includes(query);
        row.classList.toggle('row-hidden', !visible);
    });
}

function openCreateVoucher() {
    editingCode = null;
    document.getElementById('voucherFormTitle').textContent = 'Tạo voucher mới';
    document.getElementById('voucherSubmitBtn').textContent = 'Tạo voucher';
    document.getElementById('vCode').value = '';
    document.getElementById('vName').value = '';
    document.getElementById('vType').value = 'percent';
    document.getElementById('vValue').value = '';
    document.getElementById('vMaxDiscount').value = '';
    document.getElementById('vMinOrder').value = '';
    document.getElementById('vStart').value = '';
    document.getElementById('vEnd').value = '';
    document.getElementById('vLimit').value = '';
    updateVoucherPreview();
    openModal('voucherFormModal');
}

function openEditVoucher(code) {
    const v = vouchersData.find((x) => x.code === code);
    if (!v) return;
    editingCode = code;
    document.getElementById('voucherFormTitle').textContent = `Chỉnh sửa voucher ${code}`;
    document.getElementById('voucherSubmitBtn').textContent = 'Lưu thay đổi';
    document.getElementById('vCode').value = v.code;
    document.getElementById('vName').value = v.name;
    document.getElementById('vType').value = v.type;
    document.getElementById('vValue').value = v.value;
    document.getElementById('vMaxDiscount').value = v.maxDiscount;
    document.getElementById('vMinOrder').value = v.minOrder;
    document.getElementById('vLimit').value = v.limit;
    updateVoucherPreview();
    openModal('voucherFormModal');
}

function updateVoucherPreview() {
    const code = (document.getElementById('vCode').value || 'MÃVOUCHER').toUpperCase();
    const type = document.getElementById('vType').value;
    const value = parseFormattedNumber(document.getElementById('vValue').value);
    const maxDiscount = parseFormattedNumber(document.getElementById('vMaxDiscount').value);
    const minOrder = parseFormattedNumber(document.getElementById('vMinOrder').value);
    document.getElementById('previewCode').textContent = code;
    const discountText = type === 'percent'
        ? `Giảm ${value || 0}%${maxDiscount ? `, tối đa ${formatNumber(maxDiscount)} ₫` : ''}`
        : `Giảm ${formatNumber(value || 0)} ₫`;
    document.getElementById('previewDesc').textContent = `${discountText}${minOrder ? ` cho đơn từ ${formatNumber(minOrder)} ₫` : ''}`;
}

function submitVoucherForm() {
    const code = document.getElementById('vCode').value.trim().toUpperCase();
    const name = document.getElementById('vName').value.trim();
    if (!code || !name) {
        showToast('Vui lòng nhập mã voucher và tên chương trình', 'warning');
        return;
    }
    const payload = {
        code, name,
        type: document.getElementById('vType').value,
        value: parseFormattedNumber(document.getElementById('vValue').value) || 0,
        maxDiscount: parseFormattedNumber(document.getElementById('vMaxDiscount').value) || 0,
        minOrder: parseFormattedNumber(document.getElementById('vMinOrder').value) || 0,
        start: document.getElementById('vStart').value || '—',
        end: document.getElementById('vEnd').value || '—',
        limit: parseFormattedNumber(document.getElementById('vLimit').value) || 1000,
    };

    if (editingCode) {
        const v = vouchersData.find((x) => x.code === editingCode);
        Object.assign(v, payload);
        showToast(`Đã cập nhật voucher ${code}`, 'success');
    } else {
        vouchersData.unshift({ ...payload, used: 0, status: 'scheduled' });
        showToast(`Đã tạo voucher ${code}`, 'success');
    }
    renderVouchers();
    applyVoucherFilter();
    closeModal('voucherFormModal');
}

function openDeleteVoucher(code) {
    deleteTargetCode = code;
    document.getElementById('deleteVoucherCode').textContent = code;
    openModal('deleteVoucherModal');
}

function confirmDeleteVoucher() {
    vouchersData = vouchersData.filter((v) => v.code !== deleteTargetCode);
    renderVouchers();
    applyVoucherFilter();
    closeModal('deleteVoucherModal');
    showToast(`Đã xoá voucher ${deleteTargetCode}`, 'danger');
    deleteTargetCode = null;
}