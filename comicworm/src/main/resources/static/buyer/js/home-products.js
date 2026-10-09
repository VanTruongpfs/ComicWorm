/**
 * Trang chủ (home.html): "Mới đăng" (T10, có tab lọc + tải thêm) và "Bán chạy" (T09).
 * Nạp SAU home.js để ghi đè các xử lý mẫu cũ của tab và nút "Xem thêm".
 */
(function () {
    'use strict';

    const A = window.ComicApi;
    const PAGE_SIZE = 8;

    // data-filter của từng tab -> tham số API
    const TAB_FILTERS = {
        all: {},
        under500: {maxPrice: 500000},
        mint: {conditions: ['new', 'likenew']},
        trade: {listingType: 'TRADE'}
    };

    const latest = {filter: 'all', page: 0, loading: false, items: new Map()};

    function renderCard(p) {
        const url = A.detailUrl(p.id);
        const liked = A.isWishlisted(p.title);
        const badge = p.tradable
            ? '<span class="badge-custom" style="background:#f59e0b;">Nhận đổi</span>' : '';
        const info = [p.publisherName || p.categoryName, p.conditionLabel].filter(Boolean);
        const publisherLine = A.esc(info[0] || '') + (info[1] ? ' • <span>' + A.esc(info[1]) + '</span>' : '');
        const canBuy = p.purchasable && p.inStock;
        return '<div class="product-card" data-id="' + p.id + '" style="cursor:pointer;">' +
            '<div class="product-img-wrap">' +
            '<img src="' + A.esc(p.coverImageUrl || A.FALLBACK_COVER) + '" alt="' + A.esc(p.title) + '" loading="lazy">' + badge +
            '<button class="btn-wishlist" aria-label="Yêu thích" data-active="' + liked + '">' +
            (liked ? '<i class="fa-solid fa-heart" style="color:#e11d48;"></i>' : '<i class="fa-regular fa-heart"></i>') +
            '</button></div>' +
            '<div class="product-info"><div>' +
            '<div class="prod-publisher">' + publisherLine + '</div>' +
            '<h4 class="prod-title"><a href="' + url + '" style="text-decoration:none;color:inherit;">' + A.esc(p.title) + '</a></h4>' +
            '</div>' +
            '<div class="prod-foot"><div class="prod-pricing"><span class="price-current">' + A.formatPrice(p.price) + '</span></div>' +
            '<div class="prod-bottom-row"><span class="seller-name">' + A.esc(p.sellerName || '') +
            (p.soldCount > 0 ? ' • Đã bán ' + p.soldCount : '') + '</span>' +
            (canBuy
                ? '<button class="btn-buy-now" data-buy="' + p.id + '">Mua Ngay</button>'
                : '<a class="btn-buy-now" href="' + url + '" style="text-decoration:none;display:inline-flex;align-items:center;">' +
                (p.inStock ? 'Xem tin' : 'Hết hàng') + '</a>') +
            '</div></div></div></div>';
    }

    function remember(items) {
        items.forEach(p => latest.items.set(p.id, p));
    }

    // Wishlist / mua nhanh / mở chi tiết: ủy quyền sự kiện cho cả hai lưới
    function bindGrid(grid) {
        if (!grid) return;
        grid.addEventListener('click', e => {
            const card = e.target.closest('.product-card');
            if (!card) return;
            const p = latest.items.get(Number(card.dataset.id));

            const wish = e.target.closest('.btn-wishlist');
            if (wish && p) {
                e.stopPropagation();
                const nowLiked = A.toggleWishlist(p.title);
                wish.dataset.active = String(nowLiked);
                wish.innerHTML = nowLiked
                    ? '<i class="fa-solid fa-heart" style="color:#e11d48;"></i>'
                    : '<i class="fa-regular fa-heart"></i>';
                A.toast(nowLiked ? 'Đã thêm "' + p.title + '" vào mục yêu thích!' : 'Đã xóa "' + p.title + '" khỏi mục yêu thích',
                    nowLiked ? 'primary' : 'info', nowLiked ? 'fa-heart' : 'fa-heart-crack');
                return;
            }

            const buy = e.target.closest('[data-buy]');
            if (buy && p) {
                e.stopPropagation();
                A.addToLocalCart(p);
                return;
            }

            if (e.target.closest('a')) return; // để link tự điều hướng
            location.href = A.detailUrl(card.dataset.id);
        });
        grid.addEventListener('error', e => {
            if (e.target.tagName === 'IMG' && e.target.src !== A.FALLBACK_COVER) e.target.src = A.FALLBACK_COVER;
        }, true);
    }

    async function loadLatest(reset) {
        const grid = document.getElementById('latestGrid');
        const more = document.querySelector('.btn-load-more');
        if (!grid || latest.loading) return;
        latest.loading = true;
        if (reset) {
            latest.page = 0;
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:32px;">Đang tải...</p>';
        }
        if (more) more.disabled = true;

        try {
            const data = await A.search({
                sort: 'newest', size: PAGE_SIZE, page: latest.page, ...TAB_FILTERS[latest.filter]
            });
            remember(data.items);
            const html = data.items.map(renderCard).join('');
            if (reset) grid.innerHTML = '';
            if (reset && !data.items.length) {
                grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#64748b;padding:32px;">Chưa có tin phù hợp.</p>';
            } else {
                grid.insertAdjacentHTML('beforeend', html);
            }
            if (more) {
                const wrap = more.closest('.center-btn-wrap') || more;
                wrap.style.display = data.hasNext ? '' : 'none';
                const remaining = data.totalElements - (data.page + 1) * data.size;
                more.firstChild.textContent = 'Xem thêm ' + Math.max(remaining, 0).toLocaleString('vi-VN') + ' tập truyện vừa lên kệ ';
            }
            latest.page = data.page + 1;
        } catch (e) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#e11d48;padding:32px;">' +
                'Không tải được danh sách truyện. Vui lòng tải lại trang.</p>';
        } finally {
            latest.loading = false;
            if (more) more.disabled = false;
        }
    }

    async function loadBestSellers() {
        const section = document.getElementById('bestsellerSection');
        const grid = document.getElementById('bestsellerGrid');
        if (!section || !grid) return;
        try {
            const items = await A.bestsellers(4);
            if (!items.length) {
                section.style.display = 'none'; // chưa có đơn hoàn tất -> ẩn mục
                return;
            }
            remember(items);
            grid.innerHTML = items.map(renderCard).join('');
            section.style.display = '';
        } catch (e) {
            section.style.display = 'none';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Gỡ listener mẫu của home.js bằng cách thay nút bằng bản clone, rồi gắn xử lý thật.
        const tabs = Array.from(document.querySelectorAll('.market-tabs .tab-btn')).map(btn => {
            const clone = btn.cloneNode(true);
            btn.replaceWith(clone);
            return clone;
        });
        tabs.forEach(tab => tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            latest.filter = tab.dataset.filter || 'all';
            loadLatest(true);
        }));

        const oldMore = document.querySelector('.btn-load-more');
        if (oldMore) {
            const more = oldMore.cloneNode(true);
            oldMore.replaceWith(more);
            more.addEventListener('click', () => loadLatest(false));
        }

        bindGrid(document.getElementById('latestGrid'));
        bindGrid(document.getElementById('bestsellerGrid'));
        loadBestSellers();
        loadLatest(true);
    });
})();
