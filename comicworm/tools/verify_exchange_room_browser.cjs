// Run with Playwright on NODE_PATH. API fixtures stay in memory; no database is changed.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = 'http://exchange.test';
const reports = path.join(root, 'build/reports/exchange-room');
const room = {
  id: 1, roomCode: 'PT-101-1234', hostId: 10, hostName: 'Chủ phòng kiểm thử',
  targetProductTitle: 'One Piece kiểm thử', targetProductId: 101,
  targetProductPrice: 320000, targetProductCondition: 90,
  status: 'OPEN', selectedOfferId: null,
  members: [
    { userId: 10, fullName: 'Chủ phòng kiểm thử', isHost: true },
    { userId: 20, fullName: 'Người đổi kiểm thử', isHost: false },
    { userId: 30, fullName: 'Thành viên khác', isHost: false }
  ],
  offers: [{
    id: 50, roomId: 1, buyerId: 20, buyerName: 'Người đổi kiểm thử',
    cashCompensation: 60000, compensationDirection: 'pay', status: 'PENDING',
    hostConfirmed: false, buyerConfirmed: false, createdAt: '2026-10-16T09:00:00',
    items: [{ productId: 202, titleSnapshot: 'Naruto kiểm thử', conditionSnapshot: 85, price: 180000 }]
  }]
};
let failConfirmation = false;
let failLoading = false;
const errors = [];
const checks = [];
const pages = [];

async function emitUpdate() {
  for (const page of pages) {
    await page.evaluate(event => {
      window.testSocket?.onmessage?.({ data: JSON.stringify(event) });
    }, { type: 'DEAL_CONFIRMED', offer: room.offers[0], roomStatus: room.status });
  }
}

