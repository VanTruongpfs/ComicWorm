const toast = document.getElementById("toast");

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


// ==============================
// Toast buttons
// ==============================

document.querySelectorAll("[data-toast]").forEach((button) => {
    button.addEventListener("click", () => {
        showToast(button.dataset.toast);
    });
});


// ==============================
// Rating
// ==============================

const labels = [
    "",
    "Rất tệ",
    "Không hài lòng",
    "Bình thường",
    "Tốt",
    "Tuyệt vời"
];

const ratingGroup = document.querySelector('[data-rating="overall"]');
const ratingText = document.getElementById("overallText");

function renderRating(value, preview = false) {
    ratingGroup.querySelectorAll("button").forEach((button) => {
        const buttonValue = Number(button.dataset.value);
        button.classList.toggle("selected", buttonValue <= value);
        button.setAttribute("aria-pressed", String(!preview && buttonValue === value));
    });
}

ratingGroup.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
        const value = Number(button.dataset.value);
        ratingGroup.dataset.value = value;
        renderRating(value);
        ratingText.textContent = `${value}/5 — ${labels[value]}`;
    });

    button.addEventListener("mouseenter", () => {
        renderRating(Number(button.dataset.value), true);
    });
});

ratingGroup.addEventListener("mouseleave", () => {
    renderRating(Number(ratingGroup.dataset.value || 0));
});


// ==============================
// Review text counter
// ==============================

const reviewText = document.getElementById("reviewText");
const counter = document.getElementById("counter");

reviewText.addEventListener("input", () => {
    counter.textContent = reviewText.value.length;
});


// ==============================
// Review tags
// ==============================

document.querySelectorAll(".tags button").forEach((button) => {

    button.addEventListener("click", () => {
        button.classList.toggle("selected");
    });

});


// ==============================
// Image upload
// ==============================

const uploadBox = document.getElementById("uploadBox");
const input = document.getElementById("photoInput");
const previews = document.getElementById("previews");

let files = [];


uploadBox.addEventListener("click", () => {
    input.click();
});


input.addEventListener("change", () => {

    [...input.files].forEach((file) => {

        // Maximum 5MB
        if (file.size > 5 * 1024 * 1024) {
            showToast(`${file.name} vượt quá 5MB.`);
            return;
        }


        // Only JPG / PNG
        if (!["image/jpeg", "image/png"].includes(file.type)) {
            showToast(`${file.name} không đúng định dạng.`);
            return;
        }


        files.push(file);
    });


    renderPreviews();

    // Cho phép chọn lại cùng một file
    input.value = "";
});


function renderPreviews() {

    previews.innerHTML = "";

    files.forEach((file, index) => {

        const url = URL.createObjectURL(file);

        const wrap = document.createElement("div");

        wrap.className = "preview";

        wrap.innerHTML = `
            <img src="${url}" alt="Ảnh đánh giá">
            <button type="button" aria-label="Xóa">×</button>
        `;


        wrap.querySelector("button").addEventListener("click", () => {

            URL.revokeObjectURL(url);

            files.splice(index, 1);

            renderPreviews();

        });


        previews.appendChild(wrap);

    });
}


// ==============================
// Get review data
// ==============================

function getData() {

    return {

        rating: ratingGroup.dataset.value || "",

        text: reviewText.value,

        tags: [
            ...document.querySelectorAll(".tags .selected")
        ].map((element) => element.dataset.tag)

    };
}


// ==============================
// Apply saved data
// ==============================

function applyData(data) {
    const oldRatings = [data.quality, data.packing, data.seller]
        .map(Number)
        .filter((value) => value > 0);
    const rating = Number(data.rating || (oldRatings.length
        ? Math.round(oldRatings.reduce((sum, value) => sum + value, 0) / oldRatings.length)
        : 0));

    if (rating) {
        ratingGroup.dataset.value = rating;
        renderRating(rating);
        ratingText.textContent = `${rating}/5 — ${labels[rating]}`;
    }


    reviewText.value = data.text || "";

    counter.textContent = reviewText.value.length;


    (data.tags || []).forEach((tag) => {

        const button =
            document.querySelector(
                `.tags button[data-tag="${tag}"]`
            );

        if (button) {
            button.classList.add("selected");
        }

    });

}


// ==============================
// Save draft
// ==============================

document.getElementById("saveDraft").addEventListener("click", () => {

    localStorage.setItem(
        "mangatrade-review-draft",
        JSON.stringify(getData())
    );

    showToast(
        "Đã lưu bản nháp đánh giá trên thiết bị."
    );

});


// ==============================
// Restore draft
// ==============================

const draft =
    localStorage.getItem("mangatrade-review-draft");

if (draft) {

    try {

        applyData(JSON.parse(draft));

        showToast(
            "Đã khôi phục bản nháp đánh giá."
        );

    } catch (error) {

        console.error(
            "Không thể khôi phục bản nháp:",
            error
        );

    }

}


// ==============================
// Submit review
// ==============================

document
    .getElementById("submitReview")
    .addEventListener("click", () => {

        const data = getData();


        // Check rating
        if (!data.rating) {

            showToast(
                "Vui lòng chọn mức đánh giá tổng thể."
            );

            return;
        }


        // Check content
        if (
            !data.text.trim() &&
            !data.tags.length
        ) {

            showToast(
                "Hãy thêm cảm nhận hoặc ít nhất một điểm nổi bật."
            );

            return;
        }


        // Remove saved draft
        localStorage.removeItem(
            "mangatrade-review-draft"
        );


        // Success
        showToast(
            "Đã gửi đánh giá thành công. Cảm ơn bạn đã đóng góp cho cộng đồng!"
        );


        const submitButton =
            document.getElementById("submitReview");

        submitButton.disabled = true;

        submitButton.textContent = "✓ Đã gửi";

    });


// ==============================
// Search
// ==============================

document
    .getElementById("searchInput")
    .addEventListener("keydown", (event) => {

        if (
            event.key === "Enter" &&
            event.target.value.trim()
        ) {

            showToast(
                `Đang tìm kiếm: "${event.target.value.trim()}"`
            );

        }

    });


// ==============================
// Ctrl + K search shortcut
// ==============================

document.addEventListener("keydown", (event) => {

    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
    ) {

        event.preventDefault();

        document
            .getElementById("searchInput")
            .focus();

    }

});


// ==============================
// Newsletter
// ==============================

document
    .getElementById("newsletter")
    .addEventListener("submit", (event) => {

        event.preventDefault();

        showToast(
            "Đăng ký bản tin thành công!"
        );

        document.getElementById("email").value = "";

    });