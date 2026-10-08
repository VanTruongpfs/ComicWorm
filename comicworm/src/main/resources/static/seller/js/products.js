(function ($) {
  'use strict';
  const api = window.BookMoochProductsApi;
  const table = $('#sellerProductsTable');
  const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  let metadata, stock = 'all', searchTimer;
  const forms = {};
  const text = value => $('<span>').text(value ?? '—');
  function error(message) { $('#productsError').text(message || '').prop('hidden', !message); }
  function failed(reason) {
    error(reason.message);
    if (reason.loginRequired) window.location.assign(window.BookMoochAccountApi.loginUrl());
    if (reason.sellerRequired) window.location.assign(window.BookMoochAccountApi.upgradeUrl());
    return { Result: 'ERROR', Message: reason.message };
  }
  function action(work) {
    const deferred = $.Deferred();
    work().then(result => { error(''); deferred.resolve(result); }, reason => deferred.resolve(failed(reason)));
    return deferred.promise();
  }
  function summary(data) {
    if (!data) return;
    $('#statTotalSku').text(data.productCount); $('#statTotalStock').text(data.stockQuantity);
    $('#statLowStock').text(data.lowStockCount); $('#statOutOfStock').text(data.outOfStockCount);
    $('#statInventoryValue').text(money(data.inventoryValue));
    $('#productsStatus').text(`${data.productCount} sản phẩm trong gian hàng của bạn.`);
  }
  function label(name, value) { return metadata[name].find(item => String(item.Value) === String(value))?.DisplayText || 'Chưa chọn'; }
  function input(name, attributes = {}, fallback = '') {
    return data => $('<input>').attr({ name, type: 'text', ...attributes }).val(data.value ?? fallback);
  }
  function textarea(name, required = false) { return data => $('<textarea>').attr({ name, rows: 3, maxlength: 10000, required }).val(data.value || ''); }
  function imageInput(name) {
    return data => {
      const cover = name === 'coverImage', container = $('<div>').addClass('product-form-images');
      const existing = (data.record?.images || []).filter(image => image.imageType === (cover ? 'COVER' : 'DETAIL'));
      const grid = $('<div>').addClass('product-image-grid product-existing-images').appendTo(container);
      if (existing.length) gallery(existing, grid);
      if (!cover) existing.forEach((image, index) => {
        const item = grid.children().eq(index);
        const checkbox = $('<input type="checkbox">').attr({ name: 'removeImageIds', value: image.id });
        $('<label>').addClass('product-remove-image').append(checkbox, document.createTextNode('Gỡ ảnh chi tiết ' + (index + 1))).appendTo(item);
        checkbox.on('change', () => item.toggleClass('product-image-removed', checkbox.prop('checked')));
      });
      $('<input>').attr({ type: 'file', name, accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: !cover,
        required: cover && !data.record?.coverImageUrl }).appendTo(container);
      $('<p>').addClass('product-image-help').text(cover ? (existing.length ? 'Chọn ảnh mới để thay ảnh bìa hiện tại.' : 'Chọn 1 ảnh bìa sản phẩm.') : 'Chọn thêm tối đa 7 ảnh chi tiết. Tích “Gỡ” để bỏ ảnh cũ khi bấm Lưu.').appendTo(container);
      $('<div>').addClass('product-image-grid product-selected-images').appendTo(container);
      return container;
    };
  }
  function saveProduct(data, formType) {
    return action(async () => {
      const form = forms[formType];
      form.data('savingImages', true).attr('aria-busy', 'true');
      form.find('.product-form-upload-status').text('Đang tải ảnh lên Cloudinary và lưu sản phẩm…');
      try { return await (formType === 'create' ? api.create(data, form[0]) : api.update(data, form[0])); }
      finally { form.data('savingImages', false).attr('aria-busy', 'false'); form.find('.product-form-upload-status').text(''); }
    });
  }
  function select(name, entries, optional = false, fallback = '') {
    return data => {
      const control = $('<select>').attr({ name, required: !optional });
      if (optional) control.append($('<option>').val('').text('Chưa chọn'));
      entries.forEach(item => control.append($('<option>').val(item.Value).text(item.DisplayText)));
      return control.val(String(data.value ?? fallback));
    };
  }
  function badge(value, style) { return $('<span>').addClass('product-status ' + style).text(value); }
  function filters() { return { search: $('#productSearchInput').val().trim(), categoryId: $('#productCategoryFilter').val(), stock }; }
  function load() { table.jtable('load', filters()); }
  function changed(message) { window.showToast?.(message, 'success'); table.jtable('reload'); }
  function gallery(records, container, remove) {
    container.empty();
    if (!records.length) { $('<p>').addClass('product-image-empty').text('Sản phẩm chưa có ảnh.').appendTo(container); return; }
    records.forEach((image, index) => {
      const item = $('<figure>').addClass('product-image-item').appendTo(container);
      $('<img>').attr({ src: image.imageUrl, alt: 'Ảnh sản phẩm ' + (index + 1), loading: 'lazy' }).appendTo(item);
      $('<figcaption>').text(image.imageType === 'COVER' ? 'Ảnh bìa' : 'Ảnh chi tiết ' + (index + 1)).appendTo(item);
      $('<a>').attr({ href: image.imageUrl, target: '_blank', rel: 'noopener noreferrer', title: image.imageUrl })
        .addClass('product-image-link').text('Xem ảnh trên Cloudinary').appendTo(item);
      if (remove) $('<button type="button">').addClass('product-detail-button').text('Gỡ ảnh')
        .attr('aria-label', 'Gỡ ảnh ' + (index + 1)).on('click', () => remove(image)).appendTo(item);
    });
  }
  async function manageImages(id, title) {
    clearTimeout(searchTimer);
    const content = $('<div>').addClass('product-image-manager');
    $('<h3>').text(title).appendTo(content);
    const status = $('<p>').attr({ role: 'status', 'aria-live': 'polite' }).appendTo(content);
    const alert = $('<p>').addClass('product-image-error').attr('role', 'alert').prop('hidden', true).appendTo(content);
    const grid = $('<div>').addClass('product-image-grid').appendTo(content);
    const form = $('<form>').addClass('product-image-form').appendTo(content);
    const inputId = 'product-image-files-' + id;
    $('<label>').attr('for', inputId).text('Chọn ảnh sản phẩm').appendTo(form);
    const files = $('<input>').attr({ id: inputId, type: 'file', name: 'files', accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: true }).appendTo(form);
    $('<p>').addClass('product-form-note').text('Tối đa 8 ảnh mỗi sản phẩm, 5 MB mỗi ảnh. Nhận JPG, PNG, WEBP và GIF. Ảnh đầu tiên là ảnh bìa.').appendTo(form);
    const selected = $('<div>').addClass('product-image-grid product-image-preview').appendTo(form);
    const upload = $('<button type="submit">').addClass('product-detail-button').text('Tải ảnh lên Cloudinary').appendTo(form);
    let busy = false, current = null, previews = [];
    const clearPreviews = () => { previews.forEach(url => URL.revokeObjectURL(url)); previews = []; selected.empty(); };
    const showError = message => alert.text(message || '').prop('hidden', !message);
    function setBusy(value) {
      busy = value;
      content.attr('aria-busy', String(value));
      content.find('input,button').prop('disabled', value);
      upload.prop('disabled', value || !current?.UploadConfigured || !files[0].files.length);
      content.dialog('option', 'position', { my: 'center', at: 'center', of: window });
    }
    function render(data) {
      current = data;
      status.text(`${data.Records.length}/${data.MaxImages} ảnh đã lưu.`);
      gallery(data.Records, grid, async image => {
        if (busy || !window.confirm('Gỡ ảnh này khỏi sản phẩm?')) return;
        showError(''); setBusy(true); status.text('Đang gỡ ảnh…');
        try { render(await api.removeImage(id, image.id)); changed('Đã gỡ ảnh khỏi sản phẩm.'); }
        catch (reason) { showError(reason.message); status.text('Chưa gỡ được ảnh. Bạn có thể thử lại.'); if (reason.loginRequired || reason.sellerRequired) failed(reason); }
        finally { setBusy(false); }
      });
      if (!data.UploadConfigured) showError('Máy chủ chưa cấu hình Cloudinary. Vui lòng bổ sung thông tin kết nối.');
      setBusy(false);
    }
    content.dialog({ title: 'Ảnh sản phẩm', modal: true, width: Math.min(740, window.innerWidth - 32), maxHeight: window.innerHeight - 48,
      buttons: { 'Đóng': function () { $(this).dialog('close'); } }, beforeClose: () => !busy,
      close: function () { clearPreviews(); $(this).dialog('destroy').remove(); } });
    files.on('change', () => {
      clearPreviews(); showError('');
      const chosen = Array.from(files[0].files);
      if (chosen.length + (current?.Records.length || 0) > (current?.MaxImages || 8)) { showError('Tổng số ảnh của sản phẩm không được vượt quá 8.'); upload.prop('disabled', true); return; }
      for (const file of chosen) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
          showError('Vui lòng chọn ảnh JPG, PNG, WEBP hoặc GIF không rỗng và tối đa 5 MB.'); upload.prop('disabled', true); clearPreviews(); return;
        }
        const url = URL.createObjectURL(file); previews.push(url);
        const item = $('<figure>').addClass('product-image-item').appendTo(selected);
        $('<img>').attr({ src: url, alt: file.name }).appendTo(item);
        $('<figcaption>').text(file.name).appendTo(item);
      }
      setBusy(false);
    });
    form.on('submit', async event => {
      event.preventDefault();
      if (busy || upload.prop('disabled')) return;
      showError(''); setBusy(true); status.text('Đang tải ảnh lên Cloudinary và lưu vào database…');
      try {
        const data = await api.uploadImages(id, files[0].files);
        files.val(''); clearPreviews(); render(data); changed('Đã tải ảnh và lưu link vào database.');
      } catch (reason) { showError(reason.message); status.text('Ảnh chưa được lưu. Bạn có thể thử lại.'); if (reason.loginRequired || reason.sellerRequired) failed(reason); }
      finally { setBusy(false); }
    });
    status.text('Đang tải ảnh sản phẩm…'); setBusy(true);
    try { render(await api.images(id)); }
    catch (reason) { showError(reason.message); if (reason.loginRequired || reason.sellerRequired) failed(reason); }
    finally { setBusy(false); }
  }
  async function details(id) {
    clearTimeout(searchTimer);
    try {
      const result = await api.detail(id), product = result.Record;
      const content = $('<div>').addClass('product-detail');
      $('<h3>').text(product.title).appendTo(content);
      gallery(product.images || [], $('<div>').addClass('product-image-grid').appendTo(content));
      $('<p>').addClass('product-description').text(product.description).appendTo(content);
      const definition = $('<dl>').appendTo(content);
      const timestamp = value => value ? new Date(value + (/[Z]|[+-]\d{2}:\d{2}$/.test(value) ? '' : 'Z')).toLocaleString('vi-VN') : '—';
      const values = [
        ['Mã sản phẩm', product.id], ['Thể loại', label('categories', product.categoryId)],
        ['Tác giả', label('authors', product.authorId)], ['Nhà xuất bản', label('publishers', product.publisherId)],
        ['Số tập', product.volumeNumbers], ['Phiên bản', product.editionType], ['Năm xuất bản', product.publicationYear],
        ['Độ mới', `${product.conditionPercent}%`], ['Giá bán', money(product.price)], ['Tồn kho', `${product.stockQuantity} cuốn`],
        ['Mong muốn trao đổi', product.tradeWishNote], ['Ngày tạo', timestamp(product.createdAt)], ['Cập nhật', timestamp(product.updatedAt)]
      ];
      values.forEach(([name, value]) => { $('<dt>').text(name).appendTo(definition); $('<dd>').text(value ?? '—').appendTo(definition); });
      content.dialog({ title: 'Chi tiết sản phẩm', modal: true, width: Math.min(620, window.innerWidth - 32),
        maxHeight: window.innerHeight - 48, buttons: { 'Đóng': function () { $(this).dialog('close'); } },
        close: function () { $(this).dialog('destroy').remove(); } });
    } catch (reason) { failed(reason); }
  }
  async function init() {
    try {
      metadata = await api.options();
      if (!metadata.categories.length) throw new Error('Chưa có thể loại truyện. Vui lòng bổ sung danh mục trước khi thêm sản phẩm.');
      metadata.categories.forEach(item => $('#productCategoryFilter').append($('<option>').val(item.Value).text(item.DisplayText)));
      const listing = [{ Value: 'SELL', DisplayText: 'Bán' }, { Value: 'TRADE', DisplayText: 'Trao đổi' }, { Value: 'SELL_AND_TRADE', DisplayText: 'Bán và trao đổi' }];
      table.jtable({
        title: 'Sản phẩm của gian hàng', paging: true, pageSize: 10, pageSizes: [10, 25, 50],
        sorting: true, multiSorting: false, defaultSorting: 'id DESC', saveUserPreferences: false,
        columnSelectable: false, columnResizable: false, animationsEnabled: false,
        dialogShowEffect: false, dialogHideEffect: false,
        messages: { addNewRecord: 'Thêm sản phẩm', editRecord: 'Sửa sản phẩm', deleteConfirmation: 'Xóa sản phẩm khỏi gian hàng? Lịch sử đơn hàng vẫn được giữ.',
          noDataAvailable: 'Chưa có sản phẩm phù hợp. Chọn “Thêm sản phẩm” để bắt đầu.', deleteText: 'Xóa sản phẩm' },
        actions: {
          listAction: (data, params) => action(async () => { const result = await api.list(data, params); summary(result.Summary); return result; }),
          createAction: data => saveProduct(data, 'create'), updateAction: data => saveProduct(data, 'edit'),
          deleteAction: data => action(() => api.remove(data))
        },
        fields: {
          id: { title: 'Mã', key: true, create: false, edit: false, width: '5%' },
          images: { title: 'Ảnh', sorting: false, create: false, edit: false, width: '10%', display: data => {
            const content = $('<div>').addClass('product-image-cell'), photos = data.record.images || [];
            if (data.record.coverImageUrl) $('<img>').attr({ src: data.record.coverImageUrl, alt: 'Ảnh bìa ' + data.record.title, loading: 'lazy' }).appendTo(content);
            $('<button type="button">').addClass('product-detail-button').text('Ảnh (' + photos.length + ')')
              .attr('aria-label', 'Quản lý ảnh ' + data.record.title).on('click', () => manageImages(data.record.id, data.record.title)).appendTo(content);
            return content;
          } },
          title: { title: 'Tên sản phẩm *', width: '25%', display: data => $('<strong>').text(data.record.title), input: input('title', { required: true, maxlength: 255 }) },
          description: { title: 'Mô tả *', list: false, input: textarea('description', true) },
          coverImage: { title: 'Ảnh bìa sản phẩm *', list: false, input: imageInput('coverImage') },
          detailImages: { title: 'Ảnh chi tiết sản phẩm', list: false, input: imageInput('detailImages') },
          categoryId: { title: 'Thể loại *', width: '12%', sorting: false, display: data => text(label('categories', data.record.categoryId)), input: select('categoryId', metadata.categories, false, metadata.categories[0].Value) },
          authorId: { title: 'Tác giả', list: false, input: select('authorId', metadata.authors, true) },
          publisherId: { title: 'Nhà xuất bản', list: false, input: select('publisherId', metadata.publishers, true) },
          volumeNumbers: { title: 'Số tập', list: false, input: input('volumeNumbers', { maxlength: 100, placeholder: 'Ví dụ: Tập 1–5' }) },
          editionType: { title: 'Phiên bản', list: false, input: input('editionType', { maxlength: 50, placeholder: 'Ví dụ: Bìa mềm' }) },
          publicationYear: { title: 'Năm xuất bản', list: false, input: input('publicationYear', { type: 'number', min: 1000, max: 9999, step: 1 }) },
          conditionPercent: { title: 'Độ mới (%) *', width: '8%', display: data => text(data.record.conditionPercent + '%'), input: input('conditionPercent', { type: 'number', required: true, min: 0, max: 100, step: 1 }, 100) },
          price: { title: 'Giá bán (₫) *', width: '12%', display: data => text(money(data.record.price)), input: input('price', { type: 'number', required: true, min: 0, max: '9999999999999.99', step: '0.01' }) },
          stockQuantity: { title: 'Tồn kho *', width: '8%', display: data => badge(`${data.record.stockQuantity} cuốn`, data.record.stockQuantity === 0 ? 'empty' : data.record.stockQuantity < 3 ? 'low' : 'available'), input: input('stockQuantity', { type: 'number', required: true, min: 0, max: 2147483647, step: 1 }, 1) },
          listingType: { title: 'Hình thức *', list: false, input: select('listingType', listing, false, 'SELL') },
          tradeWishNote: { title: 'Mong muốn trao đổi', list: false, input: textarea('tradeWishNote') },
          isActive: { title: 'Hiển thị', width: '8%', display: data => badge(data.record.isActive ? 'Bật' : 'Ẩn', data.record.isActive ? 'available' : 'muted'), input: select('isActive', [{ Value: 'true', DisplayText: 'Bật hiển thị' }, { Value: 'false', DisplayText: 'Ẩn sản phẩm' }], false, 'true') },
          moderationStatus: { title: 'Kiểm duyệt', width: '10%', create: false, edit: false, display: data => badge(({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' })[data.record.moderationStatus], data.record.moderationStatus === 'APPROVED' ? 'available' : 'low') },
          detail: { title: 'Chi tiết', width: '7%', sorting: false, create: false, edit: false, display: data => $('<button type="button">').addClass('product-detail-button').attr('aria-label', 'Xem chi tiết ' + data.record.title).text('Xem').on('click', () => details(data.record.id)) }
        },
        formCreated: (_, data) => {
          clearTimeout(searchTimer);
          forms[data.formType] = data.form;
          data.form.data('existingImages', data.record?.images || []).data('previewUrls', []);
          data.form.attr('novalidate', 'novalidate');
          data.form.find('input,select,textarea').each(function () {
            const control = $(this), name = control.attr('name');
            if (['hidden', 'checkbox'].includes(control.attr('type'))) return;
            const id = 'product-' + data.formType + '-' + name;
            control.attr('id', id);
            const label = control.closest('.jtable-input-field-container').find('.jtable-input-label');
            label.replaceWith($('<label>').addClass('jtable-input-label').attr('for', id).text(label.text()));
          });
          data.form.closest('.ui-dialog-content').dialog('option', { width: Math.min(720, window.innerWidth - 32), maxHeight: window.innerHeight - 48 });
          data.form.closest('.ui-dialog-content').dialog('option', 'beforeClose', () => !data.form.data('savingImages'));
          $('<p>').addClass('product-form-note').text('Chọn ảnh bìa và ảnh chi tiết ngay trong form. Bấm Lưu để tải ảnh lên Cloudinary và lưu sản phẩm. Mỗi ảnh tối đa 5 MB, tổng tối đa 8 ảnh.').prependTo(data.form);
          $('<p>').addClass('product-form-upload-status').attr({ role: 'status', 'aria-live': 'polite' }).appendTo(data.form);
          data.form.find('input[type="file"]').on('change', function () {
            this.setCustomValidity('');
            const preview = $(this).siblings('.product-selected-images').empty(), urls = data.form.data('previewUrls');
            Array.from(this.files).forEach(file => {
              const url = URL.createObjectURL(file); urls.push(url);
              const item = $('<figure>').addClass('product-image-item').appendTo(preview);
              $('<img>').attr({ src: url, alt: file.name }).appendTo(item); $('<figcaption>').text(file.name).appendTo(item);
            });
            data.form.closest('.ui-dialog-content').dialog('option', 'position', { my: 'center', at: 'center', of: window });
          });
        },
        formSubmitting: (_, data) => {
          const form = data.form[0], cover = form.querySelector('input[name="coverImage"]'), detail = form.querySelector('input[name="detailImages"]');
          cover.setCustomValidity(''); detail.setCustomValidity('');
          const chosen = [...cover.files, ...detail.files];
          for (const file of chosen) {
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
              (Array.from(cover.files).includes(file) ? cover : detail).setCustomValidity('Chọn ảnh JPG, PNG, WEBP hoặc GIF tối đa 5 MB.');
            }
          }
          const removed = new Set(Array.from(form.querySelectorAll('input[name="removeImageIds"]:checked')).map(input => Number(input.value)));
          const retainedDetails = (data.form.data('existingImages') || []).filter(image => image.imageType === 'DETAIL' && !removed.has(image.id)).length;
          if (retainedDetails + detail.files.length > 7) detail.setCustomValidity('Mỗi sản phẩm có tối đa 7 ảnh chi tiết. Hãy gỡ bớt ảnh cũ.');
          return form.reportValidity();
        },
        formClosed: (_, data) => { (data.form.data('previewUrls') || []).forEach(url => URL.revokeObjectURL(url)); delete forms[data.formType]; },
        recordAdded: () => changed('Đã thêm sản phẩm và lưu ảnh.'),
        recordUpdated: () => changed('Đã lưu thay đổi sản phẩm.'), recordDeleted: () => changed('Đã xóa sản phẩm khỏi gian hàng.')
      });
      $('#addProductButton').prop('disabled', false).on('click', () => table.jtable('showCreateForm'));
      $('#refreshProductButton').on('click', () => table.jtable('reload'));
      $('#productFilterForm').on('submit', event => { event.preventDefault(); clearTimeout(searchTimer); load(); });
      $('#productCategoryFilter').on('change', load);
      $('#productSearchInput').on('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
      $('[data-stock-filter]').on('click', function () { stock = this.dataset.stockFilter; $('[data-stock-filter]').removeClass('active'); $(this).addClass('active'); load(); });
      load();
    } catch (reason) { failed(reason); $('#productsStatus').text('Chưa tải được danh sách sản phẩm.'); }
  }
  $(init);
})(jQuery);
