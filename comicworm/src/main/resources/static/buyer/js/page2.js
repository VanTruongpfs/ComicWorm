/* Quản lý đơn hàng (người mua) - B08: chỉ XEM trạng thái và lịch sử đơn đã mua. */
document.addEventListener("DOMContentLoaded", () => {
  const api = window.BookMoochOrdersApi;
  const tabs = [...document.querySelectorAll(".order-tab-btn")];
  const searchInput = document.getElementById("search-input");
  const emptyMessage = document.getElementById("empty-message");
  const listEl = document.getElementById("orders-items");
  const pagerEl = document.getElementById("pagination");
  const detailEl = document.getElementById("detail-panel");
  const badge = document.getElementById("stored-badge");
  const toast = document.getElementById("toast");

  const PAGE_SIZE = 5;
  const state = { group: "all", q: "", page: 0, selected: null };
  let toastTimer;
  let searchTimer;
  let requestSeq = 0;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;
  const when = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.toLocaleDateString("vi-VN")} • ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  };
  const safeImg = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");
  const css = (s) => ({
    WAITING_PAYMENT: "pending", WAITING_CONFIRM: "processing", PACKING: "processing",
    SHIPPING: "shipping", DELIVERED: "shipping", COMPLETED: "completed", CANCELLED: "cancelled"
  }[s] || "processing");
  const icon = (s) => ({
    WAITING_PAYMENT: "payments", WAITING_CONFIRM: "hourglass_top", PACKING: "inventory_2",
    SHIPPING: "local_shipping", DELIVERED: "inventory", COMPLETED: "task_alt", CANCELLED: "cancel"
  }[s] || "info");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function handleError(error) {
    if (error.loginRequired) {
      window.location.href = "../../auth/html/login.html";
      return;
    }
    showToast(error.message);
  }

  /* ---------- danh sách ---------- */

  function cardHtml(o) {
    const first = o.items[0];
    const more = o.items.length > 1 ? ` <small>và ${o.items.length - 1} sản phẩm khác</small>` : "";
    const img = first ? safeImg(first.imageUrl) : "";
    const initials = (o.sellerName || "?").trim().slice(0, 2).toUpperCase();
    const review = o.status === "COMPLETED"
      ? `<a href="page4.html" class="secondary-action review-button" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
           <span class="material-symbols-outlined">star</span> Đánh giá</a>` : "";
    return `
      <article class="order-card${state.selected === o.orderCode ? " active-card" : ""}" data-order-code="${esc(o.orderCode)}">
        <div class="order-header">
          <div class="seller">
            <div class="seller-avatar">${esc(initials)}</div>
            <div><div class="seller-name">${esc(o.sellerName)}</div><span>Mã đơn: ${esc(o.orderCode)}</span></div>
          </div>
          <span class="status ${css(o.status)}">
            <span class="material-symbols-outlined">${icon(o.status)}</span>${esc(api.LABELS[o.status] || o.status)}
          </span>
        </div>
        <div class="order-product">
          ${img ? `<img alt="${esc(first.title)}" src="${esc(img)}">` : `<img alt="" src="">`}
          <div class="product-info">
            <h3>${esc(first ? first.title : "(Không có sản phẩm)")}${more}</h3>
            <p>${first ? `Tình trạng ${esc(first.conditionPercent)}%` : ""}</p>
            <div class="price-row"><strong>${money(first ? first.unitPrice : 0)}</strong><span>SL: ${esc(o.itemCount)}</span></div>
          </div>
          <div class="order-total"><span>Tổng thanh toán</span><strong>${money(o.totalAmount)}</strong></div>
        </div>
        <div class="order-footer">
          <span>Đặt lúc ${esc(when(o.createdAt))}</span>
          <div class="card-actions">${review}</div>
        </div>
      </article>`;
  }

  function renderList(page) {
    listEl.innerHTML = page.content.map(cardHtml).join("");
    emptyMessage?.classList.toggle("show", page.content.length === 0);

    const counts = page.counts || {};
    tabs.forEach((t) => {
      const b = t.querySelector("b");
      if (b) b.textContent = counts[t.dataset.filter] ?? 0;
    });
    if (badge) badge.textContent = `${counts.all ?? 0} đơn`;

    pagerEl.innerHTML = "";
    if (page.totalPages > 1) {
      const from = page.page * page.size + 1;
      const to = Math.min(from + page.content.length - 1, page.totalElements);
      let btns = `<button data-page="${page.page - 1}" ${page.page === 0 ? "disabled" : ""}>
        <span class="material-symbols-outlined">chevron_left</span></button>`;
      for (let i = 0; i < page.totalPages; i++) {
        btns += `<button data-page="${i}" class="${i === page.page ? "page-active" : ""}">${i + 1}</button>`;
      }
      btns += `<button data-page="${page.page + 1}" ${page.page >= page.totalPages - 1 ? "disabled" : ""}>
        <span class="material-symbols-outlined">chevron_right</span></button>`;
      pagerEl.innerHTML = `<span>Hiển thị ${from}-${to} trên tổng ${page.totalElements} đơn hàng</span><div>${btns}</div>`;
    }
  }

  async function load() {
    const seq = ++requestSeq;
    listEl.innerHTML = '<div class="orders-loading">Đang tải đơn hàng...</div>';
    try {
      const page = await api.mine({ status: state.group, q: state.q, page: state.page, size: PAGE_SIZE });
      if (seq !== requestSeq) return; // có yêu cầu mới hơn, bỏ kết quả cũ
      renderList(page);
      if (!state.selected && page.content[0]) selectOrder(page.content[0].orderCode);
      if (page.content.length === 0) detailEl.innerHTML = '<div class="orders-loading">Chưa có đơn hàng nào.</div>';
    } catch (error) {
      if (seq !== requestSeq) return;
      listEl.innerHTML = `<div class="orders-error">${esc(error.message)}</div>`;
      handleError(error);
    }
  }

  /* ---------- chi tiết ---------- */

  function renderDetail(d) {
    const s = d.summary;
    const items = s.items.map((i) => `
      <div class="detail-product">
        ${safeImg(i.imageUrl) ? `<img alt="${esc(i.title)}" src="${esc(safeImg(i.imageUrl))}">` : `<img alt="" src="">`}
        <div><strong>${esc(i.title)}</strong><span>Tình trạng ${esc(i.conditionPercent)}%</span><span>SL: ${esc(i.quantity)}</span></div>
        <strong>${money(i.lineTotal)}</strong>
      </div>`).join("");
    const last = d.history.length - 1;
    const timeline = d.history.map((h, idx) => `
      <div class="timeline-item ${idx === last ? "current" : "done"}">
        <span class="timeline-dot"></span>
        <div><strong>${esc(api.LABELS[h.newStatus] || h.newStatus)}</strong>
          <small>${esc(when(h.createdAt))} • ${esc(h.changedByName || "Hệ thống")}</small>
          ${h.note ? `<small class="timeline-note">${esc(h.note)}</small>` : ""}</div>
      </div>`).join("");
    detailEl.innerHTML = `
      <div class="detail-header">
        <div><div class="detail-title"><h2>Chi Tiết Đơn Hàng</h2><span>#${esc(s.orderCode)}</span></div>
          <p>Đặt ngày: ${esc(when(s.createdAt))}</p></div>
      </div>
      <div class="detail-status"><span class="material-symbols-outlined">${icon(s.status)}</span>
        <div><strong>${esc(api.LABELS[s.status] || s.status)}</strong>
          <span>Người nhận: ${esc(s.recipientName)} • ${esc(d.recipientPhone)}</span></div></div>
      <div class="detail-section"><div class="section-title"><span class="material-symbols-outlined">storefront</span>Người bán</div>
        <div class="seller-detail"><div class="seller-avatar">${esc((s.sellerName || "?").slice(0, 2).toUpperCase())}</div>
          <div><strong>${esc(s.sellerName)}</strong><span>${esc(d.shippingAddress)}</span></div></div></div>
      <div class="detail-section"><div class="section-title"><span class="material-symbols-outlined">menu_book</span>Sản phẩm</div>${items}</div>
      <div class="detail-section"><div class="section-title"><span class="material-symbols-outlined">route</span>Lịch sử trạng thái</div>
        <div class="timeline">${timeline}</div></div>
      <div class="detail-section price-summary">
        <div><span>Giá sản phẩm</span><strong>${money(s.subtotalAmount)}</strong></div>
        <div><span>Phí vận chuyển</span><strong>${money(s.shippingFee)}</strong></div>
        <div class="summary-total"><span>Tổng thanh toán</span><strong>${money(s.totalAmount)}</strong></div></div>
      ${d.buyerNote ? `<div class="detail-section"><div class="section-title">Ghi chú</div><p>${esc(d.buyerNote)}</p></div>` : ""}
      ${d.cancelReason ? `<div class="detail-section"><div class="section-title">Lý do hủy</div><p>${esc(d.cancelReason)}</p></div>` : ""}`;
  }

  async function selectOrder(code) {
    state.selected = code;
    listEl.querySelectorAll(".order-card").forEach((c) =>
      c.classList.toggle("active-card", c.dataset.orderCode === code));
    detailEl.innerHTML = '<div class="orders-loading">Đang tải chi tiết...</div>';
    try {
      const d = await api.detail(code);
      if (state.selected === code) renderDetail(d);
    } catch (error) {
      detailEl.innerHTML = `<div class="orders-error">${esc(error.message)}</div>`;
      handleError(error);
    }
  }

  /* ---------- sự kiện ---------- */

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.group = tab.dataset.filter || "all";
    state.page = 0;
    state.selected = null;
    load();
  }));

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchInput.value.trim();
      state.page = 0;
      state.selected = null;
      load();
    }, 300);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = "";
      searchInput.blur();
      state.q = "";
      state.page = 0;
      load();
    }
  });

  listEl.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return;
    const card = event.target.closest(".order-card");
    if (card) selectOrder(card.dataset.orderCode);
  });

  pagerEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    state.selected = null;
    load();
  });

  /* ---------- điều hướng chung ---------- */

  const pathMap = {
    "kham-pha": "home.html", "dang-tin-tim-mua": "page1.html", "quan-ly-don-hang": "page2.html",
    "theo-doi-trang-thai": "page3.html", "huy-va-doi-tra": "page5.html",
    "danh-gia-truyen": "page4.html", "truyen-yeu-thich": "page6.html"
  };
  document.querySelectorAll("[data-path]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const path = link.dataset.path;
      if (pathMap[path] && path !== "quan-ly-don-hang") { window.location.href = pathMap[path]; return; }
      document.querySelectorAll("[data-path]").forEach((i) => i.classList.remove("active"));
      document.querySelectorAll(`[data-path="${path}"]`).forEach((i) => i.classList.add("active"));
    });
  });

  document.getElementById("global-search")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const value = event.currentTarget.value.trim();
    if (value && searchInput) {
      searchInput.value = value;
      state.q = value;
      state.page = 0;
      load();
    }
  });

  document.getElementById("newsletter-button")?.addEventListener("click", () => {
    const input = document.getElementById("newsletter-email");
    const email = input?.value.trim();
    if (!email) { showToast("Vui lòng nhập email."); input?.focus(); return; }
    if (!input.checkValidity()) { showToast("Email chưa đúng định dạng."); input.focus(); return; }
    input.value = "";
    showToast("Đã đăng ký nhận bản tin thành công.");
  });

  load();
});
