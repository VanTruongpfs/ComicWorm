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
// Dynamic Data Loading from API
// ==============================
let currentOrderItemId = null;
let allLoadedItems = [];

async function loadReviewTarget() {
    const params = new URLSearchParams(window.location.search);
    const orderItemIdParam = params.get("orderItemId");
    const orderIdParam = params.get("orderId");
    const orderCodeParam = params.get("orderCode");

    const alertBox = document.getElementById("reviewAlertBox");
    const submitBtn = document.getElementById("submitReview");
    const saveDraftBtn = document.getElementById("saveDraft");
    const selectorContainer = document.getElementById("itemSelectorContainer");
    const selectDropdown = document.getElementById("itemSelectDropdown");

    function showAlert(msg, type = "info") {
        if (!alertBox) return;
        alertBox.style.display = "block";
        if (type === "warning" || type === "error") {
            alertBox.style.background = "#fff5f5";
            alertBox.style.color = "#c53030";
            alertBox.style.border = "1px solid #feb2b2";
        } else if (type === "success") {
            alertBox.style.background = "#f0fff4";
            alertBox.style.color = "#276749";
            alertBox.style.border = "1px solid #9ae6b4";
        } else {
            alertBox.style.background = "#ebf8ff";
            alertBox.style.color = "#2b6cb0";
            alertBox.style.border = "1px solid #bee3f8";
        }
        alertBox.innerHTML = msg;
    }

    function hideAlert() {
        if (alertBox) alertBox.style.display = "none";
    }

    try {
        let apiUrl = "";
        if (orderItemIdParam) {
            apiUrl = `/api/reviews/item/${orderItemIdParam}`;
        } else if (orderIdParam) {
            apiUrl = `/api/reviews/order/${orderIdParam}`;
        } else if (orderCodeParam) {
            apiUrl = `/api/reviews/order-code/${encodeURIComponent(orderCodeParam)}`;
        } else {
            apiUrl = `/api/reviews/my-items`;
        }

        const res = await fetch(apiUrl, { credentials: "include" });
        if (res.status === 401) {
            showAlert("Vui lòng <a href='/auth/login' style='text-decoration:underline; font-weight:bold; color:#2b6cb0;'>đăng nhập</a> để xem các đơn hàng đã mua và thực hiện đánh giá truyện.", "warning");
            isFormDisabled = true;
            if (submitBtn) submitBtn.disabled = true;
            if (saveDraftBtn) saveDraftBtn.style.display = "none";
            return;
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showAlert(errData.message || "Không thể tải thông tin đơn hàng từ máy chủ.", "error");
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        const rawData = await res.json();
        const items = Array.isArray(rawData) ? rawData : [rawData];
        allLoadedItems = items;

        if (items.length === 0) {
            showAlert("Bạn chưa có đơn hàng nào đã hoàn tất giao hàng (COMPLETED) trong hệ thống để đánh giá.<br>Chỉ những đơn hàng đã giao thành công mới có thể gửi đánh giá.", "info");
            isFormDisabled = true;
            if (submitBtn) submitBtn.disabled = true;
            if (saveDraftBtn) saveDraftBtn.style.display = "none";
            return;
        }

        // Render Dropdown nếu có nhiều sản phẩm
        if (items.length > 1 && selectorContainer && selectDropdown) {
            selectorContainer.style.display = "block";
            selectDropdown.innerHTML = "";
            items.forEach((item, index) => {
                const opt = document.createElement("option");
                opt.value = item.orderItemId;
                const statusTag = item.reviewed ? "✓ [Đã đánh giá]" : "★ [Chưa đánh giá]";
                const priceFormatted = Number(item.unitPrice || 0).toLocaleString("vi-VN");
                opt.textContent = `${statusTag} #${item.orderCode} - ${item.productTitle} (${priceFormatted}₫)`;
                selectDropdown.appendChild(opt);
            });

            selectDropdown.addEventListener("change", (e) => {
                const selectedId = Number(e.target.value);
                const target = items.find((it) => it.orderItemId === selectedId);
                if (target) displaySelectedItem(target);
            });
        }

        // Chọn item mục tiêu: ưu tiên item khớp orderItemId/orderCode, hoặc item chưa đánh giá đầu tiên
        let chosenItem = null;
        if (orderItemIdParam) {
            chosenItem = items.find((it) => String(it.orderItemId) === String(orderItemIdParam));
        } else if (orderCodeParam) {
            chosenItem = items.find((it) => String(it.orderCode) === String(orderCodeParam));
        }
        if (!chosenItem) {
            chosenItem = items.find((it) => !it.reviewed && it.orderStatus === "COMPLETED") || items[0];
        }

        if (selectDropdown && chosenItem) {
            selectDropdown.value = chosenItem.orderItemId;
        }

        displaySelectedItem(chosenItem);

    } catch (e) {
        console.error("Lỗi khi tải dữ liệu đánh giá từ DB:", e);
        showAlert("Lỗi kết nối khi tải dữ liệu từ máy chủ. Vui lòng tải lại trang.", "error");
    }

    function displaySelectedItem(item) {
        if (!item) return;
        currentOrderItemId = item.orderItemId;

        const orderTitle = document.getElementById("orderTitle");
        const productSubTitle = document.getElementById("productSubTitle");
        const orderStatusBadge = document.getElementById("orderStatusBadge");
        const productImg = document.getElementById("productImg");
        const productTitle = document.getElementById("productTitle");
        const productCondition = document.getElementById("productCondition");
        const productPrice = document.getElementById("productPrice");
        const sellerSideName = document.getElementById("sellerSideName");
        const sellerSideAvatar = document.getElementById("sellerSideAvatar");

        if (orderTitle) orderTitle.textContent = `Đánh giá đơn hàng #${item.orderCode || item.orderId}`;
        if (productSubTitle) productSubTitle.textContent = item.productTitle || "";
        if (productTitle) productTitle.textContent = item.productTitle || "";
        if (productImg) {
            if (item.imageUrl) {
                productImg.src = item.imageUrl;
            } else {
                productImg.src = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80";
            }
        }
        if (productCondition) {
            productCondition.textContent = `Độ mới ${item.conditionPercent || 100}% • Số lượng: ${item.quantity || 1}`;
        }
        if (productPrice) {
            const price = Number(item.unitPrice || 0).toLocaleString("vi-VN");
            productPrice.textContent = `${price}₫`;
        }
        if (sellerSideName && item.sellerName) {
            sellerSideName.textContent = item.sellerName;
        }
        if (sellerSideAvatar && item.sellerName) {
            sellerSideAvatar.textContent = item.sellerName.substring(0, 2).toUpperCase();
        }

        // 1. Kiểm tra trạng thái đơn hàng COMPLETED
        if (item.orderStatus !== "COMPLETED") {
            isFormDisabled = true;
            if (orderStatusBadge) {
                orderStatusBadge.textContent = "Chưa hoàn tất";
                orderStatusBadge.style.background = "#fed7d7";
                orderStatusBadge.style.color = "#c53030";
            }
            showAlert(`⚠️ Đơn hàng này <strong>chưa hoàn tất thành công</strong> (${item.orderStatus}). Bạn chỉ có thể đánh giá sau khi đơn hàng được giao thành công.`, "warning");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Chưa thể đánh giá";
            }
            if (saveDraftBtn) saveDraftBtn.style.display = "none";
            return;
        }

        if (orderStatusBadge) {
            orderStatusBadge.textContent = "✓ Đã hoàn thành";
            orderStatusBadge.style.background = "#c6f6d5";
            orderStatusBadge.style.color = "#22543d";
        }

        // 2. Kiểm tra đã đánh giá chưa
        if (item.reviewed) {
            isFormDisabled = true;
            const reviewDate = item.existingCreatedAt ? new Date(item.existingCreatedAt).toLocaleDateString("vi-VN") : "trước đó";
            showAlert(`✓ Bạn đã đánh giá sản phẩm này (${item.existingRating}★) vào ngày <strong>${reviewDate}</strong>.`, "success");
            setRatingValue("overall", item.existingRating);
            setRatingValue("quality", item.existingProductQualityRating || item.existingRating);
            setRatingValue("seller", item.existingSellerAttitudeRating || item.existingRating);
            if (reviewText) {
                reviewText.value = item.existingContent || "";
                reviewText.disabled = true;
                if (counter) counter.textContent = reviewText.value.length;
            }
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "✓ Đã đánh giá";
            }
            if (saveDraftBtn) saveDraftBtn.style.display = "none";
        } else {
            // Chưa đánh giá -> Mở form cho phép đánh giá
            isFormDisabled = false;
            hideAlert();
            setRatingValue("overall", 0);
            setRatingValue("quality", 0);
            setRatingValue("seller", 0);
            if (reviewText) {
                reviewText.value = "";
                reviewText.disabled = false;
                if (counter) counter.textContent = "0";
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Gửi đánh giá";
            }
            if (saveDraftBtn) {
                saveDraftBtn.disabled = false;
                saveDraftBtn.style.display = "inline-block";
            }
        }
    }
}

