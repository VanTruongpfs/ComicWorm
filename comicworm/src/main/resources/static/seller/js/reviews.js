/**
 * ComicHub / BookMooch - Quản lý đánh giá (Reviews Logic)
 * Phục vụ cho: index.html#view-reviews & reviews.html
 * 
 * Các tính năng nâng cao:
 * 1. Đa tiêu chí lọc kết hợp (Multi-criteria combined filter):
 *    - Lọc theo số sao: Tất cả, 5 sao, 4 sao, 3 sao, 2 sao, 1 sao, Có ảnh, Chưa phản hồi
 *    - Lọc theo tựa sách / truyện: One Piece, Dragon Ball, Jujutsu Kaisen, Spy x Family, Conan, Doraemon, v.v.
 *    - Lọc theo thời gian / ngày: Hôm nay, 7 ngày qua, 30 ngày qua, Tháng này, Tháng trước
 *    - Tìm kiếm tức thời theo từ khóa: Tên độc giả, mã đơn hàng, nội dung review
 * 2. Cập nhật số lượng kết quả đếm tức thời (Match count badge)
 * 3. Trạng thái trống (Empty state) thân thiện khi không có kết quả phù hợp + Nút Đặt lại bộ lọc
 * 4. Rating progress bar chạy animation mượt mà khi vào trang
 * 5. "Xem thêm / Thu gọn" cho các bình luận dài
 * 6. Optimistic UI khi gửi phản hồi đánh giá trực tiếp cho khách mua truyện
 * 7. Load more đánh giá với loading spinner
 */

let currentReviewStarFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initReviewsModule();
});

function initReviewsModule() {
  initRatingBarsAnimation();
  initReviewFilterListeners();
  initCommentTextClamping();
}

/**
 * 1. Gắn sự kiện cho các thành phần lọc đánh giá: số sao, tựa sách, ngày và tìm kiếm
 */
function initReviewFilterListeners() {
  const tabsBar = document.getElementById('starFilterTabs') || document.querySelector('.filter-tabs-bar');
  if (tabsBar) {
    tabsBar.querySelectorAll('.tab-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const starVal = btn.getAttribute('data-filter-star') || extractStarValFromText(btn.textContent);
        setReviewStarFilter(starVal, btn);
      });
    });
  }

  const bookSelect = document.getElementById('reviewBookSelect');
  if (bookSelect) {
    bookSelect.addEventListener('change', () => filterReviewsCombined());
  }

  const dateSelect = document.getElementById('reviewDateSelect');
  if (dateSelect) {
    dateSelect.addEventListener('change', () => filterReviewsCombined());
  }

  const searchInput = document.getElementById('reviewSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterReviewsCombined());
  }
}

/**
 * Trợ giúp trích xuất giá trị sao từ text nút tab nếu không có data-filter-star
 */
function extractStarValFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('5 sao') || lower.includes('5')) return '5';
  if (lower.includes('4 sao') || lower.includes('4')) return '4';
  if (lower.includes('3 sao') || lower.includes('3')) return '3';
  if (lower.includes('2 sao') || lower.includes('2')) return '2';
  if (lower.includes('1 sao') || lower.includes('1')) return '1';
  if (lower.includes('ảnh') || lower.includes('hình')) return 'with_photo';
  if (lower.includes('chưa phản hồi')) return 'unreplied';
  return 'all';
}

/**
 * 2. Chọn mức sao để lọc (hỗ trợ cả gọi trực tiếp từ onclick hoặc event listener)
 */
function setReviewStarFilter(starVal, btn) {
  currentReviewStarFilter = String(starVal);

  const tabsBars = document.querySelectorAll('#starFilterTabs, .filter-tabs-bar');
  tabsBars.forEach(bar => {
    bar.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
    if (btn && bar.contains(btn)) {
      btn.classList.add('active');
    } else {
      const matchBtn = bar.querySelector(`[data-filter-star="${starVal}"]`);
      if (matchBtn) {
        matchBtn.classList.add('active');
      } else {
        // Fallback match text
        bar.querySelectorAll('.tab-chip').forEach(b => {
          if (extractStarValFromText(b.textContent) === currentReviewStarFilter) {
            b.classList.add('active');
          }
        });
      }
    }
  });

  filterReviewsCombined();
}

