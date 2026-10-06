/* =========================================================
   MangaTrade — Khiếu Nại Đổi Trả
   File: js/script.js
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   Toast
   --------------------------------------------------------- */

let toastTimer = null;

function showToast(message, title = "MangaTrade đã tiếp nhận") {
    const toast = document.getElementById("toast-message");

    if (!toast) {
        return;
    }

    const titleElement = toast.querySelector("h4");
    const textElement = toast.querySelector("p");

    if (titleElement) {
        titleElement.textContent = title;
    }

    if (textElement) {
        textElement.textContent = message;
    }

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 5000);
}

/* ---------------------------------------------------------
   Chuyển tab Hủy đơn / Đổi trả
   --------------------------------------------------------- */

function switchMainTab(tab) {
    const cancelButton = document.getElementById("tab-btn-cancel");
    const returnButton = document.getElementById("tab-btn-return");

    if (!cancelButton || !returnButton) {
        return;
    }

    if (tab === "cancel") {
        cancelButton.classList.add("active");
        returnButton.classList.remove("active");

        showToast(
            "Đơn #ORD-8712 đã được người bán gửi cho bưu tá. Bạn cần dùng luồng “Đổi trả / Hoàn tiền đơn đã nhận”."
        );

        setTimeout(() => {
            switchMainTab("return");
        }, 900);

        return;
    }

    returnButton.classList.add("active");
    cancelButton.classList.remove("active");
}

/* ---------------------------------------------------------
   Chọn / bỏ chọn tất cả sản phẩm
   --------------------------------------------------------- */

function toggleSelectAll() {
    const checkboxes = [
        ...document.querySelectorAll('input[name="item_select"]')
    ];

    const button = document.getElementById("btn-select-all");

    if (!checkboxes.length || !button) {
        return;
    }

    const allChecked = checkboxes.every(
        (checkbox) => checkbox.checked
    );

    checkboxes.forEach((checkbox) => {
        checkbox.checked = !allChecked;
    });

    button.textContent = allChecked
        ? "Chọn tất cả 11 tập"
        : "Bỏ chọn tất cả";
}

/* ---------------------------------------------------------
   Gửi yêu cầu đổi trả
   --------------------------------------------------------- */

function submitDispute() {
    const selectedItems = document.querySelectorAll(
        'input[name="item_select"]:checked'
    );

    const selectedReason = document.querySelector(
        'input[name="dispute_reason"]:checked'
    );

    const description = document.getElementById(
        "disputeDescription"
    );

    const submitButton = document.getElementById(
        "btn-submit-request"
    );

    /* Kiểm tra sản phẩm */

    if (!selectedItems.length) {
        showToast(
            "Vui lòng chọn ít nhất một sản phẩm hoặc cuốn truyện cần hỗ trợ.",
            "Thiếu sản phẩm cần hỗ trợ"
        );

        return;
    }

    /* Kiểm tra lý do */

    if (!selectedReason) {
        showToast(
            "Vui lòng chọn lý do đổi trả / khiếu nại.",
            "Thiếu lý do khiếu nại"
        );

        return;
    }

    /* Kiểm tra mô tả */

    if (
        description &&
        description.value.trim().length < 10
    ) {
        showToast(
            "Vui lòng mô tả tình trạng lỗi chi tiết hơn (ít nhất 10 ký tự).",
            "Mô tả chưa đủ thông tin"
        );

        description.focus();

        return;
    }

    if (!submitButton) {
        return;
    }

    /* Trạng thái đang gửi */

    submitButton.disabled = true;

    submitButton.innerHTML = `
        <span class="material-symbols-outlined">
            progress_activity
        </span>
        <span>Đang khởi tạo mã ký quỹ...</span>
    `;

    showToast(
        "Hồ sơ của bạn đang được kiểm tra và tiền thanh toán vẫn được bảo vệ tại Escrow.",
        "Đang tiếp nhận yêu cầu"
    );

    /* Giả lập gửi hồ sơ */

    setTimeout(() => {
        submitButton.innerHTML = `
            <span class="material-symbols-outlined">
                task_alt
            </span>
            <span>Đã gửi hồ sơ thành công</span>
        `;

        submitButton.style.background = "#855300";
        submitButton.style.color = "#ffffff";

        showToast(
            "Yêu cầu #TR-9941 đã được tạo. 680.000 đ đang được bảo vệ tại Escrow và người bán đã nhận thông báo.",
            "Đã gửi yêu cầu thành công"
        );
    }, 1200);

    /* Cho phép nút hoạt động lại sau một khoảng thời gian */

    setTimeout(() => {
        submitButton.disabled = false;
    }, 4000);
}

