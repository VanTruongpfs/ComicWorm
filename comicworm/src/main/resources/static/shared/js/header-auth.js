/**
 * ComicHub Header Authentication & User Dropdown Menu
 * Tự động kiểm tra trạng thái đăng nhập qua /api/account/me,
 * hiển thị avatar + dropdown menu (bao gồm nút Đăng xuất) hoặc nút Đăng nhập / Đăng ký nếu là khách.
 */
(function () {
    'use strict';

    // Inject CSS cần thiết cho User Dropdown & Guest Buttons
    const injectStyles = () => {
        if (document.getElementById('comic-header-auth-styles')) return;
        const style = document.createElement('style');
        style.id = 'comic-header-auth-styles';
        style.textContent = `
            .user-profile-menu {
                position: relative !important;
                display: flex !important;
                align-items: center !important;
                user-select: none !important;
            }
            .user-avatar-trigger {
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                cursor: pointer !important;
                padding: 4px 8px !important;
                border-radius: 9999px !important;
                transition: background-color 0.2s ease !important;
            }
            .user-avatar-trigger:hover {
                background-color: rgba(249, 115, 22, 0.08) !important;
            }
            .user-avatar-img {
                width: 36px !important;
                height: 36px !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                border: 2px solid #fed7aa !important;
                background-color: #f97316 !important;
                color: #ffffff !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-weight: 700 !important;
                font-size: 14px !important;
            }
            .user-name-label {
                font-size: 13px !important;
                font-weight: 700 !important;
                color: #0f172a !important;
                max-width: 120px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            .user-dropdown-arrow {
                font-size: 11px !important;
                color: #94a3b8 !important;
                transition: transform 0.25s ease !important;
            }
            .user-dropdown-menu {
                position: absolute !important;
                top: calc(100% + 10px) !important;
                right: 0 !important;
                width: 250px !important;
                background: #ffffff !important;
                border-radius: 16px !important;
                box-shadow: 0 16px 36px -6px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06) !important;
                padding: 8px !important;
                z-index: 999999 !important;
                display: none !important;
                flex-direction: column !important;
                opacity: 0 !important;
                transform: translateY(-8px) scale(0.97) !important;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }
            .user-dropdown-menu.show {
                display: flex !important;
                opacity: 1 !important;
                transform: translateY(0) scale(1) !important;
            }
            .user-dropdown-header {
                padding: 10px 12px 12px !important;
                border-bottom: 1px solid #f1f5f9 !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 4px !important;
            }
            .user-dropdown-name {
                font-size: 14px !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                line-height: 1.3 !important;
            }
            .user-dropdown-email {
                font-size: 12px !important;
                color: #64748b !important;
                word-break: break-all !important;
            }
            .user-dropdown-role-badge {
                display: inline-block !important;
                margin-top: 4px !important;
                align-self: flex-start !important;
                font-size: 10px !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.04em !important;
                padding: 2px 8px !important;
                border-radius: 9999px !important;
                background-color: #ffedd5 !important;
                color: #ea580c !important;
            }
            .user-dropdown-role-badge.admin {
                background-color: #fef08a !important;
                color: #854d0e !important;
            }
            .user-dropdown-role-badge.seller {
                background-color: #dcfce7 !important;
                color: #16a34a !important;
            }
            .user-dropdown-items {
                padding: 6px 0 !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 2px !important;
            }
            .user-dropdown-item {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                padding: 9px 12px !important;
                border-radius: 10px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                color: #334155 !important;
                text-decoration: none !important;
                transition: all 0.15s ease !important;
                cursor: pointer !important;
                border: none !important;
                background: transparent !important;
                width: 100% !important;
                text-align: left !important;
            }
            .user-dropdown-item i {
                font-size: 14px !important;
                width: 18px !important;
                text-align: center !important;
                color: #64748b !important;
                transition: color 0.15s ease !important;
            }
            .user-dropdown-item:hover {
                background-color: #f8fafc !important;
                color: #ea580c !important;
            }
            .user-dropdown-item:hover i {
                color: #ea580c !important;
            }
            .user-dropdown-divider {
                height: 1px !important;
                background-color: #f1f5f9 !important;
                margin: 4px 6px !important;
            }
            .user-dropdown-logout {
                color: #ef4444 !important;
            }
            .user-dropdown-logout i {
                color: #ef4444 !important;
            }
            .user-dropdown-logout:hover {
                background-color: #fef2f2 !important;
                color: #dc2626 !important;
            }
            .user-dropdown-logout:hover i {
                color: #dc2626 !important;
            }

            /* Khách vãng lai (Chưa đăng nhập) */
            .guest-auth-buttons {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .btn-guest-login {
                padding: 7px 16px !important;
                border-radius: 9999px !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                text-decoration: none !important;
                color: #334155 !important;
                border: 1.5px solid #cbd5e1 !important;
                background: #ffffff !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                transition: all 0.2s ease !important;
            }
            .btn-guest-login:hover {
                background-color: #f8fafc !important;
                border-color: #94a3b8 !important;
                color: #0f172a !important;
            }
            .btn-guest-register {
                padding: 7px 16px !important;
                border-radius: 9999px !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                text-decoration: none !important;
                color: #ffffff !important;
                border: none !important;
                background: #ea580c !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25) !important;
                transition: all 0.2s ease !important;
            }
            .btn-guest-register:hover {
                background-color: #c2410c !important;
                box-shadow: 0 4px 16px rgba(234, 88, 12, 0.4) !important;
            }
        `;
        document.head.appendChild(style);
    };

    // Hàm gọi đăng xuất
    const executeLogout = () => {
        const keysToClear = [
            'bookmooch_session',
            'bookmooch_profile',
            'bookmooch_avatar',
            'userRole',
            'userName',
            'rememberMe',
            'bm_admin_session'
        ];
        keysToClear.forEach(key => {
            try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            } catch (_) {}
        });
        window.location.href = '/auth/logout';
    };

    // Render giao diện khi ĐÃ ĐĂNG NHẬP
    const renderAuthenticatedMenu = (container, user) => {
        const fullName = user.fullName || user.email.split('@')[0];
        const initials = fullName.slice(0, 2).toUpperCase();
        const role = user.role || (user.isSeller ? 'SELLER' : 'BUYER');
        
        let roleBadgeText = 'Khách hàng';
        let roleClass = '';
        if (role === 'ADMIN') {
            roleBadgeText = 'Quản trị viên';
            roleClass = 'admin';
        } else if (user.isSeller || role === 'SELLER') {
            roleBadgeText = 'Người bán';
            roleClass = 'seller';
        }

        const avatarElement = user.avatarUrl
            ? `<img src="${user.avatarUrl}" alt="${fullName}" class="user-avatar-img" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=\\'user-avatar-img\\'>${initials}</div>'">`
            : `<div class="user-avatar-img">${initials}</div>`;

        const sellerLink = user.isSeller
            ? '<a href="/seller/html/index.html" class="user-dropdown-item"><i class="fa-solid fa-store"></i> <span>Kênh Người bán</span></a>'
            : '';

        const adminLink = role === 'ADMIN'
            ? '<a href="/admin/html/dashboard.html" class="user-dropdown-item"><i class="fa-solid fa-shield-halved"></i> <span>Quản trị Admin</span></a>'
            : '';

        container.innerHTML = `
            <div class="user-avatar-trigger" id="comic-avatar-trigger" title="${fullName}">
                ${avatarElement}
                <span class="user-name-label">${fullName}</span>
                <i class="fa-solid fa-chevron-down user-dropdown-arrow"></i>
            </div>
            <div class="user-dropdown-menu" id="comic-user-dropdown">
                <div class="user-dropdown-header" style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
                    ${avatarElement}
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                        <strong class="user-dropdown-name">${fullName}</strong>
                        <span class="user-dropdown-email">${user.email}</span>
                        <span class="user-dropdown-role-badge ${roleClass}">${roleBadgeText}</span>
                    </div>
                </div>
                <div class="user-dropdown-items">
                    <a href="/user/html/profile.html" class="user-dropdown-item">
                        <i class="fa-regular fa-id-card"></i> <span>Hồ sơ cá nhân</span>
                    </a>
                    <a href="/buyer/html/shopping_cart.html" class="user-dropdown-item">
                        <i class="fa-solid fa-bag-shopping"></i> <span>Giỏ hàng của tôi</span>
                    </a>
                    <a href="/exchange/html/dealing-room.html" class="user-dropdown-item">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i> <span>Sàn trao đổi truyện</span>
                    </a>
                    ${sellerLink}
                    ${adminLink}
                    <a href="/index.html" class="user-dropdown-item">
                        <i class="fa-solid fa-compass"></i> <span>Master Portal</span>
                    </a>
                </div>
                <div class="user-dropdown-divider"></div>
                <button type="button" class="user-dropdown-item user-dropdown-logout" id="btn-header-logout">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Đăng xuất</span>
                </button>
            </div>
        `;

        const trigger = container.querySelector('#comic-avatar-trigger');
        const dropdown = container.querySelector('#comic-user-dropdown');
        const arrow = container.querySelector('.user-dropdown-arrow');
        const logoutBtn = container.querySelector('#btn-header-logout');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('show');
                dropdown.classList.toggle('show');
                if (arrow) {
                    arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });

            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.classList.remove('show');
                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                executeLogout();
            });
        }
    };

    // Render giao diện khi CHƯA ĐĂNG NHẬP (Guest)
    const renderGuestMenu = (container) => {
        container.innerHTML = `
            <div class="guest-auth-buttons">
                <a href="/auth/login" class="btn-guest-login">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Đăng nhập
                </a>
                <a href="/auth/register" class="btn-guest-register">
                    <i class="fa-solid fa-user-plus"></i> Đăng ký
                </a>
            </div>
        `;
    };

    // Cập nhật ẩn/hiện nút Đăng bán truyện dựa theo quyền Người bán
    const updateSellerButtonsVisibility = (isSeller) => {
        const postButtons = document.querySelectorAll('.btn-post-listing, a[href*="/seller/html/dang-ban-truyen"]');
        postButtons.forEach(btn => {
            btn.style.display = isSeller ? '' : 'none';
        });
    };

    // Khởi tạo
    const initHeaderAuth = async () => {
        injectStyles();

        const profileMenus = document.querySelectorAll('.user-profile-menu');

        try {
            const res = await fetch('/api/account/me', {
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });

            if (res.ok) {
                const user = await res.json();
                if (user && user.id && user.email) {
                    const isSeller = Boolean(user.isSeller);
                    updateSellerButtonsVisibility(isSeller);
                    if (profileMenus.length) {
                        profileMenus.forEach(menu => renderAuthenticatedMenu(menu, user));
                    }
                    return;
                }
            }
        } catch (e) {
            // Lỗi kết nối hoặc chưa đăng nhập
        }

        // Nếu 401 hoặc chưa đăng nhập
        updateSellerButtonsVisibility(false);
        if (profileMenus.length) {
            profileMenus.forEach(menu => renderGuestMenu(menu));
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderAuth);
    } else {
        initHeaderAuth();
    }

    // Export hàm logout ra window để mọi nơi có thể gọi
    window.ComicHubLogout = executeLogout;
})();

