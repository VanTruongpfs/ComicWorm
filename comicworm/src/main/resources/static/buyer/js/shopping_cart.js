/**
 * COMICWORM - GIỎ HÀNG & ĐẶT HÀNG (KẾT NỐI DATABASE THỰC TẾ)
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
    let voucherDiscount = 0;

    const cartContainer = document.getElementById('cart-groups-container');
    const selectAllCheckbox = document.querySelector('.checkbox-select-all');
    const bulkDeleteBtn = document.querySelector('.btn-bulk-delete');
    const clearCartBtn = document.querySelector('.btn-clear-cart');
    const checkoutBtn = document.getElementById('btn-proceed-checkout');
    const cartCounterEl = document.querySelector('.cart-items-counter');

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
        cartContainer.innerHTML = `
            <div style="background: #ffffff; border-radius: 20px; padding: 48px 24px; text-align: center; border: 1px solid #e2e8f0;">
                <div style="width: 72px; height: 72px; border-radius: 50%; background: #fff7ed; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
                    <i class="fa-solid fa-user-lock"></i>
                </div>
                <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Vui lòng đăng nhập</h3>
                <p style="font-size: 13px; color: #64748b; max-width: 380px; margin: 0 auto 24px;">
                    Bạn cần đăng nhập để xem các bộ truyện trong giỏ hàng của mình.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="/auth/register" style="display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 9999px; text-decoration: none;">
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
                <p style="color: #64748b; font-size: 14px;">Không thể tải dữ liệu giỏ hàng từ máy chủ. Vui lòng thử lại sau.</p>
                <button type="button" onclick="location.reload()" style="margin-top: 12px; padding: 8px 18px; border-radius: 8px; background: #f97316; color: white; border: none; cursor: pointer; font-weight: 600;">
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

        if (cartCounterEl) {
            cartCounterEl.textContent = `(${items.length} sản phẩm)`;
        }

        if (items.length === 0) {
            cartContainer.innerHTML = `
                <div style="background: #ffffff; border-radius: 20px; padding: 48px 24px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="width: 72px; height: 72px; border-radius: 50%; background: #fff7ed; color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
                        <i class="fa-solid fa-cart-arrow-down"></i>
                    </div>
                    <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Giỏ hàng của bạn đang trống</h3>
                    <p style="font-size: 13px; color: #64748b; max-width: 380px; margin: 0 auto 24px; line-height: 1.5;">
                        Chưa có bộ truyện tranh nào trong giỏ. Hãy khám phá ngay hàng ngàn tập manga độc lạ trên ComicHub nhé!
                    </p>
                    <a href="category.html" style="display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
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
                <section class="seller-cart-group" style="background:#fff; border-radius:18px; border:1px solid #e2e8f0; margin-bottom:18px; overflow:hidden;">
                    <header class="group-seller-header" style="background:#f8fafc; padding:12px 18px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between;">
                        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" class="shop-checkbox" data-seller-id="${grp.sellerId}" ${shopAllSelected ? 'checked' : ''}>
                            <span class="seller-shop-name" style="font-weight:700; color:#0f172a; font-size:14px;">
                                <i class="fa-solid fa-store" style="color:#f97316; margin-right:4px;"></i> ${grp.sellerName}
                            </span>
                        </label>
                        <span class="seller-trust-badge" style="font-size:12px; color:#16a34a; font-weight:600;">
                            <i class="fa-solid fa-certificate"></i> Người bán xác thực
                        </span>
                    </header>
            `;

            grp.items.forEach(item => {
                const itemTotal = (item.price || 0) * (item.quantity || 1);
                if (item.isSelected) {
                    totalSubtotal += itemTotal;
                }
                const fallbackImg = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';

                html += `
                    <article class="cart-item-card" data-item-id="${item.cartItemId}" style="padding:16px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
                        <div class="item-select-wrap">
                            <input type="checkbox" class="item-checkbox" data-item-id="${item.cartItemId}" ${item.isSelected ? 'checked' : ''} style="width:18px; height:18px; accent-color:#f97316; cursor:pointer;">
                        </div>
                        <div class="item-thumbnail-wrap" style="width:70px; height:90px; border-radius:10px; overflow:hidden; flex-shrink:0; background:#f1f5f9;">
                            <img src="${item.imageUrl || fallbackImg}" alt="${item.productTitle}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div class="item-details-wrap" style="flex:1; min-width:200px;">
                            <h2 class="item-title" style="font-size:14px; font-weight:700; margin-bottom:4px;">
                                <a href="product_details.html?id=${item.productId}" style="color:#0f172a; text-decoration:none;">${item.productTitle}</a>
                            </h2>
                            <div style="font-size:12px; color:#64748b; margin-bottom:4px;">Độ mới: <strong style="color:#f97316;">${item.conditionPercent || 95}%</strong></div>
                            <div style="font-size:14px; font-weight:800; color:#f97316;">${formatMoney(item.price)}</div>
                        </div>
                        <div class="item-quantity-column" style="display:flex; align-items:center; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">
                            <button type="button" class="btn-qty-minus" data-item-id="${item.cartItemId}" data-qty="${item.quantity}" style="width:30px; height:30px; border:none; background:#f8fafc; cursor:pointer;"><i class="fa-solid fa-minus" style="font-size:10px;"></i></button>
                            <span style="width:36px; text-align:center; font-weight:700; font-size:13px;">${item.quantity}</span>
                            <button type="button" class="btn-qty-plus" data-item-id="${item.cartItemId}" data-qty="${item.quantity}" style="width:30px; height:30px; border:none; background:#f8fafc; cursor:pointer;"><i class="fa-solid fa-plus" style="font-size:10px;"></i></button>
                        </div>
                        <div class="item-subtotal-column" style="min-width:110px; text-align:right;">
                            <div style="font-size:11px; color:#94a3b8;">Thành tiền:</div>
                            <div style="font-weight:800; color:#0f172a; font-size:15px;">${formatMoney(itemTotal)}</div>
                        </div>
                        <div class="item-actions-column">
                            <button type="button" class="btn-delete-cart-item" data-item-id="${item.cartItemId}" data-title="${item.productTitle}" style="border:none; background:transparent; color:#94a3b8; font-size:16px; cursor:pointer; padding:6px;">
                                <i class="fa-regular fa-trash-can hover:text-red-500"></i>
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
    // 4. CẬP NHẬT TÓM TẮT ĐƠN HÀNG
    // --------------------------------------------------------------------------
    const updateSummary = (subtotal, shippingFee, shopCount) => {
        const grandTotal = Math.max(0, subtotal + shippingFee - voucherDiscount);

        const subtotalRow = document.querySelector('.summary-rows-group .summary-row:nth-child(1) .summary-value');
        if (subtotalRow) subtotalRow.textContent = formatMoney(subtotal);

        const shipRow = document.querySelector('.summary-rows-group .summary-row:nth-child(4) .summary-value');
        if (shipRow) {
            shipRow.textContent = shopCount > 0 ? `${formatMoney(shippingFee)} (${shopCount} shop)` : '0₫';
        }

        const grandTotalEl = document.querySelector('.total-price-amount');
        if (grandTotalEl) grandTotalEl.textContent = formatMoney(grandTotal);

        if (checkoutBtn) {
            const hasSelected = currentCartData && currentCartData.items && currentCartData.items.some(it => it.isSelected);
            checkoutBtn.disabled = !hasSelected;
            checkoutBtn.style.opacity = hasSelected ? '1' : '0.5';
            checkoutBtn.style.cursor = hasSelected ? 'pointer' : 'not-allowed';
        }
    };

    // --------------------------------------------------------------------------
    // 5. GẮN SỰ KIỆN TƯƠNG TÁC
    // --------------------------------------------------------------------------
    const bindCartEvents = () => {
        // Tăng số lượng
        document.querySelectorAll('.btn-qty-plus').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId;
                const currentQty = parseInt(btn.dataset.qty, 10) || 1;
                await updateCartItem(itemId, { quantity: currentQty + 1 });
            });
        });

        // Giảm số lượng
        document.querySelectorAll('.btn-qty-minus').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId;
                const currentQty = parseInt(btn.dataset.qty, 10) || 1;
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

    // Làm trống giỏ hàng
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
    // 6. TIẾN HÀNH ĐẶT HÀNG (CHECKOUT MODAL)
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

    const openCheckoutModal = () => {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.id = 'checkout-modal-backdrop';
        modalBackdrop.style.cssText = `
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px); z-index: 99999; display: flex;
            align-items: center; justify-content: center; padding: 20px;
        `;

        modalBackdrop.innerHTML = `
            <div style="background: #ffffff; border-radius: 20px; padding: 28px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); font-family: inherit;">
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
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Họ và tên người nhận *</label>
                        <input type="text" id="chk-recipient-name" required placeholder="Ví dụ: Nguyễn Văn A" style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Số điện thoại liên hệ *</label>
                        <input type="tel" id="chk-recipient-phone" required placeholder="Ví dụ: 0912345678" style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Địa chỉ giao hàng chi tiết *</label>
                        <textarea id="chk-shipping-address" required rows="2" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..." style="width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none; resize: none; font-family: inherit;"></textarea>
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
    console.log('ComicWorm Cart script connected to real database APIs.');
});