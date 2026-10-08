const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// All product mutations use the disposable MySQL preview, never the configured database.
const base = 'http://localhost:18081';
const reports = path.resolve(__dirname, '../build/reports');

function cloudConfig() {
  const file = path.resolve(__dirname, '../application-local.properties');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const config = {};
  for (const name of ['cloud-name', 'api-key', 'api-secret']) {
    const variable = 'CLOUDINARY_' + name.toUpperCase().replaceAll('-', '_');
    const match = text.match(new RegExp('^cloudinary\\.' + name + '=\\$\\{[^:]+:([^}]+)\\}', 'm'));
    config[name] = process.env[variable] || match?.[1];
    assert.ok(config[name], 'Cloudinary settings are required for this live check');
  }
  return config;
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  const errors = [], checks = [], uploaded = [];
  let productId;
  const remember = record => record.images.forEach(image => { if (!uploaded.includes(image.imageUrl)) uploaded.push(image.imageUrl); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const title = 'CRUD ảnh Cloudinary ' + Date.now(), editedTitle = title + ' đã sửa';
  try {
    await page.goto(base + '/auth/login');
    await page.locator('#email').fill('products-seller@example.invalid');
    await page.locator('#password').fill('ProductsTest2026!');
    await Promise.all([page.waitForURL(base + '/buyer/html/home.html'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()]);
    await page.goto(base + '/seller/html/quan-ly-san-pham.html');
    await page.locator('#addProductButton:enabled').waitFor();
    await page.locator('#addProductButton').click();
    await page.locator('#product-create-title').fill(title);
    await page.locator('#product-create-description').fill('Kiểm thử lưu sản phẩm, ảnh bìa và ảnh chi tiết trong cùng form.');
    await page.locator('#product-create-price').fill('25000');
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 160;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f97316'; ctx.fillRect(0, 0, 120, 160);
      ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.fillText('ComicWorm', 4, 80);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const photo = name => ({ name, mimeType: 'image/png', buffer: png });
    await page.locator('#product-create-coverImage').setInputFiles(photo('cover.png'));
    await page.locator('#product-create-detailImages').setInputFiles([photo('detail-1.png'), photo('detail-2.png')]);
    assert.equal(await page.locator('.jtable-dialog-form:visible .product-selected-images img').count(), 3);
    await page.screenshot({ path: path.join(reports, 'product-crud-images-create.png'), fullPage: true });
    const created = page.waitForResponse(response => response.url() === base + '/api/seller/products' && response.request().method() === 'POST', { timeout: 120000 });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    const createResponse = await created, createData = await createResponse.json();
    assert.equal(createResponse.status(), 200, JSON.stringify(createData));
    let record = createData.Record; productId = record.id; remember(record);
    assert.equal(record.images.length, 3); assert.equal(record.detailImages.length, 2);
    assert.equal(record.images[0].imageType, 'COVER');
    assert.equal(record.coverImageUrl, record.images[0].imageUrl);
    uploaded.forEach(url => assert.ok(url.startsWith('https://res.cloudinary.com/')));
    checks.push('The create form uploads one cover and two details and saves them with the product');
    await page.reload();
    let row = page.locator('tr.jtable-data-row').filter({ hasText: title });
    await row.getByRole('button', { name: 'Quản lý ảnh ' + title, exact: true }).waitFor();
    assert.equal(await row.locator('.product-image-cell img').getAttribute('src'), record.coverImageUrl);
    await row.getByRole('button', { name: 'Xem chi tiết ' + title, exact: true }).click();
    const detail = page.locator('.product-detail'); await detail.waitFor();
    assert.equal(await detail.locator('.product-image-grid img').count(), 3);
    await detail.locator('..').getByRole('button', { name: 'Đóng', exact: true }).click();
    checks.push('Reload and product details restore the persisted cover and gallery');
    await row.locator('.jtable-edit-command-button').click();
    await page.locator('#product-edit-title').fill(editedTitle);
    const oldCover = record.coverImageUrl, removedId = record.detailImages[0].id;
    await page.getByLabel('Gỡ ảnh chi tiết 1', { exact: true }).check();
    await page.locator('#product-edit-coverImage').setInputFiles(photo('new-cover.png'));
    await page.locator('#product-edit-detailImages').setInputFiles(photo('new-detail.png'));
    await page.screenshot({ path: path.join(reports, 'product-crud-images-edit.png'), fullPage: true });
    const edited = page.waitForResponse(response => response.url() === base + '/api/seller/products/' + productId && response.request().method() === 'PUT', { timeout: 120000 });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    const editResponse = await edited, editData = await editResponse.json();
    assert.equal(editResponse.status(), 200, JSON.stringify(editData)); record = editData.Record; remember(record);
    assert.notEqual(record.coverImageUrl, oldCover); assert.equal(record.detailImages.length, 2);
    assert.ok(!record.images.some(image => image.id === removedId));
    assert.equal(record.images.filter(image => image.imageType === 'COVER').length, 1);
    checks.push('One edit replaces the cover, removes a detail and uploads a new detail atomically');
    await page.reload();
    row = page.locator('tr.jtable-data-row').filter({ hasText: editedTitle });
    await row.getByRole('button', { name: 'Quản lý ảnh ' + editedTitle, exact: true }).waitFor();
    assert.equal(await row.locator('.product-image-cell img').getAttribute('src'), record.coverImageUrl);
    await row.locator('.jtable-edit-command-button').click();
    const unchanged = page.waitForResponse(response => response.url() === base + '/api/seller/products/' + productId && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    const unchangedResponse = await unchanged, unchangedData = await unchangedResponse.json();
    assert.equal(unchangedResponse.status(), 200, JSON.stringify(unchangedData));
    assert.equal(unchangedData.Record.coverImageUrl, record.coverImageUrl);
    assert.deepEqual(unchangedData.Record.images, record.images);
    checks.push('Editing without selecting new files preserves existing image URLs');
    const stored = await (await page.request.get(base + '/api/seller/products/' + productId)).json();
    assert.equal(stored.Record.coverImageUrl, record.coverImageUrl);
    assert.deepEqual(stored.Record.detailImages, record.detailImages);
    await page.setViewportSize({ width: 390, height: 844 });
    await row.locator('.jtable-edit-command-button').click();
    await page.locator('#product-edit-coverImage').waitFor();
    await page.screenshot({ path: path.join(reports, 'product-crud-images-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(reports, 'product-images-browser.json'), JSON.stringify({ status: 'PASS', testProductId: productId, checks, errors, uploadedUrls: uploaded }, null, 2));
    console.log(JSON.stringify({ status: 'PASS', checks, errors }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(reports, 'product-images-browser-failure.png'), fullPage: true });
    throw error;
  } finally {
    await browser.close();
    if (uploaded.length) {
      const config = cloudConfig();
      for (const url of uploaded) {
        const match = new URL(url).pathname.match(/\/image\/upload\/v\d+\/(.+)\.[a-zA-Z0-9]+$/);
        assert.ok(match && match[1].startsWith('comicworm/products/92001/' + productId + '/'));
        const publicId = match[1], timestamp = Math.floor(Date.now() / 1000);
        const signature = crypto.createHash('sha1').update('invalidate=true&public_id=' + publicId + '&timestamp=' + timestamp + config['api-secret']).digest('hex');
        const cleanup = await fetch('https://api.cloudinary.com/v1_1/' + config['cloud-name'] + '/image/destroy', {
          method: 'POST', body: new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), invalidate: 'true', api_key: config['api-key'], signature })
        });
        const result = await cleanup.json();
        assert.ok(cleanup.ok && ['ok', 'not found'].includes(result.result), 'Could not clean up a temporary test image');
      }
      console.log('Temporary Cloudinary test images cleaned up.');
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
