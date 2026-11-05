const toast = document.getElementById("toast");

function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");

    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

// ==============================
// Rating Criteria Labels & Setup
// ==============================
const criteriaConfig = {
    overall: {
        group: document.querySelector('[data-rating="overall"]'),
        text: document.getElementById("overallText"),
        labels: ["", "1/5 — Rất tệ", "2/5 — Không hài lòng", "3/5 — Bình thường", "4/5 — Tốt", "5/5 — Tuyệt vời"]
    },
    quality: {
        group: document.querySelector('[data-rating="quality"]'),
        text: document.getElementById("qualityText"),
        labels: ["", "1/5 — Kém, không đúng mô tả", "2/5 — Có lỗi / cũ nhiều", "3/5 — Chấp nhận được", "4/5 — Khá đẹp, đúng mô tả", "5/5 — Rất đẹp, như mới"]
    },
    seller: {
        group: document.querySelector('[data-rating="seller"]'),
        text: document.getElementById("sellerText"),
        labels: ["", "1/5 — Rất thiếu thiện chí", "2/5 — Chậm chạp, khó chịu", "3/5 — Bình thường", "4/5 — Thân thiện, hỗ trợ tốt", "5/5 — Rất nhiệt tình, chu đáo"]
    }
};

let isFormDisabled = false;

function setupRatingBlock(key) {
    const config = criteriaConfig[key];
    if (!config || !config.group) return;

    function renderRating(value, preview = false) {
        config.group.querySelectorAll("button").forEach((btn) => {
            const val = Number(btn.dataset.value);
            btn.classList.toggle("selected", val <= value);
            btn.setAttribute("aria-pressed", String(!preview && val === value));
        });
    }

    config.group.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (isFormDisabled) return;
            const value = Number(btn.dataset.value);
            config.group.dataset.value = value;
            renderRating(value);
            if (config.text) config.text.textContent = config.labels[value] || `${value}/5`;
        });

        btn.addEventListener("mouseenter", () => {
            if (isFormDisabled) return;
            renderRating(Number(btn.dataset.value), true);
        });
    });

    config.group.addEventListener("mouseleave", () => {
        if (isFormDisabled) return;
        renderRating(Number(config.group.dataset.value || 0));
    });
}

Object.keys(criteriaConfig).forEach(setupRatingBlock);

function setRatingValue(key, value) {
    const config = criteriaConfig[key];
    if (!config || !config.group) return;
    const num = Number(value) || 0;
    config.group.dataset.value = num;
    config.group.querySelectorAll("button").forEach((btn) => {
        const val = Number(btn.dataset.value);
        btn.classList.toggle("selected", val <= num);
    });
    if (config.text) {
        config.text.textContent = config.labels[num] || (num > 0 ? `${num}/5` : "Chọn mức đánh giá");
    }
}

// ==============================
// Review text counter & Tags
// ==============================
const reviewText = document.getElementById("reviewText");
const counter = document.getElementById("counter");

if (reviewText && counter) {
    reviewText.addEventListener("input", () => {
        counter.textContent = reviewText.value.length;
    });
}

document.querySelectorAll(".tags button").forEach((button) => {
    button.addEventListener("click", () => {
        if (isFormDisabled) return;
        button.classList.toggle("selected");
        const tag = button.dataset.tag;
        if (tag && reviewText && button.classList.contains("selected")) {
            if (!reviewText.value.includes(tag)) {
                reviewText.value = reviewText.value ? `${reviewText.value.trim()}, ${tag}` : tag;
                if (counter) counter.textContent = reviewText.value.length;
            }
        }
    });
});

// ==============================
// Image Upload Previews
// ==============================
const uploadBox = document.getElementById("uploadBox");
const photoInput = document.getElementById("photoInput");
const previews = document.getElementById("previews");
let uploadedFiles = [];

if (uploadBox && photoInput) {
    uploadBox.addEventListener("click", () => {
        if (!isFormDisabled) photoInput.click();
    });

    photoInput.addEventListener("change", () => {
        [...photoInput.files].forEach((file) => {
            if (file.size > 5 * 1024 * 1024) {
                showToast(`${file.name} vượt quá 5MB.`);
                return;
            }
            if (!["image/jpeg", "image/png"].includes(file.type)) {
                showToast(`${file.name} không đúng định dạng JPG/PNG.`);
                return;
            }
            uploadedFiles.push(file);
        });
        renderPreviews();
        photoInput.value = "";
    });
}

