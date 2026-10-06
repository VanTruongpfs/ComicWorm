import { resetPassword } from "./auth-api.js";
import { setFieldError, showToast, togglePasswordVisibility, validatePassword } from "./auth-shared.js";

const form = document.querySelector("#reset-form");
const password = document.querySelector("#password");
const confirmPassword = document.querySelector("#confirm-password");
const submitButton = document.querySelector("[data-submit]");
const status = document.querySelector("[data-reset-status]");
const token = new URLSearchParams(window.location.search).get("token");

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    const input = button.dataset.togglePassword === "confirmPassword" ? confirmPassword : password;
    button.addEventListener("click", () => togglePasswordVisibility(input, button));
});

if (!token) {
    status.textContent = "Đường dẫn đổi mật khẩu không hợp lệ hoặc đã hết hạn.";
    form.hidden = true;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const passwordValue = password.value;
    const confirmValue = confirmPassword.value;
    const errors = {
        password: validatePassword(passwordValue) ? "" : "Mật khẩu cần có ít nhất 8 ký tự.",
        confirmPassword: passwordValue === confirmValue ? "" : "Mật khẩu nhập lại không khớp."
    };
    setFieldError(password, document.querySelector("[data-error-for='password']"), errors.password);
    setFieldError(confirmPassword, document.querySelector("[data-error-for='confirmPassword']"), errors.confirmPassword);
    if (Object.values(errors).some(Boolean)) return;
    submitButton.disabled = true;
    submitButton.textContent = "Đang cập nhật...";
    try {
        const response = await resetPassword(token, passwordValue);
        form.replaceWith(Object.assign(document.createElement("p"), { className: "auth-subtitle reset-message", textContent: response.message }));
        showToast(response.message, "success");
    } catch (error) {
        status.textContent = error.message;
        showToast(error.message);
        submitButton.disabled = false;
        submitButton.textContent = "Đổi mật khẩu";
    }
});