/**
 * 3. Bộ lọc kết hợp 3 tiêu chuẩn cốt lõi: Số sao + Sách + Ngày + Tìm kiếm từ khóa
 */
function filterReviewsCombined() {
  const bookSelect = document.getElementById('reviewBookSelect');
  const dateSelect = document.getElementById('reviewDateSelect');
  const searchInput = document.getElementById('reviewSearchInput');
  const countBadge = document.getElementById('reviewMatchCountBadge');
  const noReviewsEl = document.getElementById('noReviewsFound');

  const selectedStar = currentReviewStarFilter;
  const selectedBook = (bookSelect ? bookSelect.value : 'all').toLowerCase().trim();
  const selectedDate = (dateSelect ? dateSelect.value : 'all').toLowerCase().trim();
  const searchKeyword = (searchInput ? searchInput.value : '').toLowerCase().trim();

  // Xác định container chứa review cards (ưu tiên view-reviews nếu đang ở SPA)
  const container = document.getElementById('reviewsListContainer') 
    || document.getElementById('view-reviews') 
    || document.querySelector('.content-body')
    || document;

  const reviewCards = container.querySelectorAll('.review-card');
  if (!reviewCards.length) return;

  let matchCount = 0;
  let animIndex = 0;

  reviewCards.forEach(card => {
    // A. Kiểm tra tiêu chí 1: Số sao đánh giá
    let starMatch = true;
    const cardStarsAttr = card.getAttribute('data-stars');
    const filledStarIcons = card.querySelectorAll('.review-stars .material-symbols-outlined.fill').length;
    const actualStars = cardStarsAttr ? parseInt(cardStarsAttr, 10) : filledStarIcons;

    const hasPhoto = card.getAttribute('data-has-photo') === 'true' 
      || card.querySelectorAll('.review-photo-gallery img').length > 0;

    const isReplied = card.getAttribute('data-replied') === 'true' 
      || (card.querySelector('.shop-reply-box') !== null && !card.querySelector('.badge-danger'));

    if (selectedStar === 'all') {
      starMatch = true;
    } else if (['1', '2', '3', '4', '5'].includes(selectedStar)) {
      starMatch = (actualStars === parseInt(selectedStar, 10));
    } else if (selectedStar === 'with_photo') {
      starMatch = hasPhoto;
    } else if (selectedStar === 'unreplied') {
      starMatch = !isReplied;
    }

    // B. Kiểm tra tiêu chí 2: Lọc theo tựa sách / truyện
    let bookMatch = true;
    if (selectedBook !== 'all') {
      const cardBook = (card.getAttribute('data-book') || '').toLowerCase();
      const productAttached = (card.querySelector('.review-product-attached')?.textContent || '').toLowerCase();
      bookMatch = cardBook.includes(selectedBook) || productAttached.includes(selectedBook);
    }

    // C. Kiểm tra tiêu chí 3: Lọc theo thời gian / ngày
    let dateMatch = true;
    if (selectedDate !== 'all') {
      const cardDate = card.getAttribute('data-date') || '';
      dateMatch = evaluateReviewDateMatch(cardDate, selectedDate);
    }

    // D. Kiểm tra tiêu chí 4: Tìm kiếm theo từ khóa độc giả, mã đơn hoặc nội dung
    let searchMatch = true;
    if (searchKeyword) {
      const reviewerName = (card.querySelector('.reviewer-info h4')?.textContent || '').toLowerCase();
      const metaInfo = (card.querySelector('.meta-time')?.textContent || '').toLowerCase();
      const contentText = (card.querySelector('.review-content-text')?.textContent || '').toLowerCase();
      const productInfo = (card.querySelector('.review-product-attached')?.textContent || '').toLowerCase();
      const shopReply = (card.querySelector('.shop-reply-text')?.textContent || '').toLowerCase();

      const combinedText = `${reviewerName} ${metaInfo} ${contentText} ${productInfo} ${shopReply}`;
      searchMatch = combinedText.includes(searchKeyword);
    }

    // Kết hợp cả 4 điều kiện
    const isMatched = starMatch && bookMatch && dateMatch && searchMatch;

    if (isMatched) {
      matchCount++;
      card.style.display = 'block';
      card.classList.remove('card-fade-out');
      card.classList.remove('card-fade-in');
      void card.offsetWidth; // Force layout
      card.classList.add('card-fade-in');
      card.style.animationDelay = `${animIndex * 25}ms`;
      animIndex++;
    } else {
      card.classList.remove('card-fade-in');
      card.classList.add('card-fade-out');
      card.style.display = 'none';
    }
  });

  // Cập nhật huy hiệu đếm kết quả
  if (countBadge) {
    countBadge.textContent = `Hiển thị: ${matchCount} / ${reviewCards.length} đánh giá`;
  }

  // Hiển thị trạng thái rỗng nếu 0 kết quả
  if (noReviewsEl) {
    noReviewsEl.style.display = (matchCount === 0) ? 'block' : 'none';
  }
}

