/* Gọi API đơn hàng (B08 + T03). Quyền do server quyết định, không đọc role từ localStorage. */
(function (root) {
  'use strict';
  function baseUrl() {
    if (root.BookMoochApiBase != null) return String(root.BookMoochApiBase).replace(/\/$/, '');
    const l = root.location;
    if (l.protocol === 'file:') return 'http://localhost:8080';
    return ['5500', '5501'].includes(l.port) && ['localhost', '127.0.0.1'].includes(l.hostname)
      ? `${l.protocol}//${l.hostname}:8080` : '';
  }
  function loginRequired() {
    const e = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    e.loginRequired = true;
    return e;
  }
  async function parse(response) {
    if (response.status === 401) throw loginRequired();
    let data = null;
    try { data = await response.json(); } catch (_) { /* body trống */ }
    if (!response.ok) throw new Error(data?.message || 'Không thể hoàn tất thao tác. Vui lòng thử lại.');
    return data;
  }
  async function get(path, params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, v); });
    let response;
    try {
      response = await root.fetch(`${baseUrl()}/api/${path}${qs.toString() ? '?' + qs : ''}`, {
        credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }
      });
    } catch (_) { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.'); }
    return parse(response);
  }
  async function patchStatus(code, status, note) {
    let response;
    try {
      const csrfResponse = await root.fetch(baseUrl() + '/api/account/csrf', {
        credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }
      });
      if (csrfResponse.status === 401) throw loginRequired();
      if (!csrfResponse.ok) throw new Error('csrf');
      const csrf = await csrfResponse.json();
      response = await root.fetch(`${baseUrl()}/api/admin/orders/${encodeURIComponent(code)}/status`, {
        method: 'PATCH', credentials: 'include', cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ status, note: note || null })
      });
    } catch (error) {
      if (error.loginRequired) throw error;
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    return parse(response);
  }
  const LABELS = {
    WAITING_PAYMENT: 'Chờ thanh toán', WAITING_CONFIRM: 'Chờ xác nhận', PACKING: 'Đang đóng gói',
    SHIPPING: 'Đang giao', DELIVERED: 'Đã giao', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy'
  };
  const NEXT_ACTION = {
    PACKING: 'Xác nhận đơn', SHIPPING: 'Giao cho vận chuyển', DELIVERED: 'Đã giao thành công',
    COMPLETED: 'Đã nhận hàng'
  };
  root.BookMoochOrdersApi = {
    mine: (p) => get('orders/my', p), seller: (p) => get('seller/orders', p), admin: (p) => get('admin/orders', p),
    detail: (code) => get('orders/' + encodeURIComponent(code)),
    adminDetail: (code) => get('admin/orders/' + encodeURIComponent(code)),
    updateStatus: patchStatus, LABELS, NEXT_ACTION
  };
})(typeof window !== 'undefined' ? window : globalThis);
