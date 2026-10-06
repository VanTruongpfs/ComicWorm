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

const STORAGE_KEY = "bookmooch_support_tickets";
const form = document.querySelector("#support-form");
const list = document.querySelector("[data-ticket-list]");
const readItems = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const render = () => { const items = readItems(); list.replaceChildren(); if (!items.length) { list.innerHTML = "<p class='empty-state'>Chưa có yêu cầu hỗ trợ nào.</p>"; return; } items.forEach((item) => { const article = document.createElement("article"); article.className = "ticket-item"; article.innerHTML = `<header><strong>${item.subject}</strong><span class="status-badge ${item.priority === "Gấp" ? "processing" : ""}">${item.priority}</span></header><p>${item.content}</p>${item.response ? `<p class="ticket-response"><strong>CSKH:</strong> ${item.response}</p>` : "<p class='ticket-response'>Đang chờ phản hồi từ CSKH.</p>"}<time>${item.createdAt}</time>`; list.append(article); }); };
form.addEventListener("submit", (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); const contentError = values.content?.trim() ? "" : "Vui lòng nhập nội dung yêu cầu."; setFieldError(document.querySelector("#content"), document.querySelector("[data-error-for='content']"), contentError); if (contentError) return; const items = readItems(); items.unshift({ subject: values.subject, priority: values.priority, content: values.content.trim(), response: "", createdAt: new Date().toLocaleString("vi-VN") }); localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); form.reset(); render(); showToast("Yêu cầu hỗ trợ đã được gửi.", "success"); });
render();