(function () {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    async function request(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.detail || data?.message || (response.status === 401 ? 'Vui lòng đăng nhập để tiếp tục.' : 'Không tải được dữ liệu. Vui lòng thử lại.'));
        return data;
    }
    const money = value => Number(value || 0).toLocaleString('vi-VN') + '₫';
    const statuses = { OPEN: 'Đang thương lượng', AGREED: 'Chờ hai bên xác nhận', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', PENDING: 'Đang chờ', ACCEPTED: 'Đã chọn', DECLINED: 'Đã từ chối', WITHDRAWN: 'Đã rút', WAITING_CONFIRM: 'Chờ người gửi xác nhận', PACKING: 'Đang chuẩn bị', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao', PAID: 'Đã thanh toán' };
    const image = (url, title) => url ? `<img src="${esc(url)}" alt="${esc(title)}" loading="lazy">` : '<span class="ex-no-cover" aria-label="Chưa có ảnh">📚</span>';
    function error(target, message) {
        target.innerHTML = `<div class="ex-panel ex-state" role="alert"><p>${esc(message)}</p><button type="button" data-retry>Tải lại</button> <a href="/auth/login">Đăng nhập</a></div>`;
        target.querySelector('[data-retry]').onclick = () => location.reload();
    }
    window.ExchangeAPI = { request, esc, money, image, error, status: code => statuses[code] || code, post: (url, body = {}) => request(url, { method: 'POST', body: JSON.stringify(body) }) };
})();
