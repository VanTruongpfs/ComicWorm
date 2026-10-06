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
const roles = { BUYER: ["Khách hàng", "U", "Mở kênh Người bán", "#seller-channel"], SELLER: ["Người bán", "S", "Mở kênh Người bán", "#seller-channel"], ADMIN: ["Quản trị viên", "A", "Trang Quản trị Admin", "#admin-dashboard"], MANAGER: ["Quản trị viên", "M", "Trang Quản trị Admin", "#admin-dashboard"] };
const role = localStorage.getItem("userRole") || "BUYER";
const fields = { displayName: document.querySelector("#display-name"), email: document.querySelector("#email") };
const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") || { displayName: localStorage.getItem("userName") || "Thành viên", email: "member@example.com" };
const roleInfo = roles[role] || roles.BUYER;

function renderProfile() { fields.displayName.value = saved.displayName || saved.fullName || ""; fields.email.value = saved.email || ""; document.querySelector("[data-display-name]").textContent = fields.displayName.value; document.querySelector("[data-display-email]").textContent = fields.email.value; document.querySelector("[data-role-badge]").textContent = roleInfo[0]; document.querySelector("[data-role-label]").textContent = roleInfo[0]; document.querySelector("[data-role-symbol]").textContent = roleInfo[1]; const action = document.querySelector("[data-role-action]"); action.textContent = roleInfo[2]; action.href = roleInfo[3]; }
renderProfile();

document.querySelector("#avatar-input").addEventListener("change", (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.addEventListener("load", () => { document.querySelector("[data-avatar]").innerHTML = `<img src="${reader.result}" alt="Ảnh đại diện">`; localStorage.setItem("bookmooch_avatar", reader.result); }); reader.readAsDataURL(file); });
const savedAvatar = localStorage.getItem("bookmooch_avatar");
if (savedAvatar) document.querySelector("[data-avatar]").innerHTML = `<img src="${savedAvatar}" alt="Ảnh đại diện">`;

document.querySelector("#profile-form").addEventListener("submit", (event) => { event.preventDefault(); const nameError = fields.displayName.value.trim() ? "" : "Vui lòng nhập tên hiển thị."; setFieldError(fields.displayName, document.querySelector("[data-error-for='displayName']"), nameError); if (nameError) return; const profile = { displayName: fields.displayName.value.trim(), email: fields.email.value }; localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); localStorage.setItem("userName", profile.displayName); saved.displayName = profile.displayName; document.querySelector("[data-display-name]").textContent = profile.displayName; showToast("Thông tin hồ sơ đã được lưu.", "success"); });

document.querySelector("#request-password-reset").addEventListener("click", async (event) => { const button = event.currentTarget; button.disabled = true; button.textContent = "Đang gửi..."; try { await requestPasswordResetForCurrentUser(); showToast(`Chúng tôi đã gửi link đổi mật khẩu tới email của bạn: ${fields.email.value}. Vui lòng kiểm tra hộp thư.`, "success"); } catch (error) { showToast(error.message); } finally { button.disabled = false; button.textContent = "Đổi mật khẩu"; } });