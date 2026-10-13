import { setFieldError, togglePasswordVisibility, validateEmail, validatePassword } from "./auth-shared.js";

const form = document.querySelector("#login-form");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const submitButton = document.querySelector("[data-submit]");

const toggleBtn = document.querySelector("[data-toggle-password='password']");
if (toggleBtn) {
    toggleBtn.addEventListener("click", (event) => togglePasswordVisibility(password, event.currentTarget));
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const emailValue = email.value.trim();
    const passwordValue = password.value;

    const emailError = !validateEmail(emailValue) ? "Vui lòng nhập email hợp lệ." : "";
    const passwordError = !validatePassword(passwordValue) ? "Mật khẩu cần có ít nhất 8 ký tự." : "";

    setFieldError(email, document.querySelector("[data-error-for='email']"), emailError);
    setFieldError(password, document.querySelector("[data-error-for='password']"), passwordError);

    if (emailError || passwordError) return;

    submitButton.disabled = true;
    submitButton.textContent = "Đang đăng nhập...";

    form.submit();
});