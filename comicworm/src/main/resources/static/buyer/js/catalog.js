/**
 * Trang danh mục (category.html): lọc / tìm kiếm / sắp xếp / phân trang bằng GET /api/products.
 * Giữ lại các hàm toàn cục mà HTML cũ đang gọi: filterCatalog, resetCatalogFilters, setSort, showToast.
 */
(function () {
    'use strict';

    const A = window.ComicApi;
    const PAGE_SIZE = 12;

    const state = {
        keyword: '',
        categoryIds: [],
        sellerId: null,
        publisherId: null,
        conditions: [],
        price: 'all',
        sort: 'popular',
        page: 0
    };

    let filterData = null;
    let requestSeq = 0;
    let defaults = {};

    const $ = id => document.getElementById(id);

    // ------------------------------------------------------------------ URL <-> state
    function readUrl() {
        const q = new URLSearchParams(location.search);
        state.keyword = (q.get('q') || '').trim();
        state.categoryIds = (q.get('categoryIds') || '').split(',').map(Number).filter(n => n > 0);
        state.sellerId = Number(q.get('sellerId') || q.get('seller')) || null;
        state.publisherId = Number(q.get('publisherId')) || null;
        state.conditions = (q.get('conditions') || '').split(',').filter(Boolean);
        state.price = q.get('price') || 'all';
        state.sort = q.get('sort') || 'popular';
        state.page = Math.max(Number(q.get('page')) || 0, 0);
        return {legacyGenre: q.get('genre'), categorySlug: q.get('category')};
    }

    function writeUrl() {
        const q = new URLSearchParams();
        if (state.keyword) q.set('q', state.keyword);
        if (state.categoryIds.length) q.set('categoryIds', state.categoryIds.join(','));
        if (state.sellerId) q.set('sellerId', state.sellerId);
        if (state.publisherId) q.set('publisherId', state.publisherId);
        if (state.conditions.length) q.set('conditions', state.conditions.join(','));
        if (state.price !== 'all') q.set('price', state.price);
        if (state.sort !== 'popular') q.set('sort', state.sort);
        if (state.page > 0) q.set('page', state.page);
        const qs = q.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }

    function priceRange() {
        switch (state.price) {
            case 'under100':
                return {maxPrice: 99999.99};
            case '100to300':
                return {minPrice: 100000, maxPrice: 300000};
            case 'above300':
                return {minPrice: 300000.01};
            default:
                return {};
        }
    }

    // ------------------------------------------------------------------ Thanh lọc
    function renderGenreList() {
        const list = $('genreFilterList');
        if (!list || !filterData) return;

        const cats = filterData.categories || [];
        const parents = cats.filter(c => !c.parentId);
        const childrenOf = id => cats.filter(c => c.parentId === id);

        const item = (value, label, count, indent) =>
            '<li><label class="filter-item-label" style="padding-left:' + (6 + indent) + 'px">' +
            '<span><input type="checkbox" value="' + value + '"> ' + A.esc(label) + '</span>' +
            '<span class="filter-count">' + Number(count).toLocaleString('vi-VN') + '</span></label></li>';

        let html = item('all', 'Tất cả thể loại', filterData.totalProducts, 0);
        parents.forEach(p => {
            html += item(p.id, p.name, p.count, 0);
            childrenOf(p.id).forEach(c => {
                html += item(c.id, c.name, c.count, 18);
            });
        });
        // Thể loại con mà cha không có trong danh sách (dữ liệu lệch) vẫn hiển thị.
        cats.filter(c => c.parentId && !parents.some(p => p.id === c.parentId))
            .forEach(c => {
                html += item(c.id, c.name, c.count, 0);
            });
        list.innerHTML = html;
    }

    function syncControls() {
        const boxes = document.querySelectorAll('#genreFilterList input[type="checkbox"]');
        boxes.forEach(cb => {
            cb.checked = cb.value === 'all'
                ? state.categoryIds.length === 0
                : state.categoryIds.includes(Number(cb.value));
        });
        document.querySelectorAll('.filter-sidebar input[type="checkbox"]').forEach(cb => {
            if (cb.closest('#genreFilterList')) return;
            cb.checked = state.conditions.includes(cb.value);
        });
        const radio = document.querySelector('input[name="priceRange"][value="' + state.price + '"]')
            || document.querySelector('input[name="priceRange"][value="all"]');
        if (radio) radio.checked = true;

        const input = $('catalogSearchInput');
        if (input) input.value = state.keyword;

        document.querySelectorAll('.sort-pill').forEach(btn => {
            const m = (btn.getAttribute('onclick') || '').match(/'([a-z_]+)'\)/);
            btn.classList.toggle('active', !!m && m[1] === state.sort);
        });
    }

    function readControls() {
        state.categoryIds = Array.from(document.querySelectorAll('#genreFilterList input[type="checkbox"]:checked'))
            .filter(cb => cb.value !== 'all').map(cb => Number(cb.value));
        state.conditions = Array.from(document.querySelectorAll('.filter-sidebar input[type="checkbox"]:checked'))
            .filter(cb => !cb.closest('#genreFilterList')).map(cb => cb.value);
        state.price = document.querySelector('input[name="priceRange"]:checked')?.value || 'all';
    }

    // ------------------------------------------------------------------ Tải & hiển thị danh sách
    async function load() {
        const seq = ++requestSeq;
        const grid = $('catalogBooksGrid');
        if (!grid) return;
        grid.style.opacity = '0.5';

        try {
            const data = await A.search({
                keyword: state.keyword,
                categoryIds: state.categoryIds,
                sellerId: state.sellerId,
                publisherId: state.publisherId,
                conditions: state.conditions,
                sort: state.sort,
                page: state.page,
                size: PAGE_SIZE,
                ...priceRange()
            });
            if (seq !== requestSeq) return; // đã có yêu cầu mới hơn

            // Trang vượt quá tổng số trang (do đổi bộ lọc) -> quay về trang cuối.
            if (data.totalPages > 0 && state.page >= data.totalPages) {
                state.page = data.totalPages - 1;
                return load();
            }
            renderGrid(data.items);
            renderPagination(data);
            renderHeader(data);
            writeUrl();
        } catch (e) {
            if (seq !== requestSeq) return;
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 16px;color:#e11d48;">' +
                '<i class="fa-solid fa-triangle-exclamation"></i> Không tải được danh sách. ' +
                '<a href="#" id="catalogRetry" style="color:#f97316;font-weight:700;">Thử lại</a></div>';
            $('catalogRetry')?.addEventListener('click', ev => {
                ev.preventDefault();
                load();
            });
        } finally {
            if (seq === requestSeq) grid.style.opacity = '1';
        }
    }

    function renderCard(p) {
        const cover = p.coverImageUrl || A.FALLBACK_COVER;
        const url = A.detailUrl(p.id);
        const meta = [p.authorName, p.publisherName].filter(Boolean).join(' • ');
        const trade = p.tradable
            ? '<span class="card-trade-badge"><i class="fa-solid fa-right-left"></i> Nhận Đổi</span>' : '';
        const tag = A.esc(p.conditionLabel) + (p.inStock ? '' : ' • Hết hàng');
        const canBuy = p.purchasable && p.inStock;
        return '<div class="comic-catalog-card" data-id="' + p.id + '">' +
            '<div class="card-cover-wrap">' +
            '<img src="' + A.esc(cover) + '" alt="' + A.esc(p.title) + '" class="card-cover-img" loading="lazy">' +
            '<span class="card-condition-tag">' + tag + '</span>' + trade +
            '</div>' +
            '<div class="card-body">' +
            '<span class="card-genre">' + A.esc(p.categoryName || '') + '</span>' +
            '<a href="' + url + '" class="card-title">' + A.esc(p.title) + '</a>' +
            (meta ? '<div class="card-meta"><i class="fa-solid fa-user-pen"></i> ' + A.esc(meta) + '</div>' : '') +
            '<div class="card-price-row"><span class="card-price">' + A.formatPrice(p.price) + '</span>' +
            (p.soldCount > 0 ? '<span class="card-old-price" style="text-decoration:none;">Đã bán ' + p.soldCount + '</span>' : '') +
            '</div>' +
            '<div class="card-actions">' +
            '<a href="' + url + '" class="btn-view-detail">Xem chi tiết</a>' +
            '<button class="btn-add-cart-icon" data-add-cart="' + p.id + '" title="' +
            (canBuy ? 'Thêm vào giỏ hàng' : 'Không thể mua trực tiếp') + '"' + (canBuy ? '' : ' disabled style="opacity:.4;cursor:not-allowed;"') + '>' +
            '<i class="fa-solid fa-cart-plus"></i></button>' +
            '</div></div></div>';
    }

    let lastItems = [];

    function renderGrid(items) {
        lastItems = items;
        const grid = $('catalogBooksGrid');
        if (!items.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:56px 16px;color:#64748b;">' +
                '<i class="fa-regular fa-face-frown" style="font-size:28px;"></i>' +
                '<p style="margin-top:10px;">Không tìm thấy bộ truyện phù hợp. Hãy thử đổi hoặc đặt lại bộ lọc.</p></div>';
            return;
        }
        grid.innerHTML = items.map(renderCard).join('');
    }

    function renderPagination(data) {
        const box = $('catalogPagination');
        if (!box) return;
        if (data.totalPages <= 1) {
            box.innerHTML = '';
            return;
        }
        const cur = data.page;
        const last = data.totalPages - 1;
        const pages = new Set([0, last, cur - 1, cur, cur + 1]);
        const sorted = Array.from(pages).filter(p => p >= 0 && p <= last).sort((a, b) => a - b);

        const btn = (label, page, opts = {}) =>
            '<button type="button" data-page="' + page + '" ' + (opts.disabled ? 'disabled ' : '') +
            'style="min-width:38px;height:38px;padding:0 12px;border-radius:10px;border:1px solid ' +
            (opts.active ? '#f97316' : '#e2e8f0') + ';background:' + (opts.active ? '#f97316' : '#fff') +
            ';color:' + (opts.active ? '#fff' : '#475569') + ';font-weight:600;cursor:' +
            (opts.disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (opts.disabled ? '.5' : '1') + ';">' + label + '</button>';

        let html = btn('<i class="fa-solid fa-chevron-left"></i>', cur - 1, {disabled: cur === 0});
        let prev = -1;
        sorted.forEach(p => {
            if (prev !== -1 && p - prev > 1) html += '<span style="align-self:center;color:#94a3b8;">…</span>';
            html += btn(p + 1, p, {active: p === cur});
            prev = p;
        });
        html += btn('<i class="fa-solid fa-chevron-right"></i>', cur + 1, {disabled: cur === last});
        box.innerHTML = html;
    }

    function renderHeader(data) {
        const badge = $('catalogMatchBadge');
        if (badge) {
            badge.innerHTML = '<i class="fa-solid fa-check-circle"></i> <span>Tìm thấy ' +
                data.totalElements.toLocaleString('vi-VN') + ' bộ truyện</span>';
        }

        const title = $('heroTitleText');
        const desc = $('heroDescText');
        const crumb = $('breadcrumbCurrent');
        if (!title || !desc || !crumb) return;

        const selectedNames = state.categoryIds
            .map(id => (filterData?.categories || []).find(c => c.id === id)?.name).filter(Boolean);

        if (state.sellerId) {
            const name = data.items[0]?.sellerName;
            title.textContent = name ? 'Tủ sách của: ' + name : 'Tủ sách người bán';
            desc.textContent = 'Toàn bộ truyện đang được người bán này đăng bán hoặc trao đổi.';
            crumb.textContent = name ? 'Gian hàng ' + name : 'Gian hàng';
        } else if (state.keyword) {
            title.textContent = 'Tìm kiếm: "' + state.keyword + '"';
            desc.textContent = 'Danh sách kết quả phù hợp nhất với từ khóa của bạn.';
            crumb.textContent = 'Tìm kiếm "' + state.keyword + '"';
        } else if (selectedNames.length) {
            const label = selectedNames.join(', ');
            title.textContent = 'Thể loại: ' + label;
            desc.textContent = 'Tuyển tập ' + label + ' đang được cộng đồng đăng bán và trao đổi.';
            crumb.textContent = label;
        } else {
            title.textContent = defaults.title;
            desc.textContent = defaults.desc;
            crumb.textContent = defaults.crumb;
        }
    }

    // ------------------------------------------------------------------ Hàm toàn cục mà HTML cũ gọi
    window.filterCatalog = function (searchKw) {
        if (typeof searchKw === 'string') state.keyword = searchKw.trim();
        readControls();
        state.page = 0;
        load();
    };

    window.resetCatalogFilters = function () {
        state.keyword = '';
        state.categoryIds = [];
        state.conditions = [];
        state.price = 'all';
        state.page = 0;
        syncControls();
        load();
        A.toast('Đã đặt lại toàn bộ bộ lọc!', 'info', 'fa-arrows-rotate');
    };

    window.setSort = function (btn, sortType) {
        document.querySelectorAll('.sort-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sort = sortType;
        state.page = 0;
        load();
    };

    window.showToast = A.toast;

    // ------------------------------------------------------------------ Khởi tạo
    document.addEventListener('DOMContentLoaded', async () => {
        defaults = {
            title: $('heroTitleText')?.textContent || '',
            desc: $('heroDescText')?.textContent || '',
            crumb: $('breadcrumbCurrent')?.textContent || ''
        };
        const legacy = readUrl();

        try {
            filterData = await A.filters();
        } catch (e) {
            filterData = null; // vẫn cho xem danh sách dù không có thanh lọc thể loại
        }
        renderGenreList();

        // Tương thích link cũ: ?genre=<tên thể loại> hoặc ?category=<slug>
        const cats = filterData?.categories || [];
        if (legacy.legacyGenre) {
            const c = cats.find(x => x.name.toLowerCase() === legacy.legacyGenre.toLowerCase());
            if (c) state.categoryIds = [c.id];
        }
        if (legacy.categorySlug) {
            const c = cats.find(x => x.slug === legacy.categorySlug);
            if (c) state.categoryIds = [c.id];
        }

        syncControls();

        // Thể loại: bấm "Tất cả" bỏ chọn các mục khác; chọn mục cụ thể bỏ chọn "Tất cả".
        $('genreFilterList')?.addEventListener('change', ev => {
            const target = ev.target;
            if (!(target instanceof HTMLInputElement)) return;
            const boxes = document.querySelectorAll('#genreFilterList input[type="checkbox"]');
            if (target.value === 'all') {
                boxes.forEach(cb => {
                    cb.checked = cb === target;
                });
            } else {
                const all = document.querySelector('#genreFilterList input[value="all"]');
                if (all) all.checked = false;
                if (!Array.from(boxes).some(cb => cb.checked)) {
                    if (all) all.checked = true;
                }
            }
            window.filterCatalog();
        });

        // Tìm kiếm
        const input = $('catalogSearchInput');
        const doSearch = () => window.filterCatalog(input ? input.value : '');
        $('catalogSearchBtn')?.addEventListener('click', doSearch);
        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter') doSearch();
        });

        // Phân trang
        $('catalogPagination')?.addEventListener('click', e => {
            const btn = e.target.closest('button[data-page]');
            if (!btn || btn.disabled) return;
            state.page = Number(btn.dataset.page);
            load();
            window.scrollTo({top: 0, behavior: 'smooth'});
        });

        // Thêm vào giỏ (ủy quyền sự kiện vì thẻ được dựng động)
        const grid = $('catalogBooksGrid');
        grid?.addEventListener('click', e => {
            const btn = e.target.closest('[data-add-cart]');
            if (!btn || btn.disabled) return;
            const p = lastItems.find(x => x.id === Number(btn.dataset.addCart));
            if (!p) return;
            A.addToLocalCart(p);
            A.toast('Đã thêm "' + p.title + '" vào giỏ hàng!', 'success', 'fa-cart-plus');
        });
        // Ảnh lỗi -> ảnh thay thế (sự kiện error không nổi bọt nên dùng capture)
        grid?.addEventListener('error', e => {
            if (e.target.tagName === 'IMG' && e.target.src !== A.FALLBACK_COVER) {
                e.target.src = A.FALLBACK_COVER;
            }
        }, true);

        load();
    });
})();
