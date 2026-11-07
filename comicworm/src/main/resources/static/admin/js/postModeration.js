document.addEventListener("DOMContentLoaded", () => {
    // --- State Management ---
    const state = {
        status: "PENDING",
        keyword: "",
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        products: [],
        currentDetailProduct: null,
        currentRejectProductId: null,
        csrfInfo: null,
        isBusy: false,
        // Tab "Chờ duyệt" chia 2 cột theo kết quả phân loại tự động, mỗi cột phân trang riêng.
        columns: {
            VALID: { page: 0, totalPages: 0, totalElements: 0, busy: false },
            INVALID: { page: 0, totalPages: 0, totalElements: 0, busy: false }
        }
    };

    // --- DOM Elements ---
    const topSearchInput = document.getElementById("topSearchInput");
    const inlineSearchInput = document.getElementById("inlineSearchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const pageSizeSelect = document.getElementById("pageSizeSelect");
    const statusTabs = document.querySelectorAll(".mod-tab-btn");
    const productTableBody = document.getElementById("productTableBody");
    const tableLoadingState = document.getElementById("tableLoadingState");
    const tableEmptyState = document.getElementById("tableEmptyState");
    const tableSummaryText = document.getElementById("tableSummaryText");
    const paginationBar = document.getElementById("paginationBar");
    const paginationInfo = document.getElementById("paginationInfo");
    const paginationControls = document.getElementById("paginationControls");
    const productTableCard = document.getElementById("productTableCard");
    const pendingSplitView = document.getElementById("pendingSplitView");
    const unclassifiedNotice = document.getElementById("unclassifiedNotice");
    const unclassifiedNoticeText = document.getElementById("unclassifiedNoticeText");
    const columnEls = {
        VALID: {
            list: document.getElementById("validColumnList"),
            pager: document.getElementById("validColumnPager"),
            count: document.getElementById("validColumnCount")
        },
        INVALID: {
            list: document.getElementById("invalidColumnList"),
            pager: document.getElementById("invalidColumnPager"),
            count: document.getElementById("invalidColumnCount")
        }
    };

    // KPI Counters
    const kpiPendingCount = document.getElementById("kpiPendingCount");
    const kpiApprovedCount = document.getElementById("kpiApprovedCount");
    const kpiRejectedCount = document.getElementById("kpiRejectedCount");
    const kpiTotalCount = document.getElementById("kpiTotalCount");
    const tabPendingBadge = document.getElementById("tabPendingBadge");
    const tabApprovedBadge = document.getElementById("tabApprovedBadge");
    const tabRejectedBadge = document.getElementById("tabRejectedBadge");
    const tabAllBadge = document.getElementById("tabAllBadge");
    const sidebarBadge = document.getElementById("sidebarBadge");
    const statusIndicatorText = document.getElementById("statusIndicatorText");

    // Detail Modal Elements
    const detailModal = document.getElementById("productDetailModal");
    const detailModalCloseBtn = document.getElementById("detailModalCloseBtn");
    const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
    const detailModalIdTag = document.getElementById("detailModalIdTag");
    const detailModalTitle = document.getElementById("detailModalTitle");
    const detailMainImg = document.getElementById("detailMainImg");
    const detailGalleryRow = document.getElementById("detailGalleryRow");
    const detailConditionPercent = document.getElementById("detailConditionPercent");
    const detailListingType = document.getElementById("detailListingType");
    const detailStockQuantity = document.getElementById("detailStockQuantity");
    const detailPrice = document.getElementById("detailPrice");
    const detailStatusBadge = document.getElementById("detailStatusBadge");
    const detailCategory = document.getElementById("detailCategory");
    const detailAuthor = document.getElementById("detailAuthor");
    const detailPublisher = document.getElementById("detailPublisher");
    const detailPublicationYear = document.getElementById("detailPublicationYear");
    const detailVolumeNumbers = document.getElementById("detailVolumeNumbers");
    const detailEditionType = document.getElementById("detailEditionType");
    const detailSellerName = document.getElementById("detailSellerName");
    const detailSellerEmail = document.getElementById("detailSellerEmail");
    const detailSellerId = document.getElementById("detailSellerId");
    const detailTradeNoteBox = document.getElementById("detailTradeNoteBox");
    const detailTradeNoteText = document.getElementById("detailTradeNoteText");
    const detailDescriptionText = document.getElementById("detailDescriptionText");
    const detailHistoryBox = document.getElementById("detailHistoryBox");
    const detailHistoryHeading = document.getElementById("detailHistoryHeading");
    const detailHistoryContent = document.getElementById("detailHistoryContent");
    const detailModalRejectBtn = document.getElementById("detailModalRejectBtn");
    const detailModalApproveBtn = document.getElementById("detailModalApproveBtn");
    const detailModalMarkValidBtn = document.getElementById("detailModalMarkValidBtn");
    const detailAiBox = document.getElementById("detailAiBox");
    const detailAiHeading = document.getElementById("detailAiHeading");
    const detailAiContent = document.getElementById("detailAiContent");

    // Reject Modal Elements
    const rejectModal = document.getElementById("rejectProductModal");
    const cancelRejectBtn = document.getElementById("cancelRejectBtn");
    const cancelRejectModalBtn = document.getElementById("cancelRejectModalBtn");
    const confirmRejectBtn = document.getElementById("confirmRejectBtn");
    const rejectReasonInput = document.getElementById("rejectReasonInput");
    const rejectModalProductTitle = document.getElementById("rejectModalProductTitle");
    const rejectCharCount = document.getElementById("rejectCharCount");
    const rejectChips = document.querySelectorAll(".reject-quick-chips .chip-btn");

    // Lightbox Modal
    const lightboxModal = document.getElementById("imgLightboxModal");
    const lightboxImg = document.getElementById("lightboxImg");

    // --- Helper Functions ---
    function toast(message, type = "normal") {
        document.querySelector(".moderation-toast")?.remove();
        const el = document.createElement("div");
        el.className = "moderation-toast";
        el.textContent = message;
        Object.assign(el.style, {
            position: "fixed", right: "24px", bottom: "24px", zIndex: "999999",
            padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600",
            boxShadow: "0 10px 25px rgba(15,23,42,.2)", background: "#fff", color: "#0f172a",
            border: `2px solid ${type === "success" ? "#10b981" : type === "danger" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#cbd5e1"}`
        });
        document.body.appendChild(el);
        window.setTimeout(() => el.remove(), 3500);
    }

    function formatPrice(price) {
        if (price === null || price === undefined || price === "") return "Chưa cập nhật giá";
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(price));
    }

    function formatDate(value) {
        if (!value) return "Chưa rõ thời gian";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    function escapeHtml(val) {
        if (val === null || val === undefined) return "";
        return String(val).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function listingTypeLabel(type, long = false) {
        if (type === "TRADE" || type === "EXCHANGE") return long ? "Trao đổi truyện" : "Trao đổi";
        if (type === "SELL_AND_TRADE" || type === "BOTH") return long ? "Vừa bán vừa đổi" : "Bán & Đổi";
        return long ? "Bán thông thường" : "Bán";
    }

    function multilineHtml(text) {
        return escapeHtml(text).replace(/\n/g, "<br>");
    }

    function scoreHtml(score) {
        if (score === null || score === undefined || score === "") return "";
        const pct = Math.round(Number(score) * 100);
        if (Number.isNaN(pct)) return "";
        return `<span class="mod-ai-score" title="Độ tin cậy của bộ phân loại">Độ tin cậy ${pct}%</span>`;
    }

    function canApprove(p) {
        return p.moderationStatus === "PENDING" && p.aiVerdict === "VALID";
    }

    function canMarkValid(p) {
        return p.moderationStatus === "PENDING" && p.aiVerdict !== "VALID";
    }

    async function api(url, options = {}) {
        const headers = { Accept: "application/json", ...(options.headers || {}) };
        if (options.method && options.method !== "GET") {
            if (!state.csrfInfo) {
                const csrfRes = await fetch("/api/admin/products/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
                const csrfData = await csrfRes.json().catch(() => ({}));
                if (!csrfRes.ok) throw new Error(csrfData.Message || "Không lấy được CSRF token. Vui lòng đăng nhập lại.");
                state.csrfInfo = csrfData;
            }
            headers[state.csrfInfo.headerName || "X-CSRF-TOKEN"] = state.csrfInfo.token;
        }
        if (options.body) headers["Content-Type"] = "application/json";
        const res = await fetch(url, { ...options, headers, credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        if (res.status === 403) throw new Error(data.Message || "Bạn không có quyền thực hiện thao tác này.");
        if (!res.ok || data.Result === "ERROR") throw new Error(data.Message || "Thao tác trên máy chủ thất bại.");
        return data;
    }

    // --- Stats & KPI Counters ---
    async function loadStats() {
        try {
            const data = await api("/api/admin/products/stats");
            const stats = data.Stats || {};
            const pending = Number(stats.pending || 0);
            const approved = Number(stats.approved || 0);
            const rejected = Number(stats.rejected || 0);
            const total = pending + approved + rejected;

            if (kpiPendingCount) kpiPendingCount.textContent = pending;
            if (kpiApprovedCount) kpiApprovedCount.textContent = approved;
            if (kpiRejectedCount) kpiRejectedCount.textContent = rejected;
            if (kpiTotalCount) kpiTotalCount.textContent = total;

            if (tabPendingBadge) tabPendingBadge.textContent = pending;
            if (tabApprovedBadge) tabApprovedBadge.textContent = approved;
            if (tabRejectedBadge) tabRejectedBadge.textContent = rejected;
            if (tabAllBadge) tabAllBadge.textContent = total;

            const pendingValid = Number(stats.pendingValid || 0);
            const pendingInvalid = Number(stats.pendingInvalid || 0);
            const pendingUnclassified = Number(stats.pendingUnclassified || 0);
            if (!state.keyword) {
                if (columnEls.VALID.count) columnEls.VALID.count.textContent = pendingValid;
                if (columnEls.INVALID.count) columnEls.INVALID.count.textContent = pendingInvalid;
            }
            if (unclassifiedNotice) {
                unclassifiedNotice.style.display = pendingUnclassified > 0 ? "flex" : "none";
                if (unclassifiedNoticeText) {
                    unclassifiedNoticeText.textContent = `${pendingUnclassified} sản phẩm đang chờ phân loại tự động, sẽ xuất hiện ở một trong hai cột sau ít phút.`;
                }
            }

            if (sidebarBadge) sidebarBadge.textContent = pending;
            if (statusIndicatorText) {
                statusIndicatorText.textContent = `Trực tuyến • Đang có ${pending} bài chờ xử lý`;
            }
        } catch (err) {
            console.warn("Không tải được thống kê:", err.message);
        }
    }

    // --- Load and Render Product List ---
    function loadProducts() {
        const splitMode = state.status === "PENDING";
        if (pendingSplitView) pendingSplitView.style.display = splitMode ? "block" : "none";
        if (productTableCard) productTableCard.style.display = splitMode ? "none" : "block";
        if (splitMode) {
            return Promise.all([loadColumn("VALID"), loadColumn("INVALID")]);
        }
        return loadTable();
    }

    function resetPages() {
        state.page = 0;
        state.columns.VALID.page = 0;
        state.columns.INVALID.page = 0;
    }

    async function refreshAll() {
        await loadProducts();
        await loadStats();
    }

    // --- Tab "Chờ duyệt": 2 cột Hợp lệ / Không hợp lệ ---
    async function loadColumn(verdict) {
        const col = state.columns[verdict];
        const els = columnEls[verdict];
        if (!col || !els || !els.list || col.busy) return;
        col.busy = true;
        els.list.innerHTML = `<div class="mod-loading-state"><div class="mod-spinner"></div><span>Đang tải...</span></div>`;
        if (els.pager) els.pager.innerHTML = "";

        let retryPreviousPage = false;
        try {
            const url = `/api/admin/products?status=PENDING&verdict=${verdict}&keyword=${encodeURIComponent(state.keyword)}&page=${col.page}&size=${state.size}`;
            const data = await api(url);
            const records = Array.isArray(data.Records) ? data.Records : [];
            col.totalElements = Number(data.TotalRecordCount || 0);
            col.totalPages = Number(data.TotalPages || 0);

            // Trang hiện tại trống sau khi duyệt/từ chối hết -> lùi về trang cuối còn dữ liệu.
            if (records.length === 0 && col.page > 0 && col.totalPages > 0) {
                col.page = col.totalPages - 1;
                retryPreviousPage = true;
                return;
            }

            if (els.count) els.count.textContent = col.totalElements;
            renderColumn(verdict, records);
        } catch (err) {
            els.list.innerHTML = `<div class="mod-split-empty mod-split-error">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</div>`;
            toast(err.message, "danger");
        } finally {
            col.busy = false;
        }
        if (retryPreviousPage) await loadColumn(verdict);
    }

    function renderColumn(verdict, products) {
        const els = columnEls[verdict];
        const col = state.columns[verdict];
        els.list.innerHTML = "";

        if (products.length === 0) {
            const title = state.keyword
                ? "Không tìm thấy sản phẩm nào"
                : verdict === "VALID" ? "Không có sản phẩm hợp lệ chờ duyệt" : "Không có sản phẩm không hợp lệ";
            const desc = state.keyword
                ? `Không có kết quả khớp với "${escapeHtml(state.keyword)}".`
                : verdict === "VALID" ? "Các sản phẩm hợp lệ đã được xử lý hết." : "Bộ phân loại chưa phát hiện tin đăng nào cần chú ý.";
            els.list.innerHTML = `<div class="mod-split-empty"><strong>${title}</strong>${desc}</div>`;
            return;
        }

        products.forEach(p => els.list.appendChild(buildCard(p, verdict)));

        if (els.pager && col.totalPages > 1) {
            els.pager.innerHTML = `
                <button type="button" class="mod-page-btn" data-dir="-1" ${col.page === 0 ? "disabled" : ""}>&laquo; Trước</button>
                <span>Trang ${col.page + 1}/${col.totalPages} · ${col.totalElements} sản phẩm</span>
                <button type="button" class="mod-page-btn" data-dir="1" ${col.page >= col.totalPages - 1 ? "disabled" : ""}>Sau &raquo;</button>
            `;
            els.pager.querySelectorAll("button").forEach(btn => {
                btn.addEventListener("click", () => {
                    col.page = Math.max(0, Math.min(col.totalPages - 1, col.page + Number(btn.dataset.dir)));
                    loadColumn(verdict);
                });
            });
        }
    }

    function buildCard(p, verdict) {
        const card = document.createElement("article");
        card.className = "mod-queue-card";
        const coverImg = p.coverImageUrl || "https://placehold.co/100x130/e2e8f0/64748b?text=Comic";

        let aiHtml = "";
        if (verdict === "INVALID") {
            aiHtml = `<div class="mod-ai-reasons"><strong>Lý do:</strong> ${multilineHtml(p.aiReasons || "Không rõ lý do.")}${scoreHtml(p.aiScore)}</div>`;
        } else if (p.aiReasons) {
            aiHtml = `<div class="mod-ai-note">${multilineHtml(p.aiReasons)}</div>`;
        }

        card.innerHTML = `
            <img src="${escapeHtml(coverImg)}" alt="${escapeHtml(p.title)}" class="mod-thumb" title="Click để phóng to ảnh bìa">
            <div class="mod-queue-card-body">
                <div class="mod-product-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title || "Chưa có tiêu đề")}</div>
                <div class="mod-product-sub">
                    <span class="mod-id-chip">#${p.id}</span>
                    <span class="mod-meta-chip">📚 ${escapeHtml(p.categoryName || "Chưa phân loại")}</span>
                </div>
                <div class="mod-queue-card-meta">
                    <span><strong>${formatPrice(p.price)}</strong></span>
                    <span>Mới ${p.conditionPercent ?? 100}% · ${listingTypeLabel(p.listingType)}</span>
                    <span>👤 ${escapeHtml(p.sellerName || "Người bán")}</span>
                    <span>🕒 ${formatDate(p.createdAt)}</span>
                </div>
                ${aiHtml}
                <div class="mod-actions-cell">
                    <button type="button" class="mod-btn-action mod-btn-view" data-action="view">Chi tiết</button>
                    ${verdict === "VALID"
                        ? `<button type="button" class="mod-btn-action mod-btn-approve" data-action="approve">✓ Duyệt</button>`
                        : `<button type="button" class="mod-btn-action mod-btn-mark-valid" data-action="mark-valid">↺ Chuyển sang hợp lệ</button>`}
                    <button type="button" class="mod-btn-action mod-btn-reject" data-action="reject">✕ Từ chối</button>
                </div>
            </div>
        `;

        card.querySelector(".mod-thumb")?.addEventListener("click", () => openLightbox(coverImg));
        card.querySelector(".mod-product-title")?.addEventListener("click", () => openProductDetail(p.id));
        card.querySelectorAll(".mod-btn-action").forEach(btn => {
            btn.addEventListener("click", () => handleRowAction(btn.dataset.action, p));
        });
        return card;
    }

    function handleRowAction(action, p) {
        if (action === "view") openProductDetail(p.id);
        else if (action === "approve") confirmApprove(p.id, p.title);
        else if (action === "mark-valid") confirmMarkValid(p.id, p.title);
        else if (action === "reject") openRejectModal(p.id, p.title, p.aiVerdict === "INVALID" ? p.aiReasons : "");
    }

    // --- Các tab còn lại: bảng ---
    async function loadTable() {
        if (state.isBusy) return;
        state.isBusy = true;

        if (tableLoadingState) tableLoadingState.style.display = "flex";
        if (tableEmptyState) tableEmptyState.style.display = "none";
        if (productTableBody) productTableBody.innerHTML = "";
        if (paginationBar) paginationBar.style.display = "none";

        try {
            const url = `/api/admin/products?status=${state.status}&keyword=${encodeURIComponent(state.keyword)}&page=${state.page}&size=${state.size}`;
            const data = await api(url);

            state.products = Array.isArray(data.Records) ? data.Records : [];
            state.totalElements = Number(data.TotalRecordCount || 0);
            state.totalPages = Number(data.TotalPages || 0);

            if (tableLoadingState) tableLoadingState.style.display = "none";

            if (state.products.length === 0) {
                if (tableEmptyState) {
                    tableEmptyState.style.display = "block";
                    const title = document.getElementById("emptyStateTitle");
                    const desc = document.getElementById("emptyStateDesc");
                    if (state.keyword) {
                        if (title) title.textContent = "Không tìm thấy sản phẩm nào";
                        if (desc) desc.textContent = `Không có kết quả nào khớp với từ khóa "${state.keyword}". Thử tìm kiếm khác.`;
                    } else if (state.status === "PENDING") {
                        if (title) title.textContent = "Không có bài đăng nào cần duyệt";
                        if (desc) desc.textContent = "Tuyệt vời! Tất cả sản phẩm chờ duyệt đã được kiểm duyệt hoàn tất.";
                    } else {
                        if (title) title.textContent = "Danh sách trống";
                        if (desc) desc.textContent = "Hiện chưa có sản phẩm nào trong mục này.";
                    }
                }
                if (tableSummaryText) tableSummaryText.textContent = "Không tìm thấy dữ liệu.";
                return;
            }

            // Render Table Rows
            renderTableRows(state.products);

            // Update Summary Text
            const startIdx = state.page * state.size + 1;
            const endIdx = Math.min((state.page + 1) * state.size, state.totalElements);
            if (tableSummaryText) {
                tableSummaryText.textContent = `Hiển thị ${startIdx} - ${endIdx} trong tổng số ${state.totalElements} sản phẩm.`;
            }

            // Render Pagination
            renderPagination();
        } catch (err) {
            if (tableLoadingState) tableLoadingState.style.display = "none";
            if (productTableBody) {
                productTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#dc2626; font-weight:600;">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</td></tr>`;
            }
            toast(err.message, "danger");
        } finally {
            state.isBusy = false;
        }
    }

    function renderTableRows(products) {
        if (!productTableBody) return;
        productTableBody.innerHTML = "";

        products.forEach(p => {
            const tr = document.createElement("tr");

            // Status Badge Config
            let statusHtml = "";
            if (p.moderationStatus === "PENDING") {
                const chip = p.aiVerdict === "VALID"
                    ? `<span class="mod-verdict-chip mod-verdict-valid">Hợp lệ</span>`
                    : p.aiVerdict === "INVALID"
                        ? `<span class="mod-verdict-chip mod-verdict-invalid">Không hợp lệ</span>`
                        : `<span class="mod-verdict-chip mod-verdict-none">Chờ phân loại</span>`;
                statusHtml = `<span class="mod-badge mod-badge-pending">⏳ Chờ duyệt</span><br>${chip}`;
            } else if (p.moderationStatus === "APPROVED") {
                statusHtml = `<span class="mod-badge mod-badge-approved">✅ Đã duyệt</span>`;
            } else if (p.moderationStatus === "REJECTED") {
                statusHtml = `<span class="mod-badge mod-badge-rejected">❌ Bị từ chối</span>`;
            } else {
                statusHtml = `<span class="mod-badge">${escapeHtml(p.moderationStatus)}</span>`;
            }

            const coverImg = p.coverImageUrl || "https://placehold.co/100x130/e2e8f0/64748b?text=Comic";

            tr.innerHTML = `
                <td>
                    <img src="${escapeHtml(coverImg)}" alt="${escapeHtml(p.title)}" class="mod-thumb" title="Click để phóng to ảnh bìa">
                </td>
                <td>
                    <div class="mod-product-cell">
                        <div style="min-width:0;">
                            <div class="mod-product-title" title="${escapeHtml(p.title)}">
                                ${escapeHtml(p.title || "Chưa có tiêu đề")}
                            </div>
                            <div class="mod-product-sub">
                                <span class="mod-id-chip">#${p.id}</span>
                                <span class="mod-meta-chip">📚 ${escapeHtml(p.categoryName || "Chưa phân loại")}</span>
                                ${p.editionType ? `<span class="mod-meta-chip">${escapeHtml(p.editionType)}</span>` : ""}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight:600; color:#0f172a; font-size:13.5px;">${escapeHtml(p.sellerName || "Người bán")}</div>
                    <div style="color:#64748b; font-size:12px;">${escapeHtml(p.sellerEmail || "Chưa có email")}</div>
                    <div style="color:#94a3b8; font-size:11px;">Mã người bán: #${p.sellerId || "—"}</div>
                </td>
                <td>
                    <div class="mod-price-text">${formatPrice(p.price)}</div>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">Kho: <strong>${p.stockQuantity ?? 0}</strong> cuốn</div>
                </td>
                <td>
                    <span class="mod-condition-badge">✨ Mới ${p.conditionPercent ?? 100}%</span>
                    <div style="font-size:12px; color:#475569; margin-top:4px;">Hình thức: <strong>${listingTypeLabel(p.listingType)}</strong></div>
                </td>
                <td>
                    <div style="font-size:12.5px; color:#334155; font-weight:500;">${formatDate(p.createdAt)}</div>
                </td>
                <td>
                    ${statusHtml}
                </td>
                <td style="text-align:center;">
                    <div class="mod-actions-cell" style="justify-content:center;">
                        <button type="button" class="mod-btn-action mod-btn-view" data-action="view" data-id="${p.id}" title="Xem toàn bộ thông tin chi tiết">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            Chi tiết
                        </button>
                        ${canMarkValid(p) ? `
                            <button type="button" class="mod-btn-action mod-btn-mark-valid" data-action="mark-valid" data-id="${p.id}" title="Chuyển sang hợp lệ để có thể duyệt">
                                ↺ Hợp lệ
                            </button>
                        ` : ""}
                        ${canApprove(p) ? `
                            <button type="button" class="mod-btn-action mod-btn-approve" data-action="approve" data-id="${p.id}" title="Phê duyệt sản phẩm ngay">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Duyệt
                            </button>
                        ` : ""}
                        ${p.moderationStatus === "PENDING" ? `
                            <button type="button" class="mod-btn-action mod-btn-reject" data-action="reject" data-id="${p.id}" title="Từ chối bài đăng này">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Từ chối
                            </button>
                        ` : ""}
                    </div>
                </td>
            `;

            // Thumb click -> Lightbox
            const thumbImg = tr.querySelector(".mod-thumb");
            thumbImg?.addEventListener("click", () => openLightbox(coverImg));

            // Title click -> View Detail
            const titleEl = tr.querySelector(".mod-product-title");
            titleEl?.addEventListener("click", () => openProductDetail(p.id));

            // Action Buttons
            tr.querySelectorAll(".mod-btn-action").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    handleRowAction(btn.dataset.action, p);
                });
            });

            productTableBody.appendChild(tr);
        });
    }

    // --- Pagination Logic ---
    function renderPagination() {
        if (!paginationBar || !paginationControls) return;
        if (state.totalPages <= 1) {
            paginationBar.style.display = "none";
            return;
        }

        paginationBar.style.display = "flex";
        const start = state.page * state.size + 1;
        const end = Math.min((state.page + 1) * state.size, state.totalElements);
        if (paginationInfo) {
            paginationInfo.textContent = `Đang hiển thị ${start} - ${end} / ${state.totalElements} sản phẩm (Trang ${state.page + 1}/${state.totalPages})`;
        }

        paginationControls.innerHTML = "";

        // Prev Button
        const prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.className = "mod-page-btn";
        prevBtn.disabled = state.page === 0;
        prevBtn.innerHTML = "&laquo; Trước";
        prevBtn.addEventListener("click", () => {
            if (state.page > 0) {
                state.page--;
                loadProducts();
            }
        });
        paginationControls.appendChild(prevBtn);

        // Page Number Buttons (Show around current)
        const maxVisiblePages = 5;
        let startPage = Math.max(0, state.page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(state.totalPages - 1, startPage + maxVisiblePages - 1);
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(0, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement("button");
            pageBtn.type = "button";
            pageBtn.className = `mod-page-btn ${i === state.page ? "active" : ""}`;
            pageBtn.textContent = i + 1;
            pageBtn.addEventListener("click", () => {
                if (state.page !== i) {
                    state.page = i;
                    loadProducts();
                }
            });
            paginationControls.appendChild(pageBtn);
        }

        // Next Button
        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "mod-page-btn";
        nextBtn.disabled = state.page >= state.totalPages - 1;
        nextBtn.innerHTML = "Sau &raquo;";
        nextBtn.addEventListener("click", () => {
            if (state.page < state.totalPages - 1) {
                state.page++;
                loadProducts();
            }
        });
        paginationControls.appendChild(nextBtn);
    }

    // --- Product Detail Modal ---
    async function openProductDetail(productId) {
        try {
            toast("Đang tải thông tin chi tiết sản phẩm...", "normal");
            const data = await api(`/api/admin/products/${productId}`);
            const p = data.Record;
            if (!p) throw new Error("Không tìm thấy dữ liệu chi tiết của sản phẩm.");

            state.currentDetailProduct = p;

            // Fill IDs & Header
            if (detailModalIdTag) detailModalIdTag.textContent = `#${p.id}`;
            if (detailModalTitle) detailModalTitle.textContent = p.title || "Chi tiết sản phẩm";

            // Main Image
            const coverUrl = p.coverImageUrl || "https://placehold.co/400x520/e2e8f0/64748b?text=Comic";
            if (detailMainImg) {
                detailMainImg.src = coverUrl;
                detailMainImg.onclick = () => openLightbox(detailMainImg.src);
            }

            // Gallery Thumbnails
            if (detailGalleryRow) {
                detailGalleryRow.innerHTML = "";
                const allImages = [];
                if (p.coverImageUrl) allImages.push(p.coverImageUrl);
                if (Array.isArray(p.detailImageUrls)) {
                    p.detailImageUrls.forEach(url => {
                        if (url && !allImages.includes(url)) allImages.push(url);
                    });
                }

                allImages.forEach((imgUrl, idx) => {
                    const thumb = document.createElement("img");
                    thumb.src = imgUrl;
                    thumb.className = `detail-gallery-thumb ${idx === 0 ? "active" : ""}`;
                    thumb.alt = "Ảnh thu nhỏ";
                    thumb.addEventListener("click", () => {
                        detailGalleryRow.querySelectorAll(".detail-gallery-thumb").forEach(t => t.classList.remove("active"));
                        thumb.classList.add("active");
                        if (detailMainImg) detailMainImg.src = imgUrl;
                    });
                    detailGalleryRow.appendChild(thumb);
                });
            }

            // Quick Tags
            if (detailConditionPercent) detailConditionPercent.textContent = `${p.conditionPercent ?? 100}%`;
            if (detailListingType) detailListingType.textContent = listingTypeLabel(p.listingType, true);
            if (detailStockQuantity) detailStockQuantity.textContent = `${p.stockQuantity ?? 0} cuốn`;

            // Price & Status Badge
            if (detailPrice) detailPrice.textContent = formatPrice(p.price);
            if (detailStatusBadge) {
                if (p.moderationStatus === "PENDING") {
                    detailStatusBadge.textContent = "Chờ duyệt";
                    detailStatusBadge.className = "status-pill status-pill-pending";
                } else if (p.moderationStatus === "APPROVED") {
                    detailStatusBadge.textContent = "Đã duyệt";
                    detailStatusBadge.className = "status-pill status-pill-approved";
                } else if (p.moderationStatus === "REJECTED") {
                    detailStatusBadge.textContent = "Bị từ chối";
                    detailStatusBadge.className = "status-pill status-pill-rejected";
                }
            }

            // Specs
            if (detailCategory) detailCategory.textContent = p.categoryName || "Chưa phân loại";
            if (detailAuthor) detailAuthor.textContent = p.authorName || "Đang cập nhật";
            if (detailPublisher) detailPublisher.textContent = p.publisherName || "Đang cập nhật";
            if (detailPublicationYear) detailPublicationYear.textContent = p.publicationYear || "Chưa rõ";
            if (detailVolumeNumbers) detailVolumeNumbers.textContent = p.volumeNumbers || "Không";
            if (detailEditionType) detailEditionType.textContent = p.editionType || "Bản thường";

            // Seller Card
            if (detailSellerName) detailSellerName.textContent = p.sellerName || "Người bán";
            if (detailSellerEmail) detailSellerEmail.textContent = p.sellerEmail || "Chưa có email";
            if (detailSellerId) detailSellerId.textContent = `Mã người bán: #${p.sellerId || "—"}`;

            // Trade Wish Note
            if (detailTradeNoteBox) {
                if (p.tradeWishNote && p.tradeWishNote.trim()) {
                    detailTradeNoteBox.style.display = "block";
                    if (detailTradeNoteText) detailTradeNoteText.textContent = p.tradeWishNote.trim();
                } else {
                    detailTradeNoteBox.style.display = "none";
                }
            }

            // Description
            if (detailDescriptionText) {
                detailDescriptionText.textContent = p.description || "Người bán không cung cấp mô tả thêm.";
            }

            // Kết quả phân loại tự động
            if (detailAiBox && detailAiContent) {
                if (p.moderationStatus === "PENDING") {
                    detailAiBox.style.display = "block";
                    if (p.aiVerdict === "VALID") {
                        detailAiBox.className = "detail-history-box history-ai-valid";
                        if (detailAiHeading) detailAiHeading.textContent = "✅ Phân loại tự động: Hợp lệ";
                    } else if (p.aiVerdict === "INVALID") {
                        detailAiBox.className = "detail-history-box history-ai-invalid";
                        if (detailAiHeading) detailAiHeading.textContent = "⚠️ Phân loại tự động: Không hợp lệ";
                    } else {
                        detailAiBox.className = "detail-history-box history-ai-none";
                        if (detailAiHeading) detailAiHeading.textContent = "⏱️ Đang chờ phân loại tự động";
                    }
                    const reasons = p.aiReasons
                        ? `<p style="margin:0 0 6px; font-weight:600;">${multilineHtml(p.aiReasons)}${scoreHtml(p.aiScore)}</p>`
                        : "";
                    const when = p.aiClassifiedAt
                        ? `<small style="color:#64748b;">Phân loại lúc ${formatDate(p.aiClassifiedAt)}</small>`
                        : `<small style="color:#64748b;">Chỉ duyệt được sau khi sản phẩm được phân loại hợp lệ.</small>`;
                    detailAiContent.innerHTML = reasons + when;
                } else {
                    detailAiBox.style.display = "none";
                }
            }

            // Moderation History
            if (detailHistoryBox && detailHistoryContent) {
                if (p.moderationStatus === "REJECTED") {
                    detailHistoryBox.style.display = "block";
                    detailHistoryBox.className = "detail-history-box history-rejected";
                    if (detailHistoryHeading) detailHistoryHeading.textContent = "⚠️ Lý do từ chối kiểm duyệt:";
                    detailHistoryContent.innerHTML = `
                        <p style="margin:0 0 6px; font-weight:600; color:#991b1b;">${escapeHtml(p.moderationReason || "Không rõ lý do.")}</p>
                        <small style="color:#64748b;">Xử lý bởi: <strong>${escapeHtml(p.moderatedByName || "Admin")}</strong> · ${formatDate(p.moderatedAt)}</small>
                    `;
                } else if (p.moderationStatus === "APPROVED") {
                    detailHistoryBox.style.display = "block";
                    detailHistoryBox.className = "detail-history-box history-approved";
                    if (detailHistoryHeading) detailHistoryHeading.textContent = "✅ Nhật ký phê duyệt:";
                    detailHistoryContent.innerHTML = `
                        <p style="margin:0 0 6px; font-weight:600; color:#166534;">Sản phẩm đã được phê duyệt và hiển thị trên chợ sách.</p>
                        <small style="color:#64748b;">Người phê duyệt: <strong>${escapeHtml(p.moderatedByName || "Admin")}</strong> · ${formatDate(p.moderatedAt)}</small>
                    `;
                } else {
                    detailHistoryBox.style.display = "none";
                }
            }

            // Action Buttons Visibility in Modal
            if (detailModalMarkValidBtn) {
                detailModalMarkValidBtn.style.display = canMarkValid(p) ? "inline-flex" : "none";
            }
            if (detailModalApproveBtn && detailModalRejectBtn) {
                if (p.moderationStatus === "PENDING") {
                    detailModalApproveBtn.style.display = canApprove(p) ? "inline-flex" : "none";
                    detailModalRejectBtn.style.display = "inline-flex";
                } else if (p.moderationStatus === "APPROVED") {
                    detailModalApproveBtn.style.display = "none";
                    detailModalRejectBtn.style.display = "inline-flex"; // Có thể từ chối hủy duyệt
                } else if (p.moderationStatus === "REJECTED") {
                    detailModalApproveBtn.style.display = "inline-flex"; // Có thể duyệt lại
                    detailModalRejectBtn.style.display = "none";
                }
            }

            if (detailModal) detailModal.style.display = "flex";
        } catch (err) {
            toast(err.message, "danger");
        }
    }

    function closeDetailModal() {
        if (detailModal) detailModal.style.display = "none";
        state.currentDetailProduct = null;
    }

    detailModalCloseBtn?.addEventListener("click", closeDetailModal);
    closeDetailModalBtn?.addEventListener("click", closeDetailModal);
    detailModal?.addEventListener("click", (e) => {
        if (e.target === detailModal) closeDetailModal();
    });

    // --- Modal Approve & Reject Actions ---
    detailModalApproveBtn?.addEventListener("click", () => {
        if (!state.currentDetailProduct) return;
        confirmApprove(state.currentDetailProduct.id, state.currentDetailProduct.title);
    });

    detailModalRejectBtn?.addEventListener("click", () => {
        const p = state.currentDetailProduct;
        if (!p) return;
        openRejectModal(p.id, p.title, p.aiVerdict === "INVALID" ? p.aiReasons : "");
    });

    detailModalMarkValidBtn?.addEventListener("click", () => {
        if (!state.currentDetailProduct) return;
        confirmMarkValid(state.currentDetailProduct.id, state.currentDetailProduct.title);
    });

    // --- Quick Approve Logic ---
    async function confirmApprove(productId, productTitle) {
        if (!confirm(`Xác nhận PHÊ DUYỆT sản phẩm #${productId}?\n\n"${productTitle}"\n\nSản phẩm sẽ được hiển thị công khai trên chợ cho người mua.`)) {
            return;
        }

        try {
            toast("Đang tiến hành phê duyệt...", "normal");
            const res = await api(`/api/admin/products/${productId}/approve`, {
                method: "POST"
            });
            toast(res.Message || "Đã phê duyệt sản phẩm thành công!", "success");
            closeDetailModal();
            await refreshAll();
        } catch (err) {
            toast(err.message, "danger");
        }
    }

    // --- Chuyển sản phẩm "Không hợp lệ" sang "Hợp lệ" ---
    async function confirmMarkValid(productId, productTitle) {
        if (!confirm(`Chuyển sản phẩm #${productId} sang danh sách HỢP LỆ?\n\n"${productTitle}"\n\nDùng khi bộ phân loại đánh giá sai. Sau đó bạn có thể phê duyệt sản phẩm ở cột Hợp lệ.`)) {
            return;
        }

        try {
            const res = await api(`/api/admin/products/${productId}/mark-valid`, { method: "POST" });
            toast(res.Message || "Đã chuyển sản phẩm sang danh sách hợp lệ.", "success");
            closeDetailModal();
            await refreshAll();
        } catch (err) {
            toast(err.message, "danger");
        }
    }

    // --- Reject Modal Logic ---
    function openRejectModal(productId, productTitle, suggestedReason = "") {
        state.currentRejectProductId = productId;
        if (rejectModalProductTitle) {
            rejectModalProductTitle.textContent = `#${productId} - ${productTitle || "Sản phẩm"}`;
        }
        const prefill = (suggestedReason || "").trim().slice(0, 1000);
        if (rejectReasonInput) rejectReasonInput.value = prefill;
        if (rejectCharCount) rejectCharCount.textContent = String(prefill.length);
        if (rejectModal) rejectModal.style.display = "flex";
        rejectReasonInput?.focus();
    }

    function closeRejectModal() {
        if (rejectModal) rejectModal.style.display = "none";
        state.currentRejectProductId = null;
    }

    cancelRejectBtn?.addEventListener("click", closeRejectModal);
    cancelRejectModalBtn?.addEventListener("click", closeRejectModal);
    rejectModal?.addEventListener("click", (e) => {
        if (e.target === rejectModal) closeRejectModal();
    });

    // Quick Chips for Rejection Reasons
    rejectChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const reason = chip.dataset.reason;
            if (rejectReasonInput) {
                if (rejectReasonInput.value.trim()) {
                    rejectReasonInput.value = rejectReasonInput.value.trim() + " " + reason;
                } else {
                    rejectReasonInput.value = reason;
                }
                if (rejectCharCount) rejectCharCount.textContent = rejectReasonInput.value.length;
                rejectReasonInput.focus();
            }
        });
    });

    rejectReasonInput?.addEventListener("input", () => {
        if (rejectCharCount) rejectCharCount.textContent = rejectReasonInput.value.length;
    });

    confirmRejectBtn?.addEventListener("click", async () => {
        const reason = (rejectReasonInput?.value || "").trim();
        if (!reason) {
            toast("Vui lòng nhập lý do từ chối để thông báo cho người bán.", "warning");
            rejectReasonInput?.focus();
            return;
        }
        if (reason.length > 1000) {
            toast("Lý do từ chối không được vượt quá 1000 ký tự.", "warning");
            return;
        }

        try {
            toast("Đang gửi kết quả từ chối...", "normal");
            const res = await api(`/api/admin/products/${state.currentRejectProductId}/reject`, {
                method: "POST",
                body: JSON.stringify({ reason })
            });
            toast(res.Message || "Đã từ chối kiểm duyệt sản phẩm.", "warning");
            closeRejectModal();
            closeDetailModal();
            await refreshAll();
        } catch (err) {
            toast(err.message, "danger");
        }
    });

    // --- Lightbox Image Preview ---
    function openLightbox(src) {
        if (!lightboxModal || !lightboxImg) return;
        lightboxImg.src = src;
        lightboxModal.style.display = "flex";
    }

    lightboxModal?.addEventListener("click", () => {
        lightboxModal.style.display = "none";
    });

    // --- Search & Filter Controls ---
    let searchDebounceTimer = null;
    function handleSearch(keyword) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            state.keyword = keyword.trim();
            resetPages();
            if (clearSearchBtn) {
                clearSearchBtn.style.display = state.keyword ? "inline-block" : "none";
            }
            loadProducts();
        }, 350);
    }

    inlineSearchInput?.addEventListener("input", (e) => {
        handleSearch(e.target.value);
        if (topSearchInput) topSearchInput.value = e.target.value;
    });

    topSearchInput?.addEventListener("input", (e) => {
        handleSearch(e.target.value);
        if (inlineSearchInput) inlineSearchInput.value = e.target.value;
    });

    clearSearchBtn?.addEventListener("click", () => {
        if (inlineSearchInput) inlineSearchInput.value = "";
        if (topSearchInput) topSearchInput.value = "";
        clearSearchBtn.style.display = "none";
        state.keyword = "";
        resetPages();
        loadProducts();
    });

    pageSizeSelect?.addEventListener("change", (e) => {
        state.size = Number(e.target.value) || 10;
        resetPages();
        loadProducts();
    });

    refreshBtn?.addEventListener("click", () => {
        refreshBtn.style.transform = "rotate(180deg)";
        refreshBtn.style.transition = "transform .4s ease";
        setTimeout(() => {
            refreshBtn.style.transform = "none";
            refreshBtn.style.transition = "none";
        }, 400);
        loadStats();
        loadProducts();
    });

    // Filter Tabs
    statusTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            statusTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            state.status = tab.dataset.status || "PENDING";
            resetPages();
            loadProducts();
        });
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (lightboxModal && lightboxModal.style.display !== "none") {
                lightboxModal.style.display = "none";
            } else if (rejectModal && rejectModal.style.display !== "none") {
                closeRejectModal();
            } else if (detailModal && detailModal.style.display !== "none") {
                closeDetailModal();
            }
        }
    });

    // --- Admin Role Guard ---
    async function verifyAdminRole() {
        try {
            const res = await fetch('/api/account/me', { credentials: 'include', headers: { Accept: 'application/json' } });
            if (!res.ok) {
                window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
                return false;
            }
            const user = await res.json();
            if (!user || user.role !== 'ADMIN') {
                alert('Tài khoản của bạn (' + (user ? user.email : '') + ') không có quyền Quản trị viên (ADMIN) để truy cập trang này.');
                window.location.href = '/buyer/html/home.html';
                return false;
            }
            return true;
        } catch (e) {
            return true;
        }
    }

    // --- Initial Boot ---
    verifyAdminRole().then(isAdmin => {
        if (!isAdmin) return;
        loadStats();
        loadProducts();
    });
});
