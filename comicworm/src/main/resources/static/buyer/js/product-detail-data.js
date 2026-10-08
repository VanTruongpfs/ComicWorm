/**
 * Trang chi tiết (product_details.html?id=...): nạp dữ liệu thật từ API vào khung HTML có sẵn.
 * Nạp SAU product_details.js. Các phần chưa có dữ liệu trong database (thẩm định AI, điểm grade,
 * số người đang xem, giá gốc/giảm giá) được ẩn thay vì hiển thị số liệu giả.
 */
(function () {
    'use strict';

    const A = window.ComicApi;
    const $ = sel => document.querySelector(sel);
    const hide = sel => document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'none';
    });
    const setText = (sel, text) => {
        const el = $(sel);
        if (el) el.textContent = text;
    };

    // Thay phần tử bằng bản clone để gỡ listener mẫu của product_details.js
    function stripListeners(el) {
        if (!el) return null;
        const clone = el.cloneNode(true);
        el.replaceWith(clone);
        return clone;
    }

    function showNotFound(message) {
        const main = $('main.main-content');
        if (!main) return;
        main.innerHTML = '<div style="text-align:center;padding:96px 16px;color:#475569;">' +
            '<i class="fa-regular fa-face-frown" style="font-size:48px;color:#94a3b8;"></i>' +
            '<h2 style="margin:16px 0 8px;">' + A.esc(message) + '</h2>' +
            '<p>Tin có thể đã bị gỡ hoặc đường dẫn không đúng.</p>' +
            '<a href="category.html" style="display:inline-block;margin-top:16px;color:#f97316;font-weight:700;">' +
            '← Quay lại chợ truyện</a></div>';
    }

    // ------------------------------------------------------------------ Render từng khu vực
    function renderBreadcrumb(p) {
        const list = $('.breadcrumb-list');
        if (!list) return;
        const cats = (p.categoryPath || []).map(c =>
            '<li class="breadcrumb-item"><a href="' + A.categoryUrl({categoryIds: c.id}) + '">' + A.esc(c.name) + '</a></li>' +
            '<li class="breadcrumb-separator">/</li>').join('');
        list.innerHTML =
            '<li class="breadcrumb-item"><a href="home.html"><i class="fa-solid fa-house"></i> Trang chủ</a></li>' +
            '<li class="breadcrumb-separator">/</li>' + cats +
            '<li class="breadcrumb-item active" aria-current="page">' + A.esc(p.title) + '</li>';
    }

    function renderGallery(p) {
        const main = $('.primary-preview-img');
        const strip = $('.thumbnail-strip');
        const images = p.images || [];
        const urls = images.length ? images.map(i => i.url) : [A.FALLBACK_COVER];

        if (main) {
            main.src = urls[0];
            main.alt = p.title;
            main.onerror = () => {
                main.onerror = null;
                main.src = A.FALLBACK_COVER;
            };
        }
        if (!strip) return;
        if (urls.length <= 1) {
            strip.style.display = 'none';
            return;
        }
        strip.style.display = '';
        strip.innerHTML = urls.map((u, i) =>
            '<button type="button" class="thumb-item' + (i === 0 ? ' active' : '') + '" data-src="' + A.esc(u) + '">' +
            '<img src="' + A.esc(u) + '" alt="' + A.esc(p.title) + ' - ảnh ' + (i + 1) + '"></button>').join('');
        strip.querySelectorAll('.thumb-item').forEach(btn => btn.addEventListener('click', () => {
            strip.querySelectorAll('.thumb-item').forEach(b => b.classList.toggle('active', b === btn));
            if (main) main.src = btn.dataset.src;
        }));
    }

    function specCard(label, value, highlight) {
        return '<div class="spec-card"><dt class="spec-label">' + A.esc(label) + '</dt>' +
            '<dd class="spec-value' + (highlight ? ' highlight' : '') + '">' + A.esc(value) + '</dd></div>';
    }

    function renderInfo(p) {
        document.title = p.title + ' | ComicHub';
        setText('.comic-main-title', p.title);
        const idLabel = $('.listing-id strong');
        if (idLabel) idLabel.textContent = '#' + p.id;

        // Dữ liệu không có trong DB -> ẩn
        hide('.tag-live-viewers, .badge-verification, .badge-grade, .ai-inspection-card, .status-verified-badge, ' +
            '.original-price, .discount-badge');

        const edition = [p.editionType, p.volumeNumbers].filter(Boolean).join(' • ');
        const editionEl = $('.edition-badge');
        if (editionEl) {
            editionEl.textContent = edition || p.conditionLabel;
        }
        setText('.posted-time', 'Đăng bán ' + A.timeAgo(p.createdAt));

        setText('.current-price', A.formatPrice(p.price));
        const priceLabel = $('.price-label');
        if (priceLabel) {
            priceLabel.textContent = p.purchasable ? 'Giá niêm yết bán thẳng'
                : (p.tradable ? 'Giá tham khảo (tin ưu tiên trao đổi)' : 'Giá niêm yết');
        }

        const specs = $('.specs-grid');
        if (specs) {
            const rows = [
                specCard('Tình trạng', p.conditionLabel, true),
                specCard('Tồn kho', p.inStock ? p.stockQuantity + ' bản' : 'Hết hàng', !p.inStock)
            ];
            if (p.author) rows.unshift(specCard('Tác giả', p.author.name));
            if (p.publisher) rows.unshift(specCard('Nhà xuất bản', p.publisher.name + (p.publicationYear ? ' (' + p.publicationYear + ')' : '')));
            else if (p.publicationYear) rows.push(specCard('Năm xuất bản', String(p.publicationYear)));
            const cat = (p.categoryPath || []).map(c => c.name).join(' / ');
            if (cat) rows.push(specCard('Thể loại', cat));
            if (p.editionType) rows.push(specCard('Ấn bản', p.editionType));
            if (p.volumeNumbers) rows.push(specCard('Tập', p.volumeNumbers));
            if (p.soldCount > 0) rows.push(specCard('Đã bán', p.soldCount + ' bản'));
            specs.innerHTML = rows.join('');
        }

        // Khung trao đổi: chỉ hiện khi tin nhận đổi
        const barter = $('.barter-offer-card');
        if (barter) {
            if (!p.tradable) {
                barter.style.display = 'none';
            } else {
                const desc = barter.querySelector('.barter-description');
                if (desc) {
                    desc.textContent = p.tradeWishNote
                        ? 'Người đăng mong muốn trao đổi với: ' + p.tradeWishNote
                        : 'Người đăng sẵn sàng trao đổi. Hãy gửi đề xuất của bạn.';
                }
                const grid = barter.querySelector('.barter-targets-grid');
                if (grid) grid.style.display = 'none';
            }
        }
        const proposeBtn = $('.btn-propose-exchange');
        if (proposeBtn && !p.tradable) proposeBtn.style.display = 'none';
    }

    function renderBuyButton(p) {
        const old = $('.primary-actions-row .btn-buy-now');
        const btn = stripListeners(old);
        if (!btn) return;
        if (!p.purchasable) {
            btn.removeAttribute('href');
            btn.style.opacity = '.5';
            btn.style.pointerEvents = 'none';
            btn.innerHTML = '<i class="fa-solid fa-ban"></i> ' +
                (!p.publiclyVisible ? 'Tin chưa được công khai' : (p.inStock ? 'Tin này chỉ nhận trao đổi' : 'Đã hết hàng'));
            return;
        }
        btn.addEventListener('click', e => {
            e.preventDefault();
            // Chức năng giỏ hàng/đặt hàng (B05/B06) sẽ thay phần này; hiện giữ luồng cũ qua localStorage.
            A.addToLocalCart({id: p.id, title: p.title, price: p.price, sellerName: p.seller?.fullName});
            A.toast('Đang chuyển đến trang Thanh Toán...', 'primary', 'fa-spinner fa-spin');
            setTimeout(() => {
                location.href = 'payment.html';
            }, 600);
        });
    }

    function renderSeller(p) {
        const card = $('.seller-profile-card');
        const s = p.seller;
        if (!card || !s) {
            if (card) card.style.display = 'none';
            return;
        }
        const avatar = card.querySelector('.seller-avatar');
        if (avatar) {
            avatar.src = s.avatarUrl || A.FALLBACK_COVER;
            avatar.alt = 'Người bán ' + s.fullName;
        }
        const name = card.querySelector('.seller-name');
        if (name) name.textContent = s.fullName;

        const stats = card.querySelector('.seller-stats-row');
        if (stats) {
            const rating = s.ratingCount > 0
                ? '<span class="rating"><i class="fa-solid fa-star"></i> ' + s.ratingAverage.toFixed(1) + '</span> (' + s.ratingCount + ' đánh giá)'
                : '<span>Chưa có đánh giá</span>';
            stats.innerHTML = rating + '<span class="separator">•</span><span>Tham gia ' + A.esc(A.formatDate(s.memberSince)) + '</span>';
        }
        const loc = card.querySelector('.seller-location');
        if (loc) loc.style.display = 'none'; // chưa có địa chỉ công khai của người bán

        const shelf = stripListeners(card.querySelector('.btn-view-shelf'));
        if (shelf) {
            shelf.textContent = 'Xem Tủ Sách Người Bán (' + s.activeProductCount + ')';
            shelf.setAttribute('href', A.categoryUrl({sellerId: s.id}));
        }
    }

    function renderTabs(p) {
        const container = $('.comic-tabs-container');
        const bar = stripListeners($('.tabs-header-bar'));
        const pane = $('.comic-tabs-container .tab-pane');
        if (!container || !bar || !pane) return;

        const buttons = bar.querySelectorAll('.tab-button');
        if (buttons.length >= 3) {
            buttons[0].textContent = '1. Giới Thiệu & Mô Tả';
            buttons[1].textContent = '2. Thông Tin Ấn Bản';
            buttons[2].textContent = '3. Đánh Giá Từ Độc Giả (' + p.ratingCount + ')';
        }

        const reviewState = {page: 0, loaded: false, hasNext: false, html: ''};

        const descHtml = () =>
            '<div class="synopsis-wrapper"><h2 class="synopsis-title">' + A.esc(p.title) + '</h2>' +
            '<p class="synopsis-paragraph" style="white-space:pre-line;">' + A.esc(p.description || 'Người bán chưa thêm mô tả.') + '</p>' +
            (p.tradeWishNote && p.tradable
                ? '<p class="synopsis-paragraph"><strong>Mong muốn trao đổi:</strong> ' + A.esc(p.tradeWishNote) + '</p>' : '') +
            '</div>';

        const infoHtml = () => {
            const rows = [
                ['Tình trạng', p.conditionLabel],
                ['Hình thức', p.listingType === 'SELL' ? 'Bán thẳng' : (p.listingType === 'TRADE' ? 'Chỉ trao đổi' : 'Bán hoặc trao đổi')],
                ['Ấn bản', p.editionType], ['Tập', p.volumeNumbers],
                ['Năm xuất bản', p.publicationYear], ['Nhà xuất bản', p.publisher?.name], ['Tác giả', p.author?.name],
                ['Ngày đăng', A.formatDate(p.createdAt)]
            ].filter(r => r[1]);
            return '<div class="synopsis-wrapper"><h2 class="synopsis-title">Thông tin ấn bản</h2>' +
                '<dl class="specs-grid" style="margin-top:12px;">' +
                rows.map(r => specCard(r[0], String(r[1]))).join('') + '</dl></div>';
        };

        const stars = n => '<span style="color:#f59e0b;font-size:12px;">' +
            '<i class="fa-solid fa-star"></i>'.repeat(n) +
            '<i class="fa-regular fa-star"></i>'.repeat(5 - n) + '</span>';

        const reviewItem = r =>
            '<div style="padding:16px 0;border-bottom:1px solid #f1f5f9;">' +
            '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">' +
            '<strong style="font-size:14px;">' + A.esc(r.buyerName) + '</strong>' + stars(r.rating) +
            '<span style="color:#94a3b8;font-size:12px;">' + A.timeAgo(r.createdAt) + '</span></div>' +
            (r.content ? '<p style="font-size:13px;color:#475569;line-height:1.5;white-space:pre-line;">' + A.esc(r.content) + '</p>' : '') +
            (r.reply
                ? '<div style="margin-top:8px;padding:10px 12px;background:#f8fafc;border-left:3px solid #f97316;border-radius:6px;font-size:13px;">' +
                '<strong>' + A.esc(r.reply.sellerName || 'Người bán') + ' (Người bán) phản hồi:</strong> ' + A.esc(r.reply.content) + '</div>' : '') +
            '</div>';

        async function showReviews(reset) {
            if (reset) {
                reviewState.page = 0;
                reviewState.html = '';
                pane.innerHTML = '<p style="padding:24px;color:#94a3b8;">Đang tải đánh giá...</p>';
            }
            try {
                const data = await A.reviews(p.id, reviewState.page, 5);
                reviewState.html += data.items.map(reviewItem).join('');
                reviewState.hasNext = data.hasNext;
                reviewState.page = data.page + 1;
                const summary = p.ratingCount > 0
                    ? '<div style="padding:12px 0;font-size:15px;"><strong style="font-size:22px;color:#f97316;">' +
                    p.ratingAverage.toFixed(1) + '</strong> / 5 · ' + p.ratingCount + ' đánh giá</div>' : '';
                pane.innerHTML = '<div>' + summary +
                    (reviewState.html || '<p style="padding:24px;color:#64748b;">Chưa có đánh giá nào. Chỉ người đã mua và nhận hàng mới có thể đánh giá.</p>') +
                    (reviewState.hasNext ? '<button type="button" id="moreReviews" class="btn" style="margin-top:12px;">Xem thêm đánh giá</button>' : '') +
                    '</div>';
                $('#moreReviews')?.addEventListener('click', () => showReviews(false));
            } catch (e) {
                pane.innerHTML = '<p style="padding:24px;color:#e11d48;">Không tải được đánh giá.</p>';
            }
        }

        const views = [
            () => {
                pane.innerHTML = descHtml();
            },
            () => {
                pane.innerHTML = infoHtml();
            },
            () => showReviews(true)
        ];
        bar.querySelectorAll('.tab-button').forEach((btn, i) => btn.addEventListener('click', () => {
            bar.querySelectorAll('.tab-button').forEach(b => {
                const on = b === btn;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', String(on));
                b.style.backgroundColor = on ? '#f97316' : '#f8fafc';
                b.style.color = on ? '#ffffff' : '#64748b';
            });
            views[i]();
        }));
        views[0]();
    }

    async function renderRelated(p) {
        const section = $('.related-comics-section');
        const grid = $('.related-grid');
        if (!section || !grid) return;
        try {
            const items = await A.related(p.id, 4);
            if (!items.length) {
                section.style.display = 'none';
                return;
            }
            const cat = (p.categoryPath || []).slice(-1)[0];
            const link = section.querySelector('.view-all-link');
            if (link && cat) {
                link.setAttribute('href', A.categoryUrl({categoryIds: cat.id}));
                link.innerHTML = 'Xem tất cả ' + A.esc(cat.name) + ' <i class="fa-solid fa-arrow-right"></i>';
            }
            grid.innerHTML = items.map(r =>
                '<article class="comic-card" data-id="' + r.id + '" style="cursor:pointer;">' +
                '<div class="card-cover-wrap"><img src="' + A.esc(r.coverImageUrl || A.FALLBACK_COVER) + '" alt="' + A.esc(r.title) + '" loading="lazy">' +
                '<span class="condition-tag">' + A.esc(r.conditionLabel) + '</span></div>' +
                '<div class="card-body"><div class="card-category">' + A.esc(r.volumeNumbers || r.editionType || r.categoryName || '') + '</div>' +
                '<h3 class="card-title">' + A.esc(r.title) + '</h3>' +
                '<div class="card-footer"><div class="card-price">' + A.formatPrice(r.price) + '</div>' +
                '<div class="card-meta">' +
                (r.tradable ? '<span class="barter-badge"><i class="fa-solid fa-arrows-rotate"></i> Nhận đổi</span>'
                    : '<span class="direct-sale-badge"><i class="fa-solid fa-tag"></i> Bán thẳng</span>') +
                '</div></div></div></article>').join('');
            grid.addEventListener('click', e => {
                const card = e.target.closest('.comic-card');
                if (card) location.href = A.detailUrl(card.dataset.id);
            });
            grid.addEventListener('error', e => {
                if (e.target.tagName === 'IMG' && e.target.src !== A.FALLBACK_COVER) e.target.src = A.FALLBACK_COVER;
            }, true);
        } catch (e) {
            section.style.display = 'none';
        }
    }

    // ------------------------------------------------------------------ Khởi tạo
    document.addEventListener('DOMContentLoaded', async () => {
        const id = Number(new URLSearchParams(location.search).get('id'));
        if (!id) {
            showNotFound('Thiếu mã sản phẩm');
            return;
        }
        try {
            const p = await A.detail(id);
            window.__comicProduct = p; // để các chức năng sau (giỏ hàng, đổi truyện) dùng lại
            renderBreadcrumb(p);
            renderGallery(p);
            renderInfo(p);
            renderBuyButton(p);
            renderSeller(p);
            renderTabs(p);
            renderRelated(p);

            if (!p.publiclyVisible) {
                const note = document.createElement('div');
                note.style.cssText = 'background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:12px 16px;border-radius:12px;margin-bottom:16px;font-size:14px;';
                note.textContent = 'Tin này chưa được công khai (trạng thái: ' + p.moderationStatus + '). Chỉ bạn (chủ tin) hoặc quản trị viên xem được.';
                $('main.main-content')?.prepend(note);
            }
        } catch (e) {
            showNotFound(e.status === 404 ? 'Không tìm thấy sản phẩm' : 'Không tải được sản phẩm');
        }
    });
})();
