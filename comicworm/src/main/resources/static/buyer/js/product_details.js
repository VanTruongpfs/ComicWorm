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
        z-index: 99999;
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
      max-width: 380px;
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
    // 1. GALLERY: CHUYỂN ĐỔI ẢNH CHÍNH THEO THUMBNAIL
    // --------------------------------------------------------------------------
    const mainImage = document.querySelector('.primary-preview-img') || document.querySelector('.comic-gallery-column .main-image-wrapper img');
    const thumbButtons = document.querySelectorAll('.thumbnail-strip .thumb-item, .thumbnail-strip button, .grid-cols-5 > div');

    if (thumbButtons.length > 0 && mainImage) {
        thumbButtons.forEach((thumbBtn) => {
            thumbBtn.addEventListener('click', () => {
                thumbButtons.forEach(btn => {
                    btn.classList.remove('active', 'border-[#F97316]', 'border-2');
                    btn.style.borderColor = '#e2e8f0';
                    btn.style.borderWidth = '1px';
                });

                thumbBtn.classList.add('active');
                thumbBtn.style.borderColor = '#f97316';
                thumbBtn.style.borderWidth = '2px';

                const thumbImg = thumbBtn.querySelector('img');
                if (thumbImg) {
                    mainImage.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    mainImage.style.opacity = '0.4';
                    mainImage.style.transform = 'scale(0.98)';

                    setTimeout(() => {
                        mainImage.src = thumbImg.src.replace('w=200', 'w=1000');
                        mainImage.alt = thumbImg.alt;
                        mainImage.style.opacity = '1';
                        mainImage.style.transform = 'scale(1)';
                    }, 150);
                }
            });
        });
    }

    // --------------------------------------------------------------------------
    // 2. CHUYỂN ĐỔI NỘI DUNG TABS (CỐT TRUYỆN / ĐÓNG GÓI / ĐÁNH GIÁ)
    // --------------------------------------------------------------------------
    const tabButtons = document.querySelectorAll('.tabs-header-bar .tab-button, .comic-tabs-container button[role="tab"]');
    const contentArea = document.querySelector('.comic-tabs-container article, .comic-tabs-container .tab-pane, .comic-tabs-container > div:last-child');

    const tabContents = [
        // Tab 1: Giới thiệu & Cốt truyện
        `
    <div class="synopsis-wrapper" style="animation: fadeIn 0.3s ease;">
      <h2 class="synopsis-title" style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; font-family: var(--font-headline);">
        Hành Trình Huyền Thoại Của Sakuragi Hanamichi & Đội Bóng Rổ Shohoku
      </h2>
      <p style="font-size: 14px; color: #475569; line-height: 1.65; margin-bottom: 12px;">
        <strong>Slam Dunk</strong> là tuyệt tác manga thể thao bất hủ của tác giả Inoue Takehiko. Tác phẩm kể về Hanamichi Sakuragi - một học sinh cá biệt với mái tóc đỏ rực lửa gia nhập đội bóng rổ trường Trung học Shohoku ban đầu chỉ để gây ấn tượng với Haruko Akagi. Dưới sự dẫn dắt của đội trưởng Akagi Takenori cùng sự xuất hiện của thiên tài lạnh lùng Rukawa Kaede, Mitsui Hisashi và Miyagi Ryota, Shohoku đã tạo nên hành trình kỳ diệu tại giải Quốc gia liên trường IH.
      </p>
      <p style="font-size: 14px; color: #475569; line-height: 1.65;">
        Phiên bản <strong>Deluxe Edition (24 tập)</strong> được Nhà xuất bản Kim Đồng ấn hành theo quy chuẩn cao cấp nhất từ Shueisha Nhật Bản: Giữ nguyên toàn bộ trang màu mở đầu chương của bản tạp chí Weekly Shonen Jump, khổ truyện mở rộng chuẩn 14.5x20.5cm và toàn bộ 24 bìa đều được tác giả Inoue Takehiko vẽ mới hoàn toàn với phong cách nét cọ hiện đại đầy sức sống.
      </p>

      <div class="highlights-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #ffedd5; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-bottom: 12px;">
            <i class="fa-solid fa-paintbrush"></i>
          </div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Bìa Mới 100% Tác Giả Vẽ</h4>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">Inoue Takehiko tự tay phác thảo lại biểu cảm và tinh thần cho cả 24 trang bìa bản Deluxe.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-bottom: 12px;">
            <i class="fa-solid fa-book-open"></i>
          </div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Trang Tranh Màu Độc Quyền</h4>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">Phục dựng trọn vẹn 320 trang màu gốc mà bản Tankobon thông thường bị chuyển thành đen trắng.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-bottom: 12px;">
            <i class="fa-solid fa-scroll"></i>
          </div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Giấy Xốp Nhập Khẩu</h4>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">Định lượng giấy dày mịn chống lem mực tối ưu, hạn chế hiện tượng ố vàng theo thời gian.</p>
        </div>
      </div>
    </div>
    `,

        // Tab 2: Quy Cách Đóng Gói 4 Lớp Chuyên Biệt
        `
    <div class="packaging-wrapper" style="animation: fadeIn 0.3s ease;">
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; font-family: var(--font-headline);">
        Tiêu Chuẩn Đóng Gói SafeShip™ 4 Lớp Chống Va Đập Bìa Manga
      </h2>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        ComicHub áp dụng quy trình kiểm định và đóng gói nghiêm ngặt trước khi xuất kho giao lưu, đảm bảo nguyên vẹn góc cạnh sách 100% đến tay độc giả.
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        <div style="border: 1.5px solid #fed7aa; background: #fffaf5; border-radius: 14px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 800; color: #f97316; margin-bottom: 4px;">LỚP 1 - BỌC TÚI OPP / ZIP</div>
          <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 6px;">Túi màng ngọc chống ẩm</div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.4;">Từng tập truyện đều được bọc màng bảo vệ riêng biệt, chống ẩm mốc và bụi bẩn xâm nhập.</p>
        </div>

        <div style="border: 1.5px solid #fed7aa; background: #fffaf5; border-radius: 14px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 800; color: #f97316; margin-bottom: 4px;">LỚP 2 - NẸP BÌA CARTON 3 LỚP</div>
          <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 6px;">Chống cấn mép góc truyện</div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.4;">Hai mặt trên dưới được kẹp carton cứng định hình, giữ phẳng gáy sách và bảo vệ góc 90°.</p>
        </div>

        <div style="border: 1.5px solid #fed7aa; background: #fffaf5; border-radius: 14px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 800; color: #f97316; margin-bottom: 4px;">LỚP 3 - CUỘN BUBBLE KHÍ 4 LỚP</div>
          <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 6px;">Xốp bóng khí hấp thu lực</div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.4;">Quấn tối thiểu 4 vòng xốp bóng khí loại dày dặn, an toàn trước va chạm khi vận chuyển.</p>
        </div>

        <div style="border: 1.5px solid #fed7aa; background: #fffaf5; border-radius: 14px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 800; color: #f97316; margin-bottom: 4px;">LỚP 4 - THÙNG SHIP HÃNG & SEAL</div>
          <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 6px;">Băng dính niêm phong ComicHub</div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.4;">Đóng thùng carton chuyên dụng kèm tem kiểm định, hỗ trợ đồng kiểm trực tiếp khi nhận hàng.</p>
        </div>
      </div>
    </div>
    `,

        // Tab 3: Đánh giá từ độc giả (18)
        `
    <div class="reviews-wrapper" style="animation: fadeIn 0.3s ease;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; font-family: var(--font-headline);">
            Đánh Giá Từ Cộng Đồng Độc Giả (18 Đánh Giá)
          </h2>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span style="font-size: 22px; font-weight: 800; color: #f97316;">5.0</span>
            <div style="color: #f59e0b; font-size: 13px;">
              <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
            </div>
            <span style="font-size: 12px; color: #64748b;">• 100% đánh giá hài lòng về độ mới & tình trạng sách</span>
          </div>
        </div>
        <button type="button" class="btn-write-review" style="background: #f97316; color: white; border: none; font-weight: 700; font-size: 12px; padding: 10px 18px; border-radius: 9999px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <i class="fa-regular fa-pen-to-square"></i> Viết Đánh Giá
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #fed7aa; color: #f97316; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 11px;">M</div>
              <strong style="font-size: 13px; color: #0f172a;">Minh Nhật (Hà Nội)</strong>
              <span style="background: #dcfce7; color: #16a34a; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">Đã giao lưu thành công</span>
            </div>
            <span style="font-size: 11px; color: #94a3b8;">Hôm qua</span>
          </div>
          <div style="color: #f59e0b; font-size: 11px; margin-bottom: 4px;">
            <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
          </div>
          <p style="font-size: 13px; color: #475569; line-height: 1.45;">Bộ Slam Dunk tuyệt đẹp! Bìa rời phẳng phiu không một vết cấn, 24 postcard nguyên vẹn trong seal như mô tả. Đóng gói 4 lớp của shop cực kỳ yên tâm.</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #dbeafe; color: #2563eb; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 11px;">T</div>
              <strong style="font-size: 13px; color: #0f172a;">Tuấn Kiệt (TP. HCM)</strong>
              <span style="background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">Đổi Barter 1-1</span>
            </div>
            <span style="font-size: 11px; color: #94a3b8;">3 ngày trước</span>
          </div>
          <div style="color: #f59e0b; font-size: 11px; margin-bottom: 4px;">
            <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
          </div>
          <p style="font-size: 13px; color: #475569; line-height: 1.45;">Giao dịch qua ký quỹ ComicHub rất tiện, hai bên đồng kiểm xong hệ thống mới chuyển tiền bù. Anh Vinh chủ sách nói chuyện rất nhiệt tình!</p>
        </div>
      </div>
    </div>
    `
    ];

    if (tabButtons.length > 0) {
        tabButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => {
                    b.classList.remove('active', 'bg-[#F97316]', 'text-white');
                    b.setAttribute('aria-selected', 'false');
                    b.style.backgroundColor = '#f8fafc';
                    b.style.color = '#64748b';
                });

                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                btn.style.backgroundColor = '#f97316';
                btn.style.color = '#ffffff';

                if (contentArea && tabContents[index]) {
                    contentArea.innerHTML = tabContents[index];

                    const btnReview = contentArea.querySelector('.btn-write-review');
                    if (btnReview) {
                        btnReview.addEventListener('click', () => {
                            showToast('Tính năng gửi đánh giá sẽ mở sau khi bạn hoàn tất nhận hàng!', 'info', 'fa-pen');
                        });
                    }
                }
            });
        });
    }

    // --------------------------------------------------------------------------
    // 3. TÍNH NĂNG WISHLIST (LƯU VÀO LOCALSTORAGE)
    // --------------------------------------------------------------------------
    const wishlistBtn = document.querySelector('.btn-icon-action[aria-label="Lưu vào yêu thích"]') || document.querySelector('button[aria-label="Yêu thích"]');
    const bookTitle = document.querySelector('.comic-main-title, h1')?.textContent.trim() || 'Slam Dunk Deluxe Edition';

    if (wishlistBtn) {
        const savedWishlist = JSON.parse(localStorage.getItem('comichub_wishlist') || '[]');
        const isLiked = savedWishlist.includes(bookTitle);

        if (isLiked) {
            wishlistBtn.innerHTML = '<i class="fa-solid fa-heart" style="color: #e11d48; font-size: 16px;"></i>';
            wishlistBtn.dataset.active = 'true';
        } else {
            wishlistBtn.dataset.active = 'false';
        }

        wishlistBtn.addEventListener('click', () => {
            const active = wishlistBtn.dataset.active === 'true';
            let currentWishlist = JSON.parse(localStorage.getItem('comichub_wishlist') || '[]');

            if (active) {
                wishlistBtn.dataset.active = 'false';
                wishlistBtn.innerHTML = '<i class="fa-regular fa-heart" style="font-size: 16px;"></i>';
                currentWishlist = currentWishlist.filter(item => item !== bookTitle);
                showToast(`Đã xóa "${bookTitle}" khỏi danh sách yêu thích!`, 'info', 'fa-heart-crack');
            } else {
                wishlistBtn.dataset.active = 'true';
                wishlistBtn.innerHTML = '<i class="fa-solid fa-heart" style="color: #e11d48; font-size: 16px;"></i>';
                if (!currentWishlist.includes(bookTitle)) currentWishlist.push(bookTitle);
                showToast(`Đã thêm "${bookTitle}" vào danh sách theo dõi!`, 'primary', 'fa-heart');

                wishlistBtn.style.transform = 'scale(1.25)';
                setTimeout(() => wishlistBtn.style.transform = 'scale(1)', 200);
            }

            localStorage.setItem('comichub_wishlist', JSON.stringify(currentWishlist));
        });
    }

    // --------------------------------------------------------------------------
    // 4. NÚT CHIA SẺ BÀI ĐĂNG (CLIPBOARD COPY)
    // --------------------------------------------------------------------------
    const shareBtn = document.querySelector('.btn-icon-action[aria-label="Chia sẻ bài đăng"]') || document.querySelector('button[aria-label="Chia sẻ"]');

    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const currentUrl = window.location.href;
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(currentUrl);
                    showToast('Đã sao chép liên kết bộ truyện vào bộ nhớ tạm!', 'success', 'fa-copy');
                } else {
                    showToast(`Link bài đăng: ${currentUrl}`, 'info', 'fa-share-nodes');
                }
            } catch (err) {
                showToast('Đã copy đường link bộ truyện!', 'success', 'fa-check');
            }
        });
    }

    // --------------------------------------------------------------------------
    // 5. NÚT "MUA NGAY (BẢO CHỨNG PAY)"
    // --------------------------------------------------------------------------
    const btnBuyNow = document.querySelector('.btn-buy-now, button.bg-\\[\\#F97316\\].shadow-lg');

    if (btnBuyNow) {
        btnBuyNow.addEventListener('click', (e) => {
            e.preventDefault();
            const priceText = document.querySelector('.current-price, .text-3xl.text-\\[\\#F97316\\]')?.textContent.trim() || '1.850.000₫';

            let cartItems = JSON.parse(localStorage.getItem('comichub_cart') || '[]');
            cartItems.push({
                title: bookTitle,
                price: priceText,
                condition: 'Near Mint 9.8',
                seller: 'AnVinh Collector',
                time: Date.now()
            });
            localStorage.setItem('comichub_cart', JSON.stringify(cartItems));

            showToast(`Đang chuyển đến trang Thanh Toán Bảo Chứng cho "${bookTitle}"...`, 'primary', 'fa-spinner fa-spin');

            setTimeout(() => {
                window.location.href = 'payment.html';
            }, 700);
        });
    }

    // --------------------------------------------------------------------------
    // 6. KHỚP KÈO NHANH (KÈO TRAO ĐỔI 01 & 02 CÓ SẴN)
    // --------------------------------------------------------------------------
    const matchButtons = document.querySelectorAll('.btn-match-barter, button.bg-\\[\\#FFF7ED\\], button.bg-\\[\\#DCFCE7\\]');

    matchButtons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            const barterName = idx === 0
                ? 'Chainsaw Man (Tập 1 - 11) + Bù 600.000₫'
                : 'Full Bộ Tokyo Ghoul (Đổi Ngang 1-1)';

            showToast(`Đang tạo yêu cầu khớp "${barterName}"...`, 'primary', 'fa-arrows-rotate fa-spin');

            setTimeout(() => {
                showToast(`Đã gửi đề xuất khớp kèo thành công tới AnVinh Collector!`, 'success', 'fa-circle-check');
            }, 900);
        });
    });

    // --------------------------------------------------------------------------
    // 7. MODAL ĐỀ XUẤT ĐỔI TRUYỆN 1-1 TÙY CHỌN
    // --------------------------------------------------------------------------
    const btnProposeBarter = document.querySelector('.btn-propose-exchange, button.bg-\\[\\#0F172A\\]');

    if (btnProposeBarter) {
        btnProposeBarter.addEventListener('click', () => {
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
          max-width: 520px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
          transform: translateY(20px);
          transition: transform 0.25s ease;
          font-family: inherit;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: #ffedd5; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fa-solid fa-right-left"></i>
              </div>
              <div>
                <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">Đề Xuất Kèo Đổi 1-1</h3>
                <span style="font-size: 11px; color: #64748b;">Gửi yêu cầu trao đổi tới <strong>AnVinh Collector</strong></span>
              </div>
            </div>
            <button class="btn-close-modal" style="border: none; background: transparent; font-size: 20px; color: #94a3b8; cursor: pointer;">&times;</button>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; font-size: 12px;">
            <span style="color: #64748b;">Truyện bạn muốn nhận:</span>
            <strong style="color: #f97316; display: block; font-size: 13px; margin-top: 2px;">${bookTitle} (Bản Bìa Rời Deluxe 24 Tập)</strong>
          </div>

          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase;">1. Chọn bộ truyện từ tủ sách của bạn để ghép đôi:</label>
          <select class="select-barter-book" style="width: 100%; padding: 10px 12px; border: 1.5px solid #fed7aa; border-radius: 10px; font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 14px; outline: none; background: #ffffff;">
            <option value="1">Jujutsu Kaisen Boxset 0-20 (Nguyên seal 100%)</option>
            <option value="2">Chainsaw Man Tập 1-11 (Bản sưu tầm like new có Obi)</option>
            <option value="3">Full Bộ Tokyo Ghoul Boxset Shueisha</option>
            <option value="4">+ Thêm bộ truyện khác từ tủ sách...</option>
          </select>

          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase;">2. Hình thức giao lưu:</label>
          <div style="display: flex; gap: 12px; margin-bottom: 14px;">
            <label style="flex: 1; display: flex; align-items: center; gap: 8px; border: 1px solid #fed7aa; background: #fffaf5; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700; color: #f97316;">
              <input type="radio" name="barter_type" checked style="accent-color: #f97316;"> Đổi Ngang 1-1
            </label>
            <label style="flex: 1; display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; color: #475569;">
              <input type="radio" name="barter_type" style="accent-color: #f97316;"> Kèm bù tiền mặt
            </label>
          </div>

          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px;">3. Lời nhắn & địa điểm giao dịch:</label>
          <textarea class="barter-message" rows="3" placeholder="Ví dụ: Mình ở Hà Nội, có thể giao dịch trực tiếp hoặc ký quỹ ComicHub để cả hai bên đều an tâm..." style="width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; margin-bottom: 18px; outline: none; resize: none; font-family: inherit;"></textarea>

          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-cancel-modal" style="padding: 10px 18px; border-radius: 9999px; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b; font-weight: 700; font-size: 13px; cursor: pointer;">Hủy bỏ</button>
            <button class="btn-confirm-barter" style="padding: 10px 22px; border-radius: 9999px; border: none; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">Gửi Đề Xuất Kèo Đổi</button>
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

            modalBackdrop.querySelector('.btn-confirm-barter').addEventListener('click', () => {
                closeModal();
                showToast('Đã gửi đề xuất trao đổi tới AnVinh Collector! Vui lòng chờ phản hồi trong 24h.', 'success', 'fa-paper-plane');
            });
        });
    }

    // --------------------------------------------------------------------------
    // 8. CHAT VỚI NGƯỜI BÁN (CHAT POPUP)
    // --------------------------------------------------------------------------
    const btnChatSeller = document.querySelector('.btn-chat-seller, button.text-xs.font-bold');

    if (btnChatSeller) {
        btnChatSeller.addEventListener('click', () => {
            const chatWidget = document.createElement('div');
            chatWidget.id = 'comichub-chat-widget';
            chatWidget.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 360px;
        background: #ffffff;
        border-radius: 18px;
        box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);
        border: 1px solid #fed7aa;
        z-index: 99998;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: inherit;
      `;

            chatWidget.innerHTML = `
        <div style="background: #0f172a; color: white; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; border: 1.5px solid #f97316;">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" style="width: 100%; height: 100%; object-fit: cover;">
              <span style="position: absolute; bottom: 0; right: 0; width: 8px; height: 8px; border-radius: 50%; background: #16a34a; border: 1.5px solid white;"></span>
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 700;">AnVinh Collector</div>
              <div style="font-size: 10px; color: #94a3b8;">Thường trả lời sau 5 phút</div>
            </div>
          </div>
          <button class="btn-close-chat" style="border: none; background: transparent; color: #94a3b8; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <div style="padding: 12px 14px; background: #fffaf5; border-bottom: 1px solid #fed7aa; display: flex; align-items: center; gap: 10px;">
          <img src="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=100&q=80" style="width: 36px; height: 48px; object-fit: cover; border-radius: 6px;">
          <div style="flex: 1;">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; line-height: 1.2;">Slam Dunk Deluxe Edition (24 Tập)</div>
            <div style="font-size: 12px; font-weight: 800; color: #f97316; margin-top: 2px;">1.850.000₫</div>
          </div>
        </div>

        <div class="chat-messages-body" style="height: 220px; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; font-size: 12px; background: #f8fafc;">
          <div style="align-self: flex-start; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 12px 12px 12px 2px; max-width: 80%; line-height: 1.4; color: #334155;">
            Chào bạn! Bộ Slam Dunk bản bìa rời này mình giữ rất kỹ trong tủ kính chống ẩm, đủ 24 postcard nguyên seal. Bạn cần xem thêm ảnh góc nào không ạ?
          </div>
        </div>

        <form class="chat-input-form" style="padding: 10px 12px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;">
          <input type="text" placeholder="Nhập tin nhắn..." style="flex: 1; border: 1px solid #cbd5e1; border-radius: 20px; padding: 8px 14px; font-size: 12px; outline: none;">
          <button type="submit" style="width: 34px; height: 34px; border-radius: 50%; background: #f97316; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-paper-plane" style="font-size: 12px;"></i>
          </button>
        </form>
      `;

            document.body.appendChild(chatWidget);

            chatWidget.querySelector('.btn-close-chat').addEventListener('click', () => {
                chatWidget.remove();
            });

            const chatForm = chatWidget.querySelector('.chat-input-form');
            const chatInput = chatForm.querySelector('input');
            const messagesBody = chatWidget.querySelector('.chat-messages-body');

            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text) return;

                const myMsg = document.createElement('div');
                myMsg.style.cssText = `
          align-self: flex-end;
          background: #f97316;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 12px 12px 2px 12px;
          max-width: 80%;
          line-height: 1.4;
        `;
                myMsg.textContent = text;
                messagesBody.appendChild(myMsg);
                chatInput.value = '';
                messagesBody.scrollTop = messagesBody.scrollHeight;

                setTimeout(() => {
                    const replyMsg = document.createElement('div');
                    replyMsg.style.cssText = `
            align-self: flex-start;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 12px 12px 12px 2px;
            max-width: 80%;
            line-height: 1.4;
            color: #334155;
          `;
                    replyMsg.textContent = 'Dạ vâng, mình đã nhận tin nhắn của bạn. Bạn muốn xem video kiểm tra gáy sách không mình gửi qua Zalo luôn nhé!';
                    messagesBody.appendChild(replyMsg);
                    messagesBody.scrollTop = messagesBody.scrollHeight;
                }, 1000);
            });
        });
    }

    // --------------------------------------------------------------------------
    // 9. NÚT "XEM TỦ SÁCH NGƯỜI BÁN (84)"
    // --------------------------------------------------------------------------
    const btnViewShelf = document.querySelector('.btn-view-shelf, button.text-xs.font-bold');

    if (btnViewShelf) {
        btnViewShelf.addEventListener('click', () => {
            showToast('Đang mở tủ sách của AnVinh Collector (84 bộ manga & comic)...', 'primary', 'fa-book');
            setTimeout(() => {
                window.location.href = 'category.html?seller=AnVinh';
            }, 500);
        });
    }

    // --------------------------------------------------------------------------
    // 10. GIẢ LẬP SỐ NGƯỜI XEM TRỰC TIẾP (LIVE VIEWERS PULSE)
    // --------------------------------------------------------------------------
    const liveViewersBadge = document.querySelector('.tag-live-viewers, .text-\\[\\#16A34A\\]');
    if (liveViewersBadge) {
        let currentViewers = 14;
        setInterval(() => {
            const change = (Math.random() > 0.5 ? 1 : -1);
            currentViewers = Math.max(11, Math.min(22, currentViewers + change));

            const dot = '<span class="live-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a; margin-right:6px;"></span>';
            liveViewersBadge.innerHTML = `${dot} Đang có <strong>${currentViewers}</strong> người xem tin này`;
        }, 6000);
    }

    // --------------------------------------------------------------------------
    // 11. CLICK VÀO TRUYỆN CÙNG THỂ LOẠI & KÈO ĐỔI TƯƠNG TỰ
    // --------------------------------------------------------------------------
    const relatedCards = document.querySelectorAll('.comic-card, .grid-cols-5 > div, .related-grid article');
    relatedCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const cardTitle = card.querySelector('.card-title, h3')?.textContent.trim() || 'Truyện liên quan';
            showToast(`Đang tải trang chi tiết "${cardTitle}"...`, 'primary', 'fa-book-open');
        });
    });

    console.log('ComicHub Product Detail scripts (detail.js) loaded successfully.');
});
