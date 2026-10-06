document.addEventListener("DOMContentLoaded", function () {

    // =========================================================
    // 1. LẤY CÁC PHẦN TỬ HTML
    // =========================================================

    const appealListView = document.querySelector("#appealListView");
    const appealDetailView = document.querySelector("#appealDetailView");

    const appealItems = document.querySelectorAll(".appeal-item");
    const appealViewButtons = document.querySelectorAll(".appeal-view-btn");

    const appealCount = document.querySelector("#appealCount");

    const pageTitle = document.querySelector("#pageTitle");
    const detailMeta = document.querySelector("#detailMeta");
    const appealStatus = document.querySelector("#appealStatus");
    const appealType = document.querySelector("#appealType");

    const backBtn = document.querySelector(".back-btn");

    const historyBtn = document.querySelector(
        '.icon-btn[aria-label="Lịch sử thay đổi"]'
    );

    const optionBtn = document.querySelector(
        '.icon-btn[aria-label="Tùy chọn"]'
    );

    const originalCaseLink = document.querySelector(".link-original-case");

    const decisionCards = document.querySelectorAll(".decision-card");

    const macroChips = document.querySelectorAll(".chip-macro");

    const replyTextarea = document.querySelector(".textarea-reply");

    const charCount = document.querySelector(".char-count");

    const auditTextarea = document.querySelector(".textarea-audit");

    const saveDraftBtn = document.querySelector(".btn-outline-action");

    const publishBtn = document.querySelector(".btn-primary-action");

    const readyTitle = document.querySelector(".ready-title");

    const readyDesc = document.querySelector(".ready-desc");

    const actionReadyCard = document.querySelector(".action-ready-card");


    // =========================================================
    // 2. BIẾN TRẠNG THÁI
    // =========================================================

    let currentAppealId = null;

    let formChanged = false;


    // =========================================================
    // 3. DỮ LIỆU KHÁNG NGHỊ
    // =========================================================

    const appealData = {

        "APL-8921": {
            type: "Phân loại: Kháng cáo Spam Bot",
            status: "ĐANG XỬ LÝ",
            user: "@hoangnam_tech",
            originalCase: "#RP-8492"
        },

        "APL-8918": {
            type: "Phân loại: Kháng nghị bài viết bị ẩn",
            status: "ĐANG XỬ LÝ",
            user: "@comic_seller",
            originalCase: "#RP-8491"
        },

        "APL-8914": {
            type: "Phân loại: Kháng nghị cảnh cáo tài khoản",
            status: "ĐANG XỬ LÝ",
            user: "@user789",
            originalCase: "#RP-8488"
        },

        "APL-8909": {
            type: "Phân loại: Kháng nghị vi phạm liên kết ngoài",
            status: "ĐANG XỬ LÝ",
            user: "@comicfan",
            originalCase: "#RP-8485"
        }

    };


    // =========================================================
    // 4. TOAST THÔNG BÁO
    // =========================================================

    function showToast(message, type) {

        const oldToast = document.querySelector(".vanguard-toast");

        if (oldToast) {
            oldToast.remove();
        }

        const toast = document.createElement("div");

        toast.className = "vanguard-toast";

        let background = "#0f172a";

        if (type === "success") {
            background = "#16a34a";
        }

        if (type === "danger") {
            background = "#dc2626";
        }

        if (type === "warning") {
            background = "#f59e0b";
        }

        toast.style.position = "fixed";
        toast.style.right = "24px";
        toast.style.bottom = "24px";
        toast.style.zIndex = "9999";
        toast.style.padding = "14px 18px";
        toast.style.borderRadius = "10px";
        toast.style.background = background;
        toast.style.color = "#ffffff";
        toast.style.fontFamily = "var(--font-body)";
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "600";
        toast.style.boxShadow = "0 10px 25px rgba(15, 23, 42, 0.15)";
        toast.style.maxWidth = "420px";
        toast.style.transition = "all 0.3s ease";

        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(function () {

            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";

            setTimeout(function () {
                toast.remove();
            }, 300);

        }, 3000);
    }


    // =========================================================
    // 5. CẬP NHẬT SỐ LƯỢNG KHÁNG NGHỊ
    // =========================================================

    function updateAppealCount() {

        if (!appealCount) {
            return;
        }

        const pendingItems =
            document.querySelectorAll(
                ".appeal-item:not(.appeal-item-processed)"
            );

        appealCount.textContent =
            pendingItems.length + " yêu cầu";
    }


    // =========================================================
    // 6. HIỂN THỊ DANH SÁCH KHÁNG NGHỊ
    // =========================================================

    function showAppealList() {

        if (appealListView) {
            appealListView.style.display = "";
        }

        if (appealDetailView) {
            appealDetailView.style.display = "none";
        }

        if (pageTitle) {
            pageTitle.textContent = "Danh sách kháng nghị";
        }

        if (detailMeta) {
            detailMeta.style.display = "none";
        }

        currentAppealId = null;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        updateAppealCount();
    }


    // =========================================================
    // 7. HIỂN THỊ CHI TIẾT KHÁNG NGHỊ
    // =========================================================

    function showAppealDetail(appealId) {

        const data = appealData[appealId];

        currentAppealId = appealId;

        if (appealListView) {
            appealListView.style.display = "none";
        }

        if (appealDetailView) {
            appealDetailView.style.display = "block";
        }

        if (pageTitle) {
            pageTitle.textContent =
                "Hồ sơ Kháng nghị #" + appealId;
        }

        if (detailMeta) {
            detailMeta.style.display = "flex";
        }

        if (appealStatus) {

            if (data) {
                appealStatus.textContent = data.status;
            }
            else {
                appealStatus.textContent = "ĐANG XỬ LÝ";
            }

        }

        if (appealType) {

            if (data) {
                appealType.textContent = data.type;
            }
            else {
                appealType.textContent =
                    "Phân loại: Kháng nghị";
            }

        }

        /*
         * Nội dung chi tiết hiện tại trong HTML được thiết kế
         * theo hồ sơ APL-8921.
         *
         * Khi mở APL-8918 / APL-8914 / APL-8909,
         * phần giao diện chi tiết vẫn dùng mẫu chi tiết hiện tại,
         * nhưng mã hồ sơ trên thanh tiêu đề sẽ thay đổi.
         */

        updateReadyTitle();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    // =========================================================
    // 8. CLICK VÀO "XEM KHÁNG NGHỊ"
    // =========================================================

    appealViewButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            event.stopPropagation();

            const appealItem =
                button.closest(".appeal-item");

            if (!appealItem) {
                return;
            }

            const appealId =
                appealItem.getAttribute("data-appeal-id");

            if (!appealId) {
                return;
            }

            showAppealDetail(appealId);

        });

    });


    // =========================================================
    // 9. CLICK VÀO TOÀN BỘ ITEM
    // =========================================================

    appealItems.forEach(function (item) {

        item.addEventListener("click", function (event) {

            /*
             * Nếu click trực tiếp vào button
             * thì button đã xử lý rồi.
             */
            if (event.target.closest(".appeal-view-btn")) {
                return;
            }

            const appealId =
                item.getAttribute("data-appeal-id");

            if (!appealId) {
                return;
            }

            showAppealDetail(appealId);

        });

    });


    // =========================================================
    // 10. NÚT QUAY LẠI
    // =========================================================

    if (backBtn) {

        backBtn.addEventListener("click", function () {

            /*
             * ĐANG Ở DETAIL
             * -> quay về danh sách
             */
            if (
                appealDetailView &&
                appealDetailView.style.display !== "none"
            ) {

                if (formChanged) {

                    const confirmed = confirm(
                        "Bạn có chắc muốn quay lại danh sách?\n\n" +
                        "Các thay đổi chưa lưu sẽ không được ban hành."
                    );

                    if (!confirmed) {
                        return;
                    }

                }

                formChanged = false;

                showAppealList();

                return;
            }


            /*
             * ĐANG Ở LIST
             * -> quay về postModeration.html
             */
            const confirmed = confirm(
                "Bạn có chắc muốn quay lại hàng đợi duyệt bài?"
            );

            if (!confirmed) {
                return;
            }

            window.location.href = "postModeration.html";

        });

    }


    // =========================================================
    // 11. CHỌN PHƯƠNG ÁN PHÁN QUYẾT
    // =========================================================

    decisionCards.forEach(function (card) {

        card.addEventListener("click", function () {

            if (publishBtn && publishBtn.disabled) {
                return;
            }

            decisionCards.forEach(function (item) {

                item.classList.remove(
                    "decision-card-active"
                );

                const radio =
                    item.querySelector(
                        'input[type="radio"]'
                    );

                if (radio) {
                    radio.checked = false;
                }

                const customRadio =
                    item.querySelector(".custom-radio");

                if (customRadio) {
                    customRadio.innerHTML = "";
                }

            });


            card.classList.add(
                "decision-card-active"
            );


            const radio =
                card.querySelector(
                    'input[type="radio"]'
                );

            if (radio) {
                radio.checked = true;
            }


            const customRadio =
                card.querySelector(".custom-radio");

            if (customRadio) {

                const dot =
                    document.createElement("span");

                dot.className =
                    "radio-inner-dot";

                customRadio.appendChild(dot);
            }


            formChanged = true;

            updateDecisionStatus();

        });

    });


    // =========================================================
    // 12. LẤY PHÁN QUYẾT ĐANG CHỌN
    // =========================================================

    function getSelectedDecision() {

        const selectedCard =
            document.querySelector(
                ".decision-card-active"
            );

        if (!selectedCard) {
            return null;
        }

        const titleElement =
            selectedCard.querySelector(
                ".decision-title-row strong"
            );

        if (!titleElement) {
            return null;
        }

        return titleElement.textContent.trim();
    }


    // =========================================================
    // 13. CẬP NHẬT KHU VỰC BAN HÀNH
    // =========================================================

    function updateDecisionStatus() {

        const selectedDecision =
            getSelectedDecision();

        if (!selectedDecision) {
            return;
        }

        updateReadyTitle();


        if (selectedDecision ===
            "Chấp thuận & Mở khóa ngay") {

            readyDesc.textContent =
                "Gửi email tự động và cập nhật trạng thái án phạt: gỡ bỏ hoàn toàn.";

            actionReadyCard.style.background =
                "#dcfce7";

            actionReadyCard.style.borderColor =
                "#16a34a";

            return;
        }


        if (selectedDecision ===
            "Giảm nhẹ án phạt xuống 24 giờ") {

            readyDesc.textContent =
                "Gửi email tự động và cập nhật trạng thái án phạt xuống còn 24 giờ.";

            actionReadyCard.style.background =
                "var(--primary-light)";

            actionReadyCard.style.borderColor =
                "var(--primary)";

            return;
        }


        if (selectedDecision ===
            "Bác bỏ khiếu nại & Giữ y án") {

            readyDesc.textContent =
                "Gửi email tự động và duy trì án phạt hiện hành 7 ngày.";

            actionReadyCard.style.background =
                "#fee2e2";

            actionReadyCard.style.borderColor =
                "#dc2626";

            return;
        }


        if (selectedDecision ===
            "Chuyển Thẩm định Cấp cao") {

            readyDesc.textContent =
                "Hồ sơ sẽ được chuyển đến bộ phận thẩm định cấp cao Tier-3.";

            actionReadyCard.style.background =
                "#eff4ff";

            actionReadyCard.style.borderColor =
                "#1e40af";
        }

    }


    // =========================================================
    // 14. CẬP NHẬT READY TITLE
    // =========================================================

    function updateReadyTitle() {

        if (!readyTitle) {
            return;
        }

        const id =
            currentAppealId || "APL-8921";

        const selectedDecision =
            getSelectedDecision();

        if (
            selectedDecision ===
            "Chuyển Thẩm định Cấp cao"
        ) {

            readyTitle.textContent =
                "Sẵn sàng chuyển hồ sơ #" + id;

        }
        else {

            readyTitle.textContent =
                "Sẵn sàng ban hành phán quyết #" + id;

        }

    }


    // =========================================================
    // 15. MACRO CHIPS
    // =========================================================

    macroChips.forEach(function (chip) {

        chip.addEventListener("click", function () {

            if (publishBtn && publishBtn.disabled) {
                return;
            }

            macroChips.forEach(function (item) {

                item.classList.remove(
                    "chip-macro-active"
                );

            });


            chip.classList.add(
                "chip-macro-active"
            );


            const chipText =
                chip.textContent.trim();

            const caseId =
                currentAppealId || "APL-8921";


            if (chipText === "Giảm án") {

                replyTextarea.value =
                    "Chào bạn, Bộ phận Kiểm duyệt An toàn Cộng đồng đã tiếp nhận và rà soát kháng nghị #" +
                    caseId +
                    ". Sau khi đối chiếu dữ liệu hệ thống, chúng tôi quyết định giảm mức phạt xuống còn 24h.";

                updateCharCount();

                formChanged = true;

                showToast(
                    "Đã áp dụng mẫu phản hồi: Giảm án",
                    "success"
                );

                return;
            }


            if (chipText === "Bác bỏ (Tái phạm)") {

                replyTextarea.value =
                    "Chào bạn, chúng tôi đã tiếp nhận kháng nghị #" +
                    caseId +
                    " và hoàn tất quá trình đối soát. Qua kiểm tra lịch sử vi phạm và dữ liệu hệ thống, khiếu nại chưa đủ cơ sở để thay đổi quyết định ban đầu. Án phạt hiện tại sẽ được giữ nguyên.";

                updateCharCount();

                formChanged = true;

                showToast(
                    "Đã áp dụng mẫu phản hồi: Bác bỏ",
                    "warning"
                );

                return;
            }


            if (chipText === "Yêu cầu CCCD") {

                replyTextarea.value =
                    "Chào bạn, để tiếp tục quá trình xác minh kháng nghị #" +
                    caseId +
                    ", vui lòng cung cấp thông tin định danh theo yêu cầu của bộ phận Kiểm duyệt An toàn Cộng đồng. Hồ sơ sẽ được tiếp tục xử lý sau khi thông tin xác minh được tiếp nhận.";

                updateCharCount();

                formChanged = true;

                showToast(
                    "Đã áp dụng mẫu yêu cầu xác minh",
                    "success"
                );

            }

        });

    });


    // =========================================================
    // 16. ĐẾM KÝ TỰ
    // =========================================================

    function updateCharCount() {

        if (!replyTextarea || !charCount) {
            return;
        }

        const count =
            replyTextarea.value.length;

        charCount.textContent =
            count + " ký tự";
    }


    if (replyTextarea) {

        replyTextarea.addEventListener(
            "input",
            function () {

                formChanged = true;

                updateCharCount();

            }
        );

        updateCharCount();
    }


    // =========================================================
    // 17. LINK ÁN PHẠT GỐC
    // =========================================================

    if (originalCaseLink) {

        originalCaseLink.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                const data =
                    appealData[currentAppealId];

                const originalCase =
                    data
                        ? data.originalCase
                        : "#RP-8492";

                showToast(
                    "Đang mở hồ sơ án phạt gốc " +
                    originalCase +
                    "...",
                    "warning"
                );

                setTimeout(function () {

                    alert(
                        "HỒ SƠ ÁN PHẠT GỐC\n\n" +
                        "Mã hồ sơ: " +
                        originalCase +
                        "\n" +
                        "Trạng thái: Có hiệu lực"
                    );

                }, 300);

            }
        );

    }


    // =========================================================
    // 18. LỊCH SỬ THAY ĐỔI
    // =========================================================

    if (historyBtn) {

        historyBtn.addEventListener(
            "click",
            function () {

                const caseId =
                    currentAppealId || "APL-8921";

                alert(
                    "LỊCH SỬ THAY ĐỔI #" +
                    caseId +
                    "\n\n" +
                    "09:42 - Bot Sentinel tạo án phạt\n" +
                    "10:15 - Người dùng gửi kháng nghị\n" +
                    "10:18 - Hồ sơ được chuyển sang Mod cấp 2\n" +
                    "10:25 - Bắt đầu đối soát telemetry\n" +
                    "Hiện tại - Đang chờ ban hành phán quyết"
                );

            }
        );

    }


    // =========================================================
    // 19. NÚT TÙY CHỌN
    // =========================================================

    if (optionBtn) {

        optionBtn.addEventListener(
            "click",
            function () {

                const caseId =
                    currentAppealId || "APL-8921";

                const choice =
                    prompt(
                        "TÙY CHỌN HỒ SƠ\n\n" +
                        "Hồ sơ: #" +
                        caseId +
                        "\n\n" +
                        "Nhập lựa chọn:\n" +
                        "1 - Đánh dấu cần kiểm tra thêm\n" +
                        "2 - Chuyển Mod khác\n" +
                        "3 - Sao chép mã hồ sơ"
                    );


                if (choice === "1") {

                    showToast(
                        "Đã đánh dấu hồ sơ cần kiểm tra thêm.",
                        "warning"
                    );

                }
                else if (choice === "2") {

                    showToast(
                        "Đã gửi yêu cầu chuyển hồ sơ.",
                        "success"
                    );

                }
                else if (choice === "3") {

                    copyCaseId();

                }
                else if (
                    choice !== null &&
                    choice !== ""
                ) {

                    showToast(
                        "Lựa chọn không hợp lệ.",
                        "danger"
                    );

                }

            }
        );

    }


    // =========================================================
    // 20. COPY MÃ HỒ SƠ
    // =========================================================

    function copyCaseId() {

        const caseId =
            "#" +
            (currentAppealId || "APL-8921");


        if (
            navigator.clipboard &&
            navigator.clipboard.writeText
        ) {

            navigator.clipboard.writeText(caseId)
                .then(function () {

                    showToast(
                        "Đã sao chép mã hồ sơ " +
                        caseId,
                        "success"
                    );

                })
                .catch(function () {

                    showToast(
                        "Không thể sao chép mã hồ sơ.",
                        "danger"
                    );

                });

        }
        else {

            showToast(
                "Trình duyệt không hỗ trợ sao chép tự động.",
                "danger"
            );

        }

    }


    // =========================================================
    // 21. FILE ĐÍNH KÈM
    // =========================================================

    const attachmentChips =
        document.querySelectorAll(".attachment-chip");


    attachmentChips.forEach(function (attachment) {

        attachment.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                const fileNameElement =
                    attachment.querySelector("span");

                let fileName =
                    "Tệp đính kèm";

                if (fileNameElement) {

                    fileName =
                        fileNameElement.textContent.trim();

                }

                showToast(
                    "Đang mở tệp: " +
                    fileName,
                    "warning"
                );

                setTimeout(function () {

                    alert(
                        "FILE PREVIEW\n\n" +
                        fileName +
                        "\n\n" +
                        "Demo: Tệp được mô phỏng trong giao diện quản trị."
                    );

                }, 300);

            }
        );

    });


    // =========================================================
    // 22. TEXTAREA AUDIT
    // =========================================================

    if (auditTextarea) {

        auditTextarea.addEventListener(
            "input",
            function () {

                formChanged = true;

                const text =
                    auditTextarea.value.trim();

                if (text.length === 0) {

                    auditTextarea.style.borderColor =
                        "var(--danger)";

                }
                else {

                    auditTextarea.style.borderColor =
                        "var(--neutral-200)";

                }

            }
        );

    }


    // =========================================================
    // 23. LƯU NHÁP
    // =========================================================

    if (saveDraftBtn) {

        saveDraftBtn.addEventListener(
            "click",
            function () {

                const selectedDecision =
                    getSelectedDecision();

                const reply =
                    replyTextarea
                        ? replyTextarea.value.trim()
                        : "";

                const audit =
                    auditTextarea
                        ? auditTextarea.value.trim()
                        : "";


                if (!selectedDecision) {

                    showToast(
                        "Vui lòng chọn phương án phán quyết trước khi lưu.",
                        "danger"
                    );

                    return;
                }


                if (audit.length === 0) {

                    showToast(
                        "Vui lòng nhập ghi chú kiểm duyệt nội bộ.",
                        "danger"
                    );

                    auditTextarea.focus();

                    return;
                }


                const draftData = {

                    caseId:
                        "#" +
                        (currentAppealId || "APL-8921"),

                    decision:
                        selectedDecision,

                    reply:
                        reply,

                    audit:
                        audit,

                    savedAt:
                        new Date().toLocaleString("vi-VN")

                };


                console.log(
                    "DRAFT SAVED:",
                    draftData
                );


                formChanged = false;


                showToast(
                    "Đã lưu bản nháp phán quyết " +
                    draftData.caseId +
                    ".",
                    "success"
                );


                const originalText =
                    saveDraftBtn.textContent;

                saveDraftBtn.textContent =
                    "Đã lưu nháp";


                setTimeout(function () {

                    saveDraftBtn.textContent =
                        originalText;

                }, 2000);

            }
        );

    }


    // =========================================================
    // 24. BAN HÀNH PHÁN QUYẾT
    // =========================================================

    if (publishBtn) {

        publishBtn.addEventListener(
            "click",
            function () {

                const selectedDecision =
                    getSelectedDecision();

                const reply =
                    replyTextarea
                        ? replyTextarea.value.trim()
                        : "";

                const audit =
                    auditTextarea
                        ? auditTextarea.value.trim()
                        : "";


                const caseId =
                    "#" +
                    (currentAppealId || "APL-8921");


                if (!selectedDecision) {

                    showToast(
                        "Vui lòng chọn phương án phán quyết.",
                        "danger"
                    );

                    return;
                }


                if (reply.length === 0) {

                    showToast(
                        "Phản hồi người dùng không được để trống.",
                        "danger"
                    );

                    replyTextarea.focus();

                    return;
                }


                if (audit.length === 0) {

                    showToast(
                        "Vui lòng nhập ghi chú kiểm duyệt nội bộ.",
                        "danger"
                    );

                    auditTextarea.focus();

                    return;
                }


                const confirmed =
                    confirm(

                        "XÁC NHẬN BAN HÀNH PHÁN QUYẾT\n\n" +

                        "Hồ sơ: " +
                        caseId +
                        "\n" +

                        "Phán quyết:\n" +
                        selectedDecision +
                        "\n\n" +

                        "Hệ thống sẽ:\n" +
                        "- Cập nhật trạng thái án phạt\n" +
                        "- Gửi phản hồi vào Inbox\n" +
                        "- Gửi email cho người dùng\n" +
                        "- Lưu log kiểm duyệt\n\n" +

                        "Bạn có chắc muốn ban hành?"

                    );


                if (!confirmed) {
                    return;
                }


                executeResolution(
                    selectedDecision,
                    reply,
                    audit
                );

            }
        );

    }


    // =========================================================
    // 25. THỰC THI PHÁN QUYẾT
    // =========================================================

    function executeResolution(
        selectedDecision,
        reply,
        audit
    ) {

        const resolvedAppealId =
            currentAppealId || "APL-8921";

        const caseId =
            "#" + resolvedAppealId;


        publishBtn.disabled = true;
        saveDraftBtn.disabled = true;

        publishBtn.style.opacity = "0.6";
        saveDraftBtn.style.opacity = "0.6";

        publishBtn.style.cursor =
            "not-allowed";

        saveDraftBtn.style.cursor =
            "not-allowed";


        publishBtn.textContent =
            "Đang ban hành...";


        readyTitle.textContent =
            "Đang ban hành phán quyết " +
            caseId;


        readyDesc.textContent =
            "Hệ thống đang cập nhật trạng thái và gửi thông báo người dùng.";


        showToast(
            "Đang xử lý phán quyết...",
            "warning"
        );


        setTimeout(function () {

            const resolutionData = {

                caseId:
                    caseId,

                decision:
                    selectedDecision,

                reply:
                    reply,

                audit:
                    audit,

                moderator:
                    "Mod_Agent_442",

                resolvedAt:
                    new Date().toLocaleString("vi-VN")

            };


            console.log(
                "RESOLUTION PUBLISHED:",
                resolutionData
            );


            publishBtn.disabled = true;

            publishBtn.style.opacity = "1";

            publishBtn.style.cursor =
                "default";


            publishBtn.innerHTML =
                `
                <svg width="18" height="18"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Đã ban hành
                `;


            readyTitle.textContent =
                "Đã ban hành phán quyết " +
                caseId;


            readyDesc.textContent =
                "Phán quyết đã được ghi nhận và thông báo đã được gửi đến người dùng.";


            actionReadyCard.style.background =
                "#dcfce7";

            actionReadyCard.style.borderColor =
                "#16a34a";


            const readyDot =
                document.querySelector(".ready-dot");


            if (readyDot) {

                readyDot.style.background =
                    "#16a34a";

            }


            showToast(
                "Phán quyết " +
                caseId +
                " đã được ban hành thành công.",
                "success"
            );


            // ---------------------------------------------
            // Đánh dấu item trong danh sách đã xử lý
            // ---------------------------------------------

            markAppealAsProcessed(
                resolvedAppealId
            );


            formChanged = false;


            // ---------------------------------------------
            // Khóa form
            // ---------------------------------------------

            decisionCards.forEach(
                function (card) {

                    card.style.pointerEvents =
                        "none";

                    card.style.opacity =
                        "0.7";

                }
            );


            macroChips.forEach(
                function (chip) {

                    chip.style.pointerEvents =
                        "none";

                    chip.style.opacity =
                        "0.7";

                }
            );


            if (replyTextarea) {
                replyTextarea.readOnly = true;
            }


            if (auditTextarea) {
                auditTextarea.readOnly = true;
            }


            /*
             * Sau khi ban hành thành công,
             * quay lại danh sách sau 1.5 giây.
             */
            setTimeout(function () {

                showAppealList();

                resetDetailForm();

            }, 1500);


        }, 1800);

    }


    // =========================================================
    // 26. ĐÁNH DẤU KHÁNG NGHỊ ĐÃ XỬ LÝ
    // =========================================================

    function markAppealAsProcessed(appealId) {

        const appealItem =
            document.querySelector(
                '.appeal-item[data-appeal-id="' +
                appealId +
                '"]'
            );


        if (!appealItem) {
            return;
        }


        appealItem.classList.add(
            "appeal-item-processed"
        );


        const status =
            appealItem.querySelector(
                ".appeal-status"
            );


        if (status) {

            status.classList.remove(
                "appeal-status-urgent",
                "appeal-status-warning"
            );

            status.classList.add(
                "appeal-status-processed"
            );


            status.innerHTML =
                `
                <span class="appeal-status-dot"></span>
                Đã xử lý
                `;

            status.style.color =
                "#16a34a";

            status.style.background =
                "#dcfce7";

        }


        const button =
            appealItem.querySelector(
                ".appeal-view-btn"
            );


        if (button) {

            button.innerHTML =
                `
                Xem lại
                <span>→</span>
                `;

        }


        updateAppealCount();

    }


    // =========================================================
    // 27. RESET FORM
    // =========================================================

    function resetDetailForm() {

        publishBtn.disabled = false;
        saveDraftBtn.disabled = false;

        publishBtn.style.opacity = "1";
        saveDraftBtn.style.opacity = "1";

        publishBtn.style.cursor =
            "pointer";

        saveDraftBtn.style.cursor =
            "pointer";


        publishBtn.innerHTML =
            `
            <svg width="18" height="18"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
            </svg>
            Ban hành phán quyết
            `;


        decisionCards.forEach(
            function (card) {

                card.style.pointerEvents =
                    "";

                card.style.opacity =
                    "";

            }
        );


        macroChips.forEach(
            function (chip) {

                chip.style.pointerEvents =
                    "";

                chip.style.opacity =
                    "";

            }
        );


        if (replyTextarea) {
            replyTextarea.readOnly = false;
        }


        if (auditTextarea) {
            auditTextarea.readOnly = false;
        }

    }


    // =========================================================
    // 28. KHỞI TẠO DECISION CARD
    // =========================================================

    function initializeDecisionCards() {

        decisionCards.forEach(
            function (card) {

                const radio =
                    card.querySelector(
                        'input[type="radio"]'
                    );

                const customRadio =
                    card.querySelector(
                        ".custom-radio"
                    );


                if (
                    radio &&
                    radio.checked
                ) {

                    card.classList.add(
                        "decision-card-active"
                    );


                    if (
                        customRadio &&
                        !customRadio.querySelector(
                            ".radio-inner-dot"
                        )
                    ) {

                        const dot =
                            document.createElement(
                                "span"
                            );

                        dot.className =
                            "radio-inner-dot";

                        customRadio.appendChild(
                            dot
                        );

                    }

                }
                else {

                    card.classList.remove(
                        "decision-card-active"
                    );

                }

            }
        );


        updateDecisionStatus();

    }


    // =========================================================
    // 29. KHỞI TẠO TRANG
    // =========================================================

    showAppealList();

    initializeDecisionCards();

    updateAppealCount();

    updateCharCount();


    // =========================================================
    // 30. LOG
    // =========================================================

    console.log(
        "Vanguard Appeal Resolution UI đã khởi tạo thành công."
    );

}); 