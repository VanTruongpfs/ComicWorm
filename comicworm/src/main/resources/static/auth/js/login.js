import { loginUser } from "./auth-api.js";
import { setFieldError, showToast, togglePasswordVisibility, validateEmail, validatePassword } from "./auth-shared.js";

const form = document.querySelector("#login-form");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const submitButton = document.querySelector("[data-submit]");

document.querySelector("[data-toggle-password='password']").addEventListener("click", (event) => togglePasswordVisibility(password, event.currentTarget));

form.addEventListener("submit", async (event) => {
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
    try {
        await loginUser(emailValue, passwordValue, document.querySelector("#remember").checked);
        showToast("Đăng nhập thành công.", "success");
        setTimeout(() => {
            window.location.href = "../../user/html/profile.html";
        }, 800);
    } catch (error) {
        showToast(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Đăng nhập";
    }
});