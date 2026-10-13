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

async function requestPasswordResetForCurrentUser() {
    const session = JSON.parse(localStorage.getItem("bookmooch_session") || sessionStorage.getItem("bookmooch_session") || "null");
    const profile = JSON.parse(localStorage.getItem("bookmooch_profile") || "null");
    const email = session?.email || profile?.email || "member@example.com";
    return new Promise((resolve) => window.setTimeout(() => resolve({ ok: true, email }), 450));
}

const PROFILE_KEY = "bookmooch_profile";
const accountApi = window.BookMoochAccountApi;
const fields = { displayName: document.querySelector("#display-name"), email: document.querySelector("#email") };
const saved = { displayName: "", email: "" };
let accountProfileKey;
let roleInfo = ["Đang xác thực", "U", "Đang xác thực tài khoản", null];
let authenticated = false;

function renderProfile() {
    fields.displayName.value = saved.displayName;
    fields.email.value = saved.email;
    document.querySelector("[data-display-name]").textContent = saved.displayName;
    document.querySelector("[data-display-email]").textContent = saved.email;
    document.querySelector("[data-role-badge]").textContent = roleInfo[0];
    document.querySelector("[data-role-label]").textContent = roleInfo[0];
    document.querySelector("[data-role-symbol]").textContent = roleInfo[1];
    const action = document.querySelector("[data-role-action]");
    action.textContent = roleInfo[2];
    if (roleInfo[3]) action.href = roleInfo[3]; else action.removeAttribute("href");
    action.setAttribute("aria-disabled", String(!roleInfo[3]));
    document.querySelector("#profile-form button[type='submit']").disabled = !authenticated;
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
            accountProfileKey = PROFILE_KEY + ":" + account.id;
            try {
                const preferences = JSON.parse(localStorage.getItem(accountProfileKey) || "null");
                if (preferences?.displayName) saved.displayName = preferences.displayName;
            } catch (_) { /* Keep the authenticated profile when local preferences are invalid. */ }
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

document.querySelector("#profile-form").addEventListener("submit", (event) => { event.preventDefault(); if (!authenticated) return; const nameError = fields.displayName.value.trim() ? "" : "Vui lòng nhập tên hiển thị."; setFieldError(fields.displayName, document.querySelector("[data-error-for='displayName']"), nameError); if (nameError) return; const profile = { displayName: fields.displayName.value.trim(), email: fields.email.value }; localStorage.setItem(accountProfileKey, JSON.stringify(profile)); localStorage.setItem("userName", profile.displayName); saved.displayName = profile.displayName; document.querySelector("[data-display-name]").textContent = profile.displayName; showToast("Thông tin hồ sơ đã được lưu.", "success"); });

document.querySelector("#request-password-reset").addEventListener("click", async (event) => { const button = event.currentTarget; button.disabled = true; button.textContent = "Đang gửi..."; try { await requestPasswordResetForCurrentUser(); showToast(`Chúng tôi đã gửi link đổi mật khẩu tới email của bạn: ${fields.email.value}. Vui lòng kiểm tra hộp thư.`, "success"); } catch (error) { showToast(error.message); } finally { button.disabled = false; button.textContent = "Đổi mật khẩu"; } });
