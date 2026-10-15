/* Admin moderation screen: list pending product posts, approve, or reject with a reason.
   All data comes from /api/admin/moderation (ADMIN only). Text is always inserted with
   textContent so seller-provided content can never inject HTML. */
(function () {
  'use strict';

  const API = '/api/admin/moderation';
  const PAGE_SIZE = 10;
  const STATUS_TITLES = { PENDING: 'Bài chờ duyệt', APPROVED: 'Bài đã duyệt', REJECTED: 'Bài đã từ chối' };
  const STATUS_LABELS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' };
  const LISTING_LABELS = { SELL: 'Bán', TRADE: 'Trao đổi', SELL_AND_TRADE: 'Bán & trao đổi' };

  const state = { status: 'PENDING', search: '', page: 0, total: 0, items: [], selectedId: null, busy: false };
  let csrf = null;
  let searchTimer = null;
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ helpers
  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach((child) => child && node.appendChild(child));
    return node;
  }

  function safeUrl(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : ''; }
  function money(value) { return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + 'đ'; }
  function when(iso) {
    if (!iso) return '';
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z'); // server stores UTC
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
  }

  function toast(message, isError) {
    const box = $('toast');
    box.textContent = message;
    box.className = 'mod-toast' + (isError ? ' error' : '');
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 4500);
  }

  async function request(path, options) {
    const opts = Object.assign({ credentials: 'include', headers: {} }, options);
    opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers);
    let response;
    try { response = await fetch(API + path, opts); }
    catch (_) { throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.'); }
    if (response.status === 401) { window.location.href = '/auth/login'; throw new Error('Phiên đăng nhập đã hết hạn.'); }
    let body = null;
    try { body = await response.json(); } catch (_) { /* no body */ }
    if (!response.ok) {
      const error = new Error((body && body.message) || (response.status === 403
        ? 'Bạn không có quyền thực hiện thao tác này hoặc phiên đã hết hạn. Hãy tải lại trang.'
        : 'Có lỗi xảy ra (' + response.status + ').'));
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function csrfHeaders(forceRefresh) {
    if (!csrf || forceRefresh) csrf = await request('/csrf');
    return { [csrf.headerName]: csrf.token };
  }

  async function post(path, payload) {
    const send = async (refresh) => request(path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, await csrfHeaders(refresh)),
      body: JSON.stringify(payload || {})
    });
    try { return await send(false); }
    catch (error) {
      if (error.status !== 403) throw error;
      return send(true); // CSRF token may have rotated (e.g. re-login): retry once with a fresh one
    }
  }

  // ------------------------------------------------------------------ list
  async function loadList(keepSelection) {
    try {
      const params = new URLSearchParams({ status: state.status, search: state.search, page: state.page, size: PAGE_SIZE });
      const data = await request('/products?' + params);
      state.items = data.items;
      state.total = data.total;
      renderCounts(data.counts);
      // Page became empty after handling the last item of a page: step back.
      if (!data.items.length && state.page > 0) { state.page -= 1; return loadList(keepSelection); }
      if (!keepSelection || !state.items.some((item) => item.id === state.selectedId)) {
        state.selectedId = state.items.length ? state.items[0].id : null;
      }
      renderList();
      renderDetail();
    } catch (error) {
      toast(error.message, true);
      $('headerStatus').textContent = 'Không tải được danh sách';
    }
  }

  function renderCounts(counts) {
    ['PENDING', 'APPROVED', 'REJECTED'].forEach((key) => { $('count' + key).textContent = counts[key] ?? 0; });
    $('navPendingBadge').textContent = counts.PENDING ?? 0;
    $('headerStatus').textContent = counts.PENDING
      ? 'Đang có ' + counts.PENDING + ' bài cần xử lý' : 'Không còn bài nào chờ duyệt';
  }

  function renderList() {
    $('listTitle').textContent = STATUS_TITLES[state.status];
    $('listCount').textContent = state.total + ' bài';
    const list = $('postList');
    list.replaceChildren();
    if (!state.items.length) {
      list.appendChild(el('div', { className: 'mod-empty', text: state.search
        ? 'Không có bài nào khớp từ khóa.' : 'Không có bài nào trong mục này.' }));
    }
    state.items.forEach((item) => {
      const cover = safeUrl(item.coverImageUrl);
      const row = el('div', { className: 'queue-item' + (item.id === state.selectedId ? ' selected' : ''), tabindex: '0', role: 'button' }, [
        cover ? el('img', { className: 'mod-thumb', src: cover, alt: '', loading: 'lazy' }) : el('div', { className: 'mod-thumb' }),
        el('div', { className: 'mod-item-main' }, [
          el('div', { className: 'mod-item-title', text: item.title }),
          el('div', { className: 'mod-item-meta', text: money(item.price) + ' • #' + item.id }),
          el('div', { className: 'mod-item-meta', text: (item.sellerName || 'Người bán') + ' • ' + when(item.createdAt) })
        ])
      ]);
      const choose = () => { state.selectedId = item.id; renderList(); renderDetail(); };
      row.addEventListener('click', choose);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
      list.appendChild(row);
    });
    renderPager();
  }

  function renderPager() {
    const pager = $('pager');
    pager.replaceChildren();
    const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
    if (pages <= 1) return;
    const prev = el('button', { type: 'button', className: 'btn btn-outline', text: '‹ Trước', disabled: state.page === 0 });
    const next = el('button', { type: 'button', className: 'btn btn-outline', text: 'Sau ›', disabled: state.page >= pages - 1 });
    prev.addEventListener('click', () => { state.page -= 1; loadList(false); });
    next.addEventListener('click', () => { state.page += 1; loadList(false); });
    pager.append(prev, el('span', { text: 'Trang ' + (state.page + 1) + '/' + pages }), next);
  }

  // ------------------------------------------------------------------ detail
  function fact(label, value) {
    if (value == null || value === '') return null;
    return el('div', {}, [el('div', { className: 'mod-fact-label', text: label }), el('div', { className: 'mod-fact-value', text: String(value) })]);
  }

  function renderDetail() {
    const panel = $('detailPanel');
    panel.replaceChildren();
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (!item) {
      panel.appendChild(el('div', { className: 'mod-empty', text: state.status === 'PENDING'
        ? 'Tuyệt vời! Không còn bài nào chờ duyệt.' : 'Chọn một bài ở danh sách bên trái để xem chi tiết.' }));
      return;
    }

    panel.appendChild(el('div', { className: 'mod-detail-head' }, [
      el('div', {}, [el('h2', { text: item.title }), el('div', { className: 'mod-price', text: money(item.price) })]),
      el('span', { className: 'mod-status ' + item.moderationStatus, text: STATUS_LABELS[item.moderationStatus] })
    ]));

    const gallery = el('div', { className: 'mod-gallery' });
    const urls = (item.imageUrls && item.imageUrls.length ? item.imageUrls : [item.coverImageUrl]).map(safeUrl).filter(Boolean);
    if (!urls.length) gallery.appendChild(el('div', { className: 'mod-item-meta', text: 'Bài đăng chưa có hình ảnh.' }));
    urls.forEach((url) => {
      const link = el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, [el('img', { src: url, alt: 'Ảnh sản phẩm', loading: 'lazy' })]);
      gallery.appendChild(link);
    });
    panel.appendChild(gallery);

    const facts = el('div', { className: 'mod-facts' }, [
      fact('Người bán', item.sellerName ? item.sellerName + (item.sellerEmail ? ' (' + item.sellerEmail + ')' : '') : null),
      fact('Thể loại', item.categoryName), fact('Tác giả', item.authorName), fact('Nhà xuất bản', item.publisherName),
      fact('Tập', item.volumeNumbers), fact('Phiên bản', item.editionType), fact('Năm xuất bản', item.publicationYear),
      fact('Độ mới', item.conditionPercent != null ? item.conditionPercent + '%' : null),
      fact('Tồn kho', item.stockQuantity != null ? item.stockQuantity + ' cuốn' : null),
      fact('Hình thức', LISTING_LABELS[item.listingType] || item.listingType),
      fact('Mong muốn trao đổi', item.tradeWishNote),
      fact('Hiển thị khi duyệt', item.isActive ? 'Bật' : 'Ẩn'),
      fact('Ngày đăng', when(item.createdAt)), fact('Cập nhật', when(item.updatedAt))
    ]);
    panel.appendChild(facts);

    panel.appendChild(el('div', { className: 'mod-fact-label', text: 'Mô tả' }));
    panel.appendChild(el('div', { className: 'mod-desc', text: item.description || '(Không có mô tả)' }));

    if (item.moderationStatus !== 'PENDING') {
      const by = item.moderatedByName ? ' bởi ' + item.moderatedByName : '';
      const text = item.moderationStatus === 'REJECTED'
        ? 'Đã từ chối' + by + (item.moderatedAt ? ' lúc ' + when(item.moderatedAt) : '') + '. Lý do: ' + (item.moderationReason || '')
        : 'Đã duyệt' + by + (item.moderatedAt ? ' lúc ' + when(item.moderatedAt) : '') + '.';
      panel.appendChild(el('div', { className: 'mod-result ' + item.moderationStatus, text }));
      return;
    }

    const reject = el('button', { type: 'button', className: 'btn btn-danger', id: 'btnReject', text: 'Từ chối' });
    const approve = el('button', { type: 'button', className: 'btn btn-approve', id: 'btnApprove', text: 'Duyệt bài' });
    reject.addEventListener('click', () => openReject(item));
    approve.addEventListener('click', () => approveItem(item, approve));
    panel.appendChild(el('div', { className: 'mod-actions' }, [reject, approve]));
  }

  // ------------------------------------------------------------------ actions
  async function approveItem(item, button) {
    if (state.busy) return;
    state.busy = true; button.disabled = true;
    try {
      await post('/products/' + item.id + '/approve');
      toast('Đã duyệt bài "' + item.title + '".');
      await loadList(false);
    } catch (error) {
      toast(error.message, true);
      if (error.status === 409) await loadList(false);
    } finally { state.busy = false; button.disabled = false; }
  }

  let rejecting = null;
  function openReject(item) {
    rejecting = item;
    $('rejectPostName').textContent = item.title + ' (#' + item.id + ')';
    $('rejectPreset').value = '';
    $('rejectReason').value = '';
    showRejectError('');
    $('rejectModal').hidden = false;
    $('rejectReason').focus();
  }
  function closeReject() { $('rejectModal').hidden = true; rejecting = null; }
  function showRejectError(message) { const box = $('rejectError'); box.textContent = message; box.hidden = !message; }

  async function confirmReject() {
    if (!rejecting || state.busy) return;
    const reason = $('rejectReason').value.trim();
    if (reason.length < 5) { showRejectError('Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự).'); return; }
    const button = $('rejectConfirm');
    state.busy = true; button.disabled = true;
    try {
      const item = rejecting;
      await post('/products/' + item.id + '/reject', { reason });
      closeReject();
      toast('Đã từ chối bài "' + item.title + '" và lưu lý do.');
      await loadList(false);
    } catch (error) {
      showRejectError(error.message);
      if (error.status === 409) { closeReject(); toast(error.message, true); await loadList(false); }
    } finally { state.busy = false; button.disabled = false; }
  }

  // ------------------------------------------------------------------ wiring
  function init() {
    document.querySelectorAll('#statusTabs .mod-tab').forEach((tab) => tab.addEventListener('click', () => {
      document.querySelectorAll('#statusTabs .mod-tab').forEach((other) => other.classList.toggle('active', other === tab));
      state.status = tab.dataset.status; state.page = 0; state.selectedId = null;
      loadList(false);
    }));
    $('searchInput').addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = event.target.value.trim(); state.page = 0; loadList(false); }, 300);
    });
    $('rejectPreset').addEventListener('change', (event) => {
      if (event.target.value) { $('rejectReason').value = event.target.value + '. '; $('rejectReason').focus(); showRejectError(''); }
    });
    $('rejectConfirm').addEventListener('click', confirmReject);
    $('rejectModal').addEventListener('click', (event) => { if (event.target.hasAttribute('data-close')) closeReject(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('rejectModal').hidden) closeReject(); });

    fetch('/api/account/me', { credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => { if (me && me.fullName) $('adminName').textContent = me.fullName; })
      .catch(() => { /* name is cosmetic */ });

    loadList(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
