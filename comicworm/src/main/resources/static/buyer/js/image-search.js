(function () {
    'use strict';
    if (window.comicImageSearchLoaded) return;
    window.comicImageSearchLoaded = true;
    const area = location.pathname.search(/\/(buyer|seller|admin|user|exchange)\//);
    const base = area > 0 ? location.pathname.slice(0, area) : '';
    const pageUrl = base + '/buyer/html/image-search.html';

    function addButtons() {
        document.querySelectorAll('.header-search-bar').forEach(bar => {
            if (bar.querySelector('.image-search-link')) return;
            const link = document.createElement('a');
            link.className = 'image-search-link';
            link.href = pageUrl;
            link.title = 'Tìm sản phẩm bằng hình ảnh';
            link.setAttribute('aria-label', link.title);
            link.textContent = '📷';
            link.style.cssText = 'align-self:center;padding:8px;text-decoration:none;font-size:20px;flex-shrink:0';
            bar.appendChild(link);
        });
    }

    function init() {
        addButtons();
        document.querySelectorAll('.btn-camera').forEach(button => {
            button.addEventListener('click', () => { location.href = pageUrl; });
        });
        const form = document.getElementById('image-search-form');
        if (!form) return;
        const input = document.getElementById('query-image');
        const preview = document.getElementById('query-preview');
        const status = document.getElementById('image-search-status');
        const results = document.getElementById('image-search-results');
        const submit = form.querySelector('button[type=submit]');
        let previewUrl;
        let sequence = 0;
        let request;
        const reset = () => {
            sequence++;
            if (request) request.abort();
            results.replaceChildren();
            status.textContent = '';
            submit.disabled = false;
            submit.textContent = 'Tìm truyện tương tự';
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            preview.removeAttribute('src');
            preview.hidden = true;
        };
        input.addEventListener('change', () => {
            reset();
            const file = input.files[0];
            if (!file) return;
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                status.textContent = 'Chọn ảnh JPG, PNG, WebP hoặc GIF, tối đa 5 MB.';
                input.value = '';
                return;
            }
            previewUrl = URL.createObjectURL(file);
            preview.src = previewUrl;
            preview.hidden = false;
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!input.files[0]) { status.textContent = 'Vui lòng chọn một ảnh bìa truyện.'; return; }
            const current = ++sequence;
            request = new AbortController();
            const controller = request;
            const timer = setTimeout(() => controller.abort(), 90000);
            const body = new FormData();
            body.append('image', input.files[0]);
            results.replaceChildren();
            submit.disabled = true;
            submit.textContent = 'Đang tìm kiếm…';
            status.textContent = 'Đang tìm những sản phẩm có hình ảnh tương tự…';
            try {
                const response = await fetch(base + '/api/products/image-search', {
                    method: 'POST', body, credentials: 'same-origin', signal: request.signal,
                    headers: {Accept: 'application/json'}
                });
                const data = await response.json().catch(() => ({}));
                if (current !== sequence) return;
                if (!response.ok) throw new Error(data.message || data.detail || 'Không thể tìm kiếm lúc này. Vui lòng thử lại.');
                const items = data.items || [];
                status.textContent = items.length
                    ? 'Tìm thấy ' + items.length + ' sản phẩm, xếp theo độ tương đồng từ cao đến thấp.'
                    : data.comparedImages === 0
                        ? 'Chưa có ảnh sản phẩm sẵn sàng để tìm kiếm. Vui lòng quay lại sau.'
                        : 'Chưa tìm thấy sản phẩm tương tự. Thử ảnh bìa rõ hơn, chụp thẳng và ít nền.';
                items.forEach((match, index) => {
                    const product = match.product;
                    const card = document.createElement('a');
                    card.className = 'image-result-card';
                    card.href = base + '/buyer/html/product_details.html?id=' + encodeURIComponent(product.id);
                    const cover = document.createElement('img');
                    // Never interpret a stored URL as markup or allow script/data URLs.
                    let imageUrl;
                    try { imageUrl = new URL(product.coverImageUrl || match.matchedImageUrl); } catch (_) { /* no cover */ }
                    if (imageUrl && imageUrl.protocol === 'https:') cover.src = imageUrl.href;
                    cover.alt = product.title;
                    cover.loading = 'lazy';
                    const rank = document.createElement('span');
                    rank.className = 'image-result-rank';
                    rank.textContent = 'Kết quả #' + (index + 1);
                    const title = document.createElement('h2');
                    title.textContent = product.title;
                    const price = document.createElement('strong');
                    price.textContent = product.price == null ? 'Liên hệ' : Number(product.price).toLocaleString('vi-VN') + ' ₫';
                    const detail = document.createElement('p');
                    detail.textContent = [product.conditionLabel, product.sellerName].filter(Boolean).join(' · ');
                    const stock = document.createElement('span');
                    stock.textContent = product.inStock ? 'Còn hàng' : 'Hết hàng';
                    card.append(cover, rank, title, price, detail, stock);
                    results.appendChild(card);
                });
            } catch (error) {
                if (current !== sequence) return;
                status.textContent = error.name === 'AbortError'
                    ? 'Tìm kiếm mất quá nhiều thời gian. Vui lòng thử lại.' : error.message;
            } finally {
                clearTimeout(timer);
                if (current === sequence) {
                    submit.disabled = false;
                    submit.textContent = 'Tìm truyện tương tự';
                }
            }
        });
        window.addEventListener('pagehide', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    // Shared headers can be loaded by fetch after DOMContentLoaded.
    new MutationObserver(addButtons).observe(document.documentElement, {childList: true, subtree: true});
})();