function renderPreviews() {
    if (!previews) return;
    previews.innerHTML = "";
    uploadedFiles.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        const wrap = document.createElement("div");
        wrap.className = "preview";
        wrap.innerHTML = `
            <img src="${url}" alt="Ảnh đánh giá">
            <button type="button" aria-label="Xóa">×</button>
        `;
        wrap.querySelector("button").addEventListener("click", () => {
            if (isFormDisabled) return;
            URL.revokeObjectURL(url);
            uploadedFiles.splice(index, 1);
            renderPreviews();
        });
        previews.appendChild(wrap);
    });
}

// ==============================
// Danh sách Chưa đánh giá / Đã đánh giá
// ==============================
const FALLBACK_COVER = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80";
const DRAFT_KEY_PREFIX = "comicworm-review-draft:";

const pageParams = new URLSearchParams(window.location.search);
const alertBox = document.getElementById("reviewAlertBox");
const listView = document.getElementById("reviewListView");
const formView = document.getElementById("reviewFormView");
const pendingList = document.getElementById("pendingList");
const reviewedList = document.getElementById("reviewedList");
const submitButton = document.getElementById("submitReview");
const saveDraftBtn = document.getElementById("saveDraft");
const sellerPanel = document.getElementById("sellerPanel");

let allLoadedItems = [];
let currentItem = null;

function showAlert(html, type = "info") {
    if (!alertBox) return;
    const palette = {
        error: ["#fff5f5", "#c53030", "#feb2b2"],
        warning: ["#fff5f5", "#c53030", "#feb2b2"],
        success: ["#f0fff4", "#276749", "#9ae6b4"],
        info: ["#ebf8ff", "#2b6cb0", "#bee3f8"]
    };
    const [bg, color, border] = palette[type] || palette.info;
    alertBox.style.display = "block";
    alertBox.style.background = bg;
    alertBox.style.color = color;
    alertBox.style.border = `1px solid ${border}`;
    // Chỉ truyền HTML tĩnh do trang tự tạo, không chứa dữ liệu người dùng.
    alertBox.innerHTML = html;
}

function hideAlert() {
    if (alertBox) alertBox.style.display = "none";
}

function formatPrice(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")}₫`;
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("vi-VN");
}

