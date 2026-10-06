/**
 * ============================================================================
 * COMICHUB - TRANG THANH TOÁN BẢO CHỨNG (CHECKOUT LOGIC)
 * ============================================================================
 * File: checkout.js / script.js
 * Mô tả: Quản lý tính toán đơn hàng realtime, thay đổi phương thức vận chuyển/thanh toán,
 *       cập nhật địa chỉ nhận hàng qua Modal, áp dụng Voucher và hoàn tất đặt hàng.
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
     * @param {string} icon - FontAwesome icon class (VD: 'fa-circle-info')
     */
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
    // 1. TIỆN ÍCH ĐỊNH DẠNG TIỀN TỆ & KHỞI TẠO STATE ĐƠN HÀNG
    // --------------------------------------------------------------------------
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    const parseMoney = (moneyStr) => {
        if (!moneyStr) return 0;
        return parseInt(moneyStr.replace(/[^\d]/g, ''), 10) || 0;
    };

    const orderState = {
        booksSubtotal: 4950000,
        barterCompensation: 150000,
        packagingFee: 0,
        standardShippingOriginal: 35000,
        expressShippingFee: 45000,
        shippingMethod: 'standard',
        voucherBookDiscount: 50000,
        voucherShipDiscount: 35000,
        paymentMethod: 'vnpay',
        orderCode: 'CHUB' + Math.floor(100000 + Math.random() * 900000)
    };

    // --------------------------------------------------------------------------
    // 2. TÍNH TOÁN LẠI TỔNG TIỀN ĐƠN HÀNG (LIVE RE-CALCULATION)
    // --------------------------------------------------------------------------
    const recalculateOrder = () => {
        let effectiveShipping = 0;
        if (orderState.shippingMethod === 'standard') {
            effectiveShipping = Math.max(0, orderState.standardShippingOriginal - orderState.voucherShipDiscount);
        } else {
            effectiveShipping = Math.max(0, orderState.expressShippingFee - orderState.voucherShipDiscount);
        }

        const totalPayable =
            orderState.booksSubtotal +
            orderState.barterCompensation +
            effectiveShipping -
            orderState.voucherBookDiscount;

        const subtotalEl = document.querySelector('.summary-subtotal-val, .summary-breakdown-list .breakdown-item:nth-child(1) .item-value');
        const barterEl = document.querySelector('.summary-barter-val, .summary-breakdown-list .breakdown-item:nth-child(2) .item-value');
        const shipFeeEl = document.querySelector('.summary-shipping-val, .summary-breakdown-list .breakdown-item:nth-child(4) .item-value');
        const discountBookEl = document.querySelector('.discount-book-val, .breakdown-item.discount-item:nth-of-type(1) .text-discount');
        const discountShipEl = document.querySelector('.discount-ship-val, .breakdown-item.discount-item:nth-of-type(2) .text-discount');
        const grandTotalEl = document.querySelector('.grand-total-amount, .total-price-amount');

        if (subtotalEl) subtotalEl.textContent = formatMoney(orderState.booksSubtotal);
        if (barterEl) barterEl.textContent = formatMoney(orderState.barterCompensation);
        if (shipFeeEl) {
            shipFeeEl.textContent = formatMoney(orderState.shippingMethod === 'standard' ? orderState.standardShippingOriginal : orderState.expressShippingFee);
        }
        if (discountBookEl) {
            discountBookEl.textContent = orderState.voucherBookDiscount > 0 ? `-${formatMoney(orderState.voucherBookDiscount)}` : '-0₫';
        }
        if (discountShipEl) {
            discountShipEl.textContent = orderState.voucherShipDiscount > 0 ? `-${formatMoney(orderState.voucherShipDiscount)}` : '-0₫';
        }
        if (grandTotalEl) {
            grandTotalEl.textContent = formatMoney(Math.max(0, totalPayable));
        }

        const qrAmountEl = document.querySelector('.highlight-amount, .transfer-amount-value');
        if (qrAmountEl) {
            qrAmountEl.textContent = formatMoney(Math.max(0, totalPayable));
        }
    };

    // --------------------------------------------------------------------------
    // 3. XỬ LÝ CHUYỂN ĐỔI PHƯƠNG THỨC VẬN CHUYỂN
    // --------------------------------------------------------------------------
    const shippingOptions = document.querySelectorAll('.shipping-option-item, div.border.rounded-xl:has(input[name="shipping_method"])');

    shippingOptions.forEach((option) => {
        option.addEventListener('click', () => {
            shippingOptions.forEach((opt) => {
                opt.classList.remove('selected', 'border-[#F97316]', 'bg-[#FFF7ED]');
                opt.style.borderColor = '#e2e8f0';
                opt.style.backgroundColor = '#fafbfc';
                const radio = opt.querySelector('input[type="radio"]');
                if (radio) radio.checked = false;
                const badge = opt.querySelector('.badge-chosen');
                if (badge) badge.remove();
            });

            option.classList.add('selected');
            option.style.borderColor = '#f97316';
            option.style.backgroundColor = '#fffaf5';
            const currentRadio = option.querySelector('input[type="radio"]');
            if (currentRadio) currentRadio.checked = true;

            const isExpress = option.textContent.includes('Hỏa Tốc') || option.textContent.includes('2h') || option.textContent.includes('45.000');
            orderState.shippingMethod = isExpress ? 'express' : 'standard';

            const titleRow = option.querySelector('.shipping-title-row, div.font-bold');
            if (titleRow && !titleRow.querySelector('.badge-chosen')) {
                const badge = document.createElement('span');
                badge.className = 'badge-chosen ml-2 bg-[#F97316] text-white text-[9px] font-bold px-1.5 py-0.5 rounded';
                badge.textContent = 'ĐÃ CHỌN';
                titleRow.appendChild(badge);
            }

            recalculateOrder();
            showToast(
                isExpress
                    ? 'Đã chuyển sang Hỏa Tốc SafeShip (Giao trong 2h tại nội thành)'
                    : 'Đã chọn Tiêu Chuẩn Bảo Đảm (Áp dụng mã freeship COMICFREE 0đ)',
                'info',
                isExpress ? 'fa-bolt' : 'fa-truck-fast'
            );
        });
    });

    // --------------------------------------------------------------------------
