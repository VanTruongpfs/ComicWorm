import { setFieldError, togglePasswordVisibility, validateEmail, validatePassword } from "./auth-shared.js";

const form = document.querySelector("#register-form");
const submitButton = document.querySelector("[data-submit]");

// Gắn sự kiện Ẩn/Hiện mật khẩu
document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
        const targetInput = document.querySelector(`[name='${button.dataset.togglePassword}']`);
        if (targetInput) {
            togglePasswordVisibility(targetInput, button);
        }
    });
});

function showErrors(errors) {
    Object.entries(errors).forEach(([name, message]) => {
        const inputEl = document.querySelector(`[name='${name}']`);
        const errorEl = document.querySelector(`[data-error-for='${name}']`);
        setFieldError(inputEl, errorEl, message);
    });
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fullNameEl = document.querySelector("[name='fullName']");
    const emailEl = document.querySelector("[name='email']");
    const passwordEl = document.querySelector("[name='password']");
    const confirmPasswordEl = document.querySelector("[name='confirmPassword']");
    const termsEl = document.querySelector("[name='terms']");

    const errors = {
        fullName: fullNameEl?.value.trim() ? "" : "Vui lòng nhập họ và tên.",
        email: validateEmail(emailEl?.value.trim()) ? "" : "Vui lòng nhập email hợp lệ.",
        password: validatePassword(passwordEl?.value) ? "" : "Mật khẩu cần có ít nhất 8 ký tự.",
        confirmPassword: passwordEl?.value === confirmPasswordEl?.value ? "" : "Mật khẩu nhập lại không khớp.",
        terms: termsEl?.checked ? "" : "Bạn cần đồng ý với điều khoản dịch vụ."
    };

    showErrors(errors);

    // Nếu có bất kỳ lỗi validation nào thì dừng lại
    if (Object.values(errors).some(Boolean)) return;

    submitButton.disabled = true;
    submitButton.textContent = "Đang tạo tài khoản...";

    // Gửi form trực tiếp về Spring Boot AuthController (/auth/register)
    form.submit();
});