function starString(rating) {
    const value = Math.max(0, Math.min(5, Number(rating) || 0));
    return "★".repeat(value) + "☆".repeat(5 - value);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function isPending(item) {
    return item.orderStatus === "COMPLETED" && !item.reviewed;
}

function reviewApiUrl() {
    if (pageParams.get("orderItemId")) return `/api/reviews/item/${encodeURIComponent(pageParams.get("orderItemId"))}`;
    if (pageParams.get("orderId")) return `/api/reviews/order/${encodeURIComponent(pageParams.get("orderId"))}`;
    if (pageParams.get("orderCode")) return `/api/reviews/order-code/${encodeURIComponent(pageParams.get("orderCode"))}`;
    return "/api/reviews/my-items";
}

async function fetchReviewItems() {
    const res = await fetch(reviewApiUrl(), { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
        const error = new Error("unauthorized");
        error.status = 401;
        throw error;
    }
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Không thể tải thông tin đơn hàng từ máy chủ.");
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [data];
}

function itemThumb(item) {
    const img = el("img", "review-item-thumb");
    img.src = item.imageUrl || FALLBACK_COVER;
    img.alt = item.productTitle || "Sản phẩm";
    img.loading = "lazy";
    img.addEventListener("error", () => { img.src = FALLBACK_COVER; }, { once: true });
    return img;
}

function itemHeader(item) {
    const head = el("div", "review-item-head");
    head.appendChild(el("h3", "review-item-title", item.productTitle || "Sản phẩm"));
    head.appendChild(el("span", "review-item-order", `#${item.orderCode || item.orderId}`));
    return head;
}

function createPendingCard(item) {
    const card = el("article", "review-item");
    card.dataset.orderItemId = String(item.orderItemId);
    card.appendChild(itemThumb(item));

    const body = el("div", "review-item-body");
    body.appendChild(itemHeader(item));
    body.appendChild(el("p", "review-item-meta",
        `${item.sellerName || "Người bán"} • ${formatPrice(item.unitPrice)} • SL: ${item.quantity || 1}`));
    card.appendChild(body);

    const action = el("button", "btn primary review-item-action", "Đánh giá");
    action.type = "button";
    action.addEventListener("click", () => openReviewForm(item));
    card.appendChild(action);
    return card;
}

function createReviewedCard(item) {
    const card = el("article", "review-item reviewed");
    card.dataset.orderItemId = String(item.orderItemId);
    card.appendChild(itemThumb(item));

    const body = el("div", "review-item-body");
    body.appendChild(itemHeader(item));
    body.appendChild(el("p", "review-item-meta", `${item.sellerName || "Người bán"} • ${formatPrice(item.unitPrice)}`));

    const ratingLine = el("div", "review-item-rating");
    const stars = el("span", "review-item-stars", starString(item.existingRating));
    stars.setAttribute("aria-label", `${item.existingRating || 0} trên 5 sao`);
    ratingLine.appendChild(stars);
    ratingLine.appendChild(el("span", "review-item-date", `Đánh giá ngày ${formatDate(item.existingCreatedAt)}`));
    body.appendChild(ratingLine);

    body.appendChild(el("p", "review-item-sub",
        `Chất lượng: ${item.existingProductQualityRating || item.existingRating}★ • `
        + `Thái độ người bán: ${item.existingSellerAttitudeRating || item.existingRating}★`));

    const content = (item.existingContent || "").trim();
    body.appendChild(el("p", content ? "review-item-content" : "review-item-content muted",
        content || "Bạn không để lại nhận xét."));

    const reply = item.sellerReply;
    if (reply && reply.content) {
        const box = el("div", "seller-reply-box");
        const replyHead = el("div", "seller-reply-head");
        replyHead.appendChild(el("strong", null, `${reply.sellerName || item.sellerName || "Người bán"} phản hồi`));
        const edited = reply.updatedAt && reply.createdAt && reply.updatedAt !== reply.createdAt;
        replyHead.appendChild(el("span", null,
            formatDate(edited ? reply.updatedAt : reply.createdAt) + (edited ? " (đã sửa)" : "")));
        box.appendChild(replyHead);
        box.appendChild(el("p", null, reply.content));
        body.appendChild(box);
    } else {
        body.appendChild(el("p", "seller-reply-empty", "Người bán chưa phản hồi đánh giá này."));
    }

    card.appendChild(body);
    return card;
}

function renderList(container, items, factory, emptyText) {
    if (!container) return;
    container.replaceChildren();
    if (items.length === 0) {
        container.appendChild(el("p", "review-empty", emptyText));
        return;
    }
    items.forEach((item) => container.appendChild(factory(item)));
}

function renderReviewLists() {
    const pending = allLoadedItems.filter(isPending);
    const reviewed = allLoadedItems
        .filter((it) => it.reviewed)
        .sort((a, b) => String(b.existingCreatedAt || "").localeCompare(String(a.existingCreatedAt || "")));
    const waiting = allLoadedItems.filter((it) => !it.reviewed && it.orderStatus !== "COMPLETED");

    document.getElementById("pendingCount").textContent = pending.length;
    document.getElementById("reviewedCount").textContent = reviewed.length;

    renderList(pendingList, pending, createPendingCard,
        "Không có sản phẩm nào đang chờ bạn đánh giá. Chỉ đơn hàng đã hoàn tất mới có thể đánh giá.");
    renderList(reviewedList, reviewed, createReviewedCard, "Bạn chưa đánh giá sản phẩm nào.");

    const waitingNote = document.getElementById("waitingNote");
    if (waitingNote) {
        waitingNote.hidden = waiting.length === 0;
        waitingNote.textContent = waiting.length
            ? `Còn ${waiting.length} sản phẩm thuộc đơn hàng chưa hoàn tất. Bạn có thể đánh giá sau khi đơn hàng được giao thành công.`
            : "";
    }

    const scopeNote = document.getElementById("reviewScopeNote");
    const scoped = pageParams.get("orderId") || pageParams.get("orderCode") || pageParams.get("orderItemId");
    if (scopeNote) {
        scopeNote.hidden = !scoped;
        scopeNote.replaceChildren();
        if (scoped) {
            const first = allLoadedItems[0];
            scopeNote.appendChild(document.createTextNode(
                `Đang hiển thị sản phẩm của đơn #${first ? (first.orderCode || first.orderId) : ""}. `));
            const allLink = el("a", null, "Xem tất cả sản phẩm đã mua");
            allLink.href = "page4.html";
            scopeNote.appendChild(allLink);
        }
    }
    return { pending, reviewed };
}

function switchTab(tab) {
    document.querySelectorAll(".review-tab").forEach((btn) => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
    });
    if (pendingList) pendingList.hidden = tab !== "pending";
    if (reviewedList) reviewedList.hidden = tab !== "reviewed";
}

document.querySelectorAll(".review-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function highlightCard(orderItemId) {
    const card = document.querySelector(`.review-item[data-order-item-id="${CSS.escape(String(orderItemId))}"]`);
    if (!card) return;
    card.classList.add("highlight");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => card.classList.remove("highlight"), 2500);
}

