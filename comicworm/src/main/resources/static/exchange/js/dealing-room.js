
    /* =========================
       FILTER
    ========================== */

    function filterRooms() {

        const keyword =
            document
                .getElementById("searchInput")
                .value
                .toLowerCase()
                .trim();


        const status =
            document
                .getElementById("statusFilter")
                .value;


        const rooms =
            document.querySelectorAll(".room-card");


        let count = 0;


        rooms.forEach(function(room) {

            const text =
                room.innerText.toLowerCase();


            const roomStatus =
                room.dataset.status;


            const matchKeyword =
                text.includes(keyword);


            const matchStatus =
                status === "all" ||
                roomStatus === status;


            if (
                matchKeyword &&
                matchStatus
            ) {

                room.style.display = "block";

                count++;

            } else {

                room.style.display = "none";

            }

        });


        document
            .getElementById("resultCount")
            .innerText =
            "Hiển thị " +
            count +
            " phòng";


        document
            .getElementById("emptyState")
            .style.display =
            count === 0
                ? "block"
                : "none";
    }


    /* =========================
       SORT
    ========================== */

    function sortRooms() {

        const list =
            document.getElementById("roomList");


        const rooms =
            Array.from(
                list.querySelectorAll(".room-card")
            );


        const type =
            document
                .getElementById("sortFilter")
                .value;


        rooms.sort(function(a, b) {

            if (type === "newest") {

                return new Date(b.dataset.date)
                    - new Date(a.dataset.date);

            }


            if (type === "oldest") {

                return new Date(a.dataset.date)
                    - new Date(b.dataset.date);

            }


            if (type === "price-high") {

                return Number(b.dataset.price)
                    - Number(a.dataset.price);

            }


            if (type === "price-low") {

                return Number(a.dataset.price)
                    - Number(b.dataset.price);

            }

        });


        rooms.forEach(function(room) {

            list.appendChild(room);

        });

    }


    /* =========================
       OPEN ROOM
    ========================== */

    function openRoom(roomId) {

        window.location.href =
            "dealing-chat.html?room=" +
            encodeURIComponent(roomId);

    }


    /* =========================
       COUNTER OFFER
    ========================== */

    function counterOffer(roomId) {

        const price =
            prompt(
                "Nhập mức giá bạn muốn đề xuất lại:"
            );


        if (
            price === null ||
            price.trim() === ""
        ) {
            return;
        }


        alert(
            "Đã tạo đề xuất " +
            Number(price).toLocaleString("vi-VN") +
            "đ cho phòng #" +
            roomId
        );

    }


    /* =========================
       ACCEPT DEAL
    ========================== */

    function acceptDeal(roomId, dealId) {

        const confirmDeal =
            confirm(
                "Bạn có chắc muốn chốt deal trong phòng #" +
                roomId +
                "?"
            );


        if (!confirmDeal) {
            return;
        }


        // Chốt deal -> chuyển thẳng sang bước tạo đơn hàng đàm phán.
        window.location.href =
            "negotiation-order.html?deal=" +
            encodeURIComponent(dealId || roomId);

    }


    /* =========================
       THỨ TỰ BAN ĐẦU
    ========================== */

    var initialOrder = [];


    document.addEventListener("DOMContentLoaded", function () {

        const list =
            document.getElementById("roomList");

        if (!list) {
            return;
        }

        initialOrder =
            Array.prototype.slice.call(
                list.querySelectorAll(".room-card")
            );

    });


    /* =========================
       REFRESH
    ========================== */

    function refreshRooms() {

        const list =
            document.getElementById("roomList");

        /*
         * Làm mới: trả các phòng về đúng thứ tự ban đầu
         * rồi áp lại bộ lọc mặc định.
         */

        if (list) {

            initialOrder.forEach(function (room) {

                list.appendChild(room);

            });

        }


        const search =
            document.getElementById("searchInput");

        const status =
            document.getElementById("statusFilter");

        const sort =
            document.getElementById("sortFilter");

        if (search) {
            search.value = "";
        }

        if (status) {
            status.value = "all";
        }

        if (sort) {
            sort.value = "newest";
        }


        filterRooms();


        alert("Đã làm mới danh sách phòng trao đổi.");

    }