async function newUser(browser, userId, legacyFields = false, noWebSocket = false) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await context.addInitScript(({ noWebSocket }) => {
    if (noWebSocket) { window.WebSocket = undefined; return; }
    window.WebSocket = class {
      constructor() {
        window.testSocket = this;
        setTimeout(() => this.onopen?.(), 0);
      }
      close() {}
    };
  }, { noWebSocket });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', err => errors.push(err.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const json = (value, status = 200) => route.fulfill({ status, json: value });
    if (url.pathname === '/api/exchange/rooms/1') {
      if (failLoading) return json({}, 503);
      const data = { ...room, currentUserId: userId,
        isCurrentUserHost: userId === 10, isCurrentUserMember: Boolean(userId) };
      if (legacyFields) {
        data.currentUserHost = data.isCurrentUserHost;
        delete data.isCurrentUserHost;
      }
      return json(data);
    }
    if (url.pathname === '/api/exchange/rooms/1/messages' || url.pathname === '/api/exchange/rooms/inventory') return json([]);
    if (request.method() === 'POST' && url.pathname === '/api/exchange/rooms/1/offers/50/respond') {
      assert.equal(userId, 10);
      assert.equal(room.status, 'OPEN');
      room.status = 'AGREED'; room.selectedOfferId = 50;
      room.offers[0].status = 'ACCEPTED';
      return json(room.offers[0]);
    }
    if (request.method() === 'POST' && url.pathname === '/api/exchange/rooms/1/offers/50/confirm') {
      if (failConfirmation) return json({ message: 'Không thể xác nhận thử nghiệm' }, 409);
      assert.ok(userId === 10 || userId === 20);
      room.offers[0][userId === 10 ? 'hostConfirmed' : 'buyerConfirmed'] = true;
      if (room.offers[0].hostConfirmed && room.offers[0].buyerConfirmed) room.status = 'COMPLETED';
      return json(room.offers[0]);
    }
    if (url.pathname.startsWith('/api/')) return json({}, 401);
    let resource;
    if (url.pathname.includes('/html/')) resource = path.join(root, 'src/main/resources/templates/view', url.pathname);
    else resource = path.join(root, 'src/main/resources/static', url.pathname);
    try {
      const body = await fs.readFile(resource);
      const ext = path.extname(resource);
      return route.fulfill({ body, contentType: ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' })[ext] || 'application/octet-stream' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  pages.push(page);
  await page.goto(origin + '/exchange/html/dealing-chat.html?room=1');
  return page;
}

(async () => {
  await fs.mkdir(reports, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const host = await newUser(browser, 10, true);
    const buyer = await newUser(browser, 20);
    await host.locator('[data-act="lock"]').waitFor();
    assert.match(await host.locator('#currentRoleText').innerText(), /Chủ sở hữu/);
    await buyer.locator('.dc-my-deal').waitFor();
    assert.equal(await buyer.locator('[data-act="lock"]').count(), 0);
    checks.push('Host role shows selection button; buyer sees their own proposal');

    await host.locator('[data-act="lock"]').click();
    await host.locator('#lockConfirm').check();
    await host.locator('#lockSubmit').click();
    await host.locator('[data-act="confirm-details"]:enabled').waitFor();
    assert.equal(room.offers[0].hostConfirmed, false);
    await emitUpdate();
    await buyer.locator('[data-act="confirm-details"]:enabled').waitFor();
    await host.locator('a[href="#sidePanel"]').filter({ hasText: 'Xem và xác nhận' }).waitFor();
    assert.equal(await host.locator('[data-act="create-order"]').count(), 0);
    assert.equal(await buyer.locator('[data-act="create-order"]').count(), 0);
    await host.screenshot({ path: path.join(reports, 'both-await-confirmation.png'), fullPage: true });
    await buyer.setViewportSize({ width: 390, height: 844 });
    await buyer.locator('a[href="#sidePanel"]').click();
    await buyer.locator('[data-act="confirm-details"]').scrollIntoViewIfNeeded();
    await buyer.screenshot({ path: path.join(reports, 'mobile-confirmation.png') });
    await buyer.setViewportSize({ width: 1360, height: 1000 });
    checks.push('Selecting a proposal exposes a separate confirmation to each party');

    failConfirmation = true;
    await buyer.locator('[data-act="confirm-details"]').click();
    await buyer.locator('#toast').filter({ hasText: 'Không thể xác nhận thử nghiệm' }).waitFor();
    await buyer.locator('[data-act="confirm-details"]:enabled').waitFor();
    assert.equal(await buyer.locator('[data-act="create-order"]').count(), 0);
    checks.push('Failed API confirmation keeps the button available and does not unlock orders');
    failConfirmation = false;

    await buyer.locator('[data-act="confirm-details"]').click();
    await buyer.locator('.dc-notice').filter({ hasText: 'Bạn đã xác nhận' }).waitFor();
    await emitUpdate();
    assert.equal(await host.locator('[data-act="create-order"]').count(), 0);
    await host.locator('[data-act="confirm-details"]:enabled').waitFor();
    await buyer.reload();
    await buyer.locator('.dc-notice').filter({ hasText: 'Bạn đã xác nhận' }).waitFor();
    assert.equal(await buyer.locator('[data-act="confirm-details"]').count(), 0);
    checks.push('One confirmation persists after reload and waits for the other party');

    const observer = await newUser(browser, 30);
    await observer.locator('.dc-notice').filter({ hasText: 'Chỉ hai bên' }).waitFor();
    assert.equal(await observer.locator('[data-act="confirm-details"]').count(), 0);
    assert.equal(await observer.locator('[data-act="create-order"]').count(), 0);

    await host.locator('[data-act="confirm-details"]').click();
    await host.locator('[data-act="create-order"]').waitFor();
    await emitUpdate();
    await buyer.locator('[data-act="create-order"]').waitFor();
    assert.equal(await observer.locator('[data-act="create-order"]').count(), 0);
    await buyer.screenshot({ path: path.join(reports, 'ready-to-create-order.png'), fullPage: true });
    await buyer.locator('[data-act="create-order"]').click();
    await buyer.waitForURL('**/negotiation-order.html?room=1&deal=50');
    checks.push('Two confirmations unlock order creation with the selected room and offer; observers cannot act');

    room.status = 'CANCELLED';
    await host.reload();
    await host.locator('#sidePanel').filter({ hasText: 'Phòng trao đổi đã đóng' }).waitFor();
    assert.equal(await host.locator('[data-act="create-order"]').count(), 0);
    checks.push('Cancelled room stays closed even when both flags are true');

    room.status = 'AGREED';
    room.offers[0].hostConfirmed = false;
    room.offers[0].buyerConfirmed = false;
    const pollingBuyer = await newUser(browser, 20, false, true);
    await pollingBuyer.locator('[data-act="confirm-details"]').waitFor();
    room.offers[0].hostConfirmed = true;
    await pollingBuyer.locator('.dc-confirmation-status .is-confirmed').waitFor({ timeout: 15000 });
    checks.push('Fallback polling updates confirmation status when WebSocket is unavailable');

    room.status = 'OPEN'; room.selectedOfferId = null; room.offers = [];
    await host.reload();
    await host.locator('.dc-empty-request').waitFor();
    assert.equal(await host.locator('[data-act="lock"]').count(), 0);
    assert.equal(await host.locator('#sidePanel').getByText('RQ-2049-01').count(), 0);
    checks.push('Empty room does not retain sample proposals');

    failLoading = true;
    await host.reload();
    await host.locator('#sidePanel').filter({ hasText: 'Không tải được phòng trao đổi' }).waitFor();
    assert.equal(await host.locator('[data-act="lock"]').count(), 0);
    checks.push('Room loading failure does not fall back to actionable sample data');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(reports, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
