/* Reporting uses the authenticated backend; a failed API never falls back to demo data. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookMoochAnalyticsApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  function baseUrl() {
    if (root.BookMoochApiBase != null) return String(root.BookMoochApiBase).replace(/\/$/, '');
    const location = root.location;
    return location && ['5500', '5501'].includes(location.port) && ['localhost', '127.0.0.1'].includes(location.hostname)
      ? `${location.protocol}//${location.hostname}:8080` : '';
  }
  function loginUrl() { return baseUrl() + '/auth/login'; }
  function upgradeUrl() { return baseUrl() + '/user/seller-upgrade'; }
  async function report(role, range, grouping = 'day', request = root.fetch.bind(root)) {
    if (!['seller', 'admin'].includes(role)) throw new Error('Vai trò báo cáo không hợp lệ.');
    const query = new URLSearchParams({ from: range.from, to: range.to, grouping });
    let response;
    try { response = await request(`${baseUrl()}/api/analytics/${role}?${query}`, { credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store' }); }
    catch (_) { throw new Error('Không kết nối được backend. Vui lòng kiểm tra server và kết nối database.'); }
    if (response.status === 401) { const error = new Error('Vui lòng đăng nhập tài khoản trong database để xem báo cáo.'); error.loginRequired = true; throw error; }
    if (response.status === 403) {
      const error = new Error(role === 'admin' ? 'Tài khoản không có quyền quản trị.' : 'Bạn cần nâng cấp tài khoản lên Người bán để xem thống kê.');
      error.sellerRequired = role === 'seller';
      throw error;
    }
    if (!response.ok) throw new Error(response.status === 400 ? 'Khoảng ngày hoặc cách nhóm báo cáo không hợp lệ.' : 'Chưa tải được dữ liệu báo cáo từ database.');
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Backend chưa trả dữ liệu báo cáo JSON.'); }
    const arrays = ['series', 'products', 'categories', 'sellers', 'campaigns', 'priceTiers', 'regions', 'cities', 'states', 'roles'];
    if (!data || data.source !== 'DATABASE' || arrays.some(key => !Array.isArray(data[key])) || !Number.isFinite(data.revenue) || !Number.isFinite(data.orders) || !Number.isFinite(data.units))
      throw new Error('Dữ liệu báo cáo từ backend không đúng định dạng.');
    return data;
  }
  return { baseUrl, loginUrl, upgradeUrl, report };
});