function showListView() {
    currentItem = null;
    if (formView) formView.hidden = true;
    if (listView) listView.hidden = false;
    if (sellerPanel) sellerPanel.hidden = true;
}

const backToListBtn = document.getElementById("backToList");
if (backToListBtn) {
    backToListBtn.addEventListener("click", () => {
        hideAlert();
        showListView();
    });
}

// ==============================
// Form đánh giá cho một sản phẩm
// ==============================
function resetForm() {
    ["overall", "quality", "seller"].forEach((key) => setRatingValue(key, 0));
    if (reviewText) {
        reviewText.value = "";
        reviewText.disabled = false;
    }
    if (counter) counter.textContent = "0";
    document.querySelectorAll(".tags button.selected").forEach((btn) => btn.classList.remove("selected"));
    uploadedFiles = [];
    renderPreviews();
}

function restoreDraft(orderItemId) {
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + orderItemId);
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        if (data.overall) setRatingValue("overall", data.overall);
        if (data.quality) setRatingValue("quality", data.quality);
        if (data.seller) setRatingValue("seller", data.seller);
        if (data.content && reviewText) {
            reviewText.value = data.content;
            if (counter) counter.textContent = data.content.length;
        }
    } catch (_) {
        localStorage.removeItem(DRAFT_KEY_PREFIX + orderItemId);
    }
}

function openReviewForm(item) {
    if (!item || !isPending(item)) return;
    currentItem = item;
    hideAlert();

    document.getElementById("orderTitle").textContent = `Đánh giá đơn hàng #${item.orderCode || item.orderId}`;
    document.getElementById("productSubTitle").textContent = item.productTitle || "";
    document.getElementById("productTitle").textContent = item.productTitle || "";
    const productImg = document.getElementById("productImg");
    productImg.src = item.imageUrl || FALLBACK_COVER;
    productImg.alt = item.productTitle || "Sản phẩm";
    document.getElementById("productCondition").textContent =
        `Độ mới ${item.conditionPercent || 100}% • Số lượng: ${item.quantity || 1}`;
    document.getElementById("productPrice").textContent = formatPrice(item.unitPrice);

    const sellerName = item.sellerName || "Người bán";
    document.getElementById("sellerSideName").textContent = sellerName;
    document.getElementById("sellerSideAvatar").textContent = sellerName.substring(0, 2).toUpperCase();
    if (sellerPanel) sellerPanel.hidden = false;

    isFormDisabled = false;
    resetForm();
    restoreDraft(item.orderItemId);
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Gửi đánh giá";
    }
    if (saveDraftBtn) {
        saveDraftBtn.disabled = false;
        saveDraftBtn.style.display = "inline-block";
    }

    if (listView) listView.hidden = true;
    if (formView) formView.hidden = false;
    formView?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ==============================
