const commissionCategories = [
    { key: 'comic', icon: 'auto_stories', label: 'Truyện tranh / Manga', rate: 7.5 },
    { key: 'manhwa', icon: 'menu_book', label: 'Manhwa / Manhua', rate: 7.5 },
    { key: 'novel', icon: 'import_contacts', label: 'Tiểu thuyết / Truyện dài', rate: 8 },
    { key: 'romance', icon: 'favorite', label: 'Truyện ngôn tình', rate: 8 },
    { key: 'mystery', icon: 'visibility', label: 'Truyện trinh thám / Kinh dị', rate: 8.5 },
    { key: 'lightnovel', icon: 'auto_awesome', label: 'Light Novel', rate: 8.5 },
    { key: 'kids_story', icon: 'child_care', label: 'Truyện thiếu nhi', rate: 6.5 },
    { key: 'rare_comic', icon: 'diamond', label: 'Truyện hiếm / Bản sưu tầm', rate: 10 },
];

const policyToggles = [
    { key: 'autoApproveSmall', title: 'Tự động duyệt rút tiền dưới ngưỡng', desc: 'Yêu cầu rút tiền nhỏ hơn ngưỡng cấu hình sẽ được xử lý tự động, không cần Admin duyệt tay.', checked: true },
    { key: 'requireSellerVerify', title: 'Bắt buộc xác minh CCCD khi đăng ký bán', desc: 'Người bán phải hoàn tất xác minh danh tính trước khi đăng bán sách trên sàn.', checked: true },
    { key: 'allowNegotiation', title: 'Cho phép trao đổi giá (đàm phán)', desc: 'Người mua có thể gửi đề nghị giá thấp hơn giá niêm yết cho người bán.', checked: true },
    { key: 'autoRefund', title: 'Tự động hoàn tiền khi huỷ đơn', desc: 'Hoàn tiền ngay vào ví người mua khi đơn hàng bị huỷ bởi người bán.', checked: true },
    { key: 'buyerProtection', title: 'Chính sách bảo vệ người mua mở rộng', desc: 'Áp dụng bảo hiểm 100% giá trị đơn hàng cho các ấn bản hiếm trên 500.000₫.', checked: false },
    { key: 'strictModeration', title: 'Kiểm duyệt nghiêm ngặt bài đăng mới', desc: 'Mọi bài đăng bán sách mới đều cần được kiểm duyệt viên phê duyệt trước khi hiển thị.', checked: false },
];

document.addEventListener('DOMContentLoaded', () => {
    renderCommissionList();
    renderPolicyToggles();
    updateSummary();
});

function renderCommissionList() {
    const container = document.getElementById('commissionList');
    container.innerHTML = commissionCategories.map((cat) => `
    <div class="commission-row">
      <div class="commission-row-label"><span class="material-symbols-outlined">${cat.icon}</span> ${escapeHtml(cat.label)}</div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="input-suffix-group">
          <input type="text" data-key="${cat.key}" class="commission-input" value="${cat.rate}" onchange="updateSummary()">
          <span class="input-suffix">%</span>
        </div>
        <button type="button" class="perm-group-remove" style="width:30px; height:30px;" title="Xoá danh mục" onclick="removeCategory('${cat.key}')"><span class="material-symbols-outlined">delete</span></button>
      </div>
    </div>
  `).join('');
}

/* ==========================================================================
   THÊM / XOÁ DANH MỤC SÁCH
   ========================================================================== */
function slugifyCategoryKey(label) {
    const base = label
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    let key = base || `cat_${Date.now()}`;
    let suffix = 1;
    while (commissionCategories.some((c) => c.key === key)) {
        key = `${base}_${suffix++}`;
    }
    return key;
}

function openAddCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'Thêm danh mục sách';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryRate').value = '';
    openModal('categoryModal');
}

function confirmSaveCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const rate = parseFloat(document.getElementById('categoryRate').value);
    if (!name) {
        showToast('Vui lòng nhập tên danh mục', 'warning');
        return;
    }
    if (commissionCategories.some((c) => c.label.toLowerCase() === name.toLowerCase())) {
        showToast('Danh mục này đã tồn tại', 'warning');
        return;
    }
    commissionCategories.push({
        key: slugifyCategoryKey(name),
        icon: 'category',
        label: name,
        rate: isNaN(rate) ? 8 : rate,
    });
    renderCommissionList();
    updateSummary();
    closeModal('categoryModal');
    showToast(`Đã thêm danh mục "${name}"`, 'success');
}

function removeCategory(key) {
    if (commissionCategories.length <= 1) {
        showToast('Phải giữ lại ít nhất 1 danh mục', 'warning');
        return;
    }
    const cat = commissionCategories.find((c) => c.key === key);
    const idx = commissionCategories.findIndex((c) => c.key === key);
    if (idx === -1) return;
    commissionCategories.splice(idx, 1);
    renderCommissionList();
    updateSummary();
    showToast(`Đã xoá danh mục "${cat.label}"`, 'danger');
}


function renderPolicyToggles() {
    const container = document.getElementById('policyToggleList');
    container.innerHTML = policyToggles.map((p) => `
    <div class="toggle-row">
      <div class="toggle-row-text"><h4>${p.title}</h4><p>${p.desc}</p></div>
      <label class="switch">
        <input type="checkbox" class="policy-toggle" data-key="${p.key}" ${p.checked ? 'checked' : ''} onchange="updateSummary()">
        <span class="switch-track"></span>
      </label>
    </div>
  `).join('');
}

function updateSummary() {
    const rates = Array.from(document.querySelectorAll('.commission-input')).map((el) => parseFloat(el.value) || 0);
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    document.getElementById('summaryAvgCommission').textContent = `${avg.toFixed(1)}%`;

    const fixed = parseFormattedNumber(document.getElementById('feeFixed').value);
    const percent = parseFloat(document.getElementById('feePercent').value) || 0;
    const estFee = fixed + (5000000 * percent) / 100;
    document.getElementById('summaryWithdrawFee').textContent = `${formatNumber(estFee)} ₫`;

    const activeCount = document.querySelectorAll('.policy-toggle:checked').length;
    const totalCount = document.querySelectorAll('.policy-toggle').length;
    document.getElementById('summaryActivePolicies').textContent = `${activeCount}/${totalCount}`;
}

function saveFeeSettings() {
    const btn = document.getElementById('saveFeesBtn');
    btn.classList.add('btn-loading');
    btn.disabled = true;
    setTimeout(() => {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        showToast('Đã lưu cấu hình biểu phí & chính sách thành công', 'success');
    }, 700);
}