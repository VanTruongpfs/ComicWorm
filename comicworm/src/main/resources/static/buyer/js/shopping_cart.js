/**
 * ============================================================================
 * COMICHUB - GIỎ HÀNG & XỬ LÝ THANH TOÁN (CART & CHECKOUT LOGIC)
 * ============================================================================
 * File: cart.js / script.js
 * Mô tả: Quản lý tính toán tổng tiền realtime, tăng/giảm số lượng, chọn/bỏ chọn,
 *       thêm phụ kiện 1-click, áp dụng voucher, modal xác nhận và chuyển trang.
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
    // 1. TIỆN ÍCH FORMAT & PARSE TIỀN TỆ VIỆT NAM (VND)
    // --------------------------------------------------------------------------
    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    const parseMoney = (moneyStr) => {
        if (!moneyStr) return 0;
        return parseInt(moneyStr.replace(/[^\d]/g, ''), 10) || 0;
    };

    // --------------------------------------------------------------------------
    // 2. KHỞI TẠO STATE & KHAI BÁO PHẦN TỬ GIAO DIỆN CHÍNH
    // --------------------------------------------------------------------------
    let currentDiscount = 0;
    let activeVoucherCode = '';

    const selectAllCheckbox = document.querySelector('input[type="checkbox"][aria-label*="Chọn tất cả"], .custom-checkbox-label input, div.bg-white input[type="checkbox"]');
    const bulkDeleteBtn = document.querySelector('.btn-bulk-delete, button.text-slate-500');
    const clearCartBtn = document.querySelector('.btn-clear-cart, button.text-slate-400');
    const voucherInput = document.querySelector('.voucher-input, input[placeholder*="OTAKU50K"]');
    const voucherApplyBtn = document.querySelector('.btn-apply-voucher, button.bg-slate-900');
    const checkoutBtn = document.querySelector('.btn-proceed-checkout, button.w-full');

    // Danh sách Voucher hợp lệ trên hệ thống
    const validVouchers = {
        'OTAKU50K': { discount: 50000, desc: 'Giảm 50.000₫ đơn từ 500k' },
        'COMICFREE': { discount: 35000, desc: 'Miễn phí ship SafeShip 35k' },
        'MANGA100K': { discount: 100000, desc: 'Giảm 100.000₫ cho boxset' },
        'BARTERSAFE': { discount: 40000, desc: 'Miễn phí bảo hiểm ký quỹ Escrow' }
    };

    // --------------------------------------------------------------------------
    // 3. TÍNH TOÁN TỔNG TIỀN GIỎ HÀNG THỜI GIAN THỰC (LIVE RE-CALCULATION)
    // --------------------------------------------------------------------------
    const recalculateCart = () => {
        let subtotalDirectBuy = 0;
        let barterCompensationTotal = 0;
        let selectedItemCount = 0;
        let selectedBarterCount = 0;

        const allItemCards = document.querySelectorAll('.cart-item-card, div[data-cart-item]');

        allItemCards.forEach((card) => {
            const checkbox = card.querySelector('input[type="checkbox"]');
            const isChecked = checkbox ? checkbox.checked : true;
            if (!isChecked) return;

            const isBarter =
                card.dataset.type === 'barter' ||
                card.querySelector('.badge-type.barter') !== null ||
                card.textContent.includes('Kèo Trao Đổi') ||
                card.textContent.includes('Phí bù chênh lệch:');

            const qtyInput = card.querySelector('.qty-input, input[type="number"], .quantity-stepper span, span.font-bold.text-sm');
            const quantity = qtyInput ? (parseInt(qtyInput.value || qtyInput.textContent, 10) || 1) : 1;

            if (isBarter) {
                selectedBarterCount++;
                const priceEl = card.querySelector('.barter-fee-value, .text-\\[\\#F97316\\].font-bold, .item-subtotal-price');
                const price = parseMoney(priceEl ? priceEl.textContent : '150000');
                barterCompensationTotal += price * quantity;
            } else {
                selectedItemCount += quantity;
                const priceEl = card.querySelector('.price-unit, .item-price-current, div.text-right div.font-bold, .item-price');
                const price = parseMoney(priceEl ? priceEl.textContent : '0');
                subtotalDirectBuy += price * quantity;
            }
        });

        const totalSelected = selectedItemCount + selectedBarterCount;
        const shippingFee = totalSelected > 0 ? 35000 : 0;
        const totalOrderValue = subtotalDirectBuy + barterCompensationTotal;
        const finalDiscount = Math.min(currentDiscount, totalOrderValue);
        const grandTotal = Math.max(0, totalOrderValue + shippingFee - finalDiscount);

        // Cập nhật hiển thị UI Tóm tắt đơn hàng
        const subtotalDisplay = document.querySelector('.summary-subtotal-val, span#summary-subtotal');
        const barterDisplay = document.querySelector('.summary-barter-val, span#summary-barter');
        const discountDisplay = document.querySelector('.summary-discount-val, span.text-red-500, .discount-text');
        const grandTotalDisplay = document.querySelector('.grand-total-amount, .total-price-amount');
        const selectAllLabel = document.querySelector('.select-all-count, label span.text-slate-500');

        if (subtotalDisplay) subtotalDisplay.textContent = formatMoney(subtotalDirectBuy);
        if (barterDisplay) barterDisplay.textContent = formatMoney(barterCompensationTotal);
        if (discountDisplay) discountDisplay.textContent = finalDiscount > 0 ? `-${formatMoney(finalDiscount)}` : '-0₫';
        if (grandTotalDisplay) grandTotalDisplay.textContent = formatMoney(grandTotal);

        if (selectAllLabel) {
            selectAllLabel.textContent = `(${totalSelected} sản phẩm & kèo trao đổi)`;
        }

        if (bulkDeleteBtn) {
            bulkDeleteBtn.innerHTML = `<i class="fa-regular fa-trash-can mr-1.5"></i> Xóa mục chọn (${totalSelected})`;
            bulkDeleteBtn.disabled = totalSelected === 0;
            bulkDeleteBtn.style.opacity = totalSelected === 0 ? '0.5' : '1';
        }

        if (checkoutBtn) {
            checkoutBtn.disabled = totalSelected === 0;
            checkoutBtn.style.opacity = totalSelected === 0 ? '0.6' : '1';
            checkoutBtn.style.cursor = totalSelected === 0 ? 'not-allowed' : 'pointer';
        }
    };

    // Đồng bộ Checkbox Shop khi Checkbox Item thay đổi
    const syncShopCheckbox = (itemCard) => {
        const sellerGroup = itemCard.closest('.seller-cart-group, div.bg-white.rounded-2xl');
        if (!sellerGroup) return;

        const shopChk = sellerGroup.querySelector('.group-seller-header input[type="checkbox"], div.bg-slate-50 input[type="checkbox"]');
        if (!shopChk) return;

        const allItemChks = sellerGroup.querySelectorAll('[data-item-checkbox]');
        const allChecked = Array.from(allItemChks).every((c) => c.checked);
        const someChecked = Array.from(allItemChks).some((c) => c.checked);

        shopChk.checked = allChecked;
        shopChk.indeterminate = !allChecked && someChecked;
    };

    // Khởi tạo từng thẻ sản phẩm / kèo đổi
    const initItemCards = () => {
        const cards = document.querySelectorAll('.cart-item-card, div.border-b.border-slate-100:has(img), div.p-4.border-b:has(img)');
        cards.forEach((card, index) => {
            card.dataset.cartItem = `item-${index}`;
            const isBarter = card.textContent.includes('Kèo Trao Đổi') || card.textContent.includes('Bù');
            card.dataset.type = isBarter ? 'barter' : 'buy';

            const chk = card.querySelector('input[type="checkbox"]');
            if (chk) {
                chk.dataset.itemCheckbox = 'true';
                chk.addEventListener('change', () => {
                    syncShopCheckbox(card);
                    recalculateCart();
                });
            }

            // Tăng giảm số lượng (Quantity Stepper)
            const btnMinus = card.querySelector('.btn-qty-minus, button:has(.fa-minus)');
            const btnPlus = card.querySelector('.btn-qty-plus, button:has(.fa-plus)');
            const qtySpan = card.querySelector('.qty-input, span.w-8, span.font-bold.text-sm');

            if (btnMinus && btnPlus && qtySpan) {
                let qty = parseInt(qtySpan.textContent.trim(), 10) || 1;

                if (isBarter) {
                    btnMinus.disabled = true;
                    btnPlus.disabled = true;
                    btnMinus.style.cursor = 'not-allowed';
                    btnPlus.style.cursor = 'not-allowed';
                    btnMinus.style.opacity = '0.4';
                    btnPlus.style.opacity = '0.4';
                } else {
                    btnMinus.addEventListener('click', () => {
                        if (qty > 1) {
                            qty--;
                            qtySpan.textContent = qty;
                            btnMinus.disabled = qty <= 1;
                            recalculateCart();
                            showToast('Đã giảm số lượng 1 cuốn', 'info', 'fa-minus');
                        }
                    });

                    btnPlus.addEventListener('click', () => {
                        if (qty < 10) {
                            qty++;
                            qtySpan.textContent = qty;
                            btnMinus.disabled = false;
                            recalculateCart();
                            showToast(`Đã tăng số lượng lên ${qty}`, 'info', 'fa-plus');
                        } else {
                            showToast('Đã đạt giới hạn số lượng có sẵn trong kho!', 'warning', 'fa-triangle-exclamation');
                        }
                    });
                }
            }

            // Nút xóa 1 mục
            const deleteBtn = card.querySelector('.btn-item-action.delete, button:has(.fa-trash-can)');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const itemTitle = card.querySelector('h3, .item-title, strong')?.textContent.trim() || 'sản phẩm';
                    confirmDeleteItem(card, itemTitle);
                });
            }
        });
    };

    // --------------------------------------------------------------------------
    // 4. CHECKBOX "CHỌN TẤT CẢ" & CHECKBOX SHOP
    // --------------------------------------------------------------------------
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const allItemCheckboxes = document.querySelectorAll('[data-item-checkbox]');
            allItemCheckboxes.forEach((chk) => {
                chk.checked = isChecked;
            });

            const shopChks = document.querySelectorAll('.group-seller-header input[type="checkbox"], div.bg-slate-50 input[type="checkbox"]');
            shopChks.forEach((sChk) => {
                sChk.checked = isChecked;
                sChk.indeterminate = false;
            });

            recalculateCart();
            showToast(
                isChecked ? 'Đã chọn toàn bộ sản phẩm và kèo đổi' : 'Đã bỏ chọn toàn bộ giỏ hàng',
                'info',
                isChecked ? 'fa-check-double' : 'fa-xmark'
            );
        });
    }

    const initShopCheckboxes = () => {
        const shopHeaders = document.querySelectorAll('.group-seller-header, div.bg-slate-50.px-5');
        shopHeaders.forEach((header) => {
            const shopChk = header.querySelector('input[type="checkbox"]');
            const sellerGroup = header.closest('.seller-cart-group, div.bg-white.rounded-2xl');
            if (shopChk && sellerGroup) {
                shopChk.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    const groupItemChks = sellerGroup.querySelectorAll('[data-item-checkbox]');
                    groupItemChks.forEach((chk) => {
                        chk.checked = isChecked;
                    });
                    recalculateCart();
                });
            }
        });
    };

    // --------------------------------------------------------------------------
    // 5. QUẢN LÝ XÓA SẢN PHẨM & MODAL XÁC NHẬN
    // --------------------------------------------------------------------------
    const showConfirmModal = (title, message, onConfirm) => {
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
        padding: 24px 28px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
        transform: translateY(20px);
        transition: transform 0.25s ease;
        font-family: inherit;
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: #ffe4e6; color: #e11d48; display: flex; align-items: center; justify-content: center; font-size: 18px;">
            <i class="fa-solid fa-trash-can"></i>
          </div>
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${title}</h3>
            <span style="font-size: 12px; color: #64748b;">Hành động này không thể hoàn tác</span>
          </div>
        </div>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">${message}</p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn-cancel" style="padding: 9px 18px; border-radius: 9999px; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b; font-weight: 700; font-size: 13px; cursor: pointer;">Giữ lại</button>
          <button class="btn-confirm" style="padding: 9px 20px; border-radius: 9999px; border: none; background: #e11d48; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);">Xác nhận xóa</button>
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

        modalBackdrop.querySelector('.btn-cancel').addEventListener('click', closeModal);
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });

        modalBackdrop.querySelector('.btn-confirm').addEventListener('click', () => {
            closeModal();
            onConfirm();
        });
    };

    const confirmDeleteItem = (itemCard, itemTitle) => {
        showConfirmModal(
            'Xóa khỏi giỏ hàng?',
            `Bạn có chắc chắn muốn bỏ <strong>"${itemTitle}"</strong> ra khỏi danh sách đặt hàng/trao đổi không?`,
            () => {
                itemCard.style.transition = 'all 0.3s ease';
                itemCard.style.opacity = '0';
                itemCard.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    const parentGroup = itemCard.closest('.seller-cart-group, div.bg-white.rounded-2xl');
                    itemCard.remove();

                    if (parentGroup && parentGroup.querySelectorAll('[data-cart-item]').length === 0) {
                        parentGroup.remove();
                    }

                    checkEmptyCart();
                    recalculateCart();
                    showToast(`Đã xóa "${itemTitle}" khỏi giỏ hàng!`, 'info', 'fa-trash-can');
                }, 300);
            }
        );
    };

    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', () => {
            const checkedBoxes = document.querySelectorAll('[data-item-checkbox]:checked');
            if (checkedBoxes.length === 0) {
                showToast('Vui lòng tích chọn ít nhất 1 mục để xóa!', 'warning', 'fa-triangle-exclamation');
                return;
            }

            showConfirmModal(
                `Xóa ${checkedBoxes.length} mục đã chọn?`,
                `Bạn có chắc chắn muốn loại bỏ ${checkedBoxes.length} sản phẩm & kèo đổi đã được đánh dấu chọn?`,
                () => {
                    checkedBoxes.forEach((chk) => {
                        const card = chk.closest('[data-cart-item]');
                        if (card) {
                            const parentGroup = card.closest('.seller-cart-group, div.bg-white.rounded-2xl');
                            card.remove();
                            if (parentGroup && parentGroup.querySelectorAll('[data-cart-item]').length === 0) {
                                parentGroup.remove();
                            }
                        }
                    });

                    checkEmptyCart();
                    recalculateCart();
                    showToast(`Đã xóa ${checkedBoxes.length} mục khỏi giỏ hàng!`, 'success', 'fa-check');
                }
            );
        });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            showConfirmModal(
                'Làm trống toàn bộ giỏ hàng?',
                'Tất cả sản phẩm và kèo trao đổi hiện có sẽ bị xóa sạch khỏi giỏ hàng của bạn.',
                () => {
                    const allCards = document.querySelectorAll('[data-cart-item], .seller-cart-group, div.bg-white.rounded-2xl');
                    allCards.forEach((c) => c.remove());
                    checkEmptyCart();
                    recalculateCart();
                    showToast('Đã làm trống toàn bộ giỏ hàng!', 'info', 'fa-trash-can');
                }
            );
        });
    }

    const checkEmptyCart = () => {
        const remainingItems = document.querySelectorAll('[data-cart-item]');
        if (remainingItems.length === 0) {
            const cartContainer = document.querySelector('.checkout-left-column, div.space-y-4, .cart-layout-grid > div:first-child');
            if (cartContainer) {
                cartContainer.innerHTML = `
          <div style="background: #ffffff; border-radius: 20px; padding: 48px 24px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="width: 72px; height: 72px; border-radius: 50%; background: #fff7ed; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
              <i class="fa-solid fa-cart-arrow-down"></i>
            </div>
            <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Giỏ hàng của bạn đang trống</h3>
            <p style="font-size: 13px; color: #64748b; max-width: 380px; margin: 0 auto 24px; line-height: 1.5;">
              Chưa có bộ truyện tranh hay kèo trao đổi nào trong giỏ. Hãy khám phá ngay hàng ngàn tập manga độc lạ trên ComicHub nhé!
            </p>
            <a href="category.html" style="display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
              <i class="fa-solid fa-store"></i> Khám Phá Chợ Truyện Ngay
            </a>
          </div>
        `;
            }
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.disabled = true;
            }
        }
    };

    // --------------------------------------------------------------------------
    // 6. NHẬP VOUCHER & ÁP DỤNG MÃ
    // --------------------------------------------------------------------------
    const renderVoucherChip = (code, desc) => {
        let chipArea = document.querySelector('.applied-coupons-list, #applied-voucher-container');
        if (!chipArea) {
            const voucherBox = document.querySelector('.voucher-box-card, div.bg-white.p-4.rounded-2xl:has(input)');
            if (voucherBox) {
                chipArea = document.createElement('div');
                chipArea.id = 'applied-voucher-container';
                chipArea.className = 'applied-coupons-list mt-3 flex flex-wrap gap-2';
                voucherBox.appendChild(chipArea);
            }
        }

        if (chipArea) {
            chipArea.innerHTML = `
        <div class="inline-flex items-center gap-1.5 bg-[#FFF7ED] border border-[#FED7AA] text-[#F97316] text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
          <i class="fa-solid fa-tag"></i>
          <span>${code}</span>
          <span class="text-slate-500 font-normal text-[11px]">(-${formatMoney(currentDiscount)})</span>
          <button type="button" class="btn-remove-code ml-1 text-slate-400 hover:text-red-500 cursor-pointer text-xs">&times;</button>
        </div>
      `;

            chipArea.querySelector('.btn-remove-code').addEventListener('click', () => {
                currentDiscount = 0;
                activeVoucherCode = '';
                chipArea.innerHTML = '';
                if (voucherInput) voucherInput.value = '';
                recalculateCart();
                showToast('Đã gỡ mã giảm giá', 'info', 'fa-xmark');
            });
        }
    };

    const applyVoucher = (code) => {
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) {
            showToast('Vui lòng nhập mã voucher trước khi nhấn Áp dụng!', 'warning', 'fa-triangle-exclamation');
            return;
        }

        if (validVouchers[cleanCode]) {
            const v = validVouchers[cleanCode];
            currentDiscount = v.discount;
            activeVoucherCode = cleanCode;

            if (voucherInput) voucherInput.value = cleanCode;
            renderVoucherChip(cleanCode, v.desc);
            recalculateCart();
            showToast(`Áp dụng mã "${cleanCode}" thành công! (${v.desc})`, 'success', 'fa-ticket');
        } else {
            showToast(`Mã "${cleanCode}" không hợp lệ hoặc đã hết lượt dùng!`, 'danger', 'fa-circle-exclamation');
        }
    };

    if (voucherApplyBtn) {
        voucherApplyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (voucherInput) applyVoucher(voucherInput.value);
        });
    }

    if (voucherInput) {
        voucherInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyVoucher(voucherInput.value);
            }
        });
    }

    // --------------------------------------------------------------------------
    // 7. THÊM NHANH PHỤ KIỆN BẢO QUẢN (1-CLICK UPSELL)
    // --------------------------------------------------------------------------
    const addonButtons = document.querySelectorAll('.btn-add-addon');

    addonButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const card = btn.closest('.addon-card, div.border.border-slate-100, div.rounded-xl.p-3');
            const addonName = card?.querySelector('.addon-title, div.font-bold, h4')?.textContent.trim() || 'Phụ kiện Collector';
            const addonPriceStr = card?.querySelector('.addon-price, div.text-sm.font-bold')?.textContent.trim() || '35.000₫';
            const addonPrice = parseMoney(addonPriceStr);

            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã thêm';
            btn.style.backgroundColor = '#16a34a';
            btn.style.color = '#ffffff';

            const targetShopList = document.querySelector('.seller-cart-group:last-of-type, div.bg-white.rounded-2xl:last-of-type');
            if (targetShopList) {
                const newRow = document.createElement('div');
                newRow.className = 'cart-item-card p-4 border-b border-slate-100 flex items-center justify-between gap-4';
                newRow.dataset.cartItem = 'addon-' + Date.now();
                newRow.dataset.type = 'buy';

                newRow.innerHTML = `
          <div class="flex items-center gap-3">
            <input type="checkbox" checked data-item-checkbox="true" class="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316]">
            <div class="w-12 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs border border-slate-200">
              <i class="fa-solid fa-box-open text-base text-[#F97316]"></i>
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-900">${addonName}</h3>
              <span class="text-xs text-slate-500">Phụ kiện bảo quản chuyên dụng</span>
            </div>
          </div>
          <div class="flex items-center gap-6">
            <div class="text-right">
              <div class="font-bold text-slate-900 price-unit">${formatMoney(addonPrice)}</div>
            </div>
            <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <button type="button" class="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 btn-qty-minus"><i class="fa-solid fa-minus text-[10px]"></i></button>
              <span class="w-8 text-center text-xs font-bold qty-input">1</span>
              <button type="button" class="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 btn-qty-plus"><i class="fa-solid fa-plus text-[10px]"></i></button>
            </div>
            <button type="button" class="text-slate-400 hover:text-red-500 btn-delete-item"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        `;

                targetShopList.appendChild(newRow);

                const chk = newRow.querySelector('[data-item-checkbox]');
                chk.addEventListener('change', recalculateCart);

                const del = newRow.querySelector('.btn-delete-item');
                del.addEventListener('click', () => {
                    newRow.remove();
                    recalculateCart();
                    showToast(`Đã xóa ${addonName}`, 'info', 'fa-trash-can');
                });

                const minus = newRow.querySelector('.btn-qty-minus');
                const plus = newRow.querySelector('.btn-qty-plus');
                const qtyS = newRow.querySelector('.qty-input');
                let count = 1;
                minus.disabled = true;

                minus.addEventListener('click', () => {
                    if (count > 1) {
                        count--;
                        qtyS.textContent = count;
                        minus.disabled = count <= 1;
                        recalculateCart();
                    }
                });

                plus.addEventListener('click', () => {
                    count++;
                    qtyS.textContent = count;
                    minus.disabled = false;
                    recalculateCart();
                });

                recalculateCart();
            }

            showToast(`Đã thêm "${addonName}" vào giỏ hàng!`, 'success', 'fa-cart-plus');

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.backgroundColor = '';
                btn.style.color = '';
            }, 1500);
        });
    });

    // --------------------------------------------------------------------------
    // 8. TIẾN HÀNH ĐẶT HÀNG & ĐỔI -> CHECKOUT.HTML
    // --------------------------------------------------------------------------
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const checkedBoxes = document.querySelectorAll('[data-item-checkbox]:checked');

            if (checkedBoxes.length === 0) {
                showToast('Vui lòng chọn ít nhất 1 sản phẩm hoặc kèo đổi để tiếp tục!', 'warning', 'fa-triangle-exclamation');
                return;
            }

            showToast('Đang chuyển đến cổng Thanh Toán Bảo Chứng ComicHub...', 'primary', 'fa-shield-halved fa-spin');
            setTimeout(() => {
                window.location.href = 'payment.html';
            }, 700);
        });
    }

    // --------------------------------------------------------------------------
    // 9. KHỞI ĐỘNG TOÀN BỘ LOGIC GIỎ HÀNG
    // --------------------------------------------------------------------------
    initItemCards();
    initShopCheckboxes();
    recalculateCart();

    console.log('ComicHub Cart & CRUD scripts (cart.js) initialized successfully.');
});