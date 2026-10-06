
    function filterDeals() {

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

        const cards =
            document.querySelectorAll(".deal-card");

        let count = 0;

        cards.forEach(function(card) {

            const text =
                card.innerText.toLowerCase();

            const cardStatus =
                card.dataset.status;

            const matchKeyword =
                text.includes(keyword);

            const matchStatus =
                status === "all" ||
                cardStatus === status;

            if (matchKeyword && matchStatus) {

                card.style.display = "block";
                count++;

            } else {

                card.style.display = "none";

            }

        });


        document.getElementById("resultCount").innerText =
            "Hiển thị " + count + " giao dịch";


        document.getElementById("emptyState").style.display =
            count === 0 ? "block" : "none";
    }


    function sortDeals() {

        const list =
            document.getElementById("dealList");

        const cards =
            Array.from(
                list.querySelectorAll(".deal-card")
            );

        const type =
            document.getElementById("sortFilter").value;


        cards.sort(function(a, b) {

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


        cards.forEach(function(card) {

            list.appendChild(card);

        });

    }


    function viewRoom(roomId) {
        window.location.href = "dealing-chat.html?room=" + encodeURIComponent(roomId || "1");
    }

    function createOrder(dealId) {
        window.location.href = "negotiation-order.html?deal=" + encodeURIComponent(dealId || "1");
    }

    function viewOrder(orderId) {
        window.location.href = "shipping-fee.html?order=" + encodeURIComponent(orderId || "1");
    }

    function goToRooms() {
        window.location.href = "dealing-room.html";
    }

