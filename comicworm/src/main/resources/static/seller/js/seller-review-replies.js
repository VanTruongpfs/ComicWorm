let sellerReviewPage = 0;
let sellerReviewHasNext = false;
let sellerReviewLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
  const replyFilter = document.getElementById('sellerReplyFilter');
  if (replyFilter) {
    replyFilter.addEventListener('change', () => loadSellerReviews(0, false));
  }
  loadSellerReviews(0, false);
});

async function sellerReviewRequest(path, method = 'GET', body) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    const csrfResponse = await fetch('/api/seller/products/csrf', {
      credentials: 'include',
      cache: 'no-store'
    });
    let csrf;
    try {
      csrf = await csrfResponse.json();
    } catch (_) {
      throw new Error('Không lấy được mã bảo mật. Vui lòng tải lại trang.');
    }
    if (!csrfResponse.ok || !csrf.headerName || !csrf.token) {
      throw new Error('Không lấy được mã bảo mật. Vui lòng tải lại trang.');
    }
    headers[csrf.headerName] = csrf.token;
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api/seller/reviews${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (response.status === 204) return null;

  let result = {};
  try {
    result = await response.json();
  } catch (_) {
    if (response.ok) throw new Error('Máy chủ chưa trả dữ liệu đánh giá hợp lệ.');
  }
  if (!response.ok) {
    throw new Error(result.message || result.detail || 'Không thực hiện được thao tác đánh giá.');
  }
  return result;
}

async function loadSellerReviews(page, append) {
  const container = document.getElementById('reviewsListContainer');
  if (!container) return;
  const filter = document.getElementById('sellerReplyFilter')?.value || 'all';
  const query = new URLSearchParams({ replied: filter, page: String(page), size: '20' });

  try {
    const result = await sellerReviewRequest(`?${query}`);
    const reviews = result.items || [];
    if (!append) container.replaceChildren();
    reviews.forEach(review => container.appendChild(createSellerReviewCard(review)));

    sellerReviewPage = page;
    sellerReviewHasNext = Boolean(result.hasNext);
    sellerReviewLoaded = true;

    const loadMoreButton = document.getElementById('loadMoreReviewsBtn');
    if (loadMoreButton) loadMoreButton.hidden = !sellerReviewHasNext;
    const countBadge = document.getElementById('reviewMatchCountBadge');
    if (countBadge) {
      countBadge.textContent = `Hiển thị: ${container.querySelectorAll('.review-card').length} / ${result.totalElements} đánh giá`;
    }
    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
      paginationInfo.textContent = `Đã tải ${container.querySelectorAll('.review-card').length} trên tổng số ${result.totalElements} đánh giá`;
    }

    if (reviews.length === 0 && !append) {
      const emptyState = document.createElement('p');
      emptyState.className = 'review-content-text';
      emptyState.textContent = 'Chưa có đánh giá phù hợp.';
      container.appendChild(emptyState);
    }
    if (typeof initCommentTextClamping === 'function') initCommentTextClamping();
    if (typeof filterReviewsCombined === 'function') filterReviewsCombined();
  } catch (error) {
    showSellerReviewMessage(error.message, 'error');
  }
}

function createSellerReviewCard(review) {
  const card = document.createElement('article');
  card.className = 'review-card';
  card.dataset.reviewId = String(review.reviewId);
  card.dataset.stars = String(review.rating || 0);
  card.dataset.book = review.productTitle || '';
  card.dataset.date = review.createdAt || '';
  card.dataset.replied = String(Boolean(review.reply));

  const header = document.createElement('div');
  header.className = 'review-card-header';
  const profile = document.createElement('div');
  profile.className = 'reviewer-profile';
  const info = document.createElement('div');
  info.className = 'reviewer-info';
  const buyerName = document.createElement('h4');
  buyerName.textContent = review.buyerName || 'Người mua';
  const meta = document.createElement('div');
  meta.className = 'meta-time';
  meta.textContent = `${formatReviewDate(review.createdAt)} • Đơn hàng ${review.orderCode || ''}`;
  info.append(buyerName, meta);
  profile.appendChild(info);
  header.appendChild(profile);
  card.appendChild(header);

  const stars = document.createElement('div');
  stars.className = 'review-stars';
  for (let index = 0; index < Number(review.rating || 0); index++) {
    const star = document.createElement('span');
    star.className = 'material-symbols-outlined fill';
    star.textContent = 'star';
    stars.appendChild(star);
  }
  card.appendChild(stars);

  const product = document.createElement('div');
  product.className = 'review-product-attached';
  product.textContent = review.productTitle || '';
  card.appendChild(product);

  const content = document.createElement('p');
  content.className = 'review-content-text';
  content.textContent = review.content || '';
  card.appendChild(content);

  if (review.reply) card.appendChild(createReplyBox(review.reply));
  card.appendChild(createReplyActions(review));
  return card;
}