// ==============================
// Submit Review Handler
// ==============================
const submitButton = document.getElementById("submitReview");

if (submitButton) {
    submitButton.addEventListener("click", async () => {
        if (isFormDisabled) return;

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

        const content = reviewText ? reviewText.value.trim() : "";
        const orderItemIdToSubmit = currentOrderItemId || new URLSearchParams(window.location.search).get("orderItemId");

        if (!orderItemIdToSubmit) {
            showToast("Không tìm thấy thông tin sản phẩm trong đơn để gửi đánh giá.");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Đang gửi...";

        try {
            const response = await fetch("/api/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    orderItemId: Number(orderItemIdToSubmit),
                    rating: overall,
                    productQualityRating: quality,
                    sellerAttitudeRating: seller,
                    content: content
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                showToast(err.message || "Gửi đánh giá thất bại. Vui lòng thử lại!");
                submitButton.disabled = false;
                submitButton.textContent = "Gửi đánh giá";
                return;
            }

            showToast("✓ Đã gửi đánh giá thành công! Cảm ơn bạn.");
            submitButton.textContent = "✓ Đã gửi";
            isFormDisabled = true;

            // Xóa bản nháp
            localStorage.removeItem("comicworm-review-draft");

            // Điều hướng quay lại trang Quản lý đơn hàng sau 1.5s
            setTimeout(() => {
                window.location.href = "page2.html";
            }, 1500);

        } catch (error) {
            console.error("Lỗi gửi đánh giá:", error);
            showToast("Lỗi kết nối máy chủ khi gửi đánh giá.");
            submitButton.disabled = false;
            submitButton.textContent = "Gửi đánh giá";
        }
    });
}

// ==============================
// Draft Handling
// ==============================
const saveDraftBtn = document.getElementById("saveDraft");
if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", () => {
        if (isFormDisabled) return;
        const draft = {
            overall: criteriaConfig.overall.group?.dataset.value,
            quality: criteriaConfig.quality.group?.dataset.value,
            seller: criteriaConfig.seller.group?.dataset.value,
            content: reviewText ? reviewText.value : ""
        };
        localStorage.setItem("comicworm-review-draft", JSON.stringify(draft));
        showToast("Đã lưu bản nháp đánh giá trên thiết bị.");
    });
}

// Khôi phục nháp nếu chưa có đánh giá
document.addEventListener("DOMContentLoaded", () => {
    loadReviewTarget();

    const savedDraft = localStorage.getItem("comicworm-review-draft");
    if (savedDraft && !isFormDisabled) {
        try {
            const data = JSON.parse(savedDraft);
            if (data.overall) setRatingValue("overall", data.overall);
            if (data.quality) setRatingValue("quality", data.quality);
            if (data.seller) setRatingValue("seller", data.seller);
            if (data.content && reviewText) {
                reviewText.value = data.content;
                if (counter) counter.textContent = data.content.length;
            }
        } catch (_) {}
    }
});