/**
 * Hàm phân tích ngày đánh giá theo mốc tham chiếu hệ thống (2026-09-24)
 */
function evaluateReviewDateMatch(cardDateStr, filterVal) {
  if (filterVal === 'all') return true;
  if (!cardDateStr) return true;

  // Lấy mốc thời gian của kịch bản ứng dụng: 24/09/2026
  const refDate = new Date('2026-09-24T23:59:59');
  const reviewDate = new Date(cardDateStr + 'T00:00:00');

  if (isNaN(reviewDate.getTime())) return true;

  const diffTime = refDate.getTime() - reviewDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (filterVal === 'today') {
    return cardDateStr === '2026-09-24' || diffDays <= 0;
  }
  if (filterVal === '7days') {
    return diffDays >= 0 && diffDays <= 7;
  }
  if (filterVal === '30days') {
    return diffDays >= 0 && diffDays <= 30;
  }
  if (filterVal === 'this_month') {
    return cardDateStr.startsWith('2026-09');
  }
  if (filterVal === 'last_month') {
    return cardDateStr.startsWith('2026-08');
  }
  return true;
}

/**
 * 4. Đặt lại toàn bộ bộ lọc về trạng thái ban đầu
 */
function resetReviewFilters() {
  currentReviewStarFilter = 'all';

  const bookSelect = document.getElementById('reviewBookSelect');
  if (bookSelect) bookSelect.value = 'all';

  const dateSelect = document.getElementById('reviewDateSelect');
  if (dateSelect) dateSelect.value = 'all';

  const searchInput = document.getElementById('reviewSearchInput');
  if (searchInput) searchInput.value = '';

  const tabsBars = document.querySelectorAll('#starFilterTabs, .filter-tabs-bar');
  tabsBars.forEach(bar => {
    bar.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
    const allBtn = bar.querySelector('[data-filter-star="all"]') || bar.querySelector('.tab-chip');
    if (allBtn) allBtn.classList.add('active');
  });

  filterReviewsCombined();

  if (typeof showToast === 'function') {
    showToast('🔄 Đã đặt lại toàn bộ bộ lọc đánh giá!', 'info');
  }
}

/**
 * 5. Thanh Rating progress bar chạy mượt mà khi tải trang hoặc chuyển view
 */
function initRatingBarsAnimation() {
  const progressFills = document.querySelectorAll('.rating-bars .progress-fill');
  if (!progressFills.length) return;

  progressFills.forEach(fill => {
    const targetWidth = fill.style.width || '0%';
    fill.style.width = '0%';
    setTimeout(() => {
      fill.style.width = targetWidth;
    }, 180);
  });
}

/**
 * 6. "Xem thêm / Thu gọn" cho bình luận dài
 */
