function setFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.setAttribute("aria-invalid", String(Boolean(message)));
    if (errorEl) errorEl.textContent = message;
}

function showToast(message, type = "error") {
    const region = document.querySelector("[data-toast-region]");
    if (!region) return;
    region.replaceChildren();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4000);
}

const STORAGE_KEY = "bookmooch_complaints";
const form = document.querySelector("#complain-form");
const list = document.querySelector("[data-complaint-list]");
const fileInput = document.querySelector("#evidence");
const fileNote = document.querySelector("[data-file-note]");
const orderSearch = document.querySelector("#order-search");
const orderStatusFilter = document.querySelector("#order-status-filter");
const orderSort = document.querySelector("#order-sort");
const orderTableBody = document.querySelector("[data-order-table-body]");
const readItems = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const defaultOrders = [
    { id: "CW-2026-1042", title: "Đảo Hải Tặc - Tập 105", date: "2026-09-21", amount: 180000, status: "Đã giao" },
    { id: "CW-2026-1098", title: "One Piece - Tập 108", date: "2026-09-18", amount: 210000, status: "Đang giao" },
    { id: "CW-2026-1125", title: "Berserk - Tập 42", date: "2026-09-10", amount: 260000, status: "Đang xử lý" },
    { id: "CW-2026-1177", title: "Doraemon - Tập 67", date: "2026-08-28", amount: 165000, status: "Đã hủy" },
    { id: "CW-2026-1201", title: "Spy x Family - Tập 12", date: "2026-08-18", amount: 195000, status: "Đã giao" }
];

const getOrders = () => {
    const customOrders = JSON.parse(localStorage.getItem("comicworm_orders") || "null");
    return Array.isArray(customOrders) && customOrders.length ? customOrders : defaultOrders;
};

const renderOrders = () => {
    if (!orderTableBody) return;
    let orders = [...getOrders()];
    const term = (orderSearch?.value || "").trim().toLowerCase();
    const status = orderStatusFilter?.value || "all";
    if (term) {
        orders = orders.filter((order) => `${order.id} ${order.title}`.toLowerCase().includes(term));
    }
    if (status !== "all") {
        orders = orders.filter((order) => order.status === status);
    }
    const sortValue = orderSort?.value || "date-desc";
    orders.sort((a, b) => {
        if (sortValue === "date-asc") return new Date(a.date) - new Date(b.date);
        if (sortValue === "amount-desc") return b.amount - a.amount;
        if (sortValue === "amount-asc") return a.amount - b.amount;
        return new Date(b.date) - new Date(a.date);
    });

    orderTableBody.replaceChildren();
    if (!orders.length) {
        orderTableBody.innerHTML = "<tr><td colspan='5' class='empty-table'>Không tìm thấy đơn hàng phù hợp.</td></tr>";
        return;
    }

    orders.forEach((order) => {
        const row = document.createElement("tr");
        row.className = "order-row";
        row.innerHTML = `
            <td><button class="order-link" type="button" data-order-select="${order.id}">${order.id}</button></td>
            <td>${order.title}</td>
            <td>${new Date(order.date).toLocaleDateString("vi-VN")}</td>
            <td>${Number(order.amount).toLocaleString("vi-VN")}đ</td>
            <td><span class="order-status status-${order.status.replace(/\s+/g, "-").toLowerCase()}">${order.status}</span></td>
        `;
        orderTableBody.append(row);
    });

    orderTableBody.querySelectorAll("[data-order-select]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.querySelector("#order-id");
            if (input) {
                input.value = button.dataset.orderSelect;
                input.focus();
                input.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    });
};

const render = () => { const items = readItems(); list.replaceChildren(); if (!items.length) { list.innerHTML = "<p class='empty-state'>Chưa có khiếu nại nào được gửi.</p>"; return; } items.forEach((item) => { const article = document.createElement("article"); article.className = "history-item"; article.innerHTML = `<header><strong>${item.orderId} · ${item.issueType}</strong><span class="status-badge ${item.status === "Đang xử lý" ? "processing" : ""}">${item.status}</span></header><p>${item.description}</p><time>${item.createdAt}</time>`; list.append(article); }); };
fileInput.addEventListener("change", () => { fileNote.textContent = fileInput.files.length ? `${fileInput.files.length} tệp đã chọn` : "Chưa chọn tệp"; });
if (orderSearch) orderSearch.addEventListener("input", renderOrders);
if (orderStatusFilter) orderStatusFilter.addEventListener("change", renderOrders);
if (orderSort) orderSort.addEventListener("change", renderOrders);
form.addEventListener("submit", (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); const orderError = values.orderId?.trim() ? "" : "Vui lòng nhập mã đơn hàng."; const descriptionError = values.description?.trim() ? "" : "Vui lòng mô tả sự cố."; setFieldError(document.querySelector("#order-id"), document.querySelector("[data-error-for='orderId']"), orderError); setFieldError(document.querySelector("#description"), document.querySelector("[data-error-for='description']"), descriptionError); if (orderError || descriptionError) return; const items = readItems(); items.unshift({ orderId: values.orderId.trim(), issueType: values.issueType, description: values.description.trim(), status: "Đang chờ", createdAt: new Date().toLocaleString("vi-VN") }); localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); form.reset(); fileNote.textContent = "Chưa chọn tệp"; render(); renderOrders(); showToast("Khiếu nại đã được gửi.", "success"); });
render();
renderOrders();