// Shared validation, password visibility, and feedback helpers for Auth screens.
export function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()); }
export function validatePassword(password) { return typeof password === "string" && password.length >= 8; }
export function togglePasswordVisibility(inputEl, iconEl) {
    const isPassword = inputEl.type === "password";
    inputEl.type = isPassword ? "text" : "password";
    iconEl.textContent = isPassword ? "Ẩn" : "Hiện";
    iconEl.setAttribute("aria-label", isPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu");
}
export function setFieldError(inputEl, errorEl, message) { inputEl.setAttribute("aria-invalid", String(Boolean(message))); errorEl.textContent = message; }
export function showToast(message, type = "error") {
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