/* ---------------------------------------------------------
   DOM Ready
   --------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {

    /* -----------------------------------------------------
       Search
       ----------------------------------------------------- */

    const searchInput =
        document.getElementById("searchInput");

    if (searchInput) {
        searchInput.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Enter" &&
                    searchInput.value.trim()
                ) {
                    showToast(
                        `Đang tìm kiếm: "${searchInput.value.trim()}"`,
                        "Tìm kiếm MangaTrade"
                    );
                }
            }
        );
    }

    /* -----------------------------------------------------
       Ctrl + K / Cmd + K
       ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        (event) => {
            const isShortcut =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k";

            if (!isShortcut) {
                return;
            }

            event.preventDefault();

            if (searchInput) {
                searchInput.focus();
            }
        }
    );

    /* -----------------------------------------------------
       Upload bằng chứng
       ----------------------------------------------------- */

    const uploadBox =
        document.querySelector(".evidence-upload");

    if (uploadBox) {
        const fileInput =
            document.createElement("input");

        fileInput.type = "file";
        fileInput.accept =
            "image/jpeg,image/png,video/mp4";
        fileInput.multiple = true;
        fileInput.hidden = true;

        uploadBox.appendChild(fileInput);

        uploadBox.addEventListener(
            "click",
            () => {
                fileInput.click();
            }
        );

        fileInput.addEventListener(
            "change",
            () => {
                const files = [
                    ...fileInput.files
                ];

                if (!files.length) {
                    return;
                }

                const validFiles = files.filter(
                    (file) => {
                        const maxSize =
                            50 * 1024 * 1024;

                        if (file.size > maxSize) {
                            showToast(
                                `${file.name} vượt quá giới hạn 50MB.`,
                                "Tệp quá lớn"
                            );

                            return false;
                        }

                        return true;
                    }
                );

                if (validFiles.length) {
                    showToast(
                        `Đã chọn ${validFiles.length} tệp bằng chứng để tải lên.`,
                        "Đã chọn bằng chứng"
                    );
                }

                fileInput.value = "";
            }
        );
    }

    /* -----------------------------------------------------
       Xóa ảnh bằng chứng mẫu
       ----------------------------------------------------- */

    document
        .querySelectorAll(".evidence-card button")
        .forEach((button) => {

            button.addEventListener(
                "click",
                (event) => {
                    event.stopPropagation();

                    const card =
                        button.closest(
                            ".evidence-card"
                        );

                    if (!card) {
                        return;
                    }

                    card.style.display = "none";

                    showToast(
                        "Đã xóa ảnh bằng chứng khỏi danh sách.",
                        "Đã xóa bằng chứng"
                    );
                }
            );
        });

    /* -----------------------------------------------------
       Chọn phương án giải quyết
       ----------------------------------------------------- */

    document
        .querySelectorAll(
            'input[name="resolution_plan"]'
        )
        .forEach((radio) => {

            radio.addEventListener(
                "change",
                () => {
                    const label =
                        radio.closest("label");

                    if (!label) {
                        return;
                    }

                    const title =
                        label.querySelector("h4");

                    showToast(
                        `Đã chọn phương án: ${
                            title
                                ? title.textContent.trim()
                                : "Phương án xử lý"
                        }`,
                        "Phương án giải quyết"
                    );
                }
            );
        });

    /* -----------------------------------------------------
       Chọn phương thức hoàn tiền
       ----------------------------------------------------- */

    document
        .querySelectorAll(
            'input[name="refund_channel"]'
        )
        .forEach((radio) => {

            radio.addEventListener(
                "change",
                () => {
                    const label =
                        radio.closest("label");

                    if (!label) {
                        return;
                    }

                    const title =
                        label.querySelector(
                            "span:first-child"
                        );

                    showToast(
                        `Đã chọn: ${
                            title
                                ? title.textContent.trim()
                                : "Phương thức hoàn tiền"
                        }`,
                        "Phương thức hoàn tiền"
                    );
                }
            );
        });

    /* -----------------------------------------------------
       Nút Hủy bỏ, giữ lại đơn hàng
       ----------------------------------------------------- */

    const keepOrderButton =
        document.querySelector(
            ".final-actions .action-button:first-child"
        );

    if (keepOrderButton) {
        keepOrderButton.addEventListener(
            "click",
            () => {
                showToast(
                    "Bạn đã chọn giữ lại đơn hàng. Hồ sơ đổi trả chưa được gửi.",
                    "Đã hủy thao tác"
                );
            }
        );
    }

    /* -----------------------------------------------------
       Newsletter
       ----------------------------------------------------- */

    const newsletterInput =
        document.querySelector(
            '.footer-col input[type="email"]'
        );

    const newsletterButton =
        document.getElementById(
            "newsletterSubmit"
        );

    if (
        newsletterInput &&
        newsletterButton
    ) {
        newsletterButton.addEventListener(
            "click",
            () => {
                const email =
                    newsletterInput.value.trim();

                if (
                    !email ||
                    !newsletterInput.checkValidity()
                ) {
                    showToast(
                        "Vui lòng nhập email hợp lệ để đăng ký bản tin.",
                        "Email chưa hợp lệ"
                    );

                    newsletterInput.focus();

                    return;
                }

                showToast(
                    "Đăng ký bản tin thành công!",
                    "Đăng ký thành công"
                );

                newsletterInput.value = "";
            }
        );
    }

    /* -----------------------------------------------------
       Active quick navigation
       ----------------------------------------------------- */

    const pathMap = {
      "kham-pha": "home.html",
      "dang-tin-tim-mua": "page1.html",
      "quan-ly-don-hang": "page2.html",
      "theo-doi-trang-thai": "page3.html",
      "huy-va-doi-tra": "page5.html",
      "danh-gia-truyen": "page4.html",
      "truyen-yeu-thich": "page6.html"
    };

    document
        .querySelectorAll(".quick-nav a, [data-path]")
        .forEach((link) => {
            const path = link.dataset.path;
            if (path === "huy-va-doi-tra") {
                link.classList.add("active");
            }
            link.addEventListener("click", (event) => {
                event.preventDefault();
                if (pathMap[path] && path !== "huy-va-doi-tra") {
                    window.location.href = pathMap[path];
                    return;
                }
                document
                    .querySelectorAll(".quick-nav a, [data-path]")
                    .forEach((item) => {
                        item.classList.remove("active");
                    });
                link.classList.add("active");
            });
        });
});
