const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Only the disposable preview from verify_products_mysql.py --preview is used.
const base = 'http://localhost:18081';
const reportPath = path.resolve(__dirname, '../build/reports/seller-upgrade-browser.json');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  const account = async () => (await page.request.get(base + '/api/account/me')).json();
  try {
    await page.goto(base + '/auth/login');
    await page.locator('#email').fill('products-buyer@example.invalid');
    await page.locator('#password').fill('ProductsTest2026!');
    await Promise.all([page.waitForURL(base + '/buyer/html/home.html'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()]);
    assert.equal((await account()).isSeller, false);
    checks.push('Login returns to home with the buyer account');
    await page.goto(base + '/user/seller-upgrade');
    await page.getByRole('button', { name: 'Nâng cấp lên Người bán', exact: true }).waitFor();
    await context.clearCookies({ name: 'JSESSIONID' });
    await Promise.all([
      page.waitForURL(base + '/user/seller-upgrade?csrfExpired=true'),
      page.getByRole('button', { name: 'Nâng cấp lên Người bán', exact: true }).click()
    ]);
    assert.match(await page.getByRole('alert').innerText(), /Phiên xác nhận đã hết hạn/);
    assert.equal((await account()).isSeller, false);
    checks.push('Expired form reloads with a message and does not upgrade the account');
    assert.equal((await page.request.get(base + '/buyer/html/home.html')).status(), 200);
    assert.equal((await account()).isSeller, false);
    await Promise.all([
      page.waitForURL(base + '/seller/html/index.html'),
      page.getByRole('button', { name: 'Nâng cấp lên Người bán', exact: true }).click()
    ]);
    assert.equal((await account()).isSeller, true);
    assert.equal((await page.request.get(base + '/seller/html/quan-ly-san-pham.html')).status(), 200);
    assert.equal((await page.request.get(base + '/api/seller/products/options')).status(), 200);
    checks.push('Fresh form succeeds after other requests; the same JWT can open seller products');
    assert.deepEqual(errors, []);
    const report = { status: 'PASS', checks, errors };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.resolve(__dirname, '../build/reports/seller-upgrade-browser-failure.png'), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
