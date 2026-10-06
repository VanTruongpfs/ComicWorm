document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --------------------------------------------------------------------------
    // 0. TIỆN ÍCH DÙNG CHUNG: TOAST NOTIFICATION
    // --------------------------------------------------------------------------
    const showToast = (message, type = 'info', icon = 'fa-circle-info') => {
        let container = document.getElementById('comichub-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'comichub-toast-container';
            container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const bgColors = {
            success: '#16a34a',
            warning: '#f59e0b',
            danger: '#e11d48',
            info: '#0f172a',
            primary: '#f97316'
        };

        toast.style.cssText = `
      background-color: ${bgColors[type] || bgColors.info};
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25);
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      max-width: 360px;
      line-height: 1.4;
    `;

        toast.innerHTML = `<i class="fa-solid ${icon}" style="font-size: 16px;"></i> <span>${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    // --------------------------------------------------------------------------
    // 1. THANH TÌM KIẾM HERO NÂNG CAO (ADVANCED SEARCH)
    // --------------------------------------------------------------------------
    const searchInput = document.querySelector('.search-input-group input');
    const btnSearchSubmit = document.querySelector('.btn-search-submit');
    const trendingTags = document.querySelectorAll('.trending-tags .tag-badge');
    const filterSelects = document.querySelectorAll('.search-filters-grid select');

    // Gợi ý khi click vào các tag xu hướng (#OnePieceTap108, #ConanMoiNhat...)
    trendingTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const keyword = tag.textContent.trim().replace(/^#/, '');
            if (searchInput) {
                searchInput.value = keyword;
                searchInput.focus();
                showToast(`Đã chọn từ khóa: "${keyword}"`, 'primary', 'fa-magnifying-glass');
            }
        });
    });

    // Xử lý gửi biểu mẫu tìm kiếm
    const handleSearch = (e) => {
        if (e) e.preventDefault();
        const query = searchInput ? searchInput.value.trim() : '';
        const filters = Array.from(filterSelects).map(sel => sel.value);

        if (!query && filters.every(f => f === '' || f === 'Tất cả')) {
            showToast('Vui lòng nhập tên truyện hoặc chọn bộ lọc để tìm kiếm!', 'warning', 'fa-triangle-exclamation');
            if (searchInput) searchInput.focus();
            return;
        }

        showToast(`Đang tìm kiếm: "${query || 'Bộ lọc đã chọn'}"...`, 'primary', 'fa-spinner fa-spin');
        setTimeout(() => {
            window.location.href = `category.html?q=${encodeURIComponent(query)}`;
        }, 600);
    };

    if (btnSearchSubmit) {
        btnSearchSubmit.addEventListener('click', handleSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSearch(e);
        });
    }

    // Nút tìm bằng bìa ảnh (AI Image Search)
    const btnCamera = document.querySelector('.btn-camera');
    if (btnCamera) {
        btnCamera.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    showToast(`Đang quét bìa ảnh "${file.name}" bằng AI...`, 'primary', 'fa-camera');
                    setTimeout(() => {
                        showToast('Tìm thấy 4 bộ truyện khớp 98% với bìa sách của bạn!', 'success', 'fa-check');
                    }, 1500);
                }
            };
            fileInput.click();
        });
    }

    // --------------------------------------------------------------------------
    // 2. CHUYỂN TABS DANH MỤC CHỢ MUA BÁN MỚI ĐĂNG
    // --------------------------------------------------------------------------
    const marketTabs = document.querySelectorAll('.market-tabs .tab-btn');
    const productCards = document.querySelectorAll('.products-grid .product-card');

    if (marketTabs.length > 0) {
        marketTabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                marketTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabText = tab.textContent.trim();
                showToast(`Đang lọc: ${tabText}`, 'info', 'fa-filter');

                productCards.forEach((card, i) => {
                    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(8px)';

                    setTimeout(() => {
                        if (index === 0) {
                            card.style.display = 'flex';
                        } else if (index === 1) { // Bộ Full Trọn Gói
                            const title = card.querySelector('.prod-title')?.textContent || '';
                            card.style.display = (title.includes('Full') || title.includes('Trọn bộ') || title.includes('Boxset')) ? 'flex' : (i % 2 === 0 ? 'flex' : 'none');
                        } else if (index === 2) { // Bản Giới Hạn / Seal
                            const badge = card.querySelector('.badge-discount, .badge-custom, .badge-verified');
                            card.style.display = badge ? 'flex' : (i % 2 !== 0 ? 'flex' : 'none');
                        } else { // Giá < 500k
                            const priceText = card.querySelector('.price-current')?.textContent || '0';
                            const priceNum = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
                            card.style.display = (priceNum <= 500000) ? 'flex' : (i % 3 === 0 ? 'flex' : 'none');
                        }

                        requestAnimationFrame(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        });
                    }, 150);
                });
            });
        });
    }

    // --------------------------------------------------------------------------
    // 3. TÍNH NĂNG DANH SÁCH YÊU THÍCH (WISHLIST) VỚI LOCALSTORAGE
    // --------------------------------------------------------------------------
    const wishlistButtons = document.querySelectorAll('.btn-wishlist');
    const savedWishlist = JSON.parse(localStorage.getItem('comichub_wishlist') || '[]');

    wishlistButtons.forEach((btn) => {
        const card = btn.closest('.product-card');
        const title = card?.querySelector('.prod-title')?.textContent.trim() || 'Truyện';

        if (savedWishlist.includes(title)) {
            btn.innerHTML = '<i class="fa-solid fa-heart" style="color: #e11d48;"></i>';
            btn.dataset.active = 'true';
        } else {
            btn.dataset.active = 'false';
        }

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = btn.dataset.active === 'true';
            let currentWishlist = JSON.parse(localStorage.getItem('comichub_wishlist') || '[]');

            if (isActive) {
                btn.dataset.active = 'false';
                btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                currentWishlist = currentWishlist.filter(item => item !== title);
                showToast(`Đã xóa "${title}" khỏi mục yêu thích`, 'info', 'fa-heart-crack');
            } else {
                btn.dataset.active = 'true';
                btn.innerHTML = '<i class="fa-solid fa-heart" style="color: #e11d48;"></i>';
                if (!currentWishlist.includes(title)) currentWishlist.push(title);
                showToast(`Đã thêm "${title}" vào mục yêu thích!`, 'primary', 'fa-heart');

                btn.style.transform = 'scale(1.25)';
                setTimeout(() => btn.style.transform = 'scale(1)', 200);
            }

            localStorage.setItem('comichub_wishlist', JSON.stringify(currentWishlist));
        });
    });

    // --------------------------------------------------------------------------
    // 4. NÚT "MUA NGAY" TRÊN MỖI CARD SẢN PHẨM (THÊM VÀO GIỎ & FEEDBACK)
    // --------------------------------------------------------------------------
    const buyButtons = document.querySelectorAll('.btn-buy-now');

    buyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.product-card');
            const title = card?.querySelector('.prod-title')?.textContent.trim() || 'Tập truyện';
            const price = card?.querySelector('.price-current')?.textContent.trim() || 'Liên hệ';

            let cartItems = JSON.parse(localStorage.getItem('comichub_cart') || '[]');
            cartItems.push({ title, price, time: Date.now() });
            localStorage.setItem('comichub_cart', JSON.stringify(cartItems));

            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã thêm';
            btn.style.backgroundColor = '#16a34a';

            showToast(`Đã thêm "${title}" (${price}) vào giỏ hàng!`, 'success', 'fa-cart-plus');

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.backgroundColor = '';
            }, 1800);
        });
    });

    // --------------------------------------------------------------------------
    // 5. NÚT "TẢI THÊM TRUYỆN VỪA LÊN KỆ" (LOAD MORE)
    // --------------------------------------------------------------------------
    const btnLoadMore = document.querySelector('.btn-load-more');
    if (btnLoadMore) {
        let loadCount = 0;
        btnLoadMore.addEventListener('click', () => {
            loadCount++;
            const originalText = btnLoadMore.innerHTML;
            btnLoadMore.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải thêm truyện...';
            btnLoadMore.disabled = true;

            setTimeout(() => {
                const productsGrid = document.querySelector('.products-grid');
                if (productsGrid) {
                    const templateCards = productsGrid.querySelectorAll('.product-card');
                    if (templateCards.length > 0) {
                        const clone1 = templateCards[0].cloneNode(true);
                        const clone2 = templateCards[1].cloneNode(true);

                        const title1 = clone1.querySelector('.prod-title');
                        if (title1) title1.textContent = `Chainsaw Man - Trọn Bộ 1-11 (Bản Sưu Tầm) - Mới #${loadCount}`;
                        const price1 = clone1.querySelector('.price-current');
                        if (price1) price1.textContent = '550.000₫';

                        const title2 = clone2.querySelector('.prod-title');
                        if (title2) title2.textContent = `Tokyo Revengers Full 31 Tập Seal 100% - Đợt #${loadCount}`;
                        const price2 = clone2.querySelector('.price-current');
                        if (price2) price2.textContent = '1.100.000₫';

                        productsGrid.appendChild(clone1);
                        productsGrid.appendChild(clone2);
                    }
                }

                btnLoadMore.innerHTML = originalText;
                btnLoadMore.disabled = false;
                showToast('Đã tải thêm 2 bộ truyện mới lên kệ!', 'success', 'fa-bolt');

                if (loadCount >= 3) {
                    btnLoadMore.textContent = 'Đã hiển thị toàn bộ truyện hôm nay';
                    btnLoadMore.disabled = true;
                    btnLoadMore.style.opacity = '0.6';
                }
            }, 700);
        });
    }

    // --------------------------------------------------------------------------
    // 6. TƯƠNG TÁC SÀN TRAO ĐỔI 1-1 (GỬI ĐỀ XUẤT ĐỔI NGANG MODAL)
    // --------------------------------------------------------------------------
    const barterButtons = document.querySelectorAll('.barter-card .btn-secondary-dark');

    barterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.barter-card');
            const ownerName = card?.querySelector('.barter-user-name')?.textContent.trim() || 'Người đăng';
            const haveBook = card?.querySelector('.compare-col.have .col-book-title')?.textContent.trim() || 'Truyện chủ sách';
            const wantBook = card?.querySelector('.compare-col.want .col-book-title')?.textContent.trim() || 'Truyện cần đổi';

            const modalBackdrop = document.createElement('div');
            modalBackdrop.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        transition: opacity 0.25s ease;
      `;

            modalBackdrop.innerHTML = `
        <div style="
          background: #ffffff;
          border-radius: 20px;
          padding: 28px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 30px -10px rgba(0,0,0,0.3);
          transform: translateY(20px);
          transition: transform 0.25s ease;
          font-family: inherit;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffedd5; color: #f97316; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-arrow-right-arrow-left"></i>
              </div>
              <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">Đề Xuất Kèo Đổi Với ${ownerName}</h3>
            </div>
            <button class="btn-close-modal" style="border: none; background: transparent; font-size: 18px; color: #94a3b8; cursor: pointer;">&times;</button>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px;">
            <div style="margin-bottom: 6px;"><strong>Họ đang có:</strong> <span style="color: #f97316; font-weight: 700;">${haveBook}</span></div>
            <div><strong>Họ mong muốn:</strong> <span style="color: #0f172a; font-weight: 700;">${wantBook}</span></div>
          </div>

          <label style="display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase;">Chọn bộ truyện từ tủ sách của bạn để ghép đôi:</label>
          <select class="my-book-select" style="width: 100%; padding: 10px 12px; border: 1.5px solid #fed7aa; border-radius: 10px; font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 14px; outline: none;">
            <option value="1">Chainsaw Man (Tập 1-11) - Đủ bookmark & obi (Like New 98%)</option>
            <option value="2">Jujutsu Kaisen Boxset 0-20 (Nguyên seal)</option>
            <option value="3">One Piece Tàu Sunny Phiên Bản Giới Hạn</option>
            <option value="4">+ Thêm truyện khác từ tủ sách của bạn...</option>
          </select>

          <label style="display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px;">Lời nhắn kèm đề xuất:</label>
          <textarea class="barter-note" rows="3" placeholder="Ví dụ: Mình ở quận 1, truyện bọc túi zip cẩn thận, có thể giao dịch trực tiếp hoặc qua ký quỹ ComicHub..." style="width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; margin-bottom: 20px; outline: none; font-family: inherit; resize: none;"></textarea>

          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-cancel-modal" style="padding: 10px 18px; border-radius: 9999px; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b; font-weight: 700; font-size: 13px; cursor: pointer;">Hủy bỏ</button>
            <button class="btn-send-barter-confirm" style="padding: 10px 22px; border-radius: 9999px; border: none; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);">Gửi Đề Xuất Ngay</button>
          </div>
        </div>
      `;

            document.body.appendChild(modalBackdrop);

            requestAnimationFrame(() => {
                modalBackdrop.style.opacity = '1';
                modalBackdrop.firstElementChild.style.transform = 'translateY(0)';
            });

            const closeModal = () => {
                modalBackdrop.style.opacity = '0';
                modalBackdrop.firstElementChild.style.transform = 'translateY(20px)';
                setTimeout(() => modalBackdrop.remove(), 250);
            };

            modalBackdrop.querySelector('.btn-close-modal').addEventListener('click', closeModal);
            modalBackdrop.querySelector('.btn-cancel-modal').addEventListener('click', closeModal);
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) closeModal();
            });

            modalBackdrop.querySelector('.btn-send-barter-confirm').addEventListener('click', () => {
                closeModal();
                showToast(`Đã gửi đề xuất đổi ngang đến ${ownerName}! Đang đợi phản hồi.`, 'success', 'fa-paper-plane');
            });
        });
    });

    // --------------------------------------------------------------------------
    // 7. SMOOTH LINKING CHO CÁC CARD DANH MỤC THỂ LOẠI
    // --------------------------------------------------------------------------
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const title = card.querySelector('.cat-title')?.textContent.trim() || 'Danh mục';
            showToast(`Đang lọc truyện thể loại: ${title}...`, 'primary', 'fa-book');
            setTimeout(() => {
                window.location.href = `category.html?genre=${encodeURIComponent(title)}`;
            }, 400);
        });
    });

    console.log('ComicHub Homepage scripts initialized successfully.');
});



