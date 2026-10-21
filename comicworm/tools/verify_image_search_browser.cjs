// UI verification with controlled API responses; no real product data is modified.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reports = path.join(root, 'build/reports');
fs.mkdirSync(reports, { recursive: true });
const html = fs.readFileSync(path.join(root, 'src/main/resources/templates/view/buyer/html/image-search.html'), 'utf8')
  .replace(/th:(href|src)="@\{([^}]+)\}"/g, '$1="$2"');
const server = http.createServer((request, response) => {
  if (request.url === '/buyer/html/image-search.html') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.end(html);
  }
  const assets = {
    '/buyer/css/image-search.css': ['text/css', 'src/main/resources/static/buyer/css/image-search.css'],
    '/buyer/js/image-search.js': ['text/javascript', 'src/main/resources/static/buyer/js/image-search.js']
  };
  const asset = assets[request.url];
  if (!asset) { response.statusCode = 404; return response.end(); }
  response.setHeader('Content-Type', asset[0] + '; charset=utf-8');
  response.end(fs.readFileSync(path.join(root, asset[1])));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base + '/buyer/html/image-search.html');
    const image = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 230;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ee7733'; ctx.fillRect(0, 0, 160, 230);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 23px sans-serif'; ctx.fillText('COMIC', 30, 70); ctx.fillText('WORM', 30, 105);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const file = { name: 'cover.png', mimeType: 'image/png', buffer: image };
    let mode = 'results';
    await page.route('https://res.cloudinary.com/**', route => route.fulfill({ contentType: 'image/png', body: image }));
    await page.route(base + '/api/products/image-search', async route => {
      assert.equal(route.request().method(), 'POST');
      assert.ok(route.request().headers()['content-type'].startsWith('multipart/form-data; boundary='));
      if (mode === 'error') return route.fulfill({ status: 503, json: { message: 'Dịch vụ nhận diện ảnh chưa sẵn sàng.' } });
      if (mode === 'empty') return route.fulfill({ json: { comparedImages: 0, items: [] } });
      return route.fulfill({ json: { comparedImages: 3, items: [1, 2, 3].map(id => ({
        product: { id, title: 'Truyện thử nghiệm ' + id, price: 25000 * id, coverImageUrl: 'https://res.cloudinary.com/test/' + id,
          sellerName: 'Gian hàng truyện', conditionLabel: 'Rất tốt', inStock: id !== 3 }, similarity: 1 - id / 10
      })) } });
    });
    await page.locator('#query-image').setInputFiles(file);
    await page.getByRole('button', { name: 'Tìm truyện tương tự' }).click();
    await page.locator('.image-result-card').first().waitFor();
    assert.equal(await page.locator('.image-result-card').count(), 3);
    assert.ok((await page.locator('.image-result-card').first().getAttribute('href')).endsWith('product_details.html?id=1'));
    assert.equal(await page.locator('#query-preview').isVisible(), true);
    await page.screenshot({ path: path.join(reports, 'image-search-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(reports, 'image-search-mobile.png'), fullPage: true });
    mode = 'empty';
    await page.getByRole('button', { name: 'Tìm truyện tương tự' }).click();
    await page.getByRole('status').filter({ hasText: 'Chưa có ảnh sản phẩm' }).waitFor();
    assert.equal(await page.locator('.image-result-card').count(), 0);
    mode = 'error';
    await page.getByRole('button', { name: 'Tìm truyện tương tự' }).click();
    await page.getByRole('status').filter({ hasText: 'chưa sẵn sàng' }).waitFor();
    await page.locator('#query-image').setInputFiles({ name: 'wrong.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await page.getByRole('status').filter({ hasText: 'Chọn ảnh JPG' }).waitFor();
    assert.equal(await page.locator('#query-preview').isVisible(), false);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(reports, 'image-search-browser.txt'),
      'PASS: multipart upload, preview, ranked results, product links, mobile layout, empty/error states and unsupported file validation.\nAPI responses were controlled fixtures.\n');
    console.log('PASS: image search UI on desktop and mobile; screenshots in build/reports.');
  } finally {
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
