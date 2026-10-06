
    const dealPrice = 275000;
    let currentShippingFee = 32000;
    let currentPaymentMethod = "vnpay";

    /*
     * Mock dữ liệu phí vận chuyển.
     * Sau này có thể thay bằng API/backend.
     */
    const shippingMethods = {
        19000: {
            name: "Tiết kiệm",
            days: "4–6 ngày"
        },

        32000: {
            name: "Giao nhanh",
            days: "2–3 ngày"
        },

        58000: {
            name: "Hoả tốc",
            days: "Trong ngày"
        }
    };

    /*
     * Thông tin các phương thức thanh toán
     */
    const paymentMethods = {
        vnpay: {
            id: "vnpay",
            name: "VNPAY-QR",
            fullName: "VNPAY-QR (Chuyển khoản / Quét mã QR)",
            badge: '<span class="tag-vnpay"><i class="fa-solid fa-qrcode"></i> VNPAY-QR</span>',
            shortDesc: "VNPAY-QR",
            hint: "Vui lòng mở ứng dụng ngân hàng hoặc ví VNPAY để quét mã QR thanh toán. Tiền sẽ được giữ an toàn tại ví bảo chứng ComicHub Escrow Vault."
        },
        cod: {
            id: "cod",
            name: "COD Đồng kiểm",
            fullName: "COD (Thanh toán tiền mặt khi nhận & đồng kiểm)",
            badge: '<span class="tag-cod"><i class="fa-solid fa-hand-holding-dollar"></i> COD Đồng kiểm</span>',
            shortDesc: "COD khi nhận",
            hint: "Đơn hàng đã được xác nhận hình thức COD có đồng kiểm. Bạn được mở gói kiểm tra ngoại quan truyện trước khi thanh toán tiền mặt cho shipper."
        }
    };


    /*
     * Format tiền Việt Nam
     */
    function formatMoney(value) {
        return value.toLocaleString("vi-VN") + "đ";
    }


    /*
     * Cập nhật tóm tắt thanh toán ở nút hành động
     */
    function updateActionSummary() {
        const fee = currentShippingFee;
        const total = dealPrice + fee;
        const shippingMethod = shippingMethods[fee] || { name: "Giao hàng", days: "" };
        const payMethod = paymentMethods[currentPaymentMethod];

        const actionPriceEl = document.getElementById("actionTotalPrice");
        if (actionPriceEl) {
            actionPriceEl.textContent = formatMoney(total);
        }

        const summaryDescEl = document.getElementById("actionSummaryDesc");
        if (summaryDescEl) {
            summaryDescEl.textContent = shippingMethod.name + " · " + payMethod.shortDesc;
        }
    }


    /*
     * Chọn phương thức thanh toán (vnpay hoặc cod)
     */
    function selectPaymentMethod(method) {
        if (!paymentMethods[method]) return;

        currentPaymentMethod = method;

        const vnpayItem = document.getElementById("methodVnpay");
        const codItem = document.getElementById("methodCod");
        const vnpayRadio = document.getElementById("payRadioVnpay");
        const codRadio = document.getElementById("payRadioCod");
        const vnpayDetails = document.getElementById("vnpayDetails");
        const codDetails = document.getElementById("codDetails");
        const selectedPaymentText = document.getElementById("selectedPaymentText");

        if (vnpayItem && codItem) {
            vnpayItem.classList.toggle("selected", method === "vnpay");
            codItem.classList.toggle("selected", method === "cod");
        }

        if (vnpayRadio) vnpayRadio.checked = (method === "vnpay");
        if (codRadio) codRadio.checked = (method === "cod");

        if (vnpayDetails) {
            vnpayDetails.style.display = method === "vnpay" ? "flex" : "none";
        }

        if (codDetails) {
            codDetails.style.display = method === "cod" ? "block" : "none";
        }

        if (selectedPaymentText) {
            selectedPaymentText.innerHTML = paymentMethods[method].badge;
        }

        updateActionSummary();
    }


    /*
     * Khởi tạo và gắn sự kiện cho trang
     */
    function initShippingPage() {
        // Gắn sự kiện chọn phương thức vận chuyển
        document
            .querySelectorAll('input[name="shipping"]')
            .forEach(function (radio) {
                radio.addEventListener("change", function () {
                    document
                        .querySelectorAll(".shipping-option")
                        .forEach(function (option) {
                            option.classList.remove("selected");
                        });

                    const currentOption = radio.closest(".shipping-option");
                    if (currentOption) {
                        currentOption.classList.add("selected");
                    }

                    updateShippingPrice(Number(radio.value));
                });
            });

        // Gắn sự kiện click chọn phương thức thanh toán
        const vnpayItem = document.getElementById("methodVnpay");
        const codItem = document.getElementById("methodCod");

        if (vnpayItem) {
            vnpayItem.addEventListener("click", function (e) {
                if (e.target.closest(".btn-copy") || e.target.closest("a")) return;
                selectPaymentMethod("vnpay");
            });
        }

        if (codItem) {
            codItem.addEventListener("click", function (e) {
                if (e.target.closest("a")) return;
                selectPaymentMethod("cod");
            });
        }

        const vnpayRadio = document.getElementById("payRadioVnpay");
        const codRadio = document.getElementById("payRadioCod");

        if (vnpayRadio) {
            vnpayRadio.addEventListener("change", function () {
                if (this.checked) selectPaymentMethod("vnpay");
            });
        }

        if (codRadio) {
            codRadio.addEventListener("change", function () {
                if (this.checked) selectPaymentMethod("cod");
            });
        }

        // Khởi tạo hiển thị ban đầu
        updateShippingPrice(currentShippingFee);
        selectPaymentMethod(currentPaymentMethod);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initShippingPage);
    } else {
        initShippingPage();
    }


    /*
     * Cập nhật phí ship + tổng tiền + mã QR & chi tiết thanh toán
     */
    function updateShippingPrice(fee) {
        currentShippingFee = fee;
        const total = dealPrice + fee;

        const feeEl = document.getElementById("shippingFee");
        if (feeEl) feeEl.textContent = formatMoney(fee);

        const totalEl = document.getElementById("totalPrice");
        if (totalEl) totalEl.textContent = formatMoney(total);

        // Cập nhật số tiền trong box VNPAY
        const vnpayAmountEl = document.getElementById("vnpayAmount");
        if (vnpayAmountEl) vnpayAmountEl.textContent = formatMoney(total);

        // Cập nhật số tiền trong box COD
        const codAmountEl = document.getElementById("codAmount");
        if (codAmountEl) codAmountEl.textContent = formatMoney(total);

        // Cập nhật QR code tự động theo số tiền mới
        const qrImg = document.getElementById("vnpayQrImg");
        if (qrImg) {
            qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=VNPAY-COMICHUB-NG2298-" + total;
        }

        updateActionSummary();
    }


    /*
     * Sao chép nội dung vào Clipboard
     */
    function copyToClipboard(text, btnElement) {
        if (!navigator.clipboard) {
            const tempInput = document.createElement("input");
            tempInput.value = text;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
        } else {
            navigator.clipboard.writeText(text);
        }

        if (btnElement) {
            const originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = '<i class="fa-solid fa-check" style="color:#16A34A"></i>';
            btnElement.title = "Đã sao chép!";

            setTimeout(function () {
                btnElement.innerHTML = originalHtml;
                btnElement.title = "Sao chép";
            }, 1600);
        }
    }


    /*
     * Mock tính lại phí vận chuyển
     */
    function calculateShipping() {
        const weightInput = document.getElementById("weight");
        const weight = Number(weightInput ? weightInput.value : 0);

        if (!weight || weight <= 0) {
            alert("Vui lòng nhập khối lượng hợp lệ.");
            return;
        }

        let fee;
        if (weight <= 1) {
            fee = 19000;
        } else if (weight <= 3) {
            fee = 32000;
        } else {
            fee = 58000;
        }

        const radio = document.querySelector('input[name="shipping"][value="' + fee + '"]');
        if (radio) {
            radio.checked = true;
            document.querySelectorAll(".shipping-option").forEach(function (option) {
                option.classList.remove("selected");
            });
            const parentOption = radio.closest(".shipping-option");
            if (parentOption) parentOption.classList.add("selected");
        }

        updateShippingPrice(fee);
    }


    /*
     * Xác nhận phí vận chuyển & phương thức thanh toán
     */
    function confirmShipping() {
        const selectedShipping = document.querySelector('input[name="shipping"]:checked');

        if (!selectedShipping) {
            alert("Vui lòng chọn phương thức vận chuyển.");
            return;
        }

        const fee = Number(selectedShipping.value);
        const method = shippingMethods[fee] || { name: "Giao nhanh", days: "2–3 ngày" };
        const payMethod = paymentMethods[currentPaymentMethod];
        const total = dealPrice + fee;

        // Điền dữ liệu vào modal
        const modalShippingEl = document.getElementById("modalShippingMethod");
        if (modalShippingEl) {
            modalShippingEl.textContent = method.name + " (" + formatMoney(fee) + ")";
        }

        const modalPaymentEl = document.getElementById("modalPaymentMethod");
        if (modalPaymentEl) {
            modalPaymentEl.textContent = payMethod.fullName;
        }

        const modalTotalEl = document.getElementById("modalTotalAmount");
        if (modalTotalEl) {
            modalTotalEl.textContent = formatMoney(total);
        }

        const modalHintEl = document.getElementById("modalPaymentHint");
        if (modalHintEl) {
            modalHintEl.innerHTML = '<i class="fa-solid fa-shield-halved"></i> <span>' + payMethod.hint + '</span>';
        }

        // Mở modal xác nhận
        const modal = document.getElementById("confirmModal");
        if (modal) {
            modal.style.display = "flex";
        } else {
            alert(
                "Đã xác nhận đơn hàng đàm phán #NG-2298:\n" +
                "- Vận chuyển: " + method.name + " (" + formatMoney(fee) + ")\n" +
                "- Thanh toán: " + payMethod.fullName + "\n" +
                "- Tổng thanh toán: " + formatMoney(total) + "\n\n" +
                "Chuyển sang trang quản lý đơn hàng trao đổi."
            );
            window.location.href = "exchange-orders.html";
        }
    }


    /*
     * Đóng modal xác nhận
     */
    function closeModal() {
        const modal = document.getElementById("confirmModal");
        if (modal) {
            modal.style.display = "none";
        }
    }


    /*
     * Điều hướng sang trang quản lý đơn trao đổi
     */
    function proceedToExchangeOrders() {
        window.location.href = "exchange-orders.html";
    }
