document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);
    const productDemo = $("#productDemo");
    const communityPost = $("#communityPost");
    const queueList = $(".queue-list");
    const queueCount = $(".queue-count");
    const searchInput = $(".search-input");
    const rejectModal = $("#rejectProductModal");
    const rejectReasonInput = $("#rejectReasonInput");
    const approveButton = $("#productApproveBtn");
    const rejectButton = $("#productRejectBtn");
    const confirmRejectButton = $("#confirmRejectBtn");
    const cancelRejectButton = $("#cancelRejectBtn");
    const skipButton = $(".btn-text");
    const statusText = $(".status-indicator span:last-child");
    const navBadge = $(".nav-badge");

    let pendingProducts = [];
    let visibleProducts = [];
    let currentProductId = null;
    let csrfInfo = null;
    let busy = false;

    function toast(message, type = "normal") {
        document.querySelector(".moderation-toast")?.remove();
        const el = document.createElement("div");
        el.className = "moderation-toast";
        el.textContent = message;
        Object.assign(el.style, {
            position: "fixed", right: "24px", bottom: "24px", zIndex: "99999",
            padding: "12px 18px", borderRadius: "8px", fontSize: "14px", fontWeight: "600",
            boxShadow: "0 8px 20px rgba(15,23,42,.15)", background: "#fff", color: "#0f172a",
            border: `1px solid ${type === "success" ? "#10b981" : type === "danger" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#e2e8f0"}`
        });
        document.body.appendChild(el);
        window.setTimeout(() => el.remove(), 3000);
    }

    async function api(url, options = {}) {
        const headers = { Accept: "application/json", ...(options.headers || {}) };
        if (options.method && options.method !== "GET") {
            if (!csrfInfo) {
                const csrfResponse = await fetch("/api/admin/products/csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
                const csrfData = await csrfResponse.json().catch(() => ({}));
                if (!csrfResponse.ok) throw new Error(csrfData.Message || "Không lấy được CSRF token. Vui lòng đăng nhập lại.");
                csrfInfo = csrfData;
            }
            headers[csrfInfo.headerName || "X-CSRF-TOKEN"] = csrfInfo.token;
        }
        if (options.body) headers["Content-Type"] = "application/json";
        const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại tài khoản quản trị.");
        if (response.status === 403) throw new Error(data.Message || "Bạn không có quyền thực hiện thao tác này hoặc CSRF token hết hạn.");
        if (!response.ok || data.Result === "ERROR") throw new Error(data.Message || "Có lỗi xảy ra khi gọi máy chủ.");
        return data;
    }

    function formatPrice(price) {
        if (price === null || price === undefined || price === "") return "Chưa cập nhật giá";
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(price));
    }

    function formatDate(value) {
        if (!value) return "Chưa rõ thời gian đăng";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
    }

    function setBusy(value) {
        busy = value;
        [approveButton, rejectButton, confirmRejectButton, skipButton].filter(Boolean).forEach(button => {
            button.disabled = value;
            button.style.opacity = value ? ".6" : "1";
            button.style.cursor = value ? "wait" : "pointer";
        });
    }

    function updateCounters(stats) {
        const pending = Number(stats?.pending ?? pendingProducts.length);
        if (navBadge) navBadge.textContent = String(pending);
        if (statusText) statusText.textContent = `Trực tuyến • Đang có ${pending} bài cần xử lý`;
        const pendingNumber = document.querySelector(".metric-card:nth-child(1) .metric-num");
        const approvedNumber = document.querySelector(".metric-card:nth-child(2) .metric-num");
        const rejectedNumber = document.querySelector(".metric-card:nth-child(3) .metric-num");
        if (pendingNumber) pendingNumber.textContent = String(pending).padStart(2, "0");
        if (approvedNumber) approvedNumber.textContent = String(stats?.approved ?? 0).padStart(2, "0");
        if (rejectedNumber) rejectedNumber.textContent = String(stats?.rejected ?? 0).padStart(2, "0");
        if (queueCount) queueCount.textContent = `${visibleProducts.length} bài`;
    }

    function renderProduct(product) {
        if (!product) {
            currentProductId = null;
            if (productDemo) productDemo.style.display = "none";
            if (communityPost) communityPost.style.display = "none";
            const typeBadge = $("#currentPostType");
            if (typeBadge) typeBadge.textContent = "📭 KHÔNG CÓ BÀI ĐĂNG CHỜ DUYỆT";
            let empty = $("#moderationEmptyState");
            if (!empty) {
                empty = document.createElement("div");
                empty.id = "moderationEmptyState";
                empty.style.cssText = "padding:48px 20px;text-align:center;color:#64748b;background:#fff;border:1px solid #e2e8f0;border-radius:12px;";
                productDemo?.parentElement?.appendChild(empty);
            }
            empty.textContent = searchInput?.value.trim() ? "Không tìm thấy sản phẩm phù hợp." : "Tuyệt vời! Hiện không còn sản phẩm nào đang chờ duyệt.";
            if (approveButton) approveButton.disabled = true;
            if (rejectButton) rejectButton.disabled = true;
            if (skipButton) skipButton.disabled = true;
            return;
        }
        $("#moderationEmptyState")?.remove();
        currentProductId = product.id;
        if (productDemo) {
            productDemo.style.display = "flex";
            productDemo.setAttribute("data-product-id", product.id);
        }
        if (communityPost) communityPost.style.display = "none";
        const typeBadge = $("#currentPostType");
        if (typeBadge) typeBadge.textContent = "🛒 BÀI ĐĂNG SẢN PHẨM CHỜ DUYỆT";
        const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
        setText("#productTitle", product.title || "Sản phẩm chưa có tiêu đề");
        setText("#productPrice", formatPrice(product.price));
        setText("#productDescription", product.description || "Người bán chưa cung cấp mô tả.");
        setText("#productSellerInfo", `Người bán: ${product.sellerName || "ID " + (product.sellerId ?? "không rõ")} · ${product.sellerEmail || ""}`);
        setText("#productCategory", `📚 ${product.categoryName || "Chưa phân loại"}`);
        setText("#productCondition", `✨ Tình trạng ${product.conditionPercent ?? "—"}%`);
        setText("#productStock", `📦 Còn ${product.stockQuantity ?? 0} sản phẩm`);
        const cover = $("#productCoverImg");
        if (cover) {
            cover.src = product.coverImageUrl || "https://placehold.co/400x500?text=No+Image";
            cover.alt = product.title || "Ảnh bìa sản phẩm";
            cover.onerror = () => { cover.onerror = null; cover.src = "https://placehold.co/400x500?text=No+Image"; };
        }
        const badge = $("#productStatusBadge");
        if (badge) {
            badge.textContent = product.moderationStatus === "REJECTED" ? "Đã từ chối" : product.moderationStatus === "APPROVED" ? "Đã duyệt" : "Chờ duyệt";
            badge.style.background = "#fef3c7";
            badge.style.color = "#92400e";
        }
        const reasonAlert = $("#productRejectReasonAlert");
        const reasonText = $("#productRejectReasonText");
        if (reasonAlert && reasonText) {
            reasonAlert.style.display = product.moderationReason ? "block" : "none";
            reasonText.textContent = product.moderationReason || "";
        }
        setText(".primary-col .section-title", `Đang kiểm duyệt · #${product.id}`);
        if (approveButton) approveButton.disabled = false;
        if (rejectButton) rejectButton.disabled = false;
        if (skipButton) skipButton.disabled = false;
        renderQueue();
    }

    function renderQueue() {
        if (!queueList) return;
        queueList.replaceChildren();
        visibleProducts.forEach(product => {
            if (product.id === currentProductId) return;
            const item = document.createElement("button");
            item.type = "button";
            item.className = "queue-item";
            item.style.cssText = "display:block;width:100%;text-align:left;cursor:pointer;border:1px solid #e2e8f0;background:#fff;font:inherit;";
            const header = document.createElement("div");
            header.className = "queue-item-header";
            const author = document.createElement("div");
            author.className = "queue-author";
            const avatar = document.createElement("img");
            avatar.className = "avatar avatar-sm";
            avatar.src = product.coverImageUrl || "https://placehold.co/80x80?text=Comic";
            avatar.alt = "Ảnh sản phẩm";
            const authorText = document.createElement("div");
            const title = document.createElement("span");
            title.className = "author-name";
            title.textContent = product.title || `Sản phẩm #${product.id}`;
            const meta = document.createElement("div");
            meta.className = "post-meta";
            meta.textContent = `#${product.id} · ${formatDate(product.createdAt)}`;
            authorText.append(title, meta);
            author.append(avatar, authorText);
            const badge = document.createElement("span");
            badge.className = "badge badge-warning-subtle";
            badge.textContent = "Chờ duyệt";
            header.append(author, badge);
            const snippet = document.createElement("p");
            snippet.className = "queue-snippet";
            snippet.textContent = product.description || "Sản phẩm chưa có mô tả.";
            const footer = document.createElement("div");
            footer.className = "queue-footer";
            const price = document.createElement("span");
            price.className = "violation-tag";
            price.textContent = formatPrice(product.price);
            footer.append(price);
            item.append(header, snippet, footer);
            item.addEventListener("click", () => renderProduct(product));
            queueList.appendChild(item);
        });
        if (!queueList.children.length) {
            const empty = document.createElement("p");
            empty.style.cssText = "padding:16px;color:#64748b;text-align:center;";
            empty.textContent = "Không còn bài nào khác trong hàng đợi.";
            queueList.appendChild(empty);
        }
        if (queueCount) queueCount.textContent = `${visibleProducts.length} bài`;
    }

    async function loadStats() {
        try {
            const data = await api("/api/admin/products/stats");
            updateCounters(data.Stats);
        } catch (error) {
            console.warn("Không tải được thống kê kiểm duyệt:", error.message);
        }
    }

    async function loadPendingProducts(keepCurrent = false) {
        try {
            const previousId = keepCurrent ? currentProductId : null;
            const data = await api("/api/admin/products?status=PENDING&page=0&size=100");
            pendingProducts = Array.isArray(data.Records) ? data.Records : [];
            const keyword = (searchInput?.value || "").trim().toLocaleLowerCase("vi-VN");
            visibleProducts = pendingProducts.filter(p => !keyword || String(p.id).includes(keyword) || (p.title || "").toLocaleLowerCase("vi-VN").includes(keyword) || (p.sellerName || "").toLocaleLowerCase("vi-VN").includes(keyword));
            const selected = visibleProducts.find(p => p.id === previousId) || visibleProducts[0];
            updateCounters(data.Stats);
            renderProduct(selected);
            renderQueue();
            if (!pendingProducts.length) toast("Không có sản phẩm nào đang chờ duyệt.", "success");
        } catch (error) {
            if (productDemo) productDemo.style.display = "none";
            if (communityPost) communityPost.style.display = "none";
            if (queueList) queueList.innerHTML = "<p style='padding:16px;color:#dc2626'>Không tải được danh sách. " + escapeHtml(error.message) + "</p>";
            toast(error.message, "danger");
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }

    async function moderate(action, reason) {
        if (!currentProductId || busy) return;
        const productId = currentProductId;
        setBusy(true);
        try {
            const options = { method: "POST", headers: { Accept: "application/json" } };
            if (action === "reject") options.body = JSON.stringify({ reason });
            const result = await api(`/api/admin/products/${productId}/${action}`, options);
            pendingProducts = pendingProducts.filter(p => p.id !== productId);
            visibleProducts = visibleProducts.filter(p => p.id !== productId);
            if (rejectModal) rejectModal.style.display = "none";
            toast(result.Message || (action === "approve" ? "Đã duyệt sản phẩm." : "Đã từ chối sản phẩm."), action === "approve" ? "success" : "warning");
            currentProductId = null;
            await loadPendingProducts();
            await loadStats();
        } catch (error) {
            toast(error.message, "danger");
        } finally {
            setBusy(false);
        }
    }

    approveButton?.addEventListener("click", () => {
        if (!currentProductId || busy) return;
        if (confirm("Xác nhận phê duyệt sản phẩm này? Sản phẩm sẽ được chuyển sang trạng thái Đã duyệt.")) moderate("approve");
    });

    rejectButton?.addEventListener("click", () => {
        if (!currentProductId || busy) return;
        if (rejectReasonInput) rejectReasonInput.value = "";
        if (rejectModal) rejectModal.style.display = "flex";
        rejectReasonInput?.focus();
    });

    cancelRejectButton?.addEventListener("click", () => { if (rejectModal) rejectModal.style.display = "none"; });
    rejectModal?.addEventListener("click", event => { if (event.target === rejectModal) rejectModal.style.display = "none"; });
    confirmRejectButton?.addEventListener("click", () => {
        const reason = (rejectReasonInput?.value || "").trim();
        if (!reason) { toast("Vui lòng nhập lý do từ chối.", "warning"); rejectReasonInput?.focus(); return; }
        if (reason.length > 1000) { toast("Lý do từ chối tối đa 1000 ký tự.", "warning"); return; }
        moderate("reject", reason);
    });

    skipButton?.addEventListener("click", () => {
        if (!visibleProducts.length) return;
        const next = visibleProducts.find(p => p.id !== currentProductId);
        if (next) renderProduct(next);
        else toast("Không còn sản phẩm khác trong hàng đợi.", "warning");
    });

    searchInput?.addEventListener("input", () => {
        const keyword = searchInput.value.trim().toLocaleLowerCase("vi-VN");
        visibleProducts = pendingProducts.filter(p => !keyword || String(p.id).includes(keyword) || (p.title || "").toLocaleLowerCase("vi-VN").includes(keyword) || (p.sellerName || "").toLocaleLowerCase("vi-VN").includes(keyword));
        const selected = visibleProducts.find(p => p.id === currentProductId) || visibleProducts[0];
        renderProduct(selected);
        renderQueue();
    });

    // Trang này hiện chỉ kiểm duyệt sản phẩm; ẩn tab cộng đồng demo để không gây hiểu nhầm.
    document.querySelectorAll(".post-type-tab").forEach(tab => {
        if (tab.dataset.type === "article") tab.style.display = "none";
        else tab.addEventListener("click", () => tab.classList.add("active"));
    });
    if (communityPost) communityPost.style.display = "none";
    if (productDemo) productDemo.style.display = "flex";
    loadPendingProducts();
    loadStats();
});
