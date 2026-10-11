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
  root.BookMoochAccountApi = {
    baseUrl, currentUser,
    loginUrl: () => baseUrl() + '/auth/login',
    upgradeUrl: () => baseUrl() + '/user/seller-upgrade',
    sellerUrl: () => baseUrl() + '/seller/html/index.html'
  };
})(window);
