/* =========================
   DEALING ROOM JS
   Quản lý danh sách phòng trao đổi truyện
========================== */

var initialOrder = [];

document.addEventListener("DOMContentLoaded", function () {
    const list = document.getElementById("roomList");
    if (list) {
        initialOrder = Array.prototype.slice.call(list.querySelectorAll(".room-card"));
    }
    loadRoomsFromApi();
});

/* =========================
   LOAD ROOMS FROM BACKEND API
========================== */
function loadRoomsFromApi() {
    fetch('/api/exchange/rooms')
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (rooms) {
            if (Array.isArray(rooms)) {
                renderRooms(rooms);
                updateStats(rooms);
            }
        })
        .catch(function (err) {
            document.getElementById('roomList').innerHTML = '';
            document.getElementById('resultCount').textContent = 'Không tải được phòng trao đổi. Bấm Tải lại để thử lại.';
            document.getElementById('emptyState').style.display = 'none';
        });
}

function renderRooms(rooms) {
    const list = document.getElementById("roomList");
    if (!list) return;

    list.innerHTML = "";
    rooms.forEach(function (r) {
        const card = document.createElement("div");
        card.className = "room-card";

        // Map status
        let statusKey = "active";
        let statusText = "Đang mở";
        let statusClass = "active";
        if (r.status === "OPEN") {
            statusKey = "active";
            statusText = "Đang trao đổi";
            statusClass = "active";
        } else if (r.status === "AGREED") {
            statusKey = "waiting";
            statusText = "Đã đồng ý deal";
            statusClass = "waiting";
        } else if (r.status === "COMPLETED") {
            statusKey = "accepted";
            statusText = "Đã chốt xong";
            statusClass = "accepted";
        } else if (r.status === "CANCELLED") {
            statusKey = "cancelled";
            statusText = "Đã đóng";
            statusClass = "cancelled";
        }

        const dateStr = r.createdAt ? r.createdAt.substring(0, 10) : "";
        const priceNum = r.targetProductPrice || 0;
        card.dataset.status = statusKey;
        card.dataset.price = priceNum;
        card.dataset.date = dateStr;

        const coverImg = r.targetProductCover;
        const formattedPrice = Number(priceNum).toLocaleString("vi-VN") + "đ";

        card.innerHTML =
            '<div class="room-main">' +
                '<div class="product-image">' +
                    ExchangeAPI.image(coverImg, r.targetProductTitle) +
                '</div>' +
                '<div class="room-info">' +
                    '<div class="room-heading">' +
                        '<div>' +
                            '<span class="room-code">PHÒNG #' + escapeHtml(r.roomCode) + '</span>' +
                            '<h3>' + escapeHtml(r.targetProductTitle) + '</h3>' +
                        '</div>' +
                        '<span class="status ' + statusClass + '">' + statusText + '</span>' +
                    '</div>' +
                    '<div class="buyer-info">' +
                        '<span>👤 Chủ phòng: <strong>' + escapeHtml(r.hostName || "Thành viên") + '</strong></span>' +
                        '<span>👥 ' + (r.memberCount || 1) + ' người tham gia</span>' +
                        '<span>📅 ' + dateStr + '</span>' +
                    '</div>' +
                    '<div class="price-area">' +
                        '<div class="price-item">' +
                            '<span>Giá niêm yết</span>' +
                            '<strong class="list-price">' + formattedPrice + '</strong>' +
                        '</div>' +
                        '<div class="price-arrow">⇄</div>' +
                        '<div class="price-item">' +
                            '<span>Đề xuất hiện có</span>' +
                            '<strong class="offer-price">' + (r.offerCount || 0) + ' kèo đề xuất</strong>' +
                        '</div>' +
                        '<div class="deal-count">' +
                            '<span>Tình trạng</span>' +
                            '<strong>' + (r.targetProductCondition ?? 0) + '%</strong>' +
                        '</div>' +
                    '</div>' +
                    (r.targetProductWishNote ? '<div style="margin-top:8px; font-size:13px; color:#64748b;"><i class="fa-solid fa-heart" style="color:#ef4444;"></i> Muốn đổi: <strong>' + escapeHtml(r.targetProductWishNote) + '</strong></div>' : '') +
                '</div>' +
            '</div>' +
            '<div class="room-actions">' +
                '<button class="btn-primary" onclick="openRoom(\'' + r.id + '\')">' +
                    '<i class="fa-solid fa-comments"></i> Vào phòng trao đổi' +
                '</button>' +
                '<button class="btn-secondary" onclick="openRoom(\'' + r.id + '\')">' +
                    'Gửi đề xuất' +
                '</button>' +
            '</div>';

        list.appendChild(card);
    });

    initialOrder = Array.prototype.slice.call(list.querySelectorAll(".room-card"));
    filterRooms();
    sortRooms();
}

