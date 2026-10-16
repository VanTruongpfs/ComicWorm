'use strict';
const { request, esc } = ExchangeAPI;
const form = document.querySelector('#address-form');
const formCard = document.querySelector('[data-address-form-card]');
const list = document.querySelector('[data-address-list]');
const provinceSelect = document.querySelector('#province');
const districtSelect = document.querySelector('#district');
const wardSelect = document.querySelector('#ward');

const fieldNames = ['recipientName', 'phone', 'province', 'district', 'ward', 'addressDetail'];
let addresses = [];

// Vietnam Administrative Units API
const API_BASE = 'https://provinces.open-api.vn/api';
let provincesCache = [];
const districtsCache = new Map();
const wardsCache = new Map();

function message(text) {
    const region = document.querySelector('[data-toast-region]');
    if (!region) return;
    region.textContent = text;
    region.setAttribute('role', 'status');
    setTimeout(() => {
        if (region.textContent === text) region.textContent = '';
    }, 4000);
}

// -----------------------------------------------------------------------------
// Administrative Units API Loaders
// -----------------------------------------------------------------------------
async function fetchProvinces() {
    if (provincesCache.length > 0) return provincesCache;
    try {
        const res = await fetch(`${API_BASE}/p/`);
        if (!res.ok) throw new Error('Không thể tải danh sách Tỉnh/Thành phố');
        provincesCache = await res.json();
        return provincesCache;
    } catch (e) {
        console.error('Lỗi tải tỉnh thành:', e);
        return [];
    }
}

async function fetchDistricts(provinceCode) {
    if (districtsCache.has(provinceCode)) return districtsCache.get(provinceCode);
    try {
        const res = await fetch(`${API_BASE}/p/${provinceCode}?depth=2`);
        if (!res.ok) throw new Error('Không thể tải danh sách Quận/Huyện');
        const data = await res.json();
        const districts = data.districts || [];
        districtsCache.set(provinceCode, districts);
        return districts;
    } catch (e) {
        console.error('Lỗi tải quận huyện:', e);
        return [];
    }
}

async function fetchWards(districtCode) {
    if (wardsCache.has(districtCode)) return wardsCache.get(districtCode);
    try {
        const res = await fetch(`${API_BASE}/d/${districtCode}?depth=2`);
        if (!res.ok) throw new Error('Không thể tải danh sách Phường/Xã');
        const data = await res.json();
        const wards = data.wards || [];
        wardsCache.set(districtCode, wards);
        return wards;
    } catch (e) {
        console.error('Lỗi tải phường xã:', e);
        return [];
    }
}

async function initProvinces() {
    provinceSelect.innerHTML = '<option value="">-- Đang tải danh sách Tỉnh/Thành --</option>';
    const list = await fetchProvinces();
    provinceSelect.innerHTML = '<option value="">-- Chọn Tỉnh / Thành phố --</option>' +
        list.map(p => `<option value="${esc(p.name)}" data-code="${p.code}">${esc(p.name)}</option>`).join('');
}

async function handleProvinceChange(selectDistrictName = null, selectWardName = null) {
    const selectedOpt = provinceSelect.options[provinceSelect.selectedIndex];
    const provinceCode = selectedOpt ? selectedOpt.dataset.code : null;

    districtSelect.innerHTML = '<option value="">-- Chọn Quận / Huyện --</option>';
    wardSelect.innerHTML = '<option value="">-- Chọn Phường / Xã --</option>';
    wardSelect.disabled = true;

    if (!provinceCode) {
        districtSelect.disabled = true;
        return;
    }

    districtSelect.disabled = true;
    districtSelect.innerHTML = '<option value="">-- Đang tải Quận / Huyện... --</option>';

    const districts = await fetchDistricts(provinceCode);
    districtSelect.innerHTML = '<option value="">-- Chọn Quận / Huyện --</option>' +
        districts.map(d => `<option value="${esc(d.name)}" data-code="${d.code}">${esc(d.name)}</option>`).join('');
    districtSelect.disabled = false;

    if (selectDistrictName) {
        let matched = Array.from(districtSelect.options).find(opt => opt.value === selectDistrictName);
        if (!matched) {
            // Trường hợp địa chỉ cũ lưu có chút khác biệt
            matched = Array.from(districtSelect.options).find(opt => opt.value.includes(selectDistrictName) || selectDistrictName.includes(opt.value));
        }
        if (matched) {
            districtSelect.value = matched.value;
            await handleDistrictChange(selectWardName);
        } else if (selectDistrictName) {
            // Giữ lại tên cũ nếu API không có
            const opt = document.createElement('option');
            opt.value = selectDistrictName;
            opt.textContent = selectDistrictName;
            opt.selected = true;
            districtSelect.appendChild(opt);
        }
    }
}

async function handleDistrictChange(selectWardName = null) {
    const selectedOpt = districtSelect.options[districtSelect.selectedIndex];
    const districtCode = selectedOpt ? selectedOpt.dataset.code : null;

    wardSelect.innerHTML = '<option value="">-- Chọn Phường / Xã --</option>';

    if (!districtCode) {
        wardSelect.disabled = true;
        return;
    }

    wardSelect.disabled = true;
    wardSelect.innerHTML = '<option value="">-- Đang tải Phường / Xã... --</option>';

    const wards = await fetchWards(districtCode);
    wardSelect.innerHTML = '<option value="">-- Chọn Phường / Xã --</option>' +
        wards.map(w => `<option value="${esc(w.name)}">${esc(w.name)}</option>`).join('');
    wardSelect.disabled = false;

    if (selectWardName) {
        let matched = Array.from(wardSelect.options).find(opt => opt.value === selectWardName);
        if (!matched) {
            matched = Array.from(wardSelect.options).find(opt => opt.value.includes(selectWardName) || selectWardName.includes(opt.value));
        }
        if (matched) {
            wardSelect.value = matched.value;
        } else if (selectWardName) {
            const opt = document.createElement('option');
            opt.value = selectWardName;
            opt.textContent = selectWardName;
            opt.selected = true;
            wardSelect.appendChild(opt);
        }
    }
}

