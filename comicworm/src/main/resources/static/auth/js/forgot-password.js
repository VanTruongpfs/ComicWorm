import { setFieldError, showToast, validateEmail } from "./auth-shared.js";

const stepFind = document.querySelector("#step-find");
const stepVerify = document.querySelector("#step-verify");
const stepSuccess = document.querySelector("#step-success");
const bottomBackSwitch = document.querySelector("#bottom-back-switch");

const findForm = document.querySelector("#find-account-form");
const identifierInput = document.querySelector("#identifier");
const identifierError = document.querySelector("[data-error-for='identifier']");
const btnFind = document.querySelector("#btn-find");

const verifyForm = document.querySelector("#verify-email-form");
const maskedEmailDisplay = document.querySelector("#masked-email-display");
const fullEmailInput = document.querySelector("#full-email");
const fullEmailError = document.querySelector("[data-error-for='full-email']");
const btnSend = document.querySelector("#btn-send");
const btnBackStep1 = document.querySelector("#btn-back-step1");

const successEmailText = document.querySelector("#success-email-text");

let activeIdentifier = "";

// BƯỚC 1: Tìm tài khoản và nhận email đã bị che (******)
findForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idVal = identifierInput.value.trim();
    if (!idVal) {
        setFieldError(identifierInput, identifierError, "Vui lòng nhập email hoặc số điện thoại.");
        return;
    }
    setFieldError(identifierInput, identifierError, "");

    btnFind.disabled = true;
    btnFind.textContent = "Đang kiểm tra tài khoản...";

    try {
        const response = await fetch("/auth/api/forgot-password/find", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: idVal })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Không tìm thấy tài khoản.");
        }

        activeIdentifier = data.identifier || idVal;
        maskedEmailDisplay.textContent = data.maskedEmail;

        stepFind.style.display = "none";
        stepVerify.style.display = "block";
        fullEmailInput.value = "";
        setFieldError(fullEmailInput, fullEmailError, "");
        fullEmailInput.focus();
        showToast("Đã tìm thấy tài khoản! Vui lòng xác thực email.", "success");
    } catch (err) {
        setFieldError(identifierInput, identifierError, err.message);
        showToast(err.message, "error");
    } finally {
        btnFind.disabled = false;
        btnFind.textContent = "Tiếp tục";
    }
});

// Nút quay lại Bước 1
if (btnBackStep1) {
    btnBackStep1.addEventListener("click", () => {
        stepVerify.style.display = "none";
        stepFind.style.display = "block";
        identifierInput.focus();
    });
}

// BƯỚC 2: Người dùng nhập chính xác email và gửi liên kết đặt lại mật khẩu
verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullEmailVal = fullEmailInput.value.trim();
    if (!fullEmailVal) {
        setFieldError(fullEmailInput, fullEmailError, "Vui lòng nhập chính xác địa chỉ email.");
        return;
    }
    if (!validateEmail(fullEmailVal)) {
        setFieldError(fullEmailInput, fullEmailError, "Định dạng email không hợp lệ.");
        return;
    }
    setFieldError(fullEmailInput, fullEmailError, "");

    btnSend.disabled = true;
    btnSend.textContent = "Đang gửi liên kết...";

    try {
        const response = await fetch("/auth/api/forgot-password/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: activeIdentifier,
                fullEmail: fullEmailVal
            })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Không thể gửi email đặt lại mật khẩu.");
        }

        stepVerify.style.display = "none";
        stepSuccess.style.display = "block";
        if (bottomBackSwitch) bottomBackSwitch.style.display = "none";
        successEmailText.textContent = fullEmailVal;
        showToast(data.message, "success");
    } catch (err) {
        setFieldError(fullEmailInput, fullEmailError, err.message);
        showToast(err.message, "error");
    } finally {
        btnSend.disabled = false;
        btnSend.textContent = "Xác nhận & Gửi liên kết đổi mật khẩu";
    }
});