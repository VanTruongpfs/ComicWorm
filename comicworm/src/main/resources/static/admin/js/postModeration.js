document.addEventListener("DOMContentLoaded", function () {

    // =========================================================
    // 1. CÁC PHẦN TỬ CHÍNH
    // =========================================================

    const searchInput = document.querySelector(".search-input");
    const notificationBtn = document.querySelector(".notification-btn");

    const skipBtn = document.querySelector(".btn-text");

    const deleteBanBtn = document.querySelector(".btn.btn-danger");
    const deleteWarnBtn = document.querySelector(".btn.btn-warning");
    const approveBtn = document.querySelector(
        ".action-group-right .btn-outline"
    );

    const queueItems = document.querySelectorAll(".queue-item");
    const queueCount = document.querySelector(".queue-count");


    // =========================================================
    // 2. HÀM HIỂN THỊ THÔNG BÁO
    // =========================================================

    function showToast(message, type = "normal") {

        // Xóa toast cũ nếu đang tồn tại
        const oldToast = document.querySelector(".moderation-toast");

        if (oldToast) {
            oldToast.remove();
        }

        // Tạo toast mới
        const toast = document.createElement("div");

        toast.className = "moderation-toast";
        toast.textContent = message;

        // Style cho toast
        toast.style.position = "fixed";
        toast.style.right = "24px";
        toast.style.bottom = "24px";
        toast.style.zIndex = "9999";

        toast.style.padding = "12px 18px";
        toast.style.borderRadius = "8px";

        toast.style.fontSize = "14px";
        toast.style.fontWeight = "600";

        toast.style.boxShadow =
            "0 8px 20px rgba(15, 23, 42, 0.15)";

        toast.style.color = "#0F172A";
        toast.style.background = "#FFFFFF";

        toast.style.border = "1px solid #E2E8F0";


        // Màu border theo loại thông báo
        if (type === "danger") {
            toast.style.borderColor = "#EF4444";
        }

        if (type === "success") {
            toast.style.borderColor = "#10B981";
        }

        if (type === "warning") {
            toast.style.borderColor = "#F59E0B";
        }


        // Thêm toast vào trang
        document.body.appendChild(toast);


        // Tự động xóa sau 2.5 giây
        setTimeout(function () {
            toast.remove();
        }, 2500);
    }


    // =========================================================
    // 3. TÌM KIẾM BÀI ĐĂNG
    // =========================================================

    if (searchInput) {

        searchInput.addEventListener("input", function () {

            // Lấy từ khóa người dùng nhập
            const keyword = this.value.trim().toLowerCase();


            // Duyệt qua từng bài trong hàng đợi
            queueItems.forEach(function (item) {

                const text = item.textContent.toLowerCase();


                // Nếu không nhập gì hoặc bài có chứa từ khóa
                if (
                    keyword === "" ||
                    text.includes(keyword)
                ) {

                    item.style.display = "";

                } else {

                    item.style.display = "none";
                }
            });


            // Đếm số bài đang hiển thị
            const visibleItems = Array.from(queueItems).filter(
                function (item) {

                    return item.style.display !== "none";
                }
            );


            // Cập nhật số lượng
            if (queueCount) {

                queueCount.textContent =
                    visibleItems.length + " bài";
            }
        });
    }


    // =========================================================
    // 4. NÚT THÔNG BÁO
    // =========================================================

    if (notificationBtn) {

        notificationBtn.addEventListener("click", function () {

            showToast("Bạn có 3 thông báo mới");
        });
    }


    // =========================================================
    // 5. BỎ QUA BÀI ĐANG KIỂM DUYỆT
    // =========================================================

    if (skipBtn) {

        skipBtn.addEventListener("click", function () {

            const confirmed = confirm(
                "Bạn có chắc muốn bỏ qua bài đăng này và chuyển sang bài tiếp theo?"
            );


            // Người dùng bấm Cancel
            if (!confirmed) {
                return;
            }


            // Hiển thị thông báo
            showToast(
                "Đã bỏ qua bài đăng. Đang chuyển sang bài tiếp theo...",
                "warning"
            );


            // Demo chuyển bài
            setTimeout(function () {

                window.location.reload();

            }, 1200);
        });
    }


    // =========================================================
    // 6. XÓA BÀI + CẤM TÀI KHOẢN
    // =========================================================

    if (deleteBanBtn) {

        deleteBanBtn.addEventListener("click", function () {

            const confirmed = confirm(
                "Bạn có chắc muốn XÓA bài đăng và CẤM tài khoản này?"
            );


            if (!confirmed) {
                return;
            }


            processModeration(
                "Đã xóa bài đăng và cấm tài khoản.",
                deleteBanBtn,
                "danger"
            );
        });
    }


    // =========================================================
    // 7. XÓA BÀI + CẢNH CÁO
    // =========================================================

    if (deleteWarnBtn) {

        deleteWarnBtn.addEventListener("click", function () {

            const confirmed = confirm(
                "Bạn có chắc muốn XÓA bài đăng và gửi cảnh cáo cho tài khoản?"
            );


            if (!confirmed) {
                return;
            }


            processModeration(
                "Đã xóa bài đăng và gửi cảnh cáo.",
                deleteWarnBtn,
                "warning"
            );
        });
    }


    // =========================================================
    // 8. PHÊ DUYỆT BÀI
    // =========================================================

    if (approveBtn) {

        approveBtn.addEventListener("click", function () {

            const confirmed = confirm(
                "Bạn có chắc bài đăng này không vi phạm và muốn phê duyệt?"
            );


            if (!confirmed) {
                return;
            }


            processModeration(
                "Đã phê duyệt bài đăng.",
                approveBtn,
                "success"
            );
        });
    }


    // =========================================================
    // 9. HÀM XỬ LÝ KIỂM DUYỆT
    // =========================================================

    function processModeration(
        message,
        clickedButton,
        type
    ) {

        // Lấy tất cả nút xử lý
        const actionButtons =
            document.querySelectorAll(".action-bar .btn");


        // Khóa tất cả nút
        actionButtons.forEach(function (button) {

            button.disabled = true;

            button.style.opacity = "0.6";

            button.style.cursor = "not-allowed";
        });


        // Giữ nút vừa click rõ hơn
        if (clickedButton) {

            clickedButton.style.opacity = "1";
        }


        // =====================================================
        // Cập nhật warning banner
        // =====================================================

        const warningBanner =
            document.querySelector(".warning-banner");


        if (warningBanner) {

            warningBanner.innerHTML = `
                <div class="warning-text">
                    <strong>Đã xử lý:</strong>
                    ${message}
                </div>
            `;


            // Đổi màu border
            if (type === "danger") {

                warningBanner.style.borderLeftColor =
                    "#EF4444";

            } else if (type === "warning") {

                warningBanner.style.borderLeftColor =
                    "#F59E0B";

            } else {

                warningBanner.style.borderLeftColor =
                    "#10B981";
            }
        }


        // Hiển thị thông báo
        showToast(message, type);


        // =====================================================
        // Sau khi xử lý → xóa bài đầu tiên khỏi queue
        // =====================================================

        setTimeout(function () {

            if (queueItems.length > 0) {

                const firstQueueItem =
                    queueItems[0];


                if (firstQueueItem) {

                    // Hiệu ứng mờ dần
                    firstQueueItem.style.transition =
                        "opacity 0.3s";

                    firstQueueItem.style.opacity = "0";


                    setTimeout(function () {

                        firstQueueItem.remove();


                        // Đếm lại số bài
                        if (queueCount) {

                            const remaining =
                                document.querySelectorAll(
                                    ".queue-item"
                                ).length;


                            queueCount.textContent =
                                remaining + " bài";
                        }

                    }, 300);
                }
            }

        }, 1500);
    }


    // =========================================================
    // 10. CLICK VÀO BÀI TRONG HÀNG ĐỢI
    // =========================================================

    queueItems.forEach(function (item) {

        // Cho biết item có thể click
        item.style.cursor = "pointer";


        item.addEventListener("click", function () {

            // Bỏ highlight tất cả item
            queueItems.forEach(function (otherItem) {

                otherItem.style.outline = "none";
            });


            // Highlight item được chọn
            item.style.outline =
                "2px solid #F97316";


            // Lấy username
            const authorElement =
                item.querySelector(".author-name");


            let authorName = "bài đăng";


            if (authorElement) {

                authorName =
                    authorElement.textContent.trim();
            }


            // Thông báo
            showToast(
                "Đã chọn bài đăng của " + authorName
            );
        });
    });


    // =========================================================
    // 11. SIDEBAR NAVIGATION
    // =========================================================

    const navItems =
        document.querySelectorAll(".nav-item");


    navItems.forEach(function (item) {

        item.addEventListener("click", function (event) {

            const href =
                item.getAttribute("href");


            // Nếu href bắt đầu bằng #
            if (
                href &&
                href.startsWith("#")
            ) {

                const target =
                    document.querySelector(href);


                // Nếu tìm thấy section
                if (target) {

                    event.preventDefault();


                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            }


            // Bỏ active của tất cả menu
            navItems.forEach(function (nav) {

                nav.classList.remove(
                    "nav-item-active"
                );
            });


            // Active menu được click
            item.classList.add(
                "nav-item-active"
            );
        });
    });


    // =========================================================
    // 12. CẬP NHẬT SỐ BÀI TRÊN SIDEBAR
    // =========================================================

    const navBadge =
        document.querySelector(".nav-badge");


    function updateQueueNumber() {

        const currentQueue =
            document.querySelectorAll(
                ".queue-item"
            ).length;


        // +15 là số bài demo còn lại
        const count = currentQueue + 15;


        if (navBadge) {

            navBadge.textContent = count;
        }
    }


    // =========================================================
    // 13. CHO PHÉP ENTER KÍCH HOẠT BUTTON
    // =========================================================

    const buttons =
        document.querySelectorAll("button");


    buttons.forEach(function (button) {

        button.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    button.click();
                }
            }
        );
    });
    //13.5
