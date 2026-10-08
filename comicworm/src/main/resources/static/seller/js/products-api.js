/* jTable adapters use the existing JWT session; ownership is enforced on the server. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookMoochProductsApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const base = () => root.BookMoochAccountApi?.baseUrl() || '';
  async function request(path, method = 'GET', body, fetcher = root.fetch.bind(root)) {
    const headers = { Accept: 'application/json' };
    const multipart = typeof root.FormData === 'function' && body instanceof root.FormData;
    if (method !== 'GET') {
      const token = await request('/csrf');
      headers[token.headerName] = token.token;
      if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetcher(base() + '/api/seller/products' + path, {
        method, headers, credentials: 'include', cache: 'no-store',
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) })
      });
    } catch (_) { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.'); }
    if (response.status === 413) throw new Error('Mỗi ảnh tối đa 5 MB, tối đa 8 ảnh mỗi sản phẩm.');
    if (response.status === 401) { const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); error.loginRequired = true; throw error; }
    if (response.status === 403) {
      const error = new Error(method === 'GET' ? 'Bạn cần nâng cấp lên Người bán.' : 'Không có quyền thực hiện thao tác. Vui lòng tải lại trang và kiểm tra tài khoản.');
      error.sellerRequired = method === 'GET'; throw error;
    }
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Máy chủ chưa trả dữ liệu sản phẩm hợp lệ.'); }
    if (!response.ok || data.Result !== 'OK') throw new Error(data.Message || 'Chưa thực hiện được thao tác sản phẩm.');
    return data;
  }
  function payload(serialized) {
    const fields = typeof serialized === 'string' ? Object.fromEntries(new URLSearchParams(serialized)) : serialized;
    const integer = name => fields[name] == null || fields[name] === '' ? null : Number(fields[name]);
    return {
      title: fields.title?.trim(), description: fields.description?.trim(),
      categoryId: integer('categoryId'), authorId: integer('authorId'), publisherId: integer('publisherId'),
      volumeNumbers: fields.volumeNumbers || null, editionType: fields.editionType || null,
      publicationYear: integer('publicationYear'), conditionPercent: integer('conditionPercent'),
      price: fields.price == null || fields.price === '' ? null : String(fields.price), stockQuantity: integer('stockQuantity'),
      listingType: fields.listingType, tradeWishNote: fields.tradeWishNote || null,
      isActive: fields.isActive === true || fields.isActive === 'true'
    };
  }
  function listQuery(filters, paging) {
    const values = { jtStartIndex: 0, jtPageSize: 10, jtSorting: 'id DESC', ...paging,
      search: filters?.search || '', stock: filters?.stock || 'all' };
    if (filters?.categoryId) values.categoryId = filters.categoryId;
    return '?' + new URLSearchParams(values);
  }
  function productBody(data, form) {
    if (!form) return payload(data);
    const body = new root.FormData();
    body.append('product', new root.Blob([JSON.stringify(payload(data))], { type: 'application/json' }));
    const cover = form.querySelector('input[name="coverImage"]')?.files[0];
    if (cover) body.append('coverImage', cover);
    Array.from(form.querySelector('input[name="detailImages"]')?.files || []).forEach(file => body.append('detailImages', file));
    const removed = Array.from(form.querySelectorAll('input[name="removeImageIds"]:checked')).map(input => Number(input.value));
    if (removed.length) body.append('removeImageIds', new root.Blob([JSON.stringify(removed)], { type: 'application/json' }));
    return body;
  }
  return { request, payload, listQuery,
    list: (filters, paging) => request(listQuery(filters, paging)),
    options: () => request('/options'), detail: id => request('/' + encodeURIComponent(id)),
    create: (data, form) => request('', 'POST', productBody(data, form)),
    update: (data, form) => { const fields = Object.fromEntries(new URLSearchParams(data)); return request('/' + encodeURIComponent(fields.id), 'PUT', productBody(fields, form)); },
    remove: data => request('/' + encodeURIComponent(data.id), 'DELETE'),
    images: id => request('/' + encodeURIComponent(id) + '/images'),
    uploadImages: (id, files) => {
      const body = new root.FormData();
      Array.from(files).forEach(file => body.append('files', file));
      return request('/' + encodeURIComponent(id) + '/images', 'POST', body);
    },
    removeImage: (id, imageId) => request('/' + encodeURIComponent(id) + '/images/' + encodeURIComponent(imageId), 'DELETE')
  };
});