function initCommentTextClamping() {
  const commentTexts = document.querySelectorAll('.review-content-text');
  commentTexts.forEach(p => {
    if (p.textContent.trim().length > 120 && !p.nextElementSibling?.classList.contains('btn-see-more')) {
      p.classList.add('clamped');
      const seeMoreBtn = document.createElement('span');
      seeMoreBtn.className = 'btn-see-more';
      seeMoreBtn.textContent = 'Xem thêm ▾';
      seeMoreBtn.onclick = () => {
        if (p.classList.contains('clamped')) {
          p.classList.remove('clamped');
          p.style.maxHeight = '44px';
          p.style.overflow = 'hidden';
          const fullH = p.scrollHeight;
          p.style.transition = 'max-height 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)';
          requestAnimationFrame(() => {
            p.style.maxHeight = `${fullH}px`;
          });
          seeMoreBtn.textContent = 'Thu gọn ▴';
          setTimeout(() => {
            p.classList.add('expanded');
            p.style.maxHeight = 'none';
          }, 360);
        } else {
          const currentH = p.scrollHeight;
          p.style.maxHeight = `${currentH}px`;
          p.style.overflow = 'hidden';
          p.classList.remove('expanded');
          void p.offsetHeight;
          p.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          requestAnimationFrame(() => {
            p.style.maxHeight = '44px';
          });
          seeMoreBtn.textContent = 'Xem thêm ▾';
          setTimeout(() => {
            p.classList.add('clamped');
            p.style.maxHeight = '';
          }, 300);
        }
      };
      p.parentNode.insertBefore(seeMoreBtn, p.nextSibling);
    }
  });
}

/**
 * 7. Mở form phản hồi đánh giá
 */
function toggleReplyForm(btn) {
  const card = btn.closest('.review-card');
  if (!card) return;

  let formContainer = card.querySelector('.inline-reply-container');
  if (!formContainer) {
    formContainer = document.createElement('div');
    formContainer.className = 'inline-reply-container open';
    formContainer.innerHTML = `
      <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 6px; color: var(--text-main);">
        Viết phản hồi công khai từ Gian Hàng:
      </div>
      <textarea class="inline-reply-textarea" placeholder="Nhập lời cảm ơn hoặc hướng dẫn giải quyết sự cố cho độc giả..."></textarea>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline btn-sm" onclick="this.closest('.inline-reply-container').classList.remove('open')">Hủy bỏ</button>
        <button class="btn btn-primary btn-sm" onclick="submitOptimisticReply(this)">
          <span class="material-symbols-outlined" style="font-size: 16px;">send</span>
          Gửi phản hồi ngay
        </button>
      </div>
    `;
    card.appendChild(formContainer);
    formContainer.querySelector('textarea').focus();
  } else {
    formContainer.classList.toggle('open');
    if (formContainer.classList.contains('open')) {
      formContainer.querySelector('textarea').focus();
    }
  }
}

/**
 * 8. Optimistic UI: Phản hồi xuất hiện ngay lập tức trước khi server xác nhận
 */
function submitOptimisticReply(submitBtn) {
  const container = submitBtn.closest('.inline-reply-container');
  const card = submitBtn.closest('.review-card');
  if (!container || !card) return;

  const textarea = container.querySelector('textarea');
  const message = textarea ? textarea.value.trim() : '';

  if (!message) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Vui lòng nhập nội dung phản hồi!', 'warning');
    }
    return;
  }

  // Chèn ngay khối phản hồi vào DOM tức thì
  let existingReply = card.querySelector('.shop-reply-box');
  if (!existingReply) {
    existingReply = document.createElement('div');
    existingReply.className = 'shop-reply-box';
    card.insertBefore(existingReply, container);
  }

  const safeMessage = typeof escapeHtml === 'function' ? escapeHtml(message) : message;
  existingReply.innerHTML = `
    <div class="shop-reply-header">
      <div class="shop-reply-author">
        <span class="material-symbols-outlined" style="font-size: 16px;">storefront</span>
        Phản hồi từ Shop: Tiệm Truyện Vũ Trụ
      </div>
      <span class="shop-reply-time">Vừa xong (Optimistic UI)</span>
    </div>
    <p class="shop-reply-text">${safeMessage}</p>
  `;
  existingReply.style.animation = 'fadeIn 0.3s ease';

  // Cập nhật nhãn trạng thái và thuộc tính sang "Đã phản hồi"
  card.setAttribute('data-replied', 'true');
  const dangerBadge = card.querySelector('.badge-danger');
  if (dangerBadge) {
    dangerBadge.className = 'badge badge-success';
    dangerBadge.innerHTML = '<span class="badge-dot"></span> Đã phản hồi';
  }

  container.classList.remove('open');
  textarea.value = '';

  if (typeof showToast === 'function') {
    showToast('✅ Đã gửi phản hồi thành công! Độc giả sẽ nhận được thông báo.', 'success');
  }
}

