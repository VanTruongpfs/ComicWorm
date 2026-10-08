/* Shared reporting calculations. The stored order snapshots are the source of truth. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookMoochAnalytics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'BOOKMOOCH_ANALYTICS_V1';
  const TIME_ZONE = 'Asia/Ho_Chi_Minh';
  const DAY = 86400000;
  const addMoney = (a, b) => Math.round((a + b) * 100) / 100;
  const STATUS_LABELS = {
    WAITING_PAYMENT: 'Chờ thanh toán', WAITING_CONFIRM: 'Chờ xác nhận',
    PACKING: 'Đang đóng gói', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao',
    COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', DISPUTED: 'Tranh chấp'
  };

  function parseDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }
  function dateKey(value) {
    if (!value) return null;
    // MySQL DATETIME and date-only values are local Vietnamese calendar dates.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(value)) {
      if (value.length > 10 && (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19) || 0) > 59)) return null;
      return parseDay(value.slice(0, 10)) ? value.slice(0, 10) : null;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !parseDay(value.slice(0, 10))) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function shiftDay(value, amount) {
    const date = parseDay(value);
    if (!date) throw new Error('Ngày không hợp lệ.');
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }
  function validateRange(from, to) {
    const start = parseDay(from), end = parseDay(to);
    if (!start || !end) throw new Error('Vui lòng nhập đầy đủ từ ngày và đến ngày hợp lệ.');
    if (start > end) throw new Error('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
    const days = Math.round((end - start) / DAY) + 1;
    if (days > 3660) throw new Error('Vui lòng chọn khoảng thời gian tối đa 10 năm.');
    return { from, to, days };
  }
  function presetRange(preset, today = dateKey(new Date())) {
    if (preset === 'month') return { from: today.slice(0, 8) + '01', to: today };
    if (preset === 'previousMonth') {
      const to = shiftDay(today.slice(0, 8) + '01', -1);
      return { from: to.slice(0, 8) + '01', to };
    }
    const days = Number(preset);
    if (![7, 30, 90].includes(days)) throw new Error('Mốc thời gian không hợp lệ.');
    return { from: shiftDay(today, 1 - days), to: today };
  }
  function number(value, label, integer = false) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 ||
      (integer && !Number.isInteger(Number(value)))) throw new Error(`${label} không hợp lệ.`);
    return Number(value);
  }
  const optionalLabel = value => value == null ? null : String(value).trim() || null;
  function priceTier(price) {
    if (price < 50000) return 'Phổ thông (< 50.000 ₫)';
    if (price < 100000) return 'Tiêu chuẩn (50.000 – dưới 100.000 ₫)';
    if (price <= 200000) return 'Cao cấp (100.000 – 200.000 ₫)';
    return 'Boxset (> 200.000 ₫)';
  }
  function normalizeDataset(raw) {
    if (!raw || !Array.isArray(raw.orders)) throw new Error('Dữ liệu thống kê phải có danh sách orders.');
    const ids = new Set();
    const orders = raw.orders.map(order => {
      if (!order || order.id == null || (order.sellerId ?? order.seller_id) == null) {
        throw new Error('Đơn hàng thiếu mã đơn hoặc mã người bán.');
      }
      const id = String(order.id);
      if (ids.has(id)) throw new Error(`Mã đơn hàng bị trùng: ${id}.`);
      ids.add(id);
      const status = String(order.status || '').toUpperCase();
      const createdAt = dateKey(order.createdAt ?? order.created_at);
      const completedAt = dateKey(order.completedAt ?? order.completed_at);
      if (!createdAt || !STATUS_LABELS[status] || (status === 'COMPLETED' && !completedAt)) {
        throw new Error(`Đơn ${id} có ngày hoặc trạng thái không hợp lệ.`);
      }
      if (!Array.isArray(order.items) || (status === 'COMPLETED' && !order.items.length)) {
        throw new Error(`Đơn ${id} thiếu chi tiết sản phẩm.`);
      }
      const items = order.items.map(item => {
        if (!item || (item.productId ?? item.product_id) == null) throw new Error(`Đơn ${id} thiếu mã sản phẩm.`);
        const quantity = number(item.quantity, 'Số lượng', true);
        if (!quantity) throw new Error('Số lượng phải lớn hơn 0.');
        const unitPrice = number(item.unitPrice ?? item.unit_price, 'Đơn giá');
        const coverPrice = item.coverPrice ?? item.cover_price;
        return { productId: String(item.productId ?? item.product_id),
          title: String(item.title ?? item.product_title ?? 'Sản phẩm'),
          category: String(item.category || 'Chưa phân loại'), quantity, unitPrice,
          coverPrice: coverPrice == null ? null : number(coverPrice, 'Giá bìa'),
          campaign: optionalLabel(item.campaign ?? item.campaignName ?? item.campaign_name),
          revenue: Math.round(quantity * unitPrice * 100) / 100 };
      });
      const revenue = items.reduce((sum, item) => addMoney(sum, item.revenue), 0);
      const subtotal = order.subtotalAmount ?? order.subtotal_amount;
      if (subtotal != null && Math.abs(number(subtotal, 'Tiền hàng') - revenue) > 0.01) {
        throw new Error(`Tiền hàng của đơn ${id} không khớp chi tiết sản phẩm.`);
      }
      return { id, sellerId: String(order.sellerId ?? order.seller_id), status, createdAt, completedAt, items, revenue,
        campaign: optionalLabel(order.campaign ?? order.campaignName ?? order.campaign_name),
        region: optionalLabel(order.region ?? order.shippingRegion ?? order.shipping_region),
        province: optionalLabel(order.province ?? order.shippingProvince ?? order.shipping_province) };
    });
    const sellers = Array.isArray(raw.sellers) ? raw.sellers.map(seller => ({
      id: String(seller.id), name: String(seller.name || seller.id), email: seller.email || ''
    })) : [];
    const users = Array.isArray(raw.users) ? raw.users.filter(user => !(user.deletedAt ?? user.deleted_at)) : [];
    return { orders, sellers, users };
  }

  function demoDataset(today = dateKey(new Date())) {
    const sellers = [
      { id: 'U-10231', name: 'Tiệm Truyện Vũ Trụ', email: 'tiemtruyenvutru@bookmooch.vn' },
      { id: 'U-11623', name: 'Comic Corner HN', email: 'comiccorner.hn@bookmooch.vn' },
      { id: 'U-11290', name: 'Nhà Sách Ngọc Anh', email: 'nhasachngocanh@bookmooch.vn' }
    ];
    const products = [
      ['MANGA-OP-100', 'One Piece - Tập 100', 'Shounen', 65000],
      ['MANGA-CONAN-COL', 'Conan - Bản màu đặc biệt', 'Trinh thám', 85000],
      ['MANGA-JJK-18', 'Jujutsu Kaisen - Tập 18', 'Shounen', 45000],
      ['MANGA-SPY-10', 'Spy × Family - Tập 10', 'Hài hước', 58000],
      ['MANGA-FRIEREN-1', 'Frieren - Tập 1', 'Kỳ ảo', 55000],
      ['MANGA-SAILOR-1', 'Sailor Moon - Tập 1', 'Shoujo', 70000]
    ];
    const orders = [];
    const locations = [
      { region: 'Miền Nam', province: 'TP. Hồ Chí Minh' },
      { region: 'Miền Bắc', province: 'Hà Nội' },
      { region: 'Miền Trung', province: 'Đà Nẵng' },
      { region: 'Miền Nam', province: 'Cần Thơ' }
    ];
    const campaigns = ['Manga Weekend', 'Ra mắt Tập mới', 'Flash Sale xả kho', null];
    for (let day = 0; day < 90; day++) {
      // Predictable item-level demo orders; never saved over actual stored data.
      if (day % 11 === 5) continue;
      sellers.forEach((seller, shop) => {
        const index = (day * 5 + shop) % products.length;
        const product = products[index];
        const status = day % 13 === 4 ? 'CANCELLED' : day < 3 && shop === 1 ? 'SHIPPING' : 'COMPLETED';
        const items = [{ productId: product[0], title: product[1], category: product[2],
          quantity: 1 + (day + shop) % 4, unitPrice: product[3] }];
        if (day % 4 === 0) items.push({ productId: products[0][0], title: products[0][1], category: products[0][2], quantity: 2, unitPrice: products[0][3] });
        orders.push({ id: `DEMO-${day}-${shop}`, sellerId: seller.id, status,
          createdAt: shiftDay(today, -day - 2), completedAt: status === 'COMPLETED' ? shiftDay(today, -day) : null,
          campaign: campaigns[(day + shop) % campaigns.length],
          ...locations[(day + shop) % locations.length], items });
      });
    }
    return { orders, sellers, users: [
      { id: 'A-1', role: 'ADMIN' }, ...sellers.map(seller => ({ ...seller, role: 'USER', is_seller: true })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `BUYER-${i}`, role: 'USER' }))
    ] };
  }
  function loadDataset(storage, today) {
    const value = storage.getItem(STORAGE_KEY);
    return value === null
      ? { ...normalizeDataset(demoDataset(today)), demo: true }
      : { ...normalizeDataset(JSON.parse(value)), demo: false };
  }
  function resolveSeller(data, session) {
    const id = session && (session.sellerId ?? session.seller_id ?? session.userId ?? session.user_id ?? session.id);
    if (id != null) return String(id);
    if (session && session.email) {
      const email = session.email.toLowerCase();
      const user = data.users.find(item => String(item.email || '').toLowerCase() === email);
      if (user) return String(user.sellerId ?? user.seller_id ?? user.id);
      const seller = data.sellers.find(item => String(item.email || '').toLowerCase() === email);
      if (seller) return seller.id;
    }
    return data.demo && !session ? 'U-10231' : null;
  }
  function aggregate(data, range, sellerId = null, grouping = 'day') {
    validateRange(range.from, range.to);
    if (!['day', 'week', 'month'].includes(grouping)) throw new Error('Cách nhóm thời gian không hợp lệ.');
    const inRange = day => day && day >= range.from && day <= range.to;
    const scope = data.orders.filter(order => sellerId === null || order.sellerId === String(sellerId));
    const completed = scope.filter(order => order.status === 'COMPLETED' && inRange(order.completedAt));
    const buckets = new Map(), products = new Map(), categories = new Map(), sellers = new Map(), states = new Map();
    const campaigns = new Map(), priceTiers = new Map(), regions = new Map(), cities = new Map();
    let unitsWithoutCoverPrice = 0;
    function addBreakdown(map, label, value, quantity, orders = 0) {
      const row = map.get(label) || { label, value: 0, units: 0, orders: 0 };
      row.value = addMoney(row.value, value);
      row.units += quantity;
      row.orders += orders;
      map.set(label, row);
    }
    function bucketKey(day) {
      if (grouping === 'month') return day.slice(0, 7) + '-01';
      if (grouping === 'week') return shiftDay(day, -(parseDay(day).getUTCDay() + 6) % 7);
      return day;
    }
    for (let day = range.from; day <= range.to; day = shiftDay(day, 1)) {
      const key = bucketKey(day);
      const bucket = buckets.get(key);
      if (bucket) bucket.to = day;
      else buckets.set(key, { key, from: day, to: day, revenue: 0, orders: 0, units: 0 });
    }
    let revenue = 0, units = 0;
    completed.forEach(order => {
      const bucket = buckets.get(bucketKey(order.completedAt));
      bucket.orders++;
      bucket.revenue = addMoney(bucket.revenue, order.revenue);
      revenue = addMoney(revenue, order.revenue);
      const sellerName = data.sellers.find(seller => seller.id === order.sellerId)?.name || order.sellerId;
      const seller = sellers.get(order.sellerId) || { id: order.sellerId, label: sellerName, value: 0 };
      seller.value = addMoney(seller.value, order.revenue);
      sellers.set(order.sellerId, seller);
      const orderUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
      addBreakdown(regions, order.region || 'Chưa xác định khu vực', order.revenue, orderUnits, 1);
      addBreakdown(cities, order.province || 'Chưa xác định tỉnh/thành', order.revenue, orderUnits, 1);
      order.items.forEach(item => {
        units += item.quantity;
        bucket.units += item.quantity;
        // Product IDs are scoped to seller to also support per-shop SKU inventories.
        const key = `${order.sellerId}\u0000${item.productId}`;
        const product = products.get(key) || { id: item.productId, title: item.title, category: item.category,
          sellerId: order.sellerId, sellerName, units: 0, revenue: 0, orderIds: new Set() };
        product.units += item.quantity;
        product.revenue = addMoney(product.revenue, item.revenue);
        product.orderIds.add(order.id);
        products.set(key, product);
        const category = categories.get(item.category) || { label: item.category, value: 0, units: 0 };
        category.value = addMoney(category.value, item.revenue);
        category.units += item.quantity;
        categories.set(item.category, category);
        addBreakdown(campaigns, item.campaign || order.campaign || 'Không gắn chiến dịch', item.revenue, item.quantity);
        addBreakdown(priceTiers, priceTier(item.coverPrice ?? item.unitPrice), item.revenue, item.quantity);
        if (item.coverPrice == null) unitsWithoutCoverPrice += item.quantity;
      });
    });
    scope.filter(order => inRange(order.createdAt)).forEach(order => {
      states.set(order.status, (states.get(order.status) || 0) + 1);
    });
    const roles = new Map();
    data.users.forEach(user => {
      const label = String(user.role).toUpperCase() === 'ADMIN' ? 'Quản trị viên' : 'Người dùng';
      roles.set(label, (roles.get(label) || 0) + 1);
    });
    return { revenue, units, orders: completed.length, average: completed.length ? revenue / completed.length : 0,
      series: Array.from(buckets.values()),
      products: Array.from(products.values()).map(({ orderIds, ...product }) => ({ ...product, orders: orderIds.size })),
      categories: Array.from(categories.values()), sellers: Array.from(sellers.values()),
      campaigns: Array.from(campaigns.values()), priceTiers: Array.from(priceTiers.values()),
      regions: Array.from(regions.values()), cities: Array.from(cities.values()), unitsWithoutCoverPrice,
      states: Array.from(states, ([status, value]) => ({ label: STATUS_LABELS[status], value })),
      roles: Array.from(roles, ([label, value]) => ({ label, value })) };
  }
  function rankProducts(products, metric = 'units') {
    const key = metric === 'revenue' ? 'revenue' : 'units';
    return [...products].sort((a, b) => b[key] - a[key] || b.revenue - a.revenue || a.id.localeCompare(b.id) || a.sellerId.localeCompare(b.sellerId));
  }
  // Escape spreadsheet formulas in exported text, including names supplied by users.
  function csvCell(value) {
    const text = String(value ?? '');
    return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
  }
  function csv(rows) { return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'); }
  return { STORAGE_KEY, TIME_ZONE, STATUS_LABELS, parseDay, dateKey, shiftDay, validateRange,
    presetRange, normalizeDataset, demoDataset, loadDataset, resolveSeller, aggregate, rankProducts, csv };
});
