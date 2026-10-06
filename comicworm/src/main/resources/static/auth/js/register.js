import { registerUser } from "./auth-api.js";
import { setFieldError, showToast, togglePasswordVisibility, validateEmail, validatePassword } from "./auth-shared.js";

const form = document.querySelector("#register-form");
const fields = Object.fromEntries(["fullName", "email", "password", "confirmPassword", "terms"].map((name) => [name, document.querySelector(`[name='${name}']`)]));
const submitButton = document.querySelector("[data-submit]");

document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => togglePasswordVisibility(fields[button.dataset.togglePassword], button)));

function showErrors(errors) {
    Object.entries(errors).forEach(([name, message]) => setFieldError(fields[name], document.querySelector(`[data-error-for='${name}']`), message));
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const errors = {
        fullName: values.fullName?.trim() ? "" : "Vui lòng nhập họ và tên.",
        email: validateEmail(values.email) ? "" : "Vui lòng nhập email hợp lệ.",
        password: validatePassword(values.password) ? "" : "Mật khẩu cần có ít nhất 8 ký tự.",
        confirmPassword: values.password === values.confirmPassword ? "" : "Mật khẩu nhập lại không khớp.",
        terms: fields.terms.checked ? "" : "Bạn cần đồng ý với điều khoản dịch vụ."
    };
    showErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    submitButton.disabled = true;
    submitButton.textContent = "Đang tạo tài khoản...";
    try {
        await registerUser({ fullName: values.fullName.trim(), email: values.email.trim(), password: values.password });
        form.reset();
        showErrors({ fullName: "", email: "", password: "", confirmPassword: "", terms: "" });
        showToast("Đăng ký thành công. Bạn có thể đăng nhập ngay.", "success");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 1000);
    } catch (error) {
        showToast(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Đăng ký";
    }
});