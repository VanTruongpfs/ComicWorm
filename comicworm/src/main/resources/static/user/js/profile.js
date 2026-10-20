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

const accountApi = window.BookMoochAccountApi;
const fields = { displayName: document.querySelector("#display-name"), email: document.querySelector("#email") };
const saved = { displayName: "", email: "" };
let roleInfo = ["Đang xác thực", "U", "Đang xác thực tài khoản", null];
let authenticated = false;

function initialsOf(name) { return Array.from(name.trim()).slice(0, 2).join("").toUpperCase(); }

function renderProfile() {
    fields.displayName.value = saved.displayName;
    fields.email.value = saved.email;
    document.querySelector("[data-display-name]").textContent = saved.displayName;
    document.querySelector("[data-display-email]").textContent = saved.email;
    const avatar = document.querySelector("[data-avatar]");
    if (avatar && !avatar.querySelector("img") && saved.displayName) avatar.textContent = initialsOf(saved.displayName);
    document.querySelector("[data-role-badge]").textContent = roleInfo[0];
    document.querySelector("[data-role-label]").textContent = roleInfo[0];
    document.querySelector("[data-role-symbol]").textContent = roleInfo[1];
    const action = document.querySelector("[data-role-action]");
    action.textContent = roleInfo[2];
    if (roleInfo[3]) action.href = roleInfo[3]; else action.removeAttribute("href");
    action.setAttribute("aria-disabled", String(!roleInfo[3]));
    document.querySelector("#profile-form button[type='submit']").disabled = !authenticated;
    document.querySelector("#password-form button[type='submit']").disabled = !authenticated;
}
renderProfile();

async function loadAccount() {
    const hint = document.querySelector("[data-role-hint]");
    try {
        const account = await accountApi.currentUser();
        if (!account) {
            roleInfo = ["Chưa đăng nhập", "U", "Đăng nhập", accountApi.loginUrl()];
            hint.textContent = "Đăng nhập để xem tài khoản và nâng cấp lên Người bán.";
        } else {
            authenticated = true;
            saved.displayName = account.fullName || "Thành viên";
            saved.email = account.email;
            roleInfo = account.isSeller
                ? ["Người bán", "S", "Mở kênh Người bán", accountApi.sellerUrl()]
                : [account.role === "ADMIN" ? "Quản trị viên" : "Khách hàng", account.role === "ADMIN" ? "A" : "U", "Nâng cấp lên Người bán", accountApi.upgradeUrl()];
            hint.textContent = account.isSeller
                ? "Tài khoản đã có quyền Người bán. Bạn có thể xem thống kê của gian hàng mình."
                : "Bạn cần nâng cấp lên Người bán để vào kênh seller và xem thống kê doanh thu.";
        }
    } catch (error) {
        roleInfo = ["Chưa xác thực", "U", "Đăng nhập", accountApi.loginUrl()];
        hint.textContent = error.message;
    }
    renderProfile();
}
loadAccount();

document.querySelector("#avatar-input").addEventListener("change", (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.addEventListener("load", () => { document.querySelector("[data-avatar]").innerHTML = `<img src="${reader.result}" alt="Ảnh đại diện">`; localStorage.setItem("bookmooch_avatar", reader.result); }); reader.readAsDataURL(file); });
const savedAvatar = localStorage.getItem("bookmooch_avatar");
if (savedAvatar) document.querySelector("[data-avatar]").innerHTML = `<img src="${savedAvatar}" alt="Ảnh đại diện">`;

function errorSlot(field) { return document.querySelector(`[data-error-for='${field}']`); }

function clearErrors(form) {
    form.querySelectorAll("[data-error-for]").forEach((slot) => { slot.textContent = ""; });
    form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
}

function showFieldError(form, field, message) {
    const input = form.elements[field];
    setFieldError(input, errorSlot(field), message);
    if (input) input.focus();
}

function handleApiError(form, error) {
    if (error.loginRequired) {
        showToast(error.message);
        window.setTimeout(() => { window.location.href = accountApi.loginUrl(); }, 1500);
    } else if (error.field && form.elements[error.field]) {
        showFieldError(form, error.field, error.message);
    } else {
        showToast(error.message);
    }
}

function syncDisplayName(name) {
    saved.displayName = name;
    fields.displayName.value = name;
    document.querySelector("[data-display-name]").textContent = name;
    const avatar = document.querySelector("[data-avatar]");
    if (avatar && !avatar.querySelector("img")) avatar.textContent = initialsOf(name);
    const sidebarName = document.querySelector("[data-sidebar-name]");
    if (sidebarName) sidebarName.textContent = name;
    const sidebarAvatar = document.querySelector("[data-sidebar-avatar]");
    if (sidebarAvatar) sidebarAvatar.textContent = initialsOf(name);
    try { localStorage.setItem("userName", name); } catch (_) { /* Storage can be blocked; the server value is authoritative. */ }
}

document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!authenticated) return;
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    clearErrors(form);
    const name = fields.displayName.value.trim().replace(/\s+/g, " ");
    if (!name) return showFieldError(form, "displayName", "Vui lòng nhập tên hiển thị.");
    if (Array.from(name).length > 100) return showFieldError(form, "displayName", "Tên hiển thị tối đa 100 ký tự.");
    if (name === saved.displayName) { fields.displayName.value = name; return showToast("Tên hiển thị chưa thay đổi.", "success"); }
    button.disabled = true;
    try {
        const account = await accountApi.updateProfile(name);
        syncDisplayName(account.fullName);
        showToast("Đã cập nhật tên hiển thị.", "success");
    } catch (error) {
        handleApiError(form, error.field === "fullName" ? Object.assign(error, { field: "displayName" }) : error);
    } finally {
        button.disabled = !authenticated;
    }
});

const passwordForm = document.querySelector("#password-form");
const passwordInputs = ["currentPassword", "newPassword", "confirmPassword"].map((name) => passwordForm.elements[name]);
const showPasswords = document.querySelector("#show-passwords");
showPasswords.addEventListener("change", () => passwordInputs.forEach((input) => { input.type = showPasswords.checked ? "text" : "password"; }));

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!authenticated) return;
    const button = passwordForm.querySelector("button[type='submit']");
    clearErrors(passwordForm);
    const { currentPassword, newPassword, confirmPassword } = passwordForm.elements;
    if (!currentPassword.value) return showFieldError(passwordForm, "currentPassword", "Vui lòng nhập mật khẩu hiện tại.");
    if (newPassword.value.length < 8) return showFieldError(passwordForm, "newPassword", "Mật khẩu mới phải từ 8 ký tự trở lên.");
    if (newPassword.value === currentPassword.value) return showFieldError(passwordForm, "newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại.");
    if (confirmPassword.value !== newPassword.value) return showFieldError(passwordForm, "confirmPassword", "Mật khẩu xác nhận không khớp.");
    button.disabled = true;
    button.textContent = "Đang đổi...";
    try {
        await accountApi.changePassword(currentPassword.value, newPassword.value, confirmPassword.value);
        passwordForm.reset();
        passwordInputs.forEach((input) => { input.type = "password"; });
        showToast("Đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới.", "success");
    } catch (error) {
        handleApiError(passwordForm, error);
    } finally {
        button.disabled = !authenticated;
        button.textContent = "Đổi mật khẩu";
    }
});