function updateStats(rooms) {
    let openCount = 0;
    let totalOffers = 0;
    let agreedCount = 0;
    let completedCount = 0;

    rooms.forEach(function (r) {
        if (r.status === "OPEN") openCount++;
        if (r.status === "AGREED") agreedCount++;
        if (r.status === "COMPLETED") completedCount++;
        totalOffers += (r.offerCount || 0);
    });

    const statCards = document.querySelectorAll(".stat-card h3");
    if (statCards.length >= 4) {
        statCards[0].innerText = padZero(openCount);
        statCards[1].innerText = padZero(totalOffers);
        statCards[2].innerText = padZero(agreedCount);
        statCards[3].innerText = padZero(completedCount);
    }
}

function padZero(n) {
    return n < 10 ? "0" + n : String(n);
}

function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/* =========================
   TẠO PHÒNG TRAO ĐỔI MỚI
========================== */
async function openCreateRoomModal() {
    try {
        const inventory = await ExchangeAPI.request('/api/exchange/rooms/inventory');
        if (!inventory.length) { alert('Bạn chưa có truyện còn hàng. Hãy đăng truyện trước khi mở phòng.'); return; }
        document.getElementById('createRoomDialog')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'createRoomDialog'; dialog.className = 'ex-panel ex-room-dialog';
        dialog.innerHTML = '<h2>Mở phòng trao đổi</h2><form class="ex-form"><label>Truyện của bạn<select name="product">' + inventory.map(p => '<option value="' + p.id + '">' + escapeHtml(p.title) + '</option>').join('') + '</select></label><label>Lời nhắn<textarea name="message" maxlength="1000"></textarea></label><div class="ex-actions"><button type="submit">Mở phòng</button><button type="button" data-close-room>Hủy</button></div></form>';
        document.body.append(dialog); dialog.showModal();
        dialog.querySelector('[data-close-room]').onclick = () => dialog.close();
        dialog.querySelector('form').onsubmit = async event => {
            event.preventDefault(); const form = event.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
            try {
                const room = await ExchangeAPI.post('/api/exchange/rooms', { targetProductId: Number(form.elements.product.value), initialMessage: form.elements.message.value.trim() });
                location.href = 'dealing-chat.html?room=' + room.id;
            } catch (err) { alert(err.message); button.disabled = false; }
        };
    } catch(err) { alert(err.message); }
}

/* =========================
   FILTER
========================== */
function filterRooms() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const status = statusFilter ? statusFilter.value : "all";

    const rooms = document.querySelectorAll(".room-card");
    let count = 0;

    rooms.forEach(function (room) {
        const text = room.innerText.toLowerCase();
        const roomStatus = room.dataset.status;
        const matchKeyword = text.includes(keyword);
        const matchStatus = status === "all" || roomStatus === status;

        if (matchKeyword && matchStatus) {
            room.style.display = "block";
            count++;
        } else {
            room.style.display = "none";
        }
    });

    const resultCount = document.getElementById("resultCount");
    if (resultCount) {
        resultCount.innerText = "Hiển thị " + count + " phòng";
    }

    const emptyState = document.getElementById("emptyState");
    if (emptyState) {
        emptyState.style.display = count === 0 ? "block" : "none";
    }
}

/* =========================
   SORT
========================== */
function sortRooms() {
    const list = document.getElementById("roomList");
    if (!list) return;

    const rooms = Array.from(list.querySelectorAll(".room-card"));
    const sortFilter = document.getElementById("sortFilter");
    const type = sortFilter ? sortFilter.value : "newest";

    rooms.sort(function (a, b) {
        if (type === "newest") {
            return new Date(b.dataset.date) - new Date(a.dataset.date);
        }
        if (type === "oldest") {
            return new Date(a.dataset.date) - new Date(b.dataset.date);
        }
        if (type === "price-high") {
            return Number(b.dataset.price) - Number(a.dataset.price);
        }
        if (type === "price-low") {
            return Number(a.dataset.price) - Number(b.dataset.price);
        }
        return 0;
    });

    rooms.forEach(function (room) {
        list.appendChild(room);
    });
}

/* =========================
   OPEN ROOM
========================== */
function openRoom(roomId) {
    window.location.href = "dealing-chat.html?room=" + encodeURIComponent(roomId);
}

/* =========================
   COUNTER OFFER
========================== */
function counterOffer(roomId) {
    window.location.href = "dealing-chat.html?room=" + encodeURIComponent(roomId);
}

/* =========================
   ACCEPT DEAL
========================== */
function acceptDeal(roomId, dealId) {
    const confirmDeal = confirm("Bạn có chắc muốn chốt deal trong phòng #" + roomId + "?");
    if (!confirmDeal) return;
    window.location.href = "negotiation-order.html?deal=" + encodeURIComponent(dealId || roomId);
}

/* =========================
   REFRESH
========================== */
function refreshRooms() {
    const search = document.getElementById("searchInput");
    const status = document.getElementById("statusFilter");
    const sort = document.getElementById("sortFilter");

    if (search) search.value = "";
    if (status) status.value = "all";
    if (sort) sort.value = "newest";

    loadRoomsFromApi();
}
