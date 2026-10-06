/* =========================
   TẠO ĐƠN HÀNG ĐÀM PHÁN
========================== */

document.addEventListener("DOMContentLoaded", function () {

    initAddressSelection();

});


/* =========================
   ĐỊA CHỈ NHẬN HÀNG
========================== */

/*
 * CSS tô sáng bằng class .addr-option.selected, còn input radio bị ẩn
 * (pointer-events: none) nên phải đồng bộ class bằng JS.
 */
function initAddressSelection() {

    document
        .querySelectorAll(".addr-option")
        .forEach(function (option) {

            bindAddressOption(option);

        });

}


function bindAddressOption(option) {

    const radio =
        option.querySelector('input[name="address"]');

    if (!radio) {
        return;
    }

    radio.addEventListener("change", function () {

        changeAddress(option);

    });

}


/*
 * Chọn một địa chỉ trong danh sách.
 */
function changeAddress(selectedOption) {

    document
        .querySelectorAll(".addr-option")
        .forEach(function (option) {

            option.classList.toggle(
                "selected",
                option === selectedOption
            );

        });


    const radio =
        selectedOption.querySelector('input[name="address"]');

    if (radio) {
        radio.checked = true;
    }

}


/*
 * Thêm địa chỉ mới vào danh sách rồi chọn luôn địa chỉ vừa thêm.
 */
function addNewAddress() {

    const list =
        document.querySelector(".addr-options");

    if (!list) {
        return;
    }


    const index =
        list.querySelectorAll(".addr-option").length + 1;


    const option =
        document.createElement("label");

    option.className = "addr-option";

    option.innerHTML =
        '<input type="radio" name="address" value="address-' + index + '">'
        + '<span class="addr-radio"></span>'
        + '<div class="addr-content">'
        + '<div class="addr-name-row">'
        + '<span class="addr-name">Huy Dương</span>'
        + '<span class="addr-label">Địa chỉ mới</span>'
        + '<span class="addr-phone">0909 123 456</span>'
        + '</div>'
        + '<p class="addr-text">Chưa cập nhật địa chỉ chi tiết.</p>'
        + '</div>';


    list.appendChild(option);

    bindAddressOption(option);

    changeAddress(option);


    const count =
        document.querySelector(".address-count");

    if (count) {
        count.textContent = index + " địa chỉ";
    }

}


/* =========================
   BƯỚC TIẾP THEO
========================== */

function continueToShipping() {

    const note =
        document.getElementById("orderNote").value.trim();


    /*
     * Trong hệ thống thật:
     *
     * 1. Kiểm tra người dùng có địa chỉ mặc định hay chưa.
     * 2. Nếu chưa có -> yêu cầu thêm địa chỉ.
     * 3. Nếu có -> tạo dữ liệu đơn hàng tạm.
     * 4. Chuyển sang trang tính phí vận chuyển.
     */

    const selectedAddress =
        document.querySelector('input[name="address"]:checked');


    if (!selectedAddress) {

        alert(
            "Bạn chưa có địa chỉ nhận hàng.\n"
            + "Vui lòng thêm địa chỉ trước khi tiếp tục."
        );

        return;

    }


    console.log("Deal: #NG-2298");
    console.log("Giá Deal: 275000");
    console.log("Địa chỉ:", selectedAddress.value);
    console.log("Ghi chú:", note);


    window.location.href =
        "shipping-fee.html?deal=NG-2298";

}


function backToRoom() {

    window.location.href =
        "dealing-chat.html?room=PT2049";

}
