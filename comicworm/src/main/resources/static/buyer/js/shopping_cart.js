/**
 * COMICWORM - GIỎ HÀNG & ĐẶT HÀNG (KẾT NỐI DATABASE THỰC TẾ & TẢI ĐỘNG 100%)
 */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --------------------------------------------------------------------------
    // 0. TOAST NOTIFICATION
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

    const formatMoney = (amount) => {
        if (!amount && amount !== 0) return '0₫';
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    // --------------------------------------------------------------------------
    // 1. STATE & ELEMENTS
    // --------------------------------------------------------------------------
    let currentCartData = null;
    let appliedVoucher = null;

    const cartContainer = document.getElementById('cart-groups-container');
    const selectAllCheckbox = document.querySelector('.checkbox-select-all');
    const selectAllLabelText = document.querySelector('.cart-bulk-actions-bar .checkbox-text');
    const bulkDeleteBtn = document.querySelector('.btn-bulk-delete');
    const clearCartBtn = document.querySelector('.btn-clear-cart');
    const checkoutBtn = document.getElementById('btn-proceed-checkout');
    const cartCounterEl = document.querySelector('.cart-items-counter');
    const headerCartBadge = document.getElementById('header-cart-badge');

    const voucherInput = document.querySelector('.voucher-input');
    const voucherApplyBtn = document.querySelector('.btn-apply-voucher');
    const couponsContainer = document.getElementById('applied-coupons-container');

    const availableVouchers = {
        'COMICNEW': { code: 'COMICNEW', type: 'fixed', value: 20000, desc: 'Giảm 20.000₫ cho đơn hàng' },
        'FREESHIP': { code: 'FREESHIP', type: 'shipping', value: 30000, desc: 'Miễn phí vận chuyển (Tối đa 30.000₫)' },
        'COMICFREE': { code: 'COMICFREE', type: 'shipping', value: 30000, desc: 'Giảm 30.000₫ phí ship' },
        'VIP10': { code: 'VIP10', type: 'percent', value: 10, desc: 'Giảm 10% tiền hàng' }
    };

    // --------------------------------------------------------------------------
    // 2. FETCH CART TỪ DATABASE
    // --------------------------------------------------------------------------
    const fetchCart = async () => {
        try {
            const res = await fetch('/api/cart');
            if (res.status === 401) {
                renderUnauthenticated();
                return;
            }
            if (!res.ok) {
                renderError();
                return;
            }

            const data = await res.json();
            currentCartData = data;
            renderCart(data);
        } catch (err) {
            console.error('Lỗi khi tải giỏ hàng:', err);
            renderError();
        }
    };

    const renderUnauthenticated = () => {
        if (!cartContainer) return;
        if (headerCartBadge) headerCartBadge.textContent = '0';
        if (cartCounterEl) cartCounterEl.textContent = '(Chưa đăng nhập)';
        if (selectAllLabelText) selectAllLabelText.textContent = 'Chọn tất cả (0 sản phẩm)';

        cartContainer.innerHTML = `
            <div style="background: #ffffff; border-radius: 20px; padding: 48px 24px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15,23,42,0.03);">
                <div style="width: 72px; height: 72px; border-radius: 50%; background: #fff7ed; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
                    <i class="fa-solid fa-user-lock"></i>
                </div>
                <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Vui lòng đăng nhập</h3>
                <p style="font-size: 13px; color: #64748b; max-width: 380px; margin: 0 auto 24px; line-height: 1.5;">
                    Bạn cần đăng nhập để quản lý và đặt mua các bộ truyện trong giỏ hàng.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="/auth/register" style="display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 14px rgba(249,115,22,0.35);">
                        <i class="fa-solid fa-user-plus"></i> Đăng Ký Tài Khoản
                    </a>
                    <a href="/auth/login" style="display: inline-flex; align-items: center; gap: 8px; background: #ffffff; color: #475569; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">
                        <i class="fa-solid fa-right-to-bracket"></i> Đăng Nhập
                    </a>
                </div>
            </div>
        `;
        updateSummary(0, 0, 0);
    };

    const renderError = () => {
        if (!cartContainer) return;
        cartContainer.innerHTML = `
            <div style="background: #ffffff; border-radius: 20px; padding: 36px 20px; text-align: center; border: 1px solid #fee2e2;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: #ef4444; margin-bottom: 12px;"></i>
                <p style="color: #64748b; font-size: 14px; font-weight: 600;">Không thể tải dữ liệu giỏ hàng từ máy chủ.</p>
                <button type="button" onclick="location.reload()" style="margin-top: 12px; padding: 9px 20px; border-radius: 9999px; background: #f97316; color: white; border: none; cursor: pointer; font-weight: 700;">
                    Tải lại trang
                </button>
            </div>
        `;
    };

    // --------------------------------------------------------------------------
    // 3. RENDER CART ITEMS THEO NHÓM NGƯỜI BÁN
    // --------------------------------------------------------------------------
    const renderCart = (cartData) => {
        if (!cartContainer) return;
        const items = cartData.items || [];

        // Cập nhật số lượng huy hiệu & tiêu đề
        if (headerCartBadge) headerCartBadge.textContent = items.length;
        if (cartCounterEl) cartCounterEl.textContent = `(${items.length} sản phẩm)`;
        if (selectAllLabelText) selectAllLabelText.textContent = `Chọn tất cả (${items.length} sản phẩm)`;

        if (items.length === 0) {
            cartContainer.innerHTML = `
                <div style="background: #ffffff; border-radius: 20px; padding: 48px 24px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15,23,42,0.03);">
                    <div style="width: 72px; height: 72px; border-radius: 50%; background: #fff7ed; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
                        <i class="fa-solid fa-cart-arrow-down"></i>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Giỏ hàng của bạn đang trống</h3>
                    <p style="font-size: 13px; color: #64748b; max-width: 380px; margin: 0 auto 24px; line-height: 1.5;">
                        Chưa có bộ truyện tranh nào trong giỏ. Hãy khám phá ngay hàng ngàn tập manga độc lạ trên ComicHub nhé!
                    </p>
                    <a href="home.html#marketplace" style="display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
                        <i class="fa-solid fa-store"></i> Khám Phá Chợ Truyện Ngay
                    </a>
                </div>
            `;
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            updateSummary(0, 0, 0);
            return;
        }

        // Nhóm theo sellerId
        const groups = {};
        items.forEach(item => {
            const sid = item.sellerId || 0;
            if (!groups[sid]) {
                groups[sid] = {
                    sellerId: sid,
                    sellerName: item.sellerName || 'Người bán #' + sid,
                    items: []
                };
            }
            groups[sid].items.push(item);
        });

        let html = '';
        let totalSubtotal = 0;
        let selectedShopCount = 0;
        let allSelected = true;

        Object.values(groups).forEach(grp => {
            const hasSelectedInShop = grp.items.some(it => it.isSelected);
            if (hasSelectedInShop) selectedShopCount++;

            const shopAllSelected = grp.items.every(it => it.isSelected);
            if (!shopAllSelected) allSelected = false;

            html += `
                <section class="seller-cart-group">
                    <header class="group-seller-header">
                        <label class="custom-checkbox-label">
                            <input type="checkbox" class="shop-checkbox" data-seller-id="${grp.sellerId}" ${shopAllSelected ? 'checked' : ''}>
                            <span class="seller-shop-name">
                                <i class="fa-solid fa-store" style="color: #f97316;"></i> ${grp.sellerName}
                            </span>
                        </label>
                        <span class="seller-trust-badge">
                            <i class="fa-solid fa-certificate"></i> Đối tác uy tín
                        </span>
                        <a href="../../exchange/html/dealing-chat.html" class="btn-chat-with-seller">
                            <i class="fa-regular fa-comment-dots"></i> Chat
                        </a>
                    </header>
            `;

            grp.items.forEach(item => {
                const itemTotal = (item.price || 0) * (item.quantity || 1);
                if (item.isSelected) {
                    totalSubtotal += itemTotal;
                }
                const fallbackImg = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';

                html += `
                    <article class="cart-item-card" data-item-id="${item.cartItemId}">
                        <div class="item-select-wrap">
                            <input type="checkbox" class="item-checkbox" data-item-id="${item.cartItemId}" ${item.isSelected ? 'checked' : ''}>
                        </div>
                        <div class="item-thumbnail-wrap">
                            <img src="${item.imageUrl || fallbackImg}" alt="${item.productTitle}" class="item-thumb-img">
                            <span class="item-condition-badge">${item.conditionPercent || 95}% Mới</span>
                        </div>
                        <div class="item-details-wrap">
                            <div class="item-badge-row">
                                <span class="badge-type buy">Mua thẳng</span>
                                <span class="badge-format">Truyện tranh sưu tầm</span>
                            </div>
                            <h2 class="item-title">
                                <a href="product_details.html?id=${item.productId}">${item.productTitle}</a>
                            </h2>
                            <div class="item-pricing-mobile">
                                <span class="item-price-current">${formatMoney(item.price)}</span>
                            </div>
                        </div>
                        <div class="item-pricing-column">
                            <span class="item-price-current">${formatMoney(item.price)}</span>
                        </div>
                        <div class="item-quantity-column">
                            <div class="quantity-stepper">
                                <button type="button" class="btn-qty-minus" data-item-id="${item.cartItemId}" data-qty="${item.quantity}" aria-label="Giảm số lượng">
                                    <i class="fa-solid fa-minus"></i>
                                </button>
                                <input type="number" class="qty-input" value="${item.quantity}" readonly>
                                <button type="button" class="btn-qty-plus" data-item-id="${item.cartItemId}" data-qty="${item.quantity}" aria-label="Tăng số lượng">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        <div class="item-subtotal-column">
                            <span class="subtotal-label">Thành tiền:</span>
                            <span class="item-subtotal-price">${formatMoney(itemTotal)}</span>
                        </div>
                        <div class="item-actions-column">
                            <button type="button" class="btn-item-action delete btn-delete-cart-item" data-item-id="${item.cartItemId}" data-title="${item.productTitle}" aria-label="Xóa sản phẩm">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </article>
                `;
            });

            html += `</section>`;
        });

        cartContainer.innerHTML = html;

        if (selectAllCheckbox) {
            selectAllCheckbox.checked = allSelected && items.length > 0;
        }

        const shippingFee = selectedShopCount * 30000;
        updateSummary(totalSubtotal, shippingFee, selectedShopCount);
        bindCartEvents();
    };

    // --------------------------------------------------------------------------
    // 4. CẬP NHẬT TÓM TẮT ĐƠN HÀNG & MÃ GIẢM GIÁ
    // --------------------------------------------------------------------------
    const updateSummary = (subtotal, shippingFee, shopCount) => {
        let discount = 0;
        if (appliedVoucher) {
            if (appliedVoucher.type === 'percent') {
                discount = Math.round(subtotal * (appliedVoucher.value / 100));
            } else if (appliedVoucher.type === 'shipping') {
                discount = Math.min(shippingFee, appliedVoucher.value);
            } else {
                discount = appliedVoucher.value;
            }
        }
        const grandTotal = Math.max(0, subtotal + shippingFee - discount);

        const subtotalEl = document.getElementById('summary-subtotal');
        if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);

        const shipEl = document.getElementById('summary-shipping');
        if (shipEl) {
            shipEl.textContent = shopCount > 0 ? `${formatMoney(shippingFee)} (${shopCount} shop)` : '0₫';
        }

        const discountRow = document.getElementById('summary-discount-row');
        const discountEl = document.getElementById('summary-discount');
        if (discountRow && discountEl) {
            if (discount > 0) {
                discountRow.style.display = 'flex';
                discountEl.textContent = '-' + formatMoney(discount);
            } else {
                discountRow.style.display = 'none';
            }
        }

        const grandTotalEl = document.getElementById('summary-total');
        if (grandTotalEl) grandTotalEl.textContent = formatMoney(grandTotal);

        if (checkoutBtn) {
            const hasSelected = currentCartData && currentCartData.items && currentCartData.items.some(it => it.isSelected);
            checkoutBtn.disabled = !hasSelected;
            checkoutBtn.style.opacity = hasSelected ? '1' : '0.5';
            checkoutBtn.style.cursor = hasSelected ? 'pointer' : 'not-allowed';
        }
    };

    const renderAppliedCoupons = () => {
        if (!couponsContainer) return;
        if (!appliedVoucher) {
            couponsContainer.style.display = 'none';
            couponsContainer.innerHTML = '';
            return;
        }
        couponsContainer.style.display = 'flex';
        couponsContainer.innerHTML = `
            <div class="coupon-chip">
                <div class="coupon-info">
                    <i class="fa-solid fa-tag"></i>
                    <span class="coupon-code">${appliedVoucher.code}</span>
                    <span class="coupon-desc">(${appliedVoucher.desc})</span>
                </div>
                <button type="button" class="btn-remove-coupon" aria-label="Bỏ mã giảm giá">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        const removeBtn = couponsContainer.querySelector('.btn-remove-coupon');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const oldCode = appliedVoucher.code;
                appliedVoucher = null;
                renderAppliedCoupons();
                if (currentCartData) renderCart(currentCartData);
                showToast(`Đã gỡ mã ưu đãi ${oldCode}`, 'info');
            });
        }
    };

    if (voucherApplyBtn && voucherInput) {
        voucherApplyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const code = voucherInput.value.trim().toUpperCase();
            if (!code) {
                showToast('Vui lòng nhập mã giảm giá', 'warning');
                return;
            }
            const found = availableVouchers[code];
            if (found) {
                appliedVoucher = found;
                voucherInput.value = '';
                renderAppliedCoupons();
                if (currentCartData) renderCart(currentCartData);
                showToast(`Áp dụng mã ưu đãi ${found.code} thành công!`, 'success', 'fa-circle-check');
            } else {
                showToast('Mã ưu đãi không hợp lệ hoặc đã hết hạn!', 'danger', 'fa-triangle-exclamation');
            }
        });
    }

    // --------------------------------------------------------------------------
    // 5. GẮN SỰ KIỆN TƯƠNG TÁC CART
    // --------------------------------------------------------------------------
    const bindCartEvents = () => {
        // Tăng số lượng
        document.querySelectorAll('.btn-qty-plus').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId;
                const currentQty = parseInt(btn.dataset.qty, 10) || 1;
                btn.disabled = true;
                await updateCartItem(itemId, { quantity: currentQty + 1 });
            });
        });

        // Giảm số lượng
        document.querySelectorAll('.btn-qty-minus').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId;
                const currentQty = parseInt(btn.dataset.qty, 10) || 1;
                btn.disabled = true;
                if (currentQty <= 1) {
                    confirmDeleteItem(itemId, 'mục này');
                } else {
                    await updateCartItem(itemId, { quantity: currentQty - 1 });
                }
            });
        });

        // Xóa 1 mục
        document.querySelectorAll('.btn-delete-cart-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                const title = btn.dataset.title || 'sản phẩm';
                confirmDeleteItem(itemId, title);
            });
        });

        // Toggle checkbox 1 mục
        document.querySelectorAll('.item-checkbox').forEach(chk => {
            chk.addEventListener('change', async () => {
                const itemId = chk.dataset.itemId;
                await updateCartItem(itemId, { isSelected: chk.checked });
            });
        });

        // Toggle checkbox shop
        document.querySelectorAll('.shop-checkbox').forEach(sChk => {
            sChk.addEventListener('change', async () => {
                const sellerId = sChk.dataset.sellerId;
                const itemsInShop = currentCartData.items.filter(it => it.sellerId == sellerId);
                for (const it of itemsInShop) {
                    await updateCartItem(it.cartItemId, { isSelected: sChk.checked });
                }
                fetchCart();
            });
        });
    };

    const updateCartItem = async (itemId, payload) => {
        try {
            const res = await fetch(`/api/cart/items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                fetchCart();
            } else {
                const err = await res.json();
                showToast(err.message || 'Cập nhật thất bại', 'danger', 'fa-triangle-exclamation');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ', 'danger');
        }
    };

    const confirmDeleteItem = (itemId, title) => {
        if (confirm(`Bạn có chắc muốn xóa "${title}" khỏi giỏ hàng?`)) {
            deleteCartItem(itemId);
        }
    };

    const deleteCartItem = async (itemId) => {
        try {
            const res = await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'info', 'fa-trash-can');
                fetchCart();
            } else {
                showToast('Xóa sản phẩm thất bại', 'danger');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ', 'danger');
        }
    };

    // Chọn tất cả
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', async () => {
            const isChecked = selectAllCheckbox.checked;
            if (currentCartData && currentCartData.items) {
                for (const it of currentCartData.items) {
                    await updateCartItem(it.cartItemId, { isSelected: isChecked });
                }
                fetchCart();
            }
        });
    }

    // Xóa các mục đã chọn (Bulk Delete)
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', async () => {
            if (!currentCartData || !currentCartData.items) return;
            const selectedItems = currentCartData.items.filter(it => it.isSelected);
            if (selectedItems.length === 0) {
                showToast('Vui lòng chọn ít nhất 1 sản phẩm để xóa!', 'warning', 'fa-triangle-exclamation');
                return;
            }
            if (!confirm(`Bạn có chắc muốn xóa ${selectedItems.length} sản phẩm đã chọn khỏi giỏ hàng?`)) {
                return;
            }
            bulkDeleteBtn.disabled = true;
            try {
                for (const it of selectedItems) {
                    await fetch(`/api/cart/items/${it.cartItemId}`, { method: 'DELETE' });
                }
                showToast(`Đã xóa ${selectedItems.length} sản phẩm khỏi giỏ hàng`, 'info', 'fa-trash-can');
                await fetchCart();
            } catch (err) {
                showToast('Lỗi khi xóa sản phẩm', 'danger');
            } finally {
                bulkDeleteBtn.disabled = false;
            }
        });
    }

    // Làm trống toàn bộ giỏ hàng
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', async () => {
            if (confirm('Bạn có chắc muốn làm trống toàn bộ giỏ hàng?')) {
                try {
                    const res = await fetch('/api/cart/clear', { method: 'DELETE' });
                    if (res.ok) {
                        showToast('Đã làm trống giỏ hàng', 'info', 'fa-trash-arrow-up');
                        fetchCart();
                    }
                } catch (e) {
                    showToast('Lỗi kết nối máy chủ', 'danger');
                }
            }
        });
    }

    // --------------------------------------------------------------------------
    // 6. TIẾN HÀNH ĐẶT HÀNG (CHECKOUT MODAL VỚI SỔ ĐỊA CHỈ ĐÃ LƯU)
    // --------------------------------------------------------------------------
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            const selectedItems = currentCartData ? currentCartData.items.filter(it => it.isSelected) : [];
            if (selectedItems.length === 0) {
                showToast('Vui lòng chọn ít nhất 1 sản phẩm để đặt hàng!', 'warning', 'fa-triangle-exclamation');
                return;
            }
            openCheckoutModal();
        });
    }

    const openCheckoutModal = async () => {
        let savedAddresses = [];
        try {
            const res = await fetch('/api/user/addresses');
            if (res.ok) {
                savedAddresses = await res.json();
            }
        } catch (e) {
            console.warn('Không thể tải địa chỉ đã lưu:', e);
        }

        const formatAddr = a => [a.addressDetail, a.ward, a.district, a.province].filter(Boolean).join(', ');
        const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0] || null;

        const modalBackdrop = document.createElement('div');
        modalBackdrop.id = 'checkout-modal-backdrop';
        modalBackdrop.style.cssText = `
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px); z-index: 99999; display: flex;
            align-items: center; justify-content: center; padding: 20px;
        `;

        const addressSelectionHtml = savedAddresses.length > 0 ? `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label for="chk-saved-address-select" style="font-size: 12px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-location-dot" style="color: #f97316;"></i> Chọn từ sổ địa chỉ đã lưu
                    </label>
                    <a href="../../user/html/manage_address.html" target="_blank" style="font-size: 11px; color: #f97316; font-weight: 700; text-decoration: none;">
                        + Quản lý địa chỉ
                    </a>
                </div>
                <select id="chk-saved-address-select" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 600; background: #ffffff; outline: none; cursor: pointer; color: #1e293b;">
                    ${savedAddresses.map(a => `
                        <option value="${a.id}" ${defaultAddr && a.id === defaultAddr.id ? 'selected' : ''}>
                            ${a.recipientName} • ${a.phone} • ${formatAddr(a)} ${a.isDefault ? '[Mặc định]' : ''}
                        </option>
                    `).join('')}
                    <option value="manual">+ Nhập địa chỉ nhận hàng khác...</option>
                </select>
            </div>
        ` : `
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px 14px; margin-bottom: 4px; font-size: 12px; color: #9a3412; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-circle-info"></i> Bạn chưa có địa chỉ đã lưu.</span>
                <a href="../../user/html/manage_address.html" target="_blank" style="color: #f97316; font-weight: 700; text-decoration: underline;">Thêm vào sổ địa chỉ</a>
            </div>
        `;

        modalBackdrop.innerHTML = `
            <div style="background: #ffffff; border-radius: 20px; padding: 28px; max-width: 520px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); font-family: inherit;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: #ffedd5; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                            <i class="fa-solid fa-truck-fast"></i>
                        </div>
                        <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">Thông Tin Nhận Hàng</h3>
                    </div>
                    <button class="btn-close-checkout" style="border: none; background: transparent; font-size: 20px; color: #94a3b8; cursor: pointer;">&times;</button>
                </div>
                <form id="checkout-form" style="display: flex; flex-direction: column; gap: 12px;">
                    ${addressSelectionHtml}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Họ và tên người nhận *</label>
                            <input type="text" id="chk-recipient-name" value="${defaultAddr ? defaultAddr.recipientName : ''}" required placeholder="Ví dụ: Nguyễn Văn A" style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Số điện thoại liên hệ *</label>
                            <input type="tel" id="chk-recipient-phone" value="${defaultAddr ? defaultAddr.phone : ''}" required placeholder="Ví dụ: 0912345678" style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none;">
                        </div>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Địa chỉ giao hàng chi tiết *</label>
                        <textarea id="chk-shipping-address" required rows="2" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..." style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none; resize: none; font-family: inherit;">${defaultAddr ? formatAddr(defaultAddr) : ''}</textarea>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Ghi chú đơn hàng (nếu có)</label>
                        <input type="text" id="chk-buyer-note" placeholder="Ví dụ: Giao giờ hành chính, bọc kỹ góc sách..." style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;">
                        <button type="button" class="btn-cancel-checkout" style="padding: 10px 18px; border-radius: 9999px; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b; font-weight: 700; font-size: 13px; cursor: pointer;">Hủy</button>
                        <button type="submit" id="btn-submit-order" style="padding: 10px 22px; border-radius: 9999px; border: none; background: #f97316; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">
                            Xác Nhận Đặt Hàng <i class="fa-solid fa-arrow-right ml-1"></i>
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modalBackdrop);

        const savedSelect = modalBackdrop.querySelector('#chk-saved-address-select');
        if (savedSelect) {
            savedSelect.addEventListener('change', () => {
                const val = savedSelect.value;
                if (val === 'manual') {
                    document.getElementById('chk-recipient-name').value = '';
                    document.getElementById('chk-recipient-phone').value = '';
                    document.getElementById('chk-shipping-address').value = '';
                    document.getElementById('chk-recipient-name').focus();
                } else {
                    const chosen = savedAddresses.find(a => String(a.id) === String(val));
                    if (chosen) {
                        document.getElementById('chk-recipient-name').value = chosen.recipientName || '';
                        document.getElementById('chk-recipient-phone').value = chosen.phone || '';
                        document.getElementById('chk-shipping-address').value = formatAddr(chosen);
                    }
                }
            });
        }

        const closeModal = () => modalBackdrop.remove();
        modalBackdrop.querySelector('.btn-close-checkout').addEventListener('click', closeModal);
        modalBackdrop.querySelector('.btn-cancel-checkout').addEventListener('click', closeModal);

        const form = modalBackdrop.querySelector('#checkout-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = modalBackdrop.querySelector('#btn-submit-order');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo đơn hàng...';

            const payload = {
                recipientName: document.getElementById('chk-recipient-name').value.trim(),
                recipientPhone: document.getElementById('chk-recipient-phone').value.trim(),
                shippingAddress: document.getElementById('chk-shipping-address').value.trim(),
                buyerNote: document.getElementById('chk-buyer-note').value.trim()
            };

            try {
                const res = await fetch('/api/cart/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.status === 401) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Xác Nhận Đặt Hàng <i class="fa-solid fa-arrow-right ml-1"></i>';
                    showToast('Vui lòng đăng ký tài khoản để tiếp tục thanh toán!', 'warning', 'fa-right-to-bracket');
                    setTimeout(() => window.location.href = '/auth/register', 1200);
                    return;
                }

                const data = await res.json();
                if (res.ok) {
                    showToast('Tạo đơn hàng thành công! Đang chuyển đến cổng thanh toán...', 'success', 'fa-circle-check');
                    setTimeout(() => {
                        window.location.href = `payment.html?checkoutCode=${data.checkoutCode}`;
                    }, 800);
                } else {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Xác Nhận Đặt Hàng <i class="fa-solid fa-arrow-right ml-1"></i>';
                    showToast(data.message || 'Lỗi đặt hàng', 'danger', 'fa-triangle-exclamation');
                }
            } catch (err) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Xác Nhận Đặt Hàng <i class="fa-solid fa-arrow-right ml-1"></i>';
                showToast('Không thể kết nối đến máy chủ', 'danger');
            }
        });
    };

    // --------------------------------------------------------------------------
    // 7. KHỞI TẠO
    // --------------------------------------------------------------------------
    fetchCart();
    console.log('ComicWorm Cart script connected to real database APIs and fully dynamic.');
});