// Tải dữ liệu
// ==============================
async function loadReviewList() {
    try {
        allLoadedItems = await fetchReviewItems();
    } catch (error) {
        if (error.status === 401) {
            showAlert("Vui lòng <a href='/auth/login' style='text-decoration:underline; font-weight:bold; color:#2b6cb0;'>đăng nhập</a> để xem các sản phẩm đã mua và đánh giá truyện.", "warning");
        } else {
            console.error("Lỗi khi tải dữ liệu đánh giá:", error);
            showAlert("Không thể tải danh sách sản phẩm đã mua. Vui lòng tải lại trang.", "error");
        }
        allLoadedItems = [];
        renderReviewLists();
        return null;
    }
    return renderReviewLists();
}

async function initReviewPage() {
    const lists = await loadReviewList();
    if (!lists) return;

    const targetId = pageParams.get("orderItemId");
    const target = targetId ? allLoadedItems.find((it) => String(it.orderItemId) === String(targetId)) : null;

    if (target && isPending(target)) {
        switchTab("pending");
        openReviewForm(target);
        return;
    }
    if (target && target.reviewed) {
        switchTab("reviewed");
        highlightCard(target.orderItemId);
        return;
    }
    if (target) {
        showAlert("⚠️ Đơn hàng của sản phẩm này <strong>chưa hoàn tất</strong>. Bạn chỉ có thể đánh giá sau khi đơn hàng được giao thành công.", "warning");
    }
    switchTab(lists.pending.length > 0 || lists.reviewed.length === 0 ? "pending" : "reviewed");
}

// ==============================
// Submit Review Handler
// ==============================
if (submitButton) {
    submitButton.addEventListener("click", async () => {
        if (isFormDisabled || !currentItem) return;

        const overall = Number(criteriaConfig.overall.group?.dataset.value || 0);
        const quality = Number(criteriaConfig.quality.group?.dataset.value || 0);
        const seller = Number(criteriaConfig.seller.group?.dataset.value || 0);

        if (!overall) {
            showToast("Vui lòng chọn số sao Đánh giá tổng thể.");
            criteriaConfig.overall.group?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        if (!quality) {
            showToast("Vui lòng chọn mức Chất lượng sản phẩm.");
            criteriaConfig.quality.group?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        if (!seller) {
            showToast("Vui lòng chọn mức độ hài lòng về Thái độ người bán.");
            criteriaConfig.seller.group?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        const orderItemId = currentItem.orderItemId;
        submitButton.disabled = true;
        submitButton.textContent = "Đang gửi...";

        try {
            const response = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    orderItemId: Number(orderItemId),
                    rating: overall,
                    productQualityRating: quality,
                    sellerAttitudeRating: seller,
                    content: reviewText ? reviewText.value.trim() : ""
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                showToast(err.message || "Gửi đánh giá thất bại. Vui lòng thử lại!");
                submitButton.disabled = false;
                submitButton.textContent = "Gửi đánh giá";
                return;
            }

            localStorage.removeItem(DRAFT_KEY_PREFIX + orderItemId);
            showToast("✓ Đã gửi đánh giá thành công! Cảm ơn bạn.");
            isFormDisabled = true;
            showListView();
            await loadReviewList();
            switchTab("reviewed");
            highlightCard(orderItemId);
        } catch (error) {
            console.error("Lỗi gửi đánh giá:", error);
            showToast("Lỗi kết nối máy chủ khi gửi đánh giá.");
            submitButton.disabled = false;
            submitButton.textContent = "Gửi đánh giá";
        }
    });
}

// ==============================
// Draft Handling (lưu theo từng sản phẩm)
// ==============================
if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", () => {
        if (isFormDisabled || !currentItem) return;
        const draft = {
            overall: criteriaConfig.overall.group?.dataset.value,
            quality: criteriaConfig.quality.group?.dataset.value,
            seller: criteriaConfig.seller.group?.dataset.value,
            content: reviewText ? reviewText.value : ""
        };
        localStorage.setItem(DRAFT_KEY_PREFIX + currentItem.orderItemId, JSON.stringify(draft));
        showToast("Đã lưu bản nháp đánh giá trên thiết bị.");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    localStorage.removeItem("comicworm-review-draft"); // khóa nháp dùng chung cũ, không còn dùng
    initReviewPage();
});
