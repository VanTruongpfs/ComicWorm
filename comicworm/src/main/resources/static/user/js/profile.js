/**
 * Profile Management & Account Security Logic
 * Kết nối với backend API thật (/api/user/profile, /api/user/change-password, /api/user/avatar).
 */

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

// References
const profileForm = document.querySelector("#profile-form");
const displayNameInput = document.querySelector("#display-name");
const phoneInput = document.querySelector("#phone");
const emailInput = document.querySelector("#email");
const btnSaveProfile = document.querySelector("#btn-save-profile");

const avatarInput = document.querySelector("#avatar-input");
const avatarDisplay = document.querySelector("[data-avatar]");

const passwordForm = document.querySelector("#change-password-form");
const currentPasswordInput = document.querySelector("#current-password");
const newPasswordInput = document.querySelector("#new-password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const btnChangePassword = document.querySelector("#btn-change-password");
const fieldCurrentPassword = document.querySelector("#field-current-password");

let currentUserProfile = null;

// Render Avatar Helper
function renderAvatar(avatarUrl, fullName) {
    if (!avatarDisplay) return;
    if (avatarUrl) {
        avatarDisplay.innerHTML = `<img src="${avatarUrl}" alt="Ảnh đại diện" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
        const initials = (fullName || "BM").slice(0, 2).toUpperCase();
        avatarDisplay.textContent = initials;
    }
}

// 1. TẢI THÔNG TIN HỒ SƠ TỪ BACKEND
async function loadUserProfile() {
    try {
        const response = await fetch("/api/user/profile", {
            credentials: "include",
            headers: { Accept: "application/json" },
            cache: "no-store"
        });

        if (response.status === 401) {
            window.location.href = "/auth/login";
            return;
        }

        if (!response.ok) {
            throw new Error("Không thể tải thông tin hồ sơ tài khoản.");
        }

        const data = await response.json();
        currentUserProfile = data;

        // Điền dữ liệu vào form
        if (displayNameInput) displayNameInput.value = data.fullName || "";
        if (phoneInput) phoneInput.value = data.phone || "";
        if (emailInput) emailInput.value = data.email || "";

        // Điền thông tin tóm tắt
        const nameLabel = document.querySelector("[data-display-name]");
        const emailLabel = document.querySelector("[data-display-email]");
        if (nameLabel) nameLabel.textContent = data.fullName || "Thành viên";
        if (emailLabel) emailLabel.textContent = data.email || "";

        // Render Avatar
        renderAvatar(data.avatarUrl, data.fullName);

        // Hiển thị vai trò
        const roleBadge = document.querySelector("[data-role-badge]");
        const roleLabel = document.querySelector("[data-role-label]");
        const roleSymbol = document.querySelector("[data-role-symbol]");
        const roleAction = document.querySelector("[data-role-action]");
        const roleHint = document.querySelector("[data-role-hint]");

        let roleText = "Khách hàng";
        let roleSym = "U";
        let actionText = "Nâng cấp lên Người bán";
        let actionUrl = "/user/seller-upgrade";
        let hintText = "Bạn cần nâng cấp lên Người bán để vào kênh seller và xem thống kê doanh thu.";

        if (data.role === "ADMIN") {
            roleText = "Quản trị viên";
            roleSym = "A";
            actionText = "Vào Trang Quản Trị";
            actionUrl = "/admin/html/dashboard.html";
            hintText = "Tài khoản có toàn quyền quản trị hệ thống ComicWorm.";
        } else if (data.isSeller) {
            roleText = "Người bán";
            roleSym = "S";
            actionText = "Mở Kênh Người Bán";
            actionUrl = "/seller/html/index.html";
            hintText = "Tài khoản đã có quyền Người bán. Bạn có thể quản lý gian hàng và xem doanh thu.";
        }

        if (roleBadge) roleBadge.textContent = roleText;
        if (roleLabel) roleLabel.textContent = roleText;
        if (roleSymbol) roleSymbol.textContent = roleSym;
        if (roleAction) {
            roleAction.textContent = actionText;
            roleAction.href = actionUrl;
        }
        if (roleHint) roleHint.textContent = hintText;

        // Xử lý tài khoản Google chưa có mật khẩu
        if (data.hasPassword === false && fieldCurrentPassword) {
            currentPasswordInput.placeholder = "Tài khoản Google (Để trống để tạo mật khẩu lần đầu)";
            currentPasswordInput.disabled = true;
            const label = fieldCurrentPassword.querySelector("label");
            if (label) label.textContent = "Mật khẩu hiện tại (Tài khoản Google không cần nhập)";
        }
    } catch (error) {
        showToast(error.message, "error");
    }
}

// 2. LƯU THAY ĐỔI THÔNG TIN CÁ NHÂN (HỌ TÊN, SỐ ĐIỆN THOẠI)
if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = displayNameInput ? displayNameInput.value.trim() : "";
        const phone = phoneInput ? phoneInput.value.trim() : "";

        const nameError = fullName ? "" : "Vui lòng nhập họ và tên của bạn.";
        let phoneError = "";
        if (phone && !/^(0|\+84)[0-9]{9,10}$/.test(phone)) {
            phoneError = "Số điện thoại không đúng định dạng (ví dụ: 0912345678).";
        }

        setFieldError(displayNameInput, document.querySelector("[data-error-for='displayName']"), nameError);
        setFieldError(phoneInput, document.querySelector("[data-error-for='phone']"), phoneError);

        if (nameError || phoneError) return;

        btnSaveProfile.disabled = true;
        btnSaveProfile.textContent = "Đang lưu thay đổi...";

        try {
            const response = await fetch("/api/user/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    fullName: fullName,
                    phone: phone,
                    avatarUrl: currentUserProfile ? currentUserProfile.avatarUrl : null
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Lưu thông tin thất bại.");
            }

            currentUserProfile = data;
            const nameLabel = document.querySelector("[data-display-name]");
            if (nameLabel) nameLabel.textContent = data.fullName;

            showToast("Đã lưu thông tin cá nhân thành công!", "success");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            btnSaveProfile.disabled = false;
            btnSaveProfile.textContent = "Lưu thay đổi";
        }
    });
}

// 3. UPLOAD VÀ CẬP NHẬT ẢNH ĐẠI DIỆN (AVATAR)
if (avatarInput) {
    avatarInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("Dung lượng ảnh tối đa là 5MB.", "error");
            avatarInput.value = "";
            return;
        }

        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!validTypes.includes(file.type)) {
            showToast("Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF).", "error");
            avatarInput.value = "";
            return;
        }

        // Preview tạm thời
        const reader = new FileReader();
        reader.onload = (e) => {
            renderAvatar(e.target.result, displayNameInput ? displayNameInput.value : "");
        };
        reader.readAsDataURL(file);

        // Upload lên server
        const formData = new FormData();
        formData.append("file", file);

        try {
            showToast("Đang tải ảnh đại diện lên...", "success");
            const response = await fetch("/api/user/avatar", {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Tải ảnh đại diện thất bại.");
            }

            if (currentUserProfile) {
                currentUserProfile.avatarUrl = data.avatarUrl;
            }
            renderAvatar(data.avatarUrl, displayNameInput ? displayNameInput.value : "");
            showToast("Cập nhật ảnh đại diện thành công!", "success");
        } catch (error) {
            showToast(error.message, "error");
            // Khôi phục lại avatar cũ
            if (currentUserProfile) {
                renderAvatar(currentUserProfile.avatarUrl, currentUserProfile.fullName);
            }
        } finally {
            avatarInput.value = "";
        }
    });
}

// 4. ĐỔI MẬT KHẨU TRỰC TIẾP
if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const currentPassword = currentPasswordInput ? currentPasswordInput.value : "";
        const newPassword = newPasswordInput ? newPasswordInput.value : "";
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";

        let currentPasswordError = "";
        if (currentUserProfile && currentUserProfile.hasPassword !== false && !currentPassword) {
            currentPasswordError = "Vui lòng nhập mật khẩu hiện tại.";
        }

        const newPasswordError = newPassword.length >= 8 ? "" : "Mật khẩu mới phải có tối thiểu 8 ký tự.";
        const confirmError = newPassword === confirmPassword ? "" : "Mật khẩu nhập lại không khớp.";

        setFieldError(currentPasswordInput, document.querySelector("[data-error-for='currentPassword']"), currentPasswordError);
        setFieldError(newPasswordInput, document.querySelector("[data-error-for='newPassword']"), newPasswordError);
        setFieldError(confirmPasswordInput, document.querySelector("[data-error-for='confirmPassword']"), confirmError);

        if (currentPasswordError || newPasswordError || confirmError) return;

        btnChangePassword.disabled = true;
        btnChangePassword.textContent = "Đang cập nhật mật khẩu...";

        try {
            const response = await fetch("/api/user/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword,
                    confirmPassword: confirmPassword
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Đổi mật khẩu thất bại.");
            }

            showToast("Đổi mật khẩu thành công!", "success");
            passwordForm.reset();
            if (currentUserProfile) {
                currentUserProfile.hasPassword = true;
                if (currentPasswordInput) {
                    currentPasswordInput.disabled = false;
                    currentPasswordInput.placeholder = "Nhập mật khẩu đang dùng...";
                }
            }
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            btnChangePassword.disabled = false;
            btnChangePassword.textContent = "Cập nhật mật khẩu";
        }
    });
}

// 5. NÚT ẨN/HIỆN MẬT KHẨU (EYE TOGGLE)
document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.dataset.toggle;
        const input = document.getElementById(targetId);
        if (!input) return;

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        const icon = btn.querySelector("i");
        if (icon) {
            if (isPassword) {
                icon.className = "fa-regular fa-eye-slash";
            } else {
                icon.className = "fa-regular fa-eye";
            }
        }
    });
});

// Khởi chạy
loadUserProfile();
