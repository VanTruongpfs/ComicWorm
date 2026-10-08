/**
 * ComicApi - gọi API sản phẩm + tiện ích dùng chung cho home / category / product_details.
 * Nạp trước catalog.js, home-products.js, product-detail-data.js.
 */
(function (global) {
    'use strict';

    // Nếu ứng dụng chạy dưới context path (ví dụ /comicworm/buyer/html/...) thì giữ nguyên tiền tố đó.
    const BASE = (() => {
        const i = location.pathname.indexOf('/buyer/');
        return i > 0 ? location.pathname.slice(0, i) : '';
    })();

    const FALLBACK_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">' +
        '<rect width="400" height="560" fill="#f1f5f9"/>' +
        '<text x="200" y="285" font-family="sans-serif" font-size="22" fill="#94a3b8" text-anchor="middle">Chưa có ảnh bìa</text>' +
        '</svg>');

    function buildQuery(params) {
        const usp = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            if (Array.isArray(value)) {
                if (value.length) usp.set(key, value.join(','));
            } else {
                usp.set(key, String(value));
            }
        });
        const qs = usp.toString();
        return qs ? '?' + qs : '';
    }

    async function request(path, params) {
        const res = await fetch(BASE + '/api/products' + path + buildQuery(params), {
            headers: {Accept: 'application/json'},
            credentials: 'same-origin'
        });
        if (!res.ok) {
            const err = new Error('HTTP ' + res.status);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => (
            {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
    }

    function formatPrice(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
    }

    // Server lưu và trả thời gian theo UTC nhưng không kèm múi giờ -> thêm 'Z' trước khi parse.
    function parseUtc(iso) {
        if (!iso) return null;
        const s = /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : iso + 'Z';
        const d = new Date(s);
        return isNaN(d) ? null : d;
    }

    function timeAgo(iso) {
        const d = parseUtc(iso);
        if (!d) return '';
        const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
        if (sec < 60) return 'vừa xong';
        const min = Math.floor(sec / 60);
        if (min < 60) return min + ' phút trước';
        const hour = Math.floor(min / 60);
        if (hour < 24) return hour + ' giờ trước';
        const day = Math.floor(hour / 24);
        if (day < 30) return day + ' ngày trước';
        const month = Math.floor(day / 30);
        if (month < 12) return month + ' tháng trước';
        return Math.floor(month / 12) + ' năm trước';
    }

    function formatDate(iso) {
        const d = parseUtc(iso);
        return d ? d.toLocaleDateString('vi-VN') : '';
    }

    function detailUrl(id) {
        return 'product_details.html?id=' + encodeURIComponent(id);
    }

    function categoryUrl(params) {
        return 'category.html' + buildQuery(params);
    }

    function toast(message, type, icon) {
        let container = document.getElementById('comichub-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'comichub-toast-container';
            container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
            document.body.appendChild(container);
        }
        const colors = {success: '#16a34a', warning: '#f59e0b', danger: '#e11d48', info: '#0f172a', primary: '#f97316'};
        const el = document.createElement('div');
        el.style.cssText = 'background:' + (colors[type] || colors.info) + ';color:#fff;padding:12px 18px;border-radius:12px;' +
            'box-shadow:0 10px 25px -5px rgba(0,0,0,.25);font-size:13px;font-weight:600;display:flex;align-items:center;gap:10px;' +
            'max-width:380px;line-height:1.4;transition:opacity .3s;pointer-events:auto;';
        el.innerHTML = '<i class="fa-solid ' + esc(icon || 'fa-circle-info') + '"></i><span>' + esc(message) + '</span>';
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 3200);
    }

    // ---- Giỏ hàng / yêu thích: giữ định dạng localStorage của giao diện cũ cho tới khi làm chức năng giỏ hàng (B05).
    function addToLocalCart(product) {
        const items = JSON.parse(localStorage.getItem('comichub_cart') || '[]');
        items.push({
            productId: product.id,
            title: product.title,
            price: formatPrice(product.price),
            seller: product.sellerName || '',
            time: Date.now()
        });
        localStorage.setItem('comichub_cart', JSON.stringify(items));
    }

    function isWishlisted(title) {
        return JSON.parse(localStorage.getItem('comichub_wishlist') || '[]').includes(title);
    }

    /** @return true nếu sau khi bấm thì sản phẩm đang ở trạng thái yêu thích */
    function toggleWishlist(title) {
        let list = JSON.parse(localStorage.getItem('comichub_wishlist') || '[]');
        const liked = list.includes(title);
        list = liked ? list.filter(t => t !== title) : list.concat(title);
        localStorage.setItem('comichub_wishlist', JSON.stringify(list));
        return !liked;
    }

    global.ComicApi = {
        BASE,
        FALLBACK_COVER,
        search: params => request('', params),
        latest: limit => request('/latest', {limit}),
        bestsellers: limit => request('/bestsellers', {limit}),
        filters: () => request('/filters'),
        detail: id => request('/' + encodeURIComponent(id)),
        related: (id, limit) => request('/' + encodeURIComponent(id) + '/related', {limit}),
        reviews: (id, page, size) => request('/' + encodeURIComponent(id) + '/reviews', {page, size}),
        esc, formatPrice, parseUtc, timeAgo, formatDate, detailUrl, categoryUrl, toast,
        addToLocalCart, isWishlisted, toggleWishlist
    };
})(window);
