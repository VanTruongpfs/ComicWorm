// Mock service boundary. Replace these methods with fetch calls when the backend is ready.
const USERS_KEY = "bookmooch_mock_users";
const RESET_TOKEN_KEY = "bookmooch_reset_token";
function readUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
function wait(value) { return new Promise((resolve) => window.setTimeout(() => resolve(value), 450)); }
export async function registerUser(user) {
    const users = readUsers();
    if (users.some((item) => item.email.toLowerCase() === user.email.toLowerCase())) throw new Error("Email này đã được đăng ký.");
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return wait({ ok: true, message: "Đăng ký thành công." });
}
export async function loginUser(email, password, remember) {
    const user = readUsers().find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) throw new Error("Thông tin đăng nhập chưa chính xác.");
    const session = JSON.stringify({ email: user.email });
    (remember ? localStorage : sessionStorage).setItem("bookmooch_session", session);
    return wait({ ok: true, user: { name: user.fullName, email: user.email } });
}
export async function requestPasswordReset(email) {
    const user = readUsers().find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (user) {
        const token = `${crypto.randomUUID()}-${Date.now()}`;
        localStorage.setItem(RESET_TOKEN_KEY, JSON.stringify({ email: user.email, token, expiresAt: Date.now() + 15 * 60 * 1000 }));
        console.info(`[Mock API] Reset URL: auth/reset-password/reset-password.html?token=${encodeURIComponent(token)}`);
    }
    return wait({ ok: true, message: "Chúng tôi đã gửi đường dẫn đổi mật khẩu mới về email của bạn. Vui lòng kiểm tra hộp thư và xác nhận." });
}
export async function requestPasswordResetForCurrentUser() {
    const session = JSON.parse(localStorage.getItem("bookmooch_session") || sessionStorage.getItem("bookmooch_session") || "null");
    const profile = JSON.parse(localStorage.getItem("bookmooch_profile") || "null");
    const email = session?.email || profile?.email || "member@example.com";
    return requestPasswordReset(email);
}
export async function resetPassword(token, password) {
    const resetRequest = JSON.parse(localStorage.getItem(RESET_TOKEN_KEY) || "null");
    if (!resetRequest || resetRequest.token !== token || resetRequest.expiresAt < Date.now()) throw new Error("Đường dẫn đổi mật khẩu không hợp lệ hoặc đã hết hạn.");
    const users = readUsers();
    const user = users.find((item) => item.email.toLowerCase() === resetRequest.email.toLowerCase());
    if (!user) throw new Error("Không tìm thấy tài khoản.");
    user.password = password;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.removeItem(RESET_TOKEN_KEY);
    return wait({ ok: true, message: "Mật khẩu đã được cập nhật." });
}