// 4. XỬ LÝ CHỌN PHƯƠNG THỨC THANH TOÁN (VNPAY-QR VS COD)
// --------------------------------------------------------------------------
    const paymentItems = document.querySelectorAll(
        '.payment-method-item, div.border.rounded-2xl:has(input[name="payment_method"])'
    );

    const qrBox = document.querySelector(
        '.qr-payment-details-box, div.bg-slate-50:has(img[alt*="QR"])'
    );

    const transferCodeEl = document.querySelector(
        '.transfer-code, span.font-mono.font-bold'
    );

    if (transferCodeEl) {
        transferCodeEl.textContent = orderState.orderCode;
    }

    paymentItems.forEach((item) => {

        item.addEventListener('click', (e) => {

            // Không đổi phương thức khi bấm nút copy
            if (e.target.closest('.btn-copy')) return;

            // Bỏ trạng thái selected của tất cả phương thức
            paymentItems.forEach((p) => {

                p.classList.remove(
                    'selected',
                    'border-[#F97316]',
                    'bg-[#FFFDFB]'
                );

                p.style.borderColor = '#e2e8f0';
                p.style.backgroundColor = '#ffffff';

                const radio = p.querySelector(
                    'input[name="payment_method"]'
                );

                if (radio) {
                    radio.checked = false;
                }
            });

            // Đánh dấu phương thức đang chọn
            item.classList.add('selected');
            item.style.borderColor = '#f97316';
            item.style.backgroundColor = '#fffcf8';

            const curRadio = item.querySelector(
                'input[name="payment_method"]'
            );

            if (curRadio) {
                curRadio.checked = true;
            }

            // Lấy trực tiếp value của radio để xác định phương thức
            const paymentValue = curRadio?.value;

            const isVNPAY = paymentValue === 'vnpay';

            // Cập nhật state
            orderState.paymentMethod = isVNPAY
                ? 'vnpay'
                : 'cod';

            // Hiện / ẩn QR
            if (qrBox) {
                qrBox.style.display = isVNPAY
                    ? 'flex'
                    : 'none';
            }

            // Thông báo
            showToast(
                isVNPAY
                    ? 'Thanh toán VNPAY-QR: Vui lòng quét mã QR để thanh toán'
                    : 'Thanh toán COD: Bạn sẽ thanh toán trực tiếp khi nhận hàng & đồng kiểm',
                'info',
                isVNPAY
                    ? 'fa-qrcode'
                    : 'fa-money-bill-wave'
            );

        });

    });

    // Sao chép thông tin chuyển khoản (Code chuyển khoản / Số tài khoản)
    const copyButtons = document.querySelectorAll('.btn-copy, button:has(.fa-copy)');
    copyButtons.forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const parentRow = btn.closest('.info-row, div.flex.justify-between');
            const textToCopy = parentRow?.querySelector('.transfer-code, .info-value, strong')?.textContent.trim() || orderState.orderCode;

            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(textToCopy);
                }
                showToast(`Đã sao chép: "${textToCopy}" vào bộ nhớ tạm!`, 'success', 'fa-check');
            } catch (err) {
                showToast(`Đã sao chép: "${textToCopy}"`, 'success', 'fa-check');
            }
        });
    });

    // --------------------------------------------------------------------------
    // 5. THAY ĐỔI ĐỊA CHỈ NHẬN HÀNG SƯU TẦM (MODAL POPUP)
    // --------------------------------------------------------------------------
    const btnChangeAddress = document.querySelector('.btn-change-address, button.text-\\[\\#F97316\\]');

    if (btnChangeAddress) {
        btnChangeAddress.addEventListener('click', () => {
            const recipientNameEl = document.querySelector('.recipient-name, .address-card strong');
            const recipientPhoneEl = document.querySelector('.recipient-phone, .address-card span.text-slate-500');
            const recipientAddressEl = document.querySelector('.recipient-address, .address-card div.text-sm');
            const deliveryNoteEl = document.querySelector('.collector-delivery-note span, .address-card .note-text');

            const curName = recipientNameEl?.textContent.trim() || 'Nguyễn An Vinh';
            const curPhone = recipientPhoneEl?.textContent.trim() || '0988.123.456';
            const curAddr = recipientAddressEl?.textContent.trim() || '124 Hoàng Hoa Thám, Phường Liễu Giai, Quận Ba Đình, Hà Nội';
            const curNote = deliveryNoteEl?.textContent.replace('Ghi chú lưu kho: ', '').replace(/["']/g, '').trim() || 'Hàng truyện tranh sưu tầm dễ móp gáy, vui lòng nhẹ tay.';

            const modalBackdrop = document.createElement('div');
            modalBackdrop.id = 'address-edit-modal';
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
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
          transform: translateY(20px);
          transition: transform 0.25s ease;
          font-family: inherit;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: #ffedd5; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fa-solid fa-location-dot"></i>
              </div>
              <div>
                <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">Địa Chỉ Nhận Hàng Sưu Tầm</h3>
                <span style="font-size: 11px; color: #64748b;">Đảm bảo shipper giao tận tay an toàn</span>
              </div>
            </div>
            <button class="btn-close-modal" style="border: none; background: transparent; font-size: 20px; color: #94a3b8; cursor: pointer;">&times;</button>
          </div>

          <form id="form-update-address" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">HỌ VÀ TÊN</label>
                <input type="text" id="input-name" value="${curName}" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; font-weight: 600; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">SỐ ĐIỆN THOẠI</label>
                <input type="tel" id="input-phone" value="${curPhone}" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; font-weight: 600; outline: none;">
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">ĐỊA CHỈ GIAO HÀNG CHI TIẾT</label>
              <textarea id="input-addr" rows="2" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; outline: none; resize: none; font-family: inherit;">${curAddr}</textarea>
            </div>

            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">LƯU Ý ĐÓNG GÓI & SHIPPER</label>
              <input type="text" id="input-note" value="${curNote}" placeholder="Ví dụ: Gọi trước khi giao, kẹp carton cẩn thận..." style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12px; outline: none;">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px;">
              <button type="button" class="btn-cancel" style="padding: 9px 18px; border-radius: 9999px; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b; font-weight: 700; font-size: 13px; cursor: pointer;">Hủy bỏ</button>
              <button type="submit" style="padding: 9px 22px; border-radius: 9999px; border: none; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">Lưu Địa Chỉ Mới</button>
            </div>
          </form>
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
            modalBackdrop.querySelector('.btn-cancel').addEventListener('click', closeModal);
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) closeModal();
            });

            modalBackdrop.querySelector('#form-update-address').addEventListener('submit', (e) => {
                e.preventDefault();
                const newName = modalBackdrop.querySelector('#input-name').value.trim();
                const newPhone = modalBackdrop.querySelector('#input-phone').value.trim();
                const newAddr = modalBackdrop.querySelector('#input-addr').value.trim();
                const newNote = modalBackdrop.querySelector('#input-note').value.trim();

                if (!newName || !newPhone || !newAddr) {
                    showToast('Vui lòng điền đủ Tên, SĐT và Địa chỉ nhận hàng!', 'warning', 'fa-triangle-exclamation');
                    return;
                }

                if (recipientNameEl) recipientNameEl.textContent = newName;
                if (recipientPhoneEl) recipientPhoneEl.textContent = newPhone;
                if (recipientAddressEl) recipientAddressEl.textContent = newAddr;
                if (deliveryNoteEl) {
                    deliveryNoteEl.textContent = `Ghi chú lưu kho: "${newNote || 'Hàng truyện tranh sưu tầm dễ móp gáy, vui lòng nhẹ tay.'}"`;
                }

                closeModal();
                showToast('Đã cập nhật địa chỉ giao hàng thành công!', 'success', 'fa-map-pin');
            });
        });
    }

    // --------------------------------------------------------------------------
    // 6. QUẢN LÝ MÃ GIẢM GIÁ / VOUCHER CHECKOUT
    // --------------------------------------------------------------------------
    const voucherField = document.querySelector('.voucher-field, input[placeholder*="voucher"]');
    const btnApplyVoucher = document.querySelector('.btn-apply-voucher, button.btn-voucher');
    const appliedContainer = document.querySelector('.applied-vouchers-group, #applied-vouchers-container');

    const validVouchersCheckout = {
        'OTAKU50K': { discount: 50000, type: 'book', name: 'OTAKU50K (-50k)' },
        'COMICFREE': { discount: 35000, type: 'shipping', name: 'COMICFREE (-35k)' },
        'MANGA100K': { discount: 100000, type: 'book', name: 'MANGA100K (-100k)' },
        'BARTERSAFE': { discount: 40000, type: 'barter', name: 'BARTERSAFE (-40k)' }
    };

    const renderVoucherPill = (code, labelText) => {
        if (!appliedContainer) return;
        const existing = Array.from(appliedContainer.querySelectorAll('.applied-voucher-pill')).some((el) => el.textContent.includes(code));
        if (existing) return;

        const pill = document.createElement('div');
        pill.className = 'applied-voucher-pill inline-flex items-center gap-1.5 bg-[#FFF7ED] border border-[#FED7AA] text-[#F97316] text-xs font-bold px-2.5 py-1 rounded-full';
        pill.innerHTML = `
      <i class="fa-solid fa-ticket text-xs"></i>
      <span>${labelText}</span>
      <button type="button" class="btn-remove-pill ml-1 text-slate-400 hover:text-red-500 cursor-pointer" aria-label="Gỡ mã">&times;</button>
    `;

        pill.querySelector('.btn-remove-pill').addEventListener('click', () => {
            pill.remove();
            if (code.includes('OTAKU') || code.includes('MANGA')) {
                orderState.voucherBookDiscount = 0;
            } else if (code.includes('FREE')) {
                orderState.voucherShipDiscount = 0;
            }
            recalculateOrder();
            showToast(`Đã gỡ mã ${code}`, 'info', 'fa-xmark');
        });

        appliedContainer.appendChild(pill);
    };

    const applyVoucherCheckout = (code) => {
        const clean = code.trim().toUpperCase();
        if (!clean) {
            showToast('Vui lòng nhập mã voucher trước khi áp dụng!', 'warning', 'fa-triangle-exclamation');
            return;
        }

        if (validVouchersCheckout[clean]) {
            const v = validVouchersCheckout[clean];
            if (v.type === 'book') {
                orderState.voucherBookDiscount = v.discount;
            } else if (v.type === 'shipping') {
                orderState.voucherShipDiscount = v.discount;
            }

            renderVoucherPill(clean, v.name);
            recalculateOrder();
            if (voucherField) voucherField.value = '';
            showToast(`Áp dụng mã "${clean}" thành công!`, 'success', 'fa-ticket');
        } else {
            showToast(`Mã voucher "${clean}" không tồn tại hoặc không đủ điều kiện!`, 'danger', 'fa-circle-exclamation');
        }
    };

    if (btnApplyVoucher) {
        btnApplyVoucher.addEventListener('click', (e) => {
            e.preventDefault();
            if (voucherField) applyVoucherCheckout(voucherField.value);
        });
    }

    if (voucherField) {
        voucherField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyVoucherCheckout(voucherField.value);
            }
        });
    }

    // Xử lý sự kiện gỡ Voucher có sẵn trên giao diện
    const existingPills = document.querySelectorAll('.applied-voucher-pill');
    existingPills.forEach((pill) => {
        const btnRemove = pill.querySelector('.btn-remove-pill');
        if (btnRemove) {
            btnRemove.addEventListener('click', () => {
                const text = pill.textContent;
                pill.remove();
                if (text.includes('OTAKU50K')) orderState.voucherBookDiscount = 0;
                if (text.includes('COMICFREE')) orderState.voucherShipDiscount = 0;
                recalculateOrder();
                showToast('Đã gỡ bỏ mã giảm giá', 'info', 'fa-xmark');
            });
        }
    });

    const voucherExploreLink = document.querySelector('.voucher-explore-link, a[href*="voucher"]');
    if (voucherExploreLink) {
        voucherExploreLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Đang chuyển hướng đến Kho Voucher ComicHub...', 'primary', 'fa-ticket');
            setTimeout(() => {
                window.location.href = 'voucher.html';
            }, 500);
        });
    }

    // --------------------------------------------------------------------------
    // 7. CHAT KIỂM ĐỊNH SÁCH VỚI NGƯỜI BÁN TRƯỚC THANH TOÁN
    // --------------------------------------------------------------------------
    const sellerChatCard = document.querySelector('.escrow-contact-card, .seller-chat-trigger');
    if (sellerChatCard) {
        sellerChatCard.style.cursor = 'pointer';
        sellerChatCard.addEventListener('click', () => {
            showToast('Đang mở kênh chat an toàn với người bán...', 'primary', 'fa-comments');
        });
    }

    // --------------------------------------------------------------------------
    // 8. XÁC NHẬN THANH TOÁN BẢO ĐẢM & HOÀN TẤT ĐƠN HÀNG
    // --------------------------------------------------------------------------
    const btnSubmitCheckout = document.querySelector('.btn-submit-checkout, button.btn-confirm-order');

    const showOrderSuccessModal = () => {
        const successBackdrop = document.createElement('div');
        successBackdrop.id = 'order-success-modal';
        successBackdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(5px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

        successBackdrop.innerHTML = `
      <div style="
        background: #ffffff;
        border-radius: 24px;
        padding: 36px 32px;
        max-width: 540px;
        width: 100%;
        text-align: center;
        box-shadow: 0 25px 60px -15px rgba(0,0,0,0.35);
        transform: scale(0.92);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: inherit;
      ">
        <div style="width: 76px; height: 76px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 20px;">
          <i class="fa-solid fa-shield-check"></i>
        </div>

        <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
          Đặt Hàng & Ký Quỹ Thành Công!
        </h2>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
          Mã đơn hàng: <strong style="color: #f97316; font-size: 15px;">#${orderState.orderCode}</strong>
          <br>Tiền thanh toán đã được khoá an toàn tại <strong>ComicHub Escrow Vault</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 16px; text-align: left; font-size: 12px; line-height: 1.6; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 8px; color: #16a34a; font-weight: 700; margin-bottom: 6px;">
            <i class="fa-solid fa-circle-check"></i> Bảo hiểm đồng kiểm 48 giờ kích hoạt
          </div>
          <p style="color: #475569; margin: 0;">
            Khi nhận truyện, bạn có 48 giờ để mở hộp đồng kiểm góc sách, gáy truyện. Nếu không đúng tình trạng đã cam kết, ComicHub sẽ hoàn lại 100% tiền mặt ngay lập tức.
          </p>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <a href="home.html" style="padding: 12px 24px; border-radius: 9999px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-weight: 700; font-size: 13px; text-decoration: none;">
            Về Trang Chủ
          </a>
          <a href="page3.html" style="padding: 12px 28px; border-radius: 9999px; border: none; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: none; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
            Theo Dõi Đơn Hàng
          </a>
        </div>
      </div>
    `;

        document.body.appendChild(successBackdrop);

        requestAnimationFrame(() => {
            successBackdrop.style.opacity = '1';
            successBackdrop.firstElementChild.style.transform = 'scale(1)';
        });

        localStorage.removeItem('comichub_cart');
    };

    if (btnSubmitCheckout) {
        btnSubmitCheckout.addEventListener('click', (e) => {
            e.preventDefault();
            const originalText = btnSubmitCheckout.innerHTML;

            btnSubmitCheckout.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang mã hoá & xác thực ký quỹ...';
            btnSubmitCheckout.disabled = true;
            btnSubmitCheckout.style.opacity = '0.8';

            setTimeout(() => {
                btnSubmitCheckout.innerHTML = originalText;
                btnSubmitCheckout.disabled = false;
                btnSubmitCheckout.style.opacity = '1';

                showOrderSuccessModal();
            }, 1200);
        });
    }

    // --------------------------------------------------------------------------
    // 9. KHỞI ĐỘNG TOÀN BỘ LOGIC CHECKOUT
    // --------------------------------------------------------------------------
    recalculateOrder();
    console.log('ComicHub Checkout script (checkout.js) loaded successfully.');
});