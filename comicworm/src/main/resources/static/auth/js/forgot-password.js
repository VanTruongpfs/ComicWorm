import { requestPasswordReset } from "./auth-api.js";
import { setFieldError, showToast, validateEmail } from "./auth-shared.js";

const form = document.querySelector("#forgot-form");
const email = document.querySelector("#email");
const emailError = document.querySelector("[data-error-for='email']");
const submitButton = document.querySelector("[data-submit]");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailValue = email.value.trim();
    const error = validateEmail(emailValue) ? "" : "Vui lòng nhập email hợp lệ.";
    setFieldError(email, emailError, error);
    if (error) return;
    submitButton.disabled = true;
    submitButton.textContent = "Đang gửi...";
    try {
        const response = await requestPasswordReset(emailValue);
        form.replaceWith(Object.assign(document.createElement("p"), { className: "auth-subtitle reset-message", textContent: response.message }));
        showToast(response.message, "success");
    } catch (error) {
        showToast(error.message);
        submitButton.disabled = false;
        submitButton.textContent = "Gửi đường dẫn đổi mật khẩu";
    }
});