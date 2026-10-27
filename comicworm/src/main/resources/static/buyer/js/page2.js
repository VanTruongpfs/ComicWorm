/* Quản lý đơn hàng (người mua) - B08: Xem danh sách, chi tiết modal, và hủy đơn nếu chưa vận chuyển. */
document.addEventListener("DOMContentLoaded", () => {
  const api = window.BookMoochOrdersApi;
  const tabs = [...document.querySelectorAll(".order-tab-btn")];
  const searchInput = document.getElementById("search-input");
  const emptyMessage = document.getElementById("empty-message");
  const listEl = document.getElementById("orders-items");
  const pagerEl = document.getElementById("pagination");
  const badge = document.getElementById("stored-badge");
  const toast = document.getElementById("toast");
  const refreshBtn = document.getElementById("refresh-orders-btn");

  // Modals & Safe Dialog Helpers
  const getDetailModal = () => document.getElementById("orderDetailModal");
  const getCancelModal = () => document.getElementById("orderCancelModal");

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      try {
        dialog.showModal();
        return;
      } catch (err) {
        console.warn("showModal failed, fallback to open attribute:", err);
      }
    }
    dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      try {
        dialog.close();
        return;
      } catch (_) {}
    }
    dialog.removeAttribute("open");
  }

  function isDialogOpen(dialog) {
    return Boolean(dialog && (dialog.open || dialog.hasAttribute("open")));
  }

  const cancelForm = document.getElementById("orderCancelForm");
  const cancelReasonSelect = document.getElementById("cancelReasonSelect");
  const cancelReasonCustomGroup = document.getElementById("cancelReasonCustomGroup");
  const cancelReasonCustom = document.getElementById("cancelReasonCustom");
  const cancelModalError = document.getElementById("cancelModalError");
  const confirmCancelSubmitBtn = document.getElementById("confirmCancelSubmitBtn");

  const PAGE_SIZE = 6;
  const state = { group: "all", q: "", page: 0, loading: false };
  let currentCancelOrderCode = null;
  let toastTimer;
  let searchTimer;
  let requestSeq = 0;
  let detailSeq = 0;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${Number(n || 0).toLocaleString("vi-VN")} ₫`;
  const when = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.toLocaleDateString("vi-VN")} • ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  };
  const safeImg = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");

  const css = (s) => ({
    WAITING_PAYMENT: "pending",
    WAITING_CONFIRM: "confirm",
    PACKING: "packing",
    SHIPPING: "shipping",
    DELIVERED: "delivered",
    COMPLETED: "completed",
    CANCELLED: "cancelled"
  }[s] || "pending");

  const icon = (s) => ({
    WAITING_PAYMENT: "payments",
    WAITING_CONFIRM: "hourglass_top",
    PACKING: "inventory_2",
    SHIPPING: "local_shipping",
    DELIVERED: "inventory",
    COMPLETED: "task_alt",
    CANCELLED: "cancel"
  }[s] || "info");

  const statusDescription = (s) => ({
    WAITING_PAYMENT: "Đơn hàng đang chờ thanh toán để chuyển cho người bán chuẩn bị hàng.",
    WAITING_CONFIRM: "Đơn hàng đang chờ người bán kiểm tra và xác nhận đơn.",
    PACKING: "Người bán đang đóng gói sản phẩm và chuẩn bị bàn giao cho bưu tá.",
    SHIPPING: "Đơn hàng đã bàn giao cho đơn vị vận chuyển và đang trên đường giao tới bạn.",
    DELIVERED: "Bưu tá đã giao hàng thành công. Vui lòng kiểm tra sản phẩm.",
    COMPLETED: "Đơn hàng đã hoàn tất thành công. Cảm ơn bạn đã mua sắm!",
    CANCELLED: "Đơn hàng đã bị hủy. Nếu đã thanh toán, số tiền sẽ được hoàn trả theo quy định."
  }[s] || "");

  function showToast(message, type = "info") {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function handleError(error) {
    if (error.loginRequired) {
      window.location.href = "../../auth/html/login.html";
      return;
    }
    showToast(error.message, "error");
  }

  /* Đơn hàng có thể hủy nếu chưa vận chuyển (WAITING_PAYMENT hoặc WAITING_CONFIRM) */
  function canCancelOrder(status) {
    return status === "WAITING_PAYMENT" || status === "WAITING_CONFIRM";
  }

  /* ---------- Render Danh sách đơn hàng ---------- */

  function renderProductRow(item) {
    const img = safeImg(item.imageUrl);
    return `
      <div class="order-item-row">
        <div class="item-thumb-wrapper">
          ${img ? `<img alt="${esc(item.title)}" src="${esc(img)}" class="item-thumb" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=120&auto=format&fit=crop&q=80'">` : `<div class="item-thumb-placeholder"><span class="material-symbols-outlined">menu_book</span></div>`}
        </div>
        <div class="item-meta">
          <h4 class="item-title" title="${esc(item.title)}">${esc(item.title)}</h4>
          <div class="item-specs">
            <span class="spec-tag">Độ mới: <strong>${esc(item.conditionPercent)}%</strong></span>
            <span class="spec-tag">Số lượng: <strong>×${esc(item.quantity)}</strong></span>
            <span class="spec-price">Đơn giá: ${money(item.unitPrice)}</span>
          </div>
        </div>
        <div class="item-subtotal">
          <small>Thành tiền</small>
          <strong>${money(item.lineTotal)}</strong>
        </div>
      </div>`;
  }

  function cardHtml(o) {
    const initials = (o.sellerName || "?").trim().slice(0, 2).toUpperCase();
    const canCancel = canCancelOrder(o.status);
    const review = o.status === "COMPLETED"
      ? `<a href="page4.html" class="btn btn-review" title="Đánh giá truyện">
           <span class="material-symbols-outlined">star</span>
           <span>Đánh giá</span>
         </a>` : "";

    const itemsHtml = (o.items || []).map(renderProductRow).join("");

    return `
      <article class="order-card" data-order-code="${esc(o.orderCode)}" id="card-${esc(o.orderCode)}">
        <div class="order-card-header">
          <div class="seller-meta">
            <div class="seller-avatar">${esc(initials)}</div>
            <div>
              <div class="seller-title">
                <span class="seller-name"><i class="fa-solid fa-store"></i> ${esc(o.sellerName)}</span>
                <span class="order-code-badge">#${esc(o.orderCode)}</span>
              </div>
              <div class="order-date-text">
                <span class="material-symbols-outlined">schedule</span> Đặt lúc ${esc(when(o.createdAt))}
              </div>
            </div>
          </div>
          <div class="status-badge-wrap">
            <span class="order-status-badge ${css(o.status)}">
              <span class="material-symbols-outlined">${icon(o.status)}</span>
              <span>${esc(api.LABELS[o.status] || o.status)}</span>
            </span>
          </div>
        </div>

        <div class="order-card-body">
          <div class="order-items-wrapper">
            ${itemsHtml}
          </div>
        </div>

        <div class="order-card-footer">
          <div class="order-total-group">
            <div class="order-recipient-sub">
              <span class="material-symbols-outlined">person</span>
              <span>${esc(o.recipientName)}</span>
              ${o.shippingFee > 0 ? `<small class="ship-note">· Phí ship: ${money(o.shippingFee)}</small>` : '<small class="ship-note">· Freeship</small>'}
            </div>
            <div class="total-price-line">
              <span>Tổng thanh toán (${esc(o.itemCount)} cuốn):</span>
              <strong class="total-amount">${money(o.totalAmount)}</strong>
            </div>
          </div>

          <div class="order-actions-group">
            <button type="button" class="btn btn-detail" data-act="view-detail" data-code="${esc(o.orderCode)}" title="Xem thông tin chi tiết đơn hàng">
              <span class="material-symbols-outlined">visibility</span>
              <span>Xem chi tiết</span>
            </button>

            ${canCancel ? `
            <button type="button" class="btn btn-cancel-order" data-act="cancel-order" data-code="${esc(o.orderCode)}" title="Hủy đơn hàng này">
              <span class="material-symbols-outlined">cancel</span>
              <span>Hủy đơn</span>
            </button>` : ''}

            ${review}
          </div>
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
      let btns = `<button class="page-nav-btn" data-page="${page.page - 1}" ${page.page === 0 ? "disabled" : ""} title="Trang trước">
        <span class="material-symbols-outlined">chevron_left</span></button>`;
      for (let i = 0; i < page.totalPages; i++) {
        btns += `<button data-page="${i}" class="page-num-btn ${i === page.page ? "page-active" : ""}">${i + 1}</button>`;
      }
      btns += `<button class="page-nav-btn" data-page="${page.page + 1}" ${page.page >= page.totalPages - 1 ? "disabled" : ""} title="Trang sau">
        <span class="material-symbols-outlined">chevron_right</span></button>`;
      pagerEl.innerHTML = `<span>Hiển thị ${from} – ${to} trên tổng số ${page.totalElements} đơn hàng</span><div class="pager-buttons">${btns}</div>`;
    }
  }

  async function load(isSilent = false) {
    if (state.loading) return;
    const seq = ++requestSeq;
    state.loading = true;

    if (!isSilent) {
      listEl.innerHTML = '<div class="orders-loading"><div class="spinner"></div> Đang tải danh sách đơn hàng...</div>';
      if (refreshBtn) refreshBtn.classList.add("loading");
    }

    try {
      const page = await api.mine({ status: state.group, q: state.q, page: state.page, size: PAGE_SIZE });
      if (seq !== requestSeq) return;
      renderList(page);
    } catch (error) {
      if (seq !== requestSeq) return;
      listEl.innerHTML = `<div class="orders-error"><span class="material-symbols-outlined">error</span> ${esc(error.message)}</div>`;
      handleError(error);
    } finally {
      if (seq === requestSeq) {
        state.loading = false;
        if (refreshBtn) refreshBtn.classList.remove("loading");
      }
    }
  }

  /* ---------- Modal Xem Chi Tiết Đơn Hàng ---------- */

  function renderStatusStepper(status, isCancelled) {
    if (isCancelled) {
      return `
        <div class="stepper-cancelled-box">
          <span class="material-symbols-outlined">cancel</span>
          <div>
            <strong>Đơn hàng đã hủy</strong>
            <span>Đơn hàng đã được ghi nhận hủy và ngưng toàn bộ quá trình xử lý.</span>
          </div>
        </div>`;
    }

    const steps = [
      { key: "WAITING_PAYMENT", label: "Chờ thanh toán", icon: "payments" },
      { key: "WAITING_CONFIRM", label: "Chờ xác nhận", icon: "hourglass_top" },
      { key: "PACKING", label: "Đang đóng gói", icon: "inventory_2" },
      { key: "SHIPPING", label: "Đang giao hàng", icon: "local_shipping" },
      { key: "DELIVERED", label: "Đã giao / Hoàn tất", icon: "task_alt" }
    ];

    const orderIndex = {
      WAITING_PAYMENT: 0,
      WAITING_CONFIRM: 1,
      PACKING: 2,
      SHIPPING: 3,
      DELIVERED: 4,
      COMPLETED: 4
    }[status] ?? 0;

    const stepsHtml = steps.map((s, idx) => {
      const isDone = idx < orderIndex;
      const isCurrent = idx === orderIndex;
      const stepClass = isCurrent ? "step-current" : isDone ? "step-done" : "step-pending";

      return `
        <div class="stepper-item ${stepClass}">
          <div class="stepper-circle">
            <span class="material-symbols-outlined">${isDone ? "check" : s.icon}</span>
          </div>
          <span class="stepper-label">${esc(s.label)}</span>
        </div>`;
    }).join(`<div class="stepper-line"></div>`);

    return `<div class="order-stepper">${stepsHtml}</div>`;
  }

  function renderDetailContent(d) {
    if (!d) return;
    const s = d.summary || d;
    const isCancelled = s.status === "CANCELLED";
    const canCancel = canCancelOrder(s.status);

    const paymentLabel = {
      PENDING: "Chờ thanh toán",
      PAID: "Đã thanh toán thành công",
      REFUNDED: "Đã hoàn tiền",
      PARTIALLY_REFUNDED: "Đã hoàn tiền một phần"
    }[s.paymentStatus] || s.paymentStatus || "—";

    // Danh sách sản phẩm trong chi tiết
    const itemsTableHtml = (s.items && s.items.length > 0)
      ? s.items.map((i) => {
          const img = safeImg(i.imageUrl);
          return `
            <div class="detail-product-row">
              <div class="detail-product-thumb">
                ${img ? `<img src="${esc(img)}" alt="${esc(i.title)}" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=120&auto=format&fit=crop&q=80'">` : `<div class="item-thumb-placeholder"><span class="material-symbols-outlined">menu_book</span></div>`}
              </div>
              <div class="detail-product-info">
                <h4>${esc(i.title)}</h4>
                <div class="detail-product-sub">
                  <span>Độ mới: <strong>${esc(i.conditionPercent)}%</strong></span>
                  <span>Số lượng: <strong>×${esc(i.quantity)}</strong></span>
                </div>
              </div>
              <div class="detail-product-price">
                <div class="unit-price">${money(i.unitPrice)} / cuốn</div>
                <strong class="line-total">${money(i.lineTotal)}</strong>
              </div>
            </div>`;
        }).join("")
      : `<div style="padding: 12px; color: #64748b; font-size: 13px;">Không có thông tin sản phẩm.</div>`;

    // Lịch sử trạng thái
    const historyList = (d.history && d.history.length > 0)
      ? d.history.map((h, idx) => {
          const isLatest = idx === d.history.length - 1;
          return `
            <div class="timeline-entry ${isLatest ? 'latest' : ''}">
              <div class="timeline-marker"></div>
              <div class="timeline-body">
                <div class="timeline-header">
                  <span class="timeline-status-title">${esc(api.LABELS[h.newStatus] || h.newStatus || "Cập nhật")}</span>
                  <span class="timeline-time">${esc(when(h.createdAt))}</span>
                </div>
                <div class="timeline-actor">Bởi: <strong>${esc(h.changedByName || "Hệ thống")}</strong></div>
                ${h.note ? `<div class="timeline-note">${esc(h.note)}</div>` : ""}
              </div>
            </div>`;
        }).join("")
      : `<div style="padding: 6px 0; color: #64748b; font-size: 13px;">Chưa có cập nhật trạng thái nào khác.</div>`;

    const detailModalBody = document.getElementById("detailModalBody");
    const detailModalFooterActions = document.getElementById("detailModalFooterActions");

    if (detailModalBody) {
      detailModalBody.innerHTML = `
        <!-- Trạng thái và tiến trình -->
        <section class="modal-section status-section">
          <div class="modal-status-top">
            <div class="modal-status-badge-wrap">
              <span class="order-status-badge large ${css(s.status)}">
                <span class="material-symbols-outlined">${icon(s.status)}</span>
                <span>${esc(api.LABELS[s.status] || s.status)}</span>
              </span>
            </div>
            <p class="modal-status-desc">${esc(statusDescription(s.status))}</p>
          </div>
          ${renderStatusStepper(s.status, isCancelled)}
        </section>

        <!-- Thông tin đơn hàng & vận chuyển -->
        <section class="modal-section info-section">
          <h3 class="section-heading"><span class="material-symbols-outlined">contact_mail</span> Thông tin đơn hàng</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label"><i class="fa-solid fa-user"></i> Người nhận hàng:</span>
              <strong class="info-val">${esc(s.recipientName || "—")}</strong>
            </div>
            <div class="info-item">
              <span class="info-label"><i class="fa-solid fa-phone"></i> Số điện thoại:</span>
              <strong class="info-val">${esc(d.recipientPhone || "—")}</strong>
            </div>
            <div class="info-item full-width">
              <span class="info-label"><i class="fa-solid fa-location-dot"></i> Địa chỉ giao hàng:</span>
              <span class="info-val address-val">${esc(d.shippingAddress || "—")}</span>
            </div>
            <div class="info-item">
              <span class="info-label"><i class="fa-solid fa-store"></i> Người bán:</span>
              <strong class="info-val highlight">${esc(s.sellerName || "—")}</strong>
            </div>
            <div class="info-item">
              <span class="info-label"><i class="fa-solid fa-credit-card"></i> Trạng thái thanh toán:</span>
              <span class="payment-badge ${s.paymentStatus === 'PAID' ? 'paid' : 'pending'}">${esc(paymentLabel)}</span>
            </div>
            ${d.buyerNote ? `
            <div class="info-item full-width note-item">
              <span class="info-label"><i class="fa-solid fa-comment-dots"></i> Ghi chú người mua:</span>
              <span class="info-val">${esc(d.buyerNote)}</span>
            </div>` : ""}
            ${d.cancelReason ? `
            <div class="info-item full-width cancel-reason-item">
              <span class="info-label"><i class="fa-solid fa-triangle-exclamation"></i> Lý do hủy đơn:</span>
              <span class="info-val danger-text">${esc(d.cancelReason)}</span>
            </div>` : ""}
          </div>
        </section>

        <!-- Danh sách sản phẩm -->
        <section class="modal-section products-section">
          <h3 class="section-heading"><span class="material-symbols-outlined">menu_book</span> Danh sách sản phẩm (${s.itemCount || 0} cuốn)</h3>
          <div class="detail-products-list">
            ${itemsTableHtml}
          </div>

          <div class="price-breakdown-box">
            <div class="breakdown-row">
              <span>Tạm tính tiền hàng:</span>
              <span>${money(s.subtotalAmount)}</span>
            </div>
            <div class="breakdown-row">
              <span>Phí vận chuyển:</span>
              <span>${s.shippingFee > 0 ? money(s.shippingFee) : '<strong style="color:#16a34a">Miễn phí</strong>'}</span>
            </div>
            <div class="breakdown-row total-row">
              <span>Tổng số tiền thanh toán:</span>
              <strong class="grand-total">${money(s.totalAmount)}</strong>
            </div>
          </div>
        </section>

        <!-- Lịch sử trạng thái đơn hàng -->
        <section class="modal-section timeline-section">
          <h3 class="section-heading"><span class="material-symbols-outlined">route</span> Lịch sử trạng thái</h3>
          <div class="order-timeline">
            ${historyList}
          </div>
        </section>`;
    }

    // Nút hành động trong footer modal
    if (detailModalFooterActions) {
      detailModalFooterActions.innerHTML = canCancel ? `
        <button type="button" class="btn btn-danger" data-act="cancel-from-detail" data-code="${esc(s.orderCode)}">
          <span class="material-symbols-outlined">cancel</span>
          <span>Hủy đơn hàng</span>
        </button>` : "";
    }
  }

  async function openDetailModal(code) {
    const cleanCode = String(code || "").trim().replace(/^#/, "");
    if (!cleanCode) return;

    const modal = getDetailModal();
    if (!modal) {
      console.error("orderDetailModal not found in DOM");
      showToast("Không tìm thấy cửa sổ chi tiết đơn hàng.", "error");
      return;
    }

    const mine = ++detailSeq;
    const codeEl = document.getElementById("detailModalCode");
    const bodyEl = document.getElementById("detailModalBody");
    const footerActions = document.getElementById("detailModalFooterActions");

    if (codeEl) codeEl.textContent = `#${cleanCode}`;
    if (bodyEl) bodyEl.innerHTML = '<div class="orders-loading"><div class="spinner"></div> Đang tải thông tin chi tiết đơn hàng...</div>';
    if (footerActions) footerActions.innerHTML = "";

    showDialog(modal);

    try {
      const d = await api.detail(cleanCode);
      if (mine !== detailSeq || !isDialogOpen(modal)) return;
      renderDetailContent(d);
    } catch (error) {
      if (mine !== detailSeq || !isDialogOpen(modal)) return;
      if (bodyEl) {
        bodyEl.innerHTML = `<div class="orders-error"><span class="material-symbols-outlined">error</span> ${esc(error.message || "Không thể tải chi tiết đơn hàng")}</div>`;
      }
      handleError(error);
    }
  }

  /* ---------- Modal Hủy Đơn Hàng ---------- */

  function openCancelModal(code) {
    const cleanCode = String(code || "").trim().replace(/^#/, "");
    if (!cleanCode) return;
    currentCancelOrderCode = cleanCode;

    const modal = getCancelModal();
    if (!modal) return;

    const codeEl = document.getElementById("cancelModalCode");
    if (codeEl) codeEl.textContent = `#${cleanCode}`;

    if (cancelReasonSelect) cancelReasonSelect.value = "";
    if (cancelReasonCustom) cancelReasonCustom.value = "";
    if (cancelReasonCustomGroup) {
      cancelReasonCustomGroup.style.display = "none";
      cancelReasonCustom.removeAttribute("required");
    }
    if (cancelModalError) {
      cancelModalError.style.display = "none";
      cancelModalError.textContent = "";
    }
    if (confirmCancelSubmitBtn) {
      confirmCancelSubmitBtn.disabled = false;
      confirmCancelSubmitBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Xác nhận hủy đơn</span>';
    }
    showDialog(modal);
  }

  cancelReasonSelect?.addEventListener("change", () => {
    if (cancelReasonSelect.value === "other") {
      cancelReasonCustomGroup.style.display = "block";
      cancelReasonCustom.setAttribute("required", "true");
      cancelReasonCustom.focus();
    } else {
      cancelReasonCustomGroup.style.display = "none";
      cancelReasonCustom.removeAttribute("required");
      cancelReasonCustom.value = "";
    }
  });

  cancelForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentCancelOrderCode || confirmCancelSubmitBtn.disabled) return;

    let reason = cancelReasonSelect.value;
    if (reason === "other") {
      reason = cancelReasonCustom.value.trim();
    }
    if (!reason) {
      cancelModalError.textContent = "Vui lòng chọn hoặc nhập lý do hủy đơn.";
      cancelModalError.style.display = "block";
      return;
    }

    confirmCancelSubmitBtn.disabled = true;
    confirmCancelSubmitBtn.innerHTML = '<div class="spinner-sm"></div> Đang xử lý hủy đơn...';
    cancelModalError.style.display = "none";

    try {
      await api.cancel(currentCancelOrderCode, reason);
      showToast(`Đơn hàng #${currentCancelOrderCode} đã được hủy thành công.`, "success");
      closeDialog(getCancelModal());
      closeDialog(getDetailModal());
      await load();
    } catch (error) {
      cancelModalError.textContent = error.message || "Không thể hủy đơn hàng. Vui lòng thử lại.";
      cancelModalError.style.display = "block";
      confirmCancelSubmitBtn.disabled = false;
      confirmCancelSubmitBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>Xác nhận hủy đơn</span>';
    }
  });

  /* ---------- Lắng nghe sự kiện click ---------- */

  document.addEventListener("click", (event) => {
    const detailModal = getDetailModal();
    const cancelModal = getCancelModal();

    // Click backdrop bên ngoài dialog để đóng
    if (event.target === detailModal) {
      closeDialog(detailModal);
      return;
    }
    if (event.target === cancelModal) {
      closeDialog(cancelModal);
      return;
    }

    // Đóng detail modal
    if (event.target.closest("[data-close-detail]")) {
      closeDialog(detailModal);
      return;
    }

    // Đóng cancel modal
    if (event.target.closest("[data-close-cancel]")) {
      closeDialog(cancelModal);
      return;
    }

    // Nút xem chi tiết
    const detailBtn = event.target.closest('[data-act="view-detail"]');
    if (detailBtn) {
      event.preventDefault();
      openDetailModal(detailBtn.dataset.code);
      return;
    }

    // Nút hủy đơn từ thẻ đơn hàng
    const cancelBtn = event.target.closest('[data-act="cancel-order"]');
    if (cancelBtn) {
      event.preventDefault();
      openCancelModal(cancelBtn.dataset.code);
      return;
    }

    // Nút hủy đơn từ bên trong detail modal
    const cancelFromDetailBtn = event.target.closest('[data-act="cancel-from-detail"]');
    if (cancelFromDetailBtn) {
      event.preventDefault();
      openCancelModal(cancelFromDetailBtn.dataset.code);
      return;
    }

    // Phân trang
    const pageBtn = event.target.closest("#pagination button[data-page]");
    if (pageBtn && !pageBtn.disabled) {
      state.page = Number(pageBtn.dataset.page);
      load();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  });

  /* ---------- Tabs & Bộ lọc ---------- */

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.group = tab.dataset.filter || "all";
    state.page = 0;
    load();
  }));

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchInput.value.trim();
      state.page = 0;
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

  /* Nút Làm mới */
  refreshBtn?.addEventListener("click", () => {
    load();
    showToast("Đang cập nhật danh sách đơn hàng...", "info");
  });

  /* Tự động làm mới khi quay lại tab */
  window.addEventListener("focus", () => {
    if (!isDialogOpen(getDetailModal()) && !isDialogOpen(getCancelModal())) {
      load(true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isDialogOpen(getDetailModal()) && !isDialogOpen(getCancelModal())) {
      load(true);
    }
  });

  /* Polling định kỳ mỗi 20s để nhận cập nhật trạng thái từ phía người bán */
  setInterval(() => {
    if (!document.hidden && !isDialogOpen(getDetailModal()) && !isDialogOpen(getCancelModal())) {
      load(true);
    }
  }, 20000);

  /* ---------- Thông báo thanh toán VNPAY ---------- */
  const urlParams = new URLSearchParams(window.location.search);
  const isPaymentSuccess = urlParams.get("paymentSuccess");
  const checkoutCodeParam = urlParams.get("checkoutCode");
  const vnpTxnRef = urlParams.get("vnp_TxnRef");

  if (isPaymentSuccess === "true" || isPaymentSuccess === "1") {
    setTimeout(() => {
      showToast("Thanh toán thành công! Đơn hàng của bạn đang được người bán xử lý.", "success");
    }, 400);

    const heading = document.querySelector(".page-heading");
    if (heading) {
      const banner = document.createElement("div");
      banner.className = "container";
      banner.style.cssText = "margin-top: 14px; margin-bottom: 6px;";
      banner.innerHTML = `
        <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #6ee7b7; border-left: 6px solid #10b981; padding: 14px 20px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.12);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="material-symbols-outlined" style="font-size: 28px; color: #10b981;">check_circle</span>
            <div>
              <strong style="color: #065f46; font-size: 14px; display: block;">Thanh toán thành công qua VNPAY!</strong>
              <span style="color: #047857; font-size: 13px;">Đơn hàng ${esc(checkoutCodeParam || vnpTxnRef || "")} đã được xác nhận và chuyển cho người bán chuẩn bị.</span>
            </div>
          </div>
          <button type="button" style="background: none; border: none; color: #047857; cursor: pointer; font-size: 20px; line-height: 1;" onclick="this.closest('.container').remove()">&times;</button>
        </div>`;
      heading.insertAdjacentElement("afterend", banner);
    }
  }

  // Khởi chạy ban đầu
  load();
});
