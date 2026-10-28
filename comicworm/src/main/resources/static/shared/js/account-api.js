/* Account identity comes from the existing JWT login, never a browser role flag. */
(function (root) {
    'use strict';
    function baseUrl() {
        if (root.BookMoochApiBase != null) return String(root.BookMoochApiBase).replace(/\/$/, '');
        const location = root.location;
        if (location.protocol === 'file:') return 'http://localhost:8080';
        return ['5500', '5501'].includes(location.port) && ['localhost', '127.0.0.1'].includes(location.hostname)
            ? `${location.protocol}//${location.hostname}:8080` : '';
    }
    let pending;
    async function currentUser() {
        if (!pending) pending = read();
        return pending;
    }
    async function read() {
        let response;
        try {
            response = await root.fetch(baseUrl() + '/api/account/me', {
                credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store'
            });
        } catch (_) { throw new Error('Chưa kết nối được máy chủ để xác thực tài khoản.'); }
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Chưa xác thực được tài khoản. Vui lòng đăng nhập lại.');
        const account = await response.json();
        if (!account || account.id == null || typeof account.email !== 'string' || typeof account.isSeller !== 'boolean') {
            throw new Error('Thông tin tài khoản từ máy chủ không hợp lệ.');
        }
        return account;
    }

    // Ghi dữ liệu tài khoản: cookie đăng nhập + CSRF token lấy từ máy chủ cho mỗi lần gọi.
    async function write(method, path, body) {
        let response;
        try {
            const csrfResponse = await root.fetch(baseUrl() + '/api/account/csrf', {
                credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store'
            });
            if (csrfResponse.status === 401) throw sessionExpired();
            if (!csrfResponse.ok) throw new Error('csrf');
            const csrf = await csrfResponse.json();
            response = await root.fetch(baseUrl() + '/api/account/' + path, {
                method, credentials: 'include', cache: 'no-store',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                body: JSON.stringify(body)
            });
        } catch (error) {
            if (error.loginRequired) throw error;
            throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
        }
        if (response.status === 401) throw sessionExpired();
        let data = null;
        try { data = await response.json(); } catch (_) { /* Body trống hoặc không phải JSON. */ }
        if (!response.ok) {
            const error = new Error(data?.message || 'Không thể hoàn tất thao tác. Vui lòng thử lại.');
            error.field = data?.field;
            throw error;
        }
        return data;
    }
    function sessionExpired() {
        const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        error.loginRequired = true;
        return error;
    }
    async function updateProfile(fullName) {
        const account = await write('PUT', 'profile', { fullName });
        pending = Promise.resolve(account);
        return account;
    }
    const changePassword = (currentPassword, newPassword, confirmPassword) =>
        write('POST', 'password', { currentPassword, newPassword, confirmPassword });

    root.BookMoochAccountApi = {
        baseUrl, currentUser, updateProfile, changePassword,
        loginUrl: () => baseUrl() + '/auth/login',
        upgradeUrl: () => baseUrl() + '/user/html/upgrade-seller.html',
        sellerUrl: () => baseUrl() + '/seller/html/index.html'
    };
})(window);