/**
 * 9. Load more đánh giá với loading spinner
 */
function loadMoreReviews(btn) {
  if (!btn) return;
  btn.classList.add('btn-loading');

  setTimeout(() => {
    btn.classList.remove('btn-loading');

    const cardContainer = document.getElementById('reviewsListContainer') 
      || btn.closest('.content-body') 
      || document.querySelector('.content-body');
    if (!cardContainer) return;

    const newCard = document.createElement('div');
    newCard.className = 'review-card';
    newCard.setAttribute('data-stars', '5');
    newCard.setAttribute('data-book', 'Chainsaw Man – Thợ Săn Quỷ Tập 11');
    newCard.setAttribute('data-date', '2026-09-24');
    newCard.setAttribute('data-has-photo', 'true');
    newCard.setAttribute('data-replied', 'true');
    newCard.style.animation = 'slideDownFade 0.3s ease';
    newCard.innerHTML = `
      <div class="review-card-header">
        <div class="reviewer-profile">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="Avatar Lan" class="reviewer-avatar">
          <div class="reviewer-info">
            <h4>
              Mai Phương Lan
              <span class="badge badge-success" style="font-size: 0.72rem; padding: 2px 7px;">Đã mua hàng</span>
            </h4>
            <div class="meta-time">5 phút trước • 24/09/2026 • Đơn hàng #CH-99280</div>
          </div>
        </div>
        <button class="nav-icon-btn" style="width: 32px; height: 32px;"><span class="material-symbols-outlined">more_horiz</span></button>
      </div>
      <div class="review-stars">
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
        <span class="material-symbols-outlined fill">star</span>
      </div>
      <div class="review-product-attached">
        <span class="material-symbols-outlined" style="font-size: 16px;">menu_book</span>
        Chainsaw Man – Thợ Săn Quỷ Tập 11 &nbsp;|&nbsp; Phân loại: Bản Bìa Giới Hạn
      </div>
      <p class="review-content-text">
        Chất lượng truyện của tiệm chưa bao giờ làm mình thất vọng! Truyện mới tinh nguyên seal nilon, màng bọc khí rất dày. Bạn chủ shop còn tặng kèm 2 sticker Makima siêu nét. Sẽ tiếp tục theo dõi các đợt phát hành mới của tiệm.
      </p>
      <div class="shop-reply-box">
        <div class="shop-reply-header">
          <div class="shop-reply-author">
            <span class="material-symbols-outlined" style="font-size: 16px;">storefront</span>
            Phản hồi từ Shop: Tiệm Truyện Vũ Trụ
          </div>
          <span class="shop-reply-time">Vừa xong</span>
        </div>
        <p class="shop-reply-text">Tiệm cảm ơn bạn Lan nhiều nhé! Chúc bạn có trải nghiệm đọc truyện tuyệt vời nha.</p>
      </div>
    `;

    cardContainer.appendChild(newCard);
    initCommentTextClamping();

    // Cập nhật lại số lượng đếm
    filterReviewsCombined();

    if (typeof showToast === 'function') {
      showToast('✅ Đã tải thêm đánh giá mới thành công!', 'success');
    }
  }, 400);
}
