import { setFieldError, showToast, togglePasswordVisibility, validatePassword } from "./auth-shared.js";

const form = document.querySelector("#reset-form");
const password = document.querySelector("#password");
const confirmPassword = document.querySelector("#confirm-password");
const submitButton = document.querySelector("[data-submit]");
const status = document.querySelector("[data-reset-status]");
const tokenInput = document.querySelector("#reset-token");

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    const input = button.dataset.togglePassword === "confirmPassword" ? confirmPassword : password;
    button.addEventListener("click", () => togglePasswordVisibility(input, button));
});

if (form) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const token = tokenInput ? tokenInput.value.trim() : (new URLSearchParams(window.location.search).get("token") || "");
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
        submitButton.textContent = "Đang cập nhật mật khẩu...";

        try {
            const response = await fetch("/auth/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: token,
                    password: passwordValue,
                    confirmPassword: confirmValue
                })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Đổi mật khẩu thất bại.");
            }

            if (status) {
                status.textContent = data.message;
            }
            showToast(data.message, "success");

            const successBox = document.createElement("div");
            successBox.style.cssText = "background: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; border-radius: 10px; margin-top: 14px; text-align: center;";
            successBox.innerHTML = `
                <div style="font-weight: 700; color: #166534; font-size: 1.05rem; margin-bottom: 6px;">${data.message}</div>
                <div style="color: #15803d; font-size: 0.9rem;">Đang chuyển hướng về trang đăng nhập...</div>
            `;
            form.replaceWith(successBox);

            setTimeout(() => {
                window.location.href = "/auth/login?resetSuccess=true";
            }, 1600);
        } catch (error) {
            if (status) status.textContent = error.message;
            showToast(error.message, "error");
            submitButton.disabled = false;
            submitButton.textContent = "Đổi mật khẩu";
        }
    });
}