const postTypeTabs = document.querySelectorAll(".post-type-tab");
const productDemo = document.querySelector("#productDemo");
const communityPost = document.querySelector("#communityPost");
const currentPostType = document.querySelector("#currentPostType");

postTypeTabs.forEach(function (tab) {

    tab.addEventListener("click", function () {

        // Xóa active ở tất cả tab
        postTypeTabs.forEach(function (item) {
            item.classList.remove("active");
        });

        // Active tab đang chọn
        tab.classList.add("active");

        const type = tab.getAttribute("data-type");

        if (type === "product") {

            // Hiện sản phẩm
            productDemo.style.display = "flex";

            // Ẩn bài viết cộng đồng
            communityPost.style.display = "none";

            // Đổi nhãn
            currentPostType.textContent = "🛒 BÀI ĐĂNG SẢN PHẨM BÁN MỚI";

            showToast("Đang hiển thị bài đăng sản phẩm bán mới.", "success");

        } else {

            // Ẩn sản phẩm
            productDemo.style.display = "none";

            // Hiện bài viết cộng đồng
            communityPost.style.display = "block";

            // Đổi nhãn
            currentPostType.textContent = "📝 BÀI VIẾT CỘNG ĐỒNG";

            showToast("Đang hiển thị bài viết cộng đồng.", "success");
        }
    });
}
);
// Mặc định khi mở trang: hiển thị bài đăng sản phẩm
const defaultProductTab = document.querySelector('.post-type-tab[data-type="product"]');

if (defaultProductTab) {
    defaultProductTab.click();
}

    // =========================================================
    // 14. KHỞI TẠO
    // =========================================================

    updateQueueNumber();


    console.log(
        "Post Moderation JavaScript đã được tải thành công."
    );
    

});