function createReplyBox(reply) {
  const box = document.createElement('div');
  box.className = 'shop-reply-box';
  const header = document.createElement('div');
  header.className = 'shop-reply-header';
  const author = document.createElement('div');
  author.className = 'shop-reply-author';
  author.textContent = 'Phản hồi từ cửa hàng';
  const time = document.createElement('span');
  time.className = 'shop-reply-time';
  time.textContent = formatReviewDate(reply.updatedAt || reply.createdAt);
  header.append(author, time);
  const content = document.createElement('p');
  content.className = 'shop-reply-text';
  content.textContent = reply.content || '';
  box.append(header, content);
  return box;
}

function createReplyActions(review) {
  const actions = document.createElement('div');
  actions.className = 'review-reply-actions';
  if (review.reply) {
    actions.appendChild(makeReplyButton('Sửa phản hồi', () => openReplyForm(review, true)));
    actions.appendChild(makeReplyButton('Xóa phản hồi', () => deleteReviewReply(review)));
  } else {
    actions.appendChild(makeReplyButton('Trả lời', () => openReplyForm(review, false)));
  }
  return actions;
}

function makeReplyButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-outline btn-sm';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function openReplyForm(review, editing) {
  const card = Array.from(document.querySelectorAll('.review-card'))
    .find(candidate => candidate.dataset.reviewId === String(review.reviewId));
  if (!card) return;
  card.querySelector('.inline-reply-container')?.remove();

  const form = document.createElement('div');
  form.className = 'inline-reply-container open';
  const heading = document.createElement('div');
  heading.textContent = editing ? 'Sửa phản hồi' : 'Viết phản hồi công khai';
  const textarea = document.createElement('textarea');
  textarea.className = 'inline-reply-textarea';
  textarea.maxLength = 1000;
  textarea.placeholder = 'Nhập phản hồi (tối đa 1000 ký tự)';
  textarea.value = editing ? review.reply.content : '';
  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'flex-end';
  buttons.style.gap = '8px';
  const cancel = makeReplyButton('Hủy', () => form.remove());
  const submit = makeReplyButton(editing ? 'Lưu thay đổi' : 'Gửi phản hồi', async () => {
    const content = textarea.value.trim();
    if (!content) {
      showSellerReviewMessage('Nội dung phản hồi không được để trống.', 'warning');
      return;
    }
    try {
      await sellerReviewRequest(`/${encodeURIComponent(review.reviewId)}/reply`, editing ? 'PUT' : 'POST', { content });
      showSellerReviewMessage(editing ? 'Đã cập nhật phản hồi.' : 'Đã gửi phản hồi.', 'success');
      await loadSellerReviews(0, false);
    } catch (error) {
      showSellerReviewMessage(error.message, 'error');
    }
  });
  buttons.append(cancel, submit);
  form.append(heading, textarea, buttons);
  card.appendChild(form);
  textarea.focus();
}

async function deleteReviewReply(review) {
  if (!window.confirm('Bạn có chắc muốn xóa phản hồi này?')) return;
  try {
    await sellerReviewRequest(`/${encodeURIComponent(review.reviewId)}/reply`, 'DELETE');
    showSellerReviewMessage('Đã xóa phản hồi.', 'success');
    await loadSellerReviews(0, false);
  } catch (error) {
    showSellerReviewMessage(error.message, 'error');
  }
}

function toggleReplyForm(button) {
  const card = button.closest('.review-card');
  const reviewId = Number(card?.dataset.reviewId);
  if (!reviewId) return;
  openReplyForm({ reviewId, reply: null }, false);
}

async function submitOptimisticReply(button) {
  const card = button.closest('.review-card');
  const textarea = card?.querySelector('.inline-reply-textarea');
  const reviewId = Number(card?.dataset.reviewId);
  if (!reviewId || !textarea) return;
  try {
    await sellerReviewRequest(`/${encodeURIComponent(reviewId)}/reply`, 'POST', { content: textarea.value });
    showSellerReviewMessage('Đã gửi phản hồi.', 'success');
    await loadSellerReviews(0, false);
  } catch (error) {
    showSellerReviewMessage(error.message, 'error');
  }
}

async function loadMoreReviews(button) {
  if (!button || !sellerReviewLoaded || !sellerReviewHasNext) return;
  button.disabled = true;
  try {
    await loadSellerReviews(sellerReviewPage + 1, true);
  } finally {
    button.disabled = false;
  }
}

function formatReviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN');
}

function showSellerReviewMessage(message, type) {
  if (typeof showToast === 'function') {
    showToast(message, type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error');
  } else {
    console.error(message);
  }
}
