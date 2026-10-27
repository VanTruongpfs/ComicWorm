/* Exercise the actual seller template/scripts against an isolated HTTP API fixture. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const reports = path.join(root, 'build/reports/seller-orders');
const orders = Array.from({ length: 16 }, (_, n) => ({
  orderCode: n ? `ORD-${String(n).padStart(2, '0')}` : 'ORD-LIVE',
  status: n === 1 ? 'WAITING_PAYMENT' : n === 2 ? 'SHIPPING' : n === 3 ? 'DELIVERED' : n === 4 ? 'COMPLETED' : n === 5 ? 'CANCELLED' : 'WAITING_CONFIRM',
  paymentStatus: 'PAID', sellerId: 2, sellerName: 'Gian hàng kiểm thử', buyerName: 'Người mua', recipientName: 'Người nhận',
  subtotalAmount: 100000 + n * 1000, shippingFee: 20000, totalAmount: 120000 + n * 1000, itemCount: 1,
  items: [{ title: n === 2 ? 'Shipping-only' : `Truyện ${n}`, quantity: 1, unitPrice: 100000 + n * 1000, lineTotal: 100000 + n * 1000 }],
  createdAt: `2026-10-${String(22 - n).padStart(2, '0')}T10:00:00`, history: []
}));
const groups = { pending: ['WAITING_PAYMENT'], processing: ['WAITING_CONFIRM', 'PACKING'], shipping: ['SHIPPING', 'DELIVERED'], completed: ['COMPLETED'], cancelled: ['CANCELLED'] };
const next = { WAITING_CONFIRM: 'PACKING', PACKING: 'SHIPPING', SHIPPING: 'DELIVERED' };
const summary = (o) => ({ ...o, nextStatus: next[o.status] || null });
const detail = (o) => ({ summary: summary(o), recipientPhone: '0900000000', shippingAddress: 'Địa chỉ kiểm thử', buyerNote: '<img src=x onerror="window.badNote=true">', history: o.history });
const writes = [], queries = [], errors = [], checks = [];
let failList = false, forceConflict = false, loggedOut = false;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    if (url.pathname === '/api/account/me') return json({ fullName: 'Người bán kiểm thử', isSeller: true });
    if (url.pathname === '/api/account/csrf') return json({ headerName: 'X-CSRF-TOKEN', token: 'fixture-csrf' });
    if (url.pathname === '/api/seller/orders') {
      queries.push(Object.fromEntries(url.searchParams));
      if (loggedOut) return json({ message: 'Hết phiên đăng nhập' }, 401);
      if (failList) return json({ message: 'Không tải được đơn hàng kiểm thử' }, 500);
      const group = url.searchParams.get('status'), q = url.searchParams.get('q') || '', sort = url.searchParams.get('sort');
      const page = Number(url.searchParams.get('page')), size = Number(url.searchParams.get('size'));
      let found = orders.filter((o) => (group === 'all' || groups[group]?.includes(o.status)) && JSON.stringify(o).toLowerCase().includes(q.toLowerCase()));
      if (sort === 'oldest') found.reverse();
      if (sort === 'price-desc') found.sort((a, b) => b.totalAmount - a.totalAmount);
      const counts = { all: orders.length };
      for (const [key, values] of Object.entries(groups)) counts[key] = orders.filter((o) => values.includes(o.status)).length;
      return json({ content: found.slice(page * size, (page + 1) * size).map(summary), page, size, totalElements: found.length, totalPages: Math.ceil(found.length / size), counts });
    }
    const getDetail = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (getDetail) return json(detail(orders.find((o) => o.orderCode === decodeURIComponent(getDetail[1]))));
    const update = url.pathname.match(/^\/api\/seller\/orders\/([^/]+)\/status$/);
    if (update && req.method === 'PATCH') {
      assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
      let body = ''; for await (const chunk of req) body += chunk;
      const data = JSON.parse(body), order = orders.find((o) => o.orderCode === decodeURIComponent(update[1]));
      if (forceConflict) return json({ message: 'Đơn hàng đã được cập nhật ở nơi khác' }, 409);
      assert.equal(data.status, next[order.status]);
      order.history.push({ previousStatus: order.status, newStatus: data.status, changedByName: 'Người bán kiểm thử', note: data.note, createdAt: '2026-10-22T11:00:00' });
      order.status = data.status; writes.push(data);
      return json(detail(order));
    }
    if (url.pathname === '/auth/login') { res.end('<h1>Đăng nhập</h1>'); return; }
    const relative = url.pathname.endsWith('.html')
      ? path.join('src/main/resources/templates/view', url.pathname)
      : path.join('src/main/resources/static', url.pathname);
    const file = path.resolve(root, relative);
    assert.ok(file.startsWith(root + path.sep));
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    res.end(data);
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});

(async () => {
  await fs.mkdir(reports, { recursive: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.setDefaultTimeout(10000);
    const ready = () => page.waitForFunction(() => document.querySelector('#ordersTable tbody').getAttribute('aria-busy') === 'false');
    await page.goto(base + '/seller/html/orders.html'); await ready();
    assert.equal(await page.locator('#ordersTable tbody tr[data-code]').count(), 10);
    assert.equal(await page.locator('[data-order-count="all"]').innerText(), '16');
    assert.equal(await page.locator('#ordersSellerName').innerText(), 'Người bán kiểm thử');
    checks.push('Real template renders API counts, authenticated seller name and ten orders per page');
    await page.locator('#ordersPaginationControls [data-page="1"]').first().click(); await ready();
    assert.equal(await page.locator('#ordersTable tbody tr[data-code]').count(), 6);
    assert.match(await page.locator('#ordersPaginationInfo').innerText(), /11 – 16/);
    await page.locator('#ordersPaginationControls [data-page="0"]').first().click(); await ready();
    await page.locator('[data-code="ORD-LIVE"] [data-act="detail"]').first().click();
    await page.locator('#sellerOrderDetailActions [data-act="advance"]').waitFor();
    assert.equal(await page.evaluate(() => window.badNote), undefined);
    await page.locator('#sellerOrderDetailActions [data-act="advance"]').click();
    await page.locator('#sellerOrderStatusNote').fill('Đã kiểm tra đủ truyện');
    await page.locator('#sellerOrderStatusSubmit').click(); await ready();
    await page.locator('tr[data-code="ORD-LIVE"][data-status="PACKING"]').waitFor();
    assert.deepEqual(writes, [{ status: 'PACKING', note: 'Đã kiểm tra đủ truyện' }]);
    await page.reload(); await ready();
    await page.locator('[data-code="ORD-LIVE"] [data-act="detail"]').first().click();
    await page.locator('.orders-history').waitFor();
    assert.match(await page.locator('.orders-history').innerText(), /Đã kiểm tra đủ truyện/);
    await page.locator('#sellerOrderDetailModal [data-close-dialog]').click();
    for (const target of ['SHIPPING', 'DELIVERED']) {
      await page.locator(`tr[data-code="ORD-LIVE"] [data-act="advance"][data-next="${target}"]`).click();
      await page.locator('#sellerOrderStatusSubmit').click();
      await page.locator(`tr[data-code="ORD-LIVE"][data-status="${target}"]`).waitFor();
    }
    assert.equal(await page.locator('tr[data-code="ORD-LIVE"] [data-act="advance"]').count(), 0);
    checks.push('Seller confirms, ships and records delivery through PATCH + CSRF; reload and detail retain server history; completion is unavailable');
    for (const code of ['ORD-01', 'ORD-03', 'ORD-04', 'ORD-05']) assert.equal(await page.locator(`tr[data-code="${code}"] [data-act="advance"]`).count(), 0);
    await page.locator('#orderFilterTabs [data-filter="processing"]').click(); await ready();
    const searchResponse = page.waitForResponse((r) => r.url().includes('/api/seller/orders?') && r.url().includes('q=Shipping-only'));
    await page.locator('#orderGlobalSearch').fill('Shipping-only'); await searchResponse; await ready();
    assert.equal(await page.locator('#ordersTable tbody tr[data-code]').count(), 0);
    assert.equal(queries.at(-1).status, 'processing');
    const clearResponse = page.waitForResponse((r) => r.url().includes('/api/seller/orders?') && !r.url().includes('&q='));
    await page.locator('#orderGlobalSearch').fill(''); await clearResponse; await ready();
    await page.locator('#ordersSort').selectOption('price-desc'); await ready();
    assert.equal(queries.at(-1).sort, 'price-desc');
    checks.push('Pagination, status filter, search and sorting use combined server queries; terminal/unpaid orders cannot advance');
    const firstAdvance = page.locator('#ordersTable [data-act="advance"]').first();
    await firstAdvance.click(); await page.locator('#sellerOrderStatusModal [data-close-dialog]').click();
    assert.equal(writes.length, 3);
    await firstAdvance.click(); forceConflict = true; await page.locator('#sellerOrderStatusSubmit').click();
    await page.locator('#sellerOrderStatusError').filter({ hasText: 'Đơn hàng đã được cập nhật' }).waitFor();
    assert.equal(await page.locator('#sellerOrderStatusSubmit').isDisabled(), true);
    assert.equal(writes.length, 3);
    await page.locator('#sellerOrderStatusModal [data-close-dialog]').click(); forceConflict = false;
    failList = true; await page.locator('#refreshOrdersBtn').click(); await ready();
    assert.match(await page.locator('#ordersTable tbody').innerText(), /Không tải được đơn hàng kiểm thử/);
    failList = false; await page.locator('#refreshOrdersBtn').click(); await ready();
    checks.push('Cancelling confirmation does not write; conflicts and list failures show errors and allow recovery');
    await page.locator('#toastContainer').evaluate((el) => el.replaceChildren());
    await page.screenshot({ path: path.join(reports, 'desktop.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => Math.abs(document.querySelector('.main-wrapper').getBoundingClientRect().left) < 1 && document.querySelector('#appSidebar').getBoundingClientRect().right <= 1);
    await page.screenshot({ path: path.join(reports, 'mobile.png'), fullPage: true, animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page must not overflow horizontally');
    assert.ok(await page.evaluate(() => document.querySelector('.main-wrapper').getBoundingClientRect().right <= window.innerWidth + 1), 'Mobile content must fit the viewport');
    assert.equal(await page.locator('#orderGlobalSearch').isVisible(), true);
    checks.push('Desktop and mobile layouts captured; mobile page has no horizontal page overflow');
    loggedOut = true; await page.locator('#refreshOrdersBtn').click(); await page.waitForURL('**/auth/login');
    assert.deepEqual(errors, []);
    checks.push('Expired login redirects to login; no uncaught browser errors');
    await fs.writeFile(path.join(reports, 'browser-results.txt'), checks.map((c) => 'PASS: ' + c).join('\n'));
    console.log(checks.map((c) => 'PASS: ' + c).join('\n'));
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
