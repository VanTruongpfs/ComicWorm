const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.EXCHANGE_BASE_URL;
if (!/^http:\/\/localhost:\d+$/.test(base || '')) throw Error('Run through verify_exchange_mysql.py with a disposable database.');
const reports = path.resolve(__dirname, '../build/reports/exchange-room');
const errors = [], checks = [];

(async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    async function user(role) {
        const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.accept());
        await page.goto(base + '/auth/login');
        await page.locator('#email').fill('exchange-' + role + '@example.invalid');
        await page.locator('#password').fill('ExchangeTest2026!');
        await Promise.all([page.waitForURL('**/buyer/html/home.html'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()]);
        return { context, page, api: context.request };
    }
    async function json(response) { assert.ok(response.ok(), `${response.status()} ${await response.text()}`); return response.json(); }
    async function addAddress(page, name) {
        const form = page.locator('#exchangeAddressForm');
        for (const [field, value] of Object.entries({ recipientName: name, phone: '0901234567', province: 'Hà Nội', district: 'Ba Đình', ward: 'Phúc Xá', addressDetail: '18 Phố Truyện' })) await form.locator(`[name="${field}"]`).fill(value);
        await form.getByRole('button', { name: 'Lưu địa chỉ', exact: true }).click();
        await page.locator('#receiveAddress option[value]:not([value=""])').waitFor({ state: 'attached' });
    }
    try {
        const host = await user('host'), buyer = await user('buyer'), observer = await user('observer');
        const hostInventory = await json(await host.api.get(base + '/api/exchange/rooms/inventory'));
        const buyerInventory = await json(await buyer.api.get(base + '/api/exchange/rooms/inventory'));
        const room = await json(await buyer.api.post(base + '/api/exchange/rooms', { data: { targetProductId: hostInventory[0].id, initialMessage: 'Tin nhắn từ kiểm thử thật' } }));
        const url = base + '/exchange/html/dealing-chat.html?room=' + room.id;
        await buyer.page.goto(url);
        await buyer.page.locator('[data-act="new-deal"]').click();
        await buyer.page.locator('[data-act="pick"][data-comic="c_' + buyerInventory[0].id + '"]').check();
        await buyer.page.locator('[data-act="draft-money"]').click();
        await buyer.page.locator('#amountInput').fill('60000');
        await buyer.page.locator('#offerSubmit').click();
        await buyer.page.locator('[data-act="send-draft"]').click();
        await buyer.page.locator('.dc-my-deal').waitFor();
        const initial = await json(await buyer.api.get(base + '/api/exchange/rooms/' + room.id));
        const offer = initial.offers[0];
        assert.equal(offer.cashCompensation, 60000);
        assert.equal(offer.items[0].productId, buyerInventory[0].id);
        checks.push('Creating a proposal in the room uses the signed-in account inventory and saves real product IDs');
        await buyer.page.locator('[data-act="edit-deal"]').click();
        await buyer.page.locator('#dealEditMoney').fill('70000');
        await buyer.page.locator('[data-act="save-deal-edit"]').click();
        await buyer.page.locator('#dealEditModal').waitFor({ state: 'hidden' });
        await buyer.page.reload();
        await buyer.page.locator('.dc-my-deal').filter({ hasText: '70.000' }).waitFor();
        let saved = await json(await buyer.api.get(base + '/api/exchange/rooms/' + room.id));
        assert.equal(saved.offers.find(o => o.id === offer.id).cashCompensation, 70000);
        checks.push('Editing a proposal saves the real database amount and persists after reload');

        await host.page.goto(url);
        await host.page.locator('[data-act="lock"]').click();
        await host.page.locator('#lockConfirm').check();
        await host.page.locator('#lockSubmit').click();
        await host.page.locator('[data-act="confirm-details"]:enabled').waitFor();
        await buyer.page.locator('[data-act="confirm-details"]:enabled').waitFor();
        await buyer.page.locator('[data-act="confirm-details"]').click();
        await buyer.page.locator('.dc-notice').filter({ hasText: 'Bạn đã xác nhận' }).waitFor();
        await buyer.page.reload();
        await buyer.page.locator('.dc-notice').filter({ hasText: 'Bạn đã xác nhận' }).waitFor();
        assert.equal(await buyer.page.locator('[data-act="create-order"]').count(), 0);
        await observer.page.goto(url);
        await observer.page.locator('.dc-notice').filter({ hasText: 'Chỉ hai bên' }).waitFor();
        assert.equal((await observer.api.get(base + '/api/exchange/rooms/' + room.id + '/checkout')).status(), 403);
        await host.page.locator('[data-act="confirm-details"]').click();
        await buyer.page.locator('[data-act="create-order"]').waitFor();
        checks.push('Real WebSocket and database confirmations require both accounts; observer cannot access checkout');

        await buyer.page.locator('[data-act="create-order"]').click();
        await buyer.page.waitForURL('**/negotiation-order.html?room=' + room.id + '&deal=' + offer.id);
        await addAddress(buyer.page, 'Người nhận từ trình duyệt');
        await buyer.page.locator('#orderNote').fill('Ghi chú từ trình duyệt');
        await buyer.page.locator('#exchangeOrderForm button[type="submit"]').click();
        await buyer.page.waitForURL('**/shipping-fee.html?room=' + room.id + '&deal=' + offer.id);
        await buyer.page.locator('#shippingMethod').selectOption('EXPRESS');
        assert.match(await buyer.page.locator('#orderTotal').innerText(), /110.000/);
        await buyer.page.screenshot({ path: path.join(reports, 'live-shipping.png'), fullPage: true });
        await buyer.page.locator('#exchangeOrderForm button[type="submit"]').click();
        await buyer.page.waitForURL('**/exchange-orders.html');
        await buyer.page.locator('[data-order-id]').waitFor();
        let checkout = await json(await buyer.api.get(base + '/api/exchange/rooms/' + room.id + '/checkout'));
        const buyerOrder = checkout.orders[0];
        assert.equal(buyerOrder.totalAmount, 110000); assert.equal(buyerOrder.paymentStatus, 'PENDING');
        assert.equal(buyerOrder.note, 'Ghi chú từ trình duyệt');
        const address = (await json(await buyer.api.get(base + '/api/user/addresses')))[0];
        const retry = await json(await buyer.api.post(base + '/api/exchange/rooms/' + room.id + '/orders', { data: { addressId: address.id, shippingMethod: 'EXPRESS', paymentMethod: 'COD' } }));
        assert.equal(retry.id, buyerOrder.id);
        checks.push('Address and shipping flow creates a real COD order with server totals; retry returns the same order');

        await host.page.goto(base + '/exchange/html/negotiation-order.html?room=' + room.id + '&deal=' + offer.id);
        await addAddress(host.page, 'Chủ phòng nhận truyện');
        await host.page.locator('#exchangeOrderForm button[type="submit"]').click();
        await host.page.waitForURL('**/shipping-fee.html?room=' + room.id + '&deal=' + offer.id);
        await host.page.locator('#exchangeOrderForm button[type="submit"]').click();
        await host.page.waitForURL('**/exchange-orders.html');
        const card = host.page.locator(`[data-order-id="${buyerOrder.id}"]`);
        await card.locator('[data-status="ACCEPT"]').click();
        await card.locator('[data-status="SHIP"]').click();
        await buyer.page.reload();
        await buyer.page.locator(`[data-order-id="${buyerOrder.id}"] [data-status="RECEIVE"]`).click();
        await buyer.page.locator(`[data-order-id="${buyerOrder.id}"]`).filter({ hasText: 'Đã thanh toán' }).waitFor();
        checkout = await json(await buyer.api.get(base + '/api/exchange/rooms/' + room.id + '/checkout'));
        assert.equal(checkout.orders.length, 2); assert.equal(checkout.orders.find(o => o.id === buyerOrder.id).status, 'COMPLETED');
        checks.push('Both shipping legs are persisted; sender and recipient progress the real order and COD status');
        await buyer.page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await buyer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Exchange layout must fit the phone viewport');
        await buyer.page.screenshot({ path: path.join(reports, 'live-orders-mobile.png'), fullPage: true });

        await host.page.goto(base + '/user/html/manage_address.html');
        await host.page.locator('.address-card').filter({ hasText: 'Chủ phòng nhận truyện' }).waitFor();
        assert.equal((await buyer.api.get(base + '/api/user/addresses')).ok(), true);
        checks.push('Account address management uses the same database addresses');

        await observer.page.route('**/api/exchange/rooms', route => route.fulfill({ json: [] }));
        await observer.page.goto(base + '/exchange/html/dealing-room.html');
        await observer.page.locator('#emptyState').waitFor();
        assert.equal(await observer.page.locator('.room-card').count(), 0);
        checks.push('Empty room API renders a true empty state with no sample room');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(reports, 'live-browser-results.json'), JSON.stringify({ checks, pageErrors: errors }, null, 2));
        console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
