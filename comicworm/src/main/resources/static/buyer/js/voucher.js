/**
 * ============================================================================
 * COMICHUB - KHO VOUCHER & TỐI ƯU ƯU ĐÃI (VOUCHER VAULT LOGIC)
 * ============================================================================
 * File: voucher-vault.js / script.js
 * Mô tả: Quản lý chọn/đổi/gỡ voucher 3 slot, tính toán tổng giảm giá realtime,
 *       lọc/sắp xếp danh sách, lưu mã mới và đồng bộ với trang Checkout qua localStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --------------------------------------------------------------------------
    // 0. TIỆN ÍCH DÙNG CHUNG: TOAST NOTIFICATION
    // --------------------------------------------------------------------------
    /**
     * Hiển thị thông báo Toast nhanh ở góc dưới màn hình
     * @param {string} message - Nội dung thông báo
     * @param {string} type - Loại thông báo: 'success' | 'warning' | 'danger' | 'info' | 'primary'
     * @param {string} icon - Class FontAwesome icon (VD: 'fa-circle-info')
     */
    const showToast = (message, type = 'info', icon = 'fa-circle-info') => {
        let container = document.getElementById('comichub-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'comichub-toast-container';
            container.style.cssText = `
        position: fixed;
        bottom: 90px;
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
    // 1. TIỆN ÍCH ĐỊNH DẠNG TIỀN TỆ & STATE VOUCHER DANG CHỌN
    // --------------------------------------------------------------------------
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    // State các voucher đang áp dụng theo 3 slot gộp độc quyền của ComicHub
    const voucherState = {
        // Slot 1: Voucher Sách & Comic (Toàn sàn hoặc Shop)
        bookVoucher: {
            code: 'OTAKU50K',
            discount: 50000,
            title: 'Giảm 50.000₫ đơn từ 400.000₫'
        },
        // Slot 2: Voucher Miễn Phí Vận Chuyển SafeShip
        shippingVoucher: {
            code: 'COMICFREE',
            discount: 35000,
            title: 'Giảm tối đa 35.000₫ phí ship SafeShip'
        },
        // Slot 3: Voucher Barter Ký Quỹ hoặc Hoàn Xu Otaku
        barterOrCoinVoucher: null,
        orderTotalValue: 5050000
    };

    // Đọc dữ liệu từ localStorage nếu đã được lưu từ trang Checkout/Cart
    try {
        const saved = localStorage.getItem('comichub_applied_vouchers');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.bookVoucher !== undefined) voucherState.bookVoucher = parsed.bookVoucher;
            if (parsed.shippingVoucher !== undefined) voucherState.shippingVoucher = parsed.shippingVoucher;
            if (parsed.barterOrCoinVoucher !== undefined) voucherState.barterOrCoinVoucher = parsed.barterOrCoinVoucher;
        }
    } catch (e) {
        console.warn('Cannot parse localStorage for vouchers', e);
    }

    // --------------------------------------------------------------------------
    // 2. TÍNH TOÁN & CẬP NHẬT FLOATING STICKY ACTION BAR & TOP BADGES
    // --------------------------------------------------------------------------
    const updateFloatingBar = () => {
        const activeCodes = [];
        const bookDiscount = voucherState.bookVoucher ? voucherState.bookVoucher.discount : 0;
        const shipDiscount = voucherState.shippingVoucher ? voucherState.shippingVoucher.discount : 0;
        const extraDiscount = voucherState.barterOrCoinVoucher ? voucherState.barterOrCoinVoucher.discount : 0;

        if (voucherState.bookVoucher) activeCodes.push(voucherState.bookVoucher.code);
        if (voucherState.shippingVoucher) activeCodes.push(voucherState.shippingVoucher.code);
        if (voucherState.barterOrCoinVoucher) activeCodes.push(voucherState.barterOrCoinVoucher.code);

        const totalDiscount = bookDiscount + shipDiscount + extraDiscount;

        const floatingTitleRow = document.querySelector('.floating-title-row');
        if (floatingTitleRow) {
            if (activeCodes.length === 0) {
                floatingTitleRow.innerHTML = `<strong>Chưa chọn mã ưu đãi nào</strong>`;
            } else {
                const badgesHtml = activeCodes.map(code => `<span class="tag-code-active">${code}</span>`).join(' ');
                floatingTitleRow.innerHTML = `<strong>Đã áp dụng ${activeCodes.length} voucher vào giỏ:</strong> ${badgesHtml}`;
            }
        }

        const savingCalcEl = document.querySelector('.floating-saving-calc');
        if (savingCalcEl) {
            savingCalcEl.innerHTML = `
        Tổng số tiền khấu trừ: <strong class="highlight-saving">-${formatMoney(totalDiscount)}</strong>
        <span class="saving-detail text-slate-500">(Giảm tiền sách: ${formatMoney(bookDiscount)} • Giảm phí vận chuyển: ${formatMoney(shipDiscount)}${extraDiscount > 0 ? ` • Trợ giá: ${formatMoney(extraDiscount)}` : ''})</span>
      `;
        }

        const cartContextTag = document.querySelector('.cart-context-badge .tag-auto-applied, .cart-context-badge-tag');
        if (cartContextTag) {
            cartContextTag.textContent = activeCodes.length > 0
                ? `TỰ ĐỘNG TỐI ƯU ${activeCodes.length} MÃ (-${formatMoney(totalDiscount)})`
                : 'CHƯA CHỌN MÃ';
        }

        const btnConfirm = document.querySelector('.btn-confirm-checkout');
        if (btnConfirm) {
            btnConfirm.disabled = (activeCodes.length === 0);
            btnConfirm.style.opacity = (activeCodes.length === 0) ? '0.6' : '1';
            btnConfirm.style.cursor = (activeCodes.length === 0) ? 'not-allowed' : 'pointer';
        }
    };

    // --------------------------------------------------------------------------
    // 3. TƯƠNG TÁC TABS PHÂN LOẠI VOUCHER (SHOPEE-STYLE TABS)
    // --------------------------------------------------------------------------
    const tabButtons = document.querySelectorAll('.voucher-tab-item, button[class*="voucher-tab"]');
    const categoryGroups = document.querySelectorAll('.voucher-category-group');

    if (tabButtons.length > 0) {
        tabButtons.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                tabButtons.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabText = tab.textContent.trim();
                showToast(`Đang hiển thị: ${tabText}`, 'info', 'fa-filter');

                categoryGroups.forEach((group, gIdx) => {
                    group.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    group.style.opacity = '0';
                    group.style.transform = 'translateY(6px)';

                    setTimeout(() => {
                        if (index === 0) {
                            group.style.display = 'block';
                        } else if (index === 1) {
                            group.style.display = (gIdx === 0) ? 'block' : 'none';
                        } else if (index === 2) {
                            group.style.display = (gIdx === 1) ? 'block' : 'none';
                        } else if (index === 3) {
                            group.style.display = (gIdx === 2) ? 'block' : 'none';
                        } else {
                            group.style.display = (gIdx >= 3) ? 'block' : 'none';
                        }

                        requestAnimationFrame(() => {
                            group.style.opacity = '1';
                            group.style.transform = 'translateY(0)';
                        });
                    }, 150);
                });
            });
        });
    }

    // --------------------------------------------------------------------------
    // 4. BỘ SẮP XẾP VOUCHER (SORT DROPDOWN)
    // --------------------------------------------------------------------------
    const sortSelect = document.querySelector('.sort-select, select[class*="sort"]');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            showToast(`Đã sắp xếp danh sách voucher theo: ${val}`, 'info', 'fa-arrow-down-wide-short');
            const allGrids = document.querySelectorAll('.voucher-cards-grid');
            allGrids.forEach(grid => {
                grid.style.opacity = '0.5';
                setTimeout(() => { grid.style.opacity = '1'; }, 200);
            });
        });
    }

    // --------------------------------------------------------------------------
    // 5. XỬ LÝ CHỌN / BỎ CHỌN / ĐỔI VOUCHER TRÊN TỪNG THẺ VÉ (TICKET CARDS)
    // --------------------------------------------------------------------------
    const initTicketActions = () => {
        const ticketCards = document.querySelectorAll('.voucher-ticket-card');

        ticketCards.forEach((card) => {
            const codeBadge = card.querySelector('.ticket-code-badge, [class*="code"]')?.textContent.trim() || '';
            const actionBtn = card.querySelector('.btn-ticket-action');
            const termsBtn = card.querySelector('.btn-terms');

            const leftStub = card.querySelector('.ticket-left-stub');
            let type = 'book';
            if (leftStub?.classList.contains('bg-teal') || codeBadge.includes('SHIP') || codeBadge.includes('FREE')) {
                type = 'shipping';
            } else if (leftStub?.classList.contains('bg-amber') || codeBadge.includes('COIN')) {
                type = 'coin';
            } else if (leftStub?.classList.contains('bg-purple') || codeBadge.includes('BARTER') || codeBadge.includes('CGC')) {
                type = 'barter';
            }

            // 5.1 Nút Thao tác chính trên thẻ Voucher
            if (actionBtn) {
                actionBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const btnText = actionBtn.textContent.trim();

                    // Thao tác: "Bỏ Chọn"
                    if (btnText.includes('Bỏ Chọn')) {
                        if (type === 'shipping') {
                            voucherState.shippingVoucher = null;
                        } else if (type === 'book') {
                            voucherState.bookVoucher = null;
                        } else {
                            voucherState.barterOrCoinVoucher = null;
                        }

                        card.classList.remove('applied-border');
                        actionBtn.className = 'btn-ticket-action btn-primary-orange';
                        actionBtn.textContent = 'Dùng Ngay';

                        const badgeInUse = card.querySelector('.badge-in-use');
                        if (badgeInUse) badgeInUse.remove();

                        updateFloatingBar();
                        showToast(`Đã gỡ voucher "${codeBadge}"`, 'info', 'fa-xmark');
                        return;
                    }

                    // Thao tác: "Đổi Mã Này" hoặc "Dùng Ngay"
                    if (btnText.includes('Đổi') || btnText.includes('Dùng Ngay')) {
                        const titleText = card.querySelector('.voucher-discount-title')?.textContent.trim() || '';
                        let discountValue = 50000;

                        if (titleText.includes('35.000')) discountValue = 35000;
                        else if (titleText.includes('70.000')) discountValue = 70000;
                        else if (titleText.includes('100.000')) discountValue = 100000;
                        else if (titleText.includes('200.000')) discountValue = 200000;
                        else if (titleText.includes('40.000')) discountValue = 40000;
                        else if (titleText.includes('25.000')) discountValue = 25000;
                        else if (titleText.includes('60k') || titleText.includes('60.000')) discountValue = 60000;

                        // Reset trạng thái hiển thị của các thẻ cùng phân loại
                        ticketCards.forEach(otherCard => {
                            const otherStub = otherCard.querySelector('.ticket-left-stub');
                            const isSameType = (type === 'shipping' && (otherStub?.classList.contains('bg-teal') || otherCard.textContent.includes('phí ship'))) ||
                                (type === 'book' && (otherStub?.classList.contains('bg-orange') || otherCard.textContent.includes('Toàn Sàn')));

                            if (isSameType && otherCard !== card) {
                                otherCard.classList.remove('applied-border');
                                const otherBtn = otherCard.querySelector('.btn-ticket-action');
                                if (otherBtn && otherBtn.textContent.includes('Bỏ Chọn')) {
                                    otherBtn.className = 'btn-ticket-action btn-outline-orange';
                                    otherBtn.textContent = 'Đổi Mã Này';
                                }
                                const otherBadge = otherCard.querySelector('.badge-in-use');
                                if (otherBadge) otherBadge.remove();
                            }
                        });

                        const newVoucher = { code: codeBadge, discount: discountValue, title: titleText };
                        if (type === 'shipping') {
                            voucherState.shippingVoucher = newVoucher;
                        } else if (type === 'book') {
                            voucherState.bookVoucher = newVoucher;
                        } else {
                            voucherState.barterOrCoinVoucher = newVoucher;
                        }

                        card.classList.add('applied-border');
                        card.classList.remove('highlight-border');
                        actionBtn.className = 'btn-ticket-action btn-outline-cancel';
                        actionBtn.textContent = 'Bỏ Chọn';

                        const badgeRow = card.querySelector('.ticket-badge-row');
                        if (badgeRow && !badgeRow.querySelector('.badge-in-use')) {
                            const inUsePill = document.createElement('span');
                            inUsePill.className = 'badge-in-use';
                            inUsePill.textContent = 'ĐANG ÁP DỤNG';
                            badgeRow.insertBefore(inUsePill, badgeRow.firstChild);
                        }

                        updateFloatingBar();
                        showToast(`Áp dụng thành công "${codeBadge}" (${titleText})!`, 'success', 'fa-ticket');
                        return;
                    }

                    // Thao tác: "Lưu Thêm" / "Lưu Mã"
                    if (btnText.includes('Lưu')) {
                        actionBtn.textContent = 'Dùng Ngay';
                        actionBtn.className = 'btn-ticket-action btn-primary-orange';
                        showToast(`Đã lưu mã "${codeBadge}" vào Ví Voucher của bạn!`, 'success', 'fa-bookmark');
                        return;
                    }

                    // Thao tác: "Nhắc Tôi" (Flash Sale)
                    if (btnText.includes('Nhắc Tôi')) {
                        actionBtn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Đặt Nhắc';
                        actionBtn.style.backgroundColor = '#dcfce7';
                        actionBtn.style.color = '#16a34a';
                        showToast('Hệ thống sẽ gửi thông báo đẩy trước 5 phút khi mở đợt flash voucher 12:00 trưa!', 'success', 'fa-bell');
                        return;
                    }
                });
            }

            // 5.2 Nút Xem "Điều Kiện"
            if (termsBtn) {
                termsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const vTitle = card.querySelector('.voucher-discount-title')?.textContent.trim() || 'Mã Ưu Đãi';
                    const vCond = card.querySelector('.voucher-condition-text')?.textContent.trim() || 'Áp dụng cho mọi đơn hàng đủ điều kiện.';
                    const vHsd = card.querySelector('.expiring-time')?.textContent.trim() || 'HSD: 31/12/2026';
                    showTermsModal(codeBadge, vTitle, vCond, vHsd);
                });
            }
        });
    };

    // --------------------------------------------------------------------------
    // 6. MODAL XEM CHI TIẾT ĐIỀU KIỆN SỬ DỤNG VOUCHER
    // --------------------------------------------------------------------------
    const showTermsModal = (code, title, condition, hsd) => {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.id = 'voucher-terms-modal';
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
        max-width: 480px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
        transform: translateY(20px);
        transition: transform 0.25s ease;
        font-family: inherit;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #ffedd5; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              <i class="fa-solid fa-receipt"></i>
            </div>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">Điều Kiện Áp Dụng Voucher</h3>
              <span style="font-size: 11px; color: #64748b;">Mã ưu đãi độc quyền sưu tầm ComicHub</span>
            </div>
          </div>
          <button class="btn-close-modal" style="border: none; background: transparent; font-size: 20px; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 14px; font-weight: 800; color: #ea580c;">${code || 'COMICHUB'}</span>
            <span style="font-size: 11px; font-weight: 700; color: #b45309;">${hsd}</span>
          </div>
          <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">${title}</h4>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px; color: #475569; line-height: 1.5; margin-bottom: 22px;">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <i class="fa-solid fa-check text-[#16a34a] mt-1"></i>
            <span><strong>Điều kiện chi tiêu:</strong> ${condition}</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <i class="fa-solid fa-check text-[#16a34a] mt-1"></i>
            <span><strong>Cơ chế gộp mã:</strong> Cho phép áp dụng đồng thời với 01 mã Freeship SafeShip và 01 mã trợ giá Kèo Barter / Xu Otaku.</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <i class="fa-solid fa-check text-[#16a34a] mt-1"></i>
            <span><strong>Quy chuẩn đóng gói:</strong> Tự động tích hợp miễn phí đóng gói 3 lớp chống sốc bảo vệ góc cạnh truyện.</span>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button class="btn-close-terms" style="padding: 10px 24px; border-radius: 9999px; border: none; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">
            Đã Hiểu
          </button>
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
        modalBackdrop.querySelector('.btn-close-terms').addEventListener('click', closeModal);
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });
    };

    // --------------------------------------------------------------------------
    // 7. FORM NHẬP MÃ VOUCHER MỚI & GỢI Ý 1-CLICK TẠI HERO BANNER
    // --------------------------------------------------------------------------
    const voucherInput = document.querySelector('.voucher-text-input, input[placeholder*="OTAKU50K"]');
    const btnSaveVoucher = document.querySelector('.btn-save-voucher');
    const suggestButtons = document.querySelectorAll('.btn-suggest-code');

    const knownVouchers = {
        'OTAKU50K': { discount: 50000, type: 'book', name: 'Giảm 50.000₫ đơn từ 400k' },
        'COMICFREE': { discount: 35000, type: 'shipping', name: 'Freeship SafeShip 35.000₫' },
        'MANGA100K': { discount: 100000, type: 'book', name: 'Giảm 100.000₫ đơn từ 1.200k' },
        'BARTERSAFE': { discount: 40000, type: 'barter', name: 'Miễn phí ký quỹ Escrow 40k' },
        'GOLDCOIN15': { discount: 150000, type: 'coin', name: 'Hoàn 15% tối đa 150k Coins' }
    };

    const processInputCode = (rawCode) => {
        const clean = rawCode.trim().toUpperCase();
        if (!clean) {
            showToast('Vui lòng nhập mã ưu đãi trước khi nhấn Lưu!', 'warning', 'fa-triangle-exclamation');
            return;
        }

        if (knownVouchers[clean]) {
            const v = knownVouchers[clean];
            showToast(`Đã lưu thành công mã "${clean}" (${v.name}) vào Kho Voucher của bạn!`, 'success', 'fa-ticket');
            if (voucherInput) voucherInput.value = '';

            const countEl = document.querySelector('.stat-number, .wallet-stats-grid .stat-cell:first-child .stat-number');
            if (countEl) {
                const currentCount = parseInt(countEl.textContent, 10) || 18;
                countEl.textContent = currentCount + 1;
            }
        } else {
            showToast(`Mã "${clean}" không tồn tại hoặc đã hết hạn sử dụng!`, 'danger', 'fa-circle-exclamation');
        }
    };

    if (btnSaveVoucher) {
        btnSaveVoucher.addEventListener('click', (e) => {
            e.preventDefault();
            if (voucherInput) processInputCode(voucherInput.value);
        });
    }

    if (voucherInput) {
        voucherInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                processInputCode(voucherInput.value);
            }
        });
    }

    suggestButtons.forEach(btn => {
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            const text = btn.textContent.trim().replace(/[^\w]/g, '');
            if (voucherInput && text) {
                voucherInput.value = text;
                processInputCode(text);
            }
        });
    });

    // --------------------------------------------------------------------------
    // 8. ĐỒNG Ý & THANH TOÁN (LƯU LOCALSTORAGE VÀ ĐIỀU HƯỚNG SANG CHECKOUT.HTML)
    // --------------------------------------------------------------------------
    const btnCheckoutConfirm = document.querySelector('.btn-confirm-checkout');
    const btnContinueBrowse = document.querySelector('.btn-continue-browse, a[href*="cart"]');

    if (btnCheckoutConfirm) {
        btnCheckoutConfirm.addEventListener('click', (e) => {
            e.preventDefault();

            try {
                localStorage.setItem('comichub_applied_vouchers', JSON.stringify(voucherState));
            } catch (err) {
                console.warn('LocalStorage save error', err);
            }

            showToast('Đang áp dụng ưu đãi và quay lại đơn hàng thanh toán...', 'primary', 'fa-shield-halved');

            setTimeout(() => {
                window.location.href = 'payment.html';
            }, 700);
        });
    }

    if (btnContinueBrowse) {
        btnContinueBrowse.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Đang quay lại giỏ hàng...', 'info', 'fa-arrow-left');
            setTimeout(() => {
                window.location.href = 'shopping_cart.html';
            }, 500);
        });
    }

    // --------------------------------------------------------------------------
    // 9. ĐỒNG HỒ ĐẾM NGƯỢC KHUNG GIỜ VÀNG (GOLDEN HOURS TIMER)
    // --------------------------------------------------------------------------
    const countdownDigits = document.querySelector('.countdown-digits');
    if (countdownDigits) {
        let secondsLeft = 2 * 3600 + 14 * 60 + 35; // 02:14:35
        setInterval(() => {
            if (secondsLeft > 0) {
                secondsLeft--;
                const h = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
                const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
                const s = String(secondsLeft % 60).padStart(2, '0');
                countdownDigits.textContent = `${h}:${m}:${s}`;
            }
        }, 1000);
    }

    // --------------------------------------------------------------------------
    // 10. KHỞI TẠO TẤT CẢ LOGIC BAN ĐẦU
    // --------------------------------------------------------------------------
    initTicketActions();
    updateFloatingBar();

    console.log('ComicHub Voucher Vault script (voucher-vault.js) initialized successfully.');
});