provinceSelect.addEventListener('change', () => handleProvinceChange());
districtSelect.addEventListener('change', () => handleDistrictChange());

// -----------------------------------------------------------------------------
// Address CRUD & Rendering
// -----------------------------------------------------------------------------
async function render() {
    try {
        addresses = await request('/api/user/addresses');
        list.innerHTML = addresses.map(a => `
            <article class="address-card ${a.isDefault ? 'default' : ''}">
                <header>
                    <div>
                        <h2>${esc(a.recipientName)}</h2>
                        <p class="phone">${esc(a.phone)}</p>
                    </div>
                    ${a.isDefault ? '<span class="default-label">Mặc định</span>' : ''}
                </header>
                <p class="address-text">${esc([a.addressDetail, a.ward, a.district, a.province].filter(Boolean).join(', '))}</p>
                <div class="address-actions">
                    <button class="button secondary" data-edit="${a.id}">Chỉnh sửa</button>
                    ${!a.isDefault ? `<button class="button secondary" data-default="${a.id}">Đặt làm mặc định</button>` : ''}
                    <button class="button secondary danger" data-delete="${a.id}">Xóa</button>
                </div>
            </article>
        `).join('') || '<p>Bạn chưa có địa chỉ nhận hàng. Hãy bấm "+ Thêm địa chỉ" để thêm mới.</p>';
    } catch (e) {
        list.textContent = e.message;
    }
}

async function openForm(item = null) {
    form.reset();
    form.elements.id.value = item?.id || '';
    form.elements.recipientName.value = item?.recipientName || '';
    form.elements.phone.value = item?.phone || '';
    form.elements.addressDetail.value = item?.addressDetail || '';
    form.elements.isDefault.checked = Boolean(item?.isDefault);

    document.querySelector('[data-form-title]').textContent = item ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới';

    // Đảm bảo tỉnh/thành đã được tải
    if (provinceSelect.options.length <= 1) {
        await initProvinces();
    }

    if (item && item.province) {
        let matched = Array.from(provinceSelect.options).find(opt => opt.value === item.province);
        if (!matched) {
            matched = Array.from(provinceSelect.options).find(opt => opt.value.includes(item.province) || item.province.includes(opt.value));
        }
        if (matched) {
            provinceSelect.value = matched.value;
            await handleProvinceChange(item.district, item.ward);
        } else {
            const opt = document.createElement('option');
            opt.value = item.province;
            opt.textContent = item.province;
            opt.selected = true;
            provinceSelect.appendChild(opt);
            await handleProvinceChange(item.district, item.ward);
        }
    } else {
        provinceSelect.value = '';
        districtSelect.innerHTML = '<option value="">-- Chọn Quận / Huyện --</option>';
        districtSelect.disabled = true;
        wardSelect.innerHTML = '<option value="">-- Chọn Phường / Xã --</option>';
        wardSelect.disabled = true;
    }

    formCard.hidden = false;
    formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.querySelectorAll('[data-open-address-form]').forEach(b => b.onclick = () => openForm());
document.querySelectorAll('[data-close-address-form]').forEach(b => b.onclick = () => formCard.hidden = true);

form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;

    const payload = Object.fromEntries(fieldNames.map(n => [n, form.elements[n].value.trim()]));
    payload.isDefault = form.elements.isDefault.checked;

    if (!payload.recipientName || !payload.phone || !payload.province || !payload.district || !payload.ward || !payload.addressDetail) {
        message('Vui lòng điền đầy đủ tất cả các trường địa chỉ.');
        return;
    }

    button.disabled = true;
    try {
        const id = form.elements.id.value;
        await request('/api/user/addresses' + (id ? '/' + id : ''), {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        formCard.hidden = true;
        await render();
        message(id ? 'Đã cập nhật địa chỉ.' : 'Đã lưu địa chỉ vào tài khoản.');
    } catch (err) {
        message(err.message || 'Lỗi khi lưu địa chỉ');
    } finally {
        button.disabled = false;
    }
});

list.addEventListener('click', async e => {
    const button = e.target.closest('button');
    if (!button) return;
    const id = Number(button.dataset.edit || button.dataset.default || button.dataset.delete);
    const a = addresses.find(a => a.id === id);
    if (!a) return;

    if (button.dataset.edit) {
        openForm(a);
        return;
    }

    if (button.dataset.delete) {
        if (!confirm(`Bạn có chắc muốn xóa địa chỉ của "${a.recipientName}" không?`)) return;
    }

    button.disabled = true;
    try {
        if (button.dataset.delete) {
            await request('/api/user/addresses/' + id, { method: 'DELETE' });
            message('Đã xóa địa chỉ.');
        } else if (button.dataset.default) {
            const payload = Object.fromEntries(fieldNames.map(n => [n, a[n]]));
            payload.isDefault = true;
            await request('/api/user/addresses/' + id, { method: 'PUT', body: JSON.stringify(payload) });
            message('Đã đặt làm địa chỉ mặc định.');
        }
        await render();
    } catch (err) {
        message(err.message || 'Thao tác thất bại');
        button.disabled = false;
    }
});

// Khởi chạy
initProvinces();
render();
