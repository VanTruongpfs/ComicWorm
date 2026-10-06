/* =====================================================
   PHÒNG TRAO ĐỔI GIÁ — dealing-chat.js
   2 góc nhìn: "proposer" (người đề nghị) và "owner" (chủ sở hữu)
   Đổi vai trò: nút "Góc nhìn" trên trang hoặc ?role=owner | ?role=proposer

   Quy ước tiền (money) trong mỗi đề xuất:
     money > 0  → Người đề nghị bù thêm cho chủ sở hữu
     money < 0  → Chủ sở hữu bù thêm cho người đề nghị
     money = 0  → Không bù tiền
===================================================== */
(function () {
    'use strict';

    /* ---------- CẤU HÌNH ---------- */
    var ORDER_PAGE = 'negotiation-order.html';   // trang "Tạo đơn hàng đàm phán"
    var DEAL_CODE = 'NG-2298';                   // mã đơn sinh ra sau khi chốt deal
    var MAX_MONEY = 100000000;

    /* ---------- DỮ LIỆU MẪU (thay bằng dữ liệu từ backend) ---------- */
    var USERS = {
        owner: {
            key: 'owner', name: 'Bủ Nguyên', short: 'Bủ Nguyên', initials: 'BN',
            roleLabel: 'Chủ sở hữu', verified: true, rating: 4.9, reviews: 218,
            deals: 186, successRate: 98, response: '~10 phút',
            location: 'Q.5, TP. Hồ Chí Minh', since: '03/2022'
        },
        proposer: {
            key: 'proposer', name: 'Huy Dương', short: 'Huy Dương', initials: 'HD',
            roleLabel: 'Người đề nghị', verified: true, rating: 4.7, reviews: 41,
            deals: 32, successRate: 94, response: '~25 phút',
            location: 'Q. Hải Châu, Đà Nẵng', since: '09/2023'
        },
        buyerMai: {
            key: 'buyerMai', name: 'Mai Anh', short: 'Mai Anh', initials: 'MA',
            roleLabel: 'Người mua', verified: true, rating: 4.8, reviews: 67,
            deals: 45, successRate: 96, response: '~8 phút',
            location: 'Q. Bình Thạnh, TP. Hồ Chí Minh', since: '02/2024'
        },
        buyerKhanh: {
            key: 'buyerKhanh', name: 'Khánh Linh', short: 'Khánh Linh', initials: 'KL',
            roleLabel: 'Người trao đổi', verified: true, rating: 4.6, reviews: 28,
            deals: 19, successRate: 91, response: '~18 phút',
            location: 'Q. Thanh Xuân, Hà Nội', since: '11/2024'
        }
    };

    var ROOM_PARTICIPANTS = [
        { key: 'owner', dealType: 'host', dealLabel: 'Chủ phòng', offer: 'Giá niêm yết ' + '320.000₫', status: 'Đang mở phòng' },
        { key: 'proposer', dealType: 'trade', dealLabel: 'Cả hai', offer: 'Naruto 1–10 + bù 60.000₫', status: 'Đang thương lượng' },
        { key: 'buyerMai', dealType: 'buy', dealLabel: 'Tiền', offer: '300.000₫', status: 'Đang quan tâm' },
        { key: 'buyerKhanh', dealType: 'trade', dealLabel: 'Trao đổi', offer: 'Bleach 1–8 + bù 40.000₫', status: 'Đã gửi đề xuất' }
    ];

    var DEAL_REQUESTS = [
        { id: 'RQ-2049-01', buyer: 'proposer', type: 'trade', optionType: 'both', comics: ['c1'], money: 60000, note: 'Naruto 1–10 + bù 60.000₫', status: 'pending', time: '14:07' },
        { id: 'RQ-2049-02', buyer: 'buyerMai', type: 'buy', optionType: 'money', comics: [], money: 300000, note: '300.000₫', status: 'pending', time: '14:06' },
        { id: 'RQ-2049-03', buyer: 'buyerKhanh', type: 'trade', optionType: 'both', comics: ['c2'], money: 40000, note: 'Bleach 1–8 + bù 40.000₫', status: 'pending', time: '14:08' }
    ];

    var DEAL_REQUESTS = [
        { id: 'RQ-2049-01', buyer: 'proposer', type: 'trade', comics: ['c1'], money: 60000, note: 'Naruto 1–10 + bù 60.000₫', status: 'pending', time: '14:07' },
        { id: 'RQ-2049-02', buyer: 'buyerMai', type: 'buy', comics: [], money: 300000, note: 'Mua đứt · 300.000₫', status: 'pending', time: '14:06' },
        { id: 'RQ-2049-03', buyer: 'buyerKhanh', type: 'trade', comics: ['c2'], money: 40000, note: 'Bleach 1–8 + bù 40.000₫', status: 'pending', time: '14:08' }
    ];

    var ITEM = {
        title: 'One Piece — Trọn bộ tập 1–10',
        cover: 'https://placehold.co/240x320/1e293b/FDBA74?text=ONE+PIECE',
        price: 320000,
        tags: ['Manga', 'Bìa mềm', '10 tập'],
        specs: [
            ['Tình trạng', 'Đã đọc · còn ~90%'],
            ['Nhà xuất bản', 'NXB Kim Đồng'],
            ['Năm in', '2019'],
            ['Ngôn ngữ', 'Tiếng Việt'],
            ['Số tập', '10 tập (1–10)'],
            ['Đăng lúc', '20/09/2026']
        ],
        note: 'Sách giữ gáy tốt, không rách bìa. Có 1 tập hơi ố nhẹ ở mép trang. Có thể gửi thêm ảnh thực tế.',
        wants: ['Naruto', 'Bleach', 'Dragon Ball', 'Tiền mặt']
    };

    var INVENTORY = [
        { id: 'c1', title: 'Naruto', vol: 'Tập 1–10', cond: '85%', value: 180000, series: 'Naruto', bg: 'C2410C' },
        { id: 'c2', title: 'Bleach', vol: 'Tập 1–8', cond: '90%', value: 130000, series: 'Bleach', bg: '334155' },
        { id: 'c3', title: 'Dragon Ball', vol: 'Tập 1–12', cond: '80%', value: 200000, series: 'Dragon Ball', bg: 'B45309' },
        { id: 'c4', title: 'Doraemon Đại tuyển tập', vol: 'Tập 1–3', cond: '95%', value: 90000, series: 'Doraemon', bg: '0F172A' },
        { id: 'c5', title: 'Thám Tử Conan', vol: 'Tập 40–45', cond: '88%', value: 110000, series: 'Conan', bg: '1E293B' },
        { id: 'c6', title: 'Attack on Titan', vol: 'Tập 1–5', cond: '92%', value: 150000, series: 'Attack on Titan', bg: '64748B' }
    ];

    var STATUS_LABEL = { pending: 'Đang chờ', accepted: 'Đã đồng ý', declined: 'Đã từ chối', superseded: 'Đã thay thế' };
    var QUICK = {
        proposer: ['Cho mình xin thêm ảnh thực tế nhé', 'Bạn giữ bộ này đến khi nào?', 'Mình có thể nhận trực tiếp không?'],
        owner: ['Mình đang xem request của bạn', 'Bạn có thể gửi thêm ảnh truyện không?', 'Mình sẽ phản hồi request sớm nhé']
    };

    /* ---------- TRẠNG THÁI ---------- */
    var params = new URLSearchParams(location.search);
    var state = {
        role: params.get('role') === 'owner' ? 'owner' : 'proposer',
        room: { code: '#PT2049', status: 'negotiating', dealType: 'mixed' },
        participantFilter: 'all',
        chatFilter: 'all',
        requestFilter: 'all',
        requestStatusFilter: 'all',
        requestSort: 'newest',
        requestSearch: '',
        confirmations: { owner: false, buyer: false },
        selectedRequestId: 'RQ-2049-01',
        dealBuyer: 'proposer',
        requestFormOpen: false,
        editingOfferId: null,
        offers: [
            { id: 1, by: 'proposer', buyerKey: 'proposer', requestId: 'RQ-2049-01', type: 'trade', optionType: 'both', comics: ['c1'], money: 60000, note: 'Mình bù thêm chút tiền nhé.', status: 'pending', edited: false, time: '14:07' }
        ],
        messages: [
            { type: 'system', text: 'Phòng được tạo lúc 14:02 · Giá niêm yết 320.000₫' },
            { type: 'text', by: 'owner', text: 'Chào bạn, bộ One Piece này còn nhé. Bạn muốn đổi bằng truyện nào?', time: '14:02' },
            { type: 'text', by: 'proposer', text: 'Mình có Naruto 1–10, bù thêm ít tiền được không ạ?', time: '14:05' },
            { type: 'text', by: 'buyerMai', text: 'Mình đang theo dõi phòng. Nếu không đổi được thì mình xin mua luôn bộ này nhé.', time: '14:06' },
            { type: 'text', by: 'buyerKhanh', text: 'Mình có Bleach 1–8, bạn có muốn xem ảnh tình trạng truyện không?', time: '14:08' },
            { type: 'offer', offerId: 1, by: 'proposer' },
            { type: 'text', by: 'owner', text: 'Phòng này có thể trao đổi hoặc mua đứt. Mình sẽ chốt một đề xuất, sau đó hai bên cùng xác nhận hàng hóa, địa chỉ và phí giao nhận trước khi tạo đơn.', time: '14:12' }
        ],
        draft: { mode: 'both', comics: ['c1'], money: 100000 },
        modal: null,
        focusKey: null
    };

    /* ---------- TIỆN ÍCH ---------- */
    var $ = function (s) { return document.querySelector(s); };
    var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
    var fmt = function (n) { return Math.abs(n).toLocaleString('vi-VN') + '₫'; };
    var esc = function (s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var nowTime = function () { return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
    var other = function (r) { return r === 'owner' ? 'proposer' : 'owner'; };
    var comicById = function (id) { return INVENTORY.filter(function (c) { return c.id === id; })[0]; };
    var cover = function (c, w, h) {
        var t = encodeURIComponent(c.title.split(' ').slice(0, 2).join('+'));
        return 'https://placehold.co/' + w + 'x' + h + '/' + c.bg + '/FFF7ED?text=' + t;
    };
    var who = function (r) { return r === state.role || (state.role === 'proposer' && r === state.dealBuyer) ? 'Bạn' : (USERS[r] ? USERS[r].short : 'Thành viên'); };
    var latestOffer = function () { return state.offers[state.offers.length - 1]; };
    var offerById = function (id) { return state.offers.filter(function (o) { return o.id === Number(id); })[0]; };
    var offerForRequest = function (requestId) { return state.offers.filter(function (offer) { return offer.requestId === requestId; })[0]; };
    var selectedDealOffer = function () { return offerForRequest(state.selectedRequestId) || latestOffer(); };
    var requestById = function (id) { return DEAL_REQUESTS.filter(function (request) { return request.id === id; })[0]; };
    var activeBuyer = function () { return USERS[state.dealBuyer] || USERS.proposer; };
    var buyerName = function (key) { return state.role === 'proposer' && key === state.dealBuyer ? 'Bạn' : (USERS[key] ? USERS[key].short : 'Người mua'); };
    var buyerDeals = function () { return state.offers.filter(function (offer) { return (offer.buyerKey || offer.by) === state.dealBuyer; }); };
    var optionType = function (offer) { return offer.optionType || (offer.comics.length ? (offer.money ? 'both' : 'comic') : 'money'); };
    var optionTypeLabel = function (type) { return type === 'money' ? 'Tiền' : type === 'comic' ? 'Trao đổi' : 'Cả hai'; };
    var roomClosed = function () { return state.room.status !== 'negotiating'; };

    function comicsValue(ids) { return ids.reduce(function (s, id) { return s + comicById(id).value; }, 0); }
    function offerValue(o) { return comicsValue(o.comics) + o.money; }
    function moneyText(m, buyerKey, dealType) {
        if (m === 0) return 'Không bù thêm tiền';
        var payer = m > 0 ? (buyerKey || state.dealBuyer) : 'owner';
        if (dealType === 'buy' && m > 0) return buyerName(payer) + ' thanh toán ' + fmt(m);
        return (payer === 'owner' ? who(payer) : buyerName(payer)) + ' bù ' + fmt(m);
    }
    function signed(dir, amount, role) {
        if (role === 'proposer') return dir === 'pay' ? amount : -amount;
        return dir === 'pay' ? -amount : amount;
    }
    function dirOf(money, role) {
        if (money === 0) return 'pay';
        return role === 'proposer' ? (money > 0 ? 'pay' : 'get') : (money > 0 ? 'get' : 'pay');
    }
    function myPending() {
        var selected = state.offers.filter(function (offer) { return offer.id === state.editingOfferId; })[0];
        return selected && selected.status === 'pending' && (selected.buyerKey || selected.by) === state.dealBuyer ? selected : null;
    }
    function lastProposerComics() {
        for (var i = state.offers.length - 1; i >= 0; i--) {
            if (state.offers[i].by === 'proposer') return state.offers[i].comics.slice();
        }
        return [];
    }
    function isWanted(c) { return ITEM.wants.indexOf(c.series) > -1; }

    function addSystem(text) { state.messages.push({ type: 'system', text: text }); }
    function toast(msg) {
        var t = $('#toast');
        t.textContent = msg;
        t.classList.add('is-show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { t.classList.remove('is-show'); }, 2600);
    }

    /* ---------- THANH ĐO GIÁ TRỊ ---------- */
    function meterHTML(value, label) {
        var diff = ITEM.price - value;
        var pct = Math.max(0, Math.min(100, (value / ITEM.price) * 100));
        var cls, note;
        if (Math.abs(diff) <= ITEM.price * 0.02) { cls = 'ok'; note = 'Cân bằng giá trị với bộ truyện'; }
        else if (diff > 0) { cls = 'low'; note = 'Còn thiếu ' + fmt(diff) + ' so với giá trị bộ truyện'; }
        else { cls = 'high'; note = 'Vượt ' + fmt(-diff) + ' so với giá trị bộ truyện'; }
        return '<div class="dc-meter dc-meter--' + cls + '">' +
            '<div class="dc-meter-top"><span>' + (label || 'Giá trị đề xuất') + '</span><strong>' + fmt(Math.max(value, 0)) + ' / ' + fmt(ITEM.price) + '</strong></div>' +
            '<div class="dc-meter-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '"><span style="width:' + pct + '%"></span></div>' +
            '<div class="dc-meter-note">' + note + '</div></div>';
    }

    function miniComics(ids) {
        if (!ids.length) return '<div class="dc-nocomic"><i class="fa-solid fa-ban"></i> Không đổi bằng truyện</div>';
        return '<ul class="dc-minis">' + ids.map(function (id) {
            var c = comicById(id);
            return '<li class="dc-mini"><img src="' + cover(c, 72, 96) + '" alt=""><span><strong>' + esc(c.title) + '</strong><small>' + c.vol + ' · ' + c.cond + '</small></span><em>' + fmt(c.value) + '</em></li>';
        }).join('') + '</ul>';
    }

    /* ---------- RENDER: 2 BÊN ---------- */
    function personCard(u) {
        var you = u.key === state.role ? '<span class="dc-you">Bạn</span>' : '';
        return '<article class="dc-person dc-person--' + u.key + '">' +
            '<div class="dc-avatar">' + u.initials + '<span class="dc-avatar-dot" title="Đang online"></span></div>' +
            '<div class="dc-person-body">' +
            '<div class="dc-person-role">' + u.roleLabel + you + '</div>' +
            '<h3 class="dc-person-name">' + u.name + (u.verified ? ' <i class="fa-solid fa-circle-check dc-verified" title="Đã xác minh"></i>' : '') + '</h3>' +
            '<div class="dc-rating"><i class="fa-solid fa-star"></i> ' + u.rating + ' <span>(' + u.reviews + ' đánh giá)</span></div>' +
            '<ul class="dc-person-stats">' +
            '<li><strong>' + u.deals + '</strong> giao dịch</li>' +
            '<li><strong>' + u.successRate + '%</strong> thành công</li>' +
            '<li>Phản hồi <strong>' + u.response + '</strong></li></ul>' +
            '<div class="dc-person-meta"><span><i class="fa-solid fa-location-dot"></i> ' + u.location + '</span><span><i class="fa-regular fa-calendar"></i> Tham gia ' + u.since + '</span></div>' +
            '</div></article>';
    }

    function statusInfo() {
        switch (state.room.status) {
            case 'agreed': return { cls: 'agreed', icon: 'fa-handshake', text: 'Hai bên đã đồng ý · chờ chốt' };
            case 'confirming': return { cls: 'confirming', icon: 'fa-clipboard-check', text: 'Đã chốt giá · chờ xác nhận giao dịch' };
            case 'locked': return { cls: 'locked', icon: 'fa-truck-fast', text: 'Đã xác nhận · sẵn sàng tạo đơn' };
            default: return { cls: 'negotiating', icon: 'fa-comments', text: 'Đang thương lượng' };
        }
    }

    function renderHero() {
        var s = statusInfo();
        var shown = ROOM_PARTICIPANTS.filter(function (p) {
            return state.participantFilter === 'all' || p.dealType === state.participantFilter || (state.participantFilter === 'closed' && state.room.status === 'locked');
        });
        $('#hero').innerHTML =
            '<section class="dc-room-summary">' +
            '<div class="dc-room-summary-main"><span class="dc-room-kicker"><i class="fa-solid fa-comments"></i> PHÒNG DEAL CỘNG ĐỒNG</span>' +
            '<h2>Phòng ' + state.room.code + '</h2><p>Chủ phòng: <strong>' + USERS.owner.name + '</strong> · ' + ITEM.title + '</p></div>' +
            '<div class="dc-room-summary-meta"><span class="dc-deal-capability">Có thể:</span><span class="dc-deal-type dc-deal-type--trade"><i class="fa-solid fa-arrows-rotate"></i> Trao đổi</span><span class="dc-deal-type dc-deal-type--buy"><i class="fa-solid fa-bag-shopping"></i> Mua đứt</span><span class="dc-status dc-status--' + s.cls + '"><i class="fa-solid ' + s.icon + '"></i> ' + s.text + '</span></div>' +
            '<div class="dc-room-price"><small>Giá niêm yết</small><strong>' + fmt(ITEM.price) + '</strong></div></section>' +
            '<section class="dc-participants" aria-label="Thành viên và đề xuất trong phòng">' +
            '<div class="dc-participants-head"><div><h3>Thành viên & đề xuất</h3><p>' + ROOM_PARTICIPANTS.length + ' thành viên · người mua có thể theo dõi và gửi đề xuất</p></div>' +
            '<div class="dc-participant-filters"><label class="sr-only" for="participantFilter">Lọc thành viên theo loại deal</label><select id="participantFilter"><option value="all" ' + (state.participantFilter === 'all' ? 'selected' : '') + '>Tất cả đề xuất</option><option value="trade" ' + (state.participantFilter === 'trade' ? 'selected' : '') + '>Trao đổi</option><option value="buy" ' + (state.participantFilter === 'buy' ? 'selected' : '') + '>Mua đứt</option><option value="closed" ' + (state.participantFilter === 'closed' ? 'selected' : '') + '>Đã chốt</option></select></div></div>' +
            '<div class="dc-participant-list">' + shown.map(function (p) {
                var u = USERS[p.key];
                var status = (state.room.status === 'locked' || state.room.status === 'confirming') && p.key === state.dealBuyer ? (state.room.status === 'locked' ? 'Đã chốt' : 'Đang xác nhận') : p.status;
                var typeClass = p.dealType === 'buy' ? 'buy' : p.dealType === 'trade' ? 'trade' : 'host';
                return '<button type="button" class="dc-participant dc-participant--' + typeClass + ' ' + (state.chatFilter === p.key ? 'is-selected' : '') + '" data-chat-participant="' + p.key + '">' +
                    '<span class="dc-participant-avatar dc-participant-avatar--' + p.key + '">' + u.initials + '<i></i></span><span class="dc-participant-copy"><strong>' + u.name + (p.key === state.role ? ' <em>Bạn</em>' : '') + '</strong><small>' + p.dealLabel + ' · ' + p.offer + '</small></span><span class="dc-participant-state ' + (status === 'Đã chốt' ? 'is-closed' : '') + '">' + status + '</span></button>';
            }).join('') + '</div></section>';
        $$('#participantFilter option').forEach(function (option) { option.selected = option.value === state.participantFilter; });
    }

    /* ---------- RENDER: SẢN PHẨM ---------- */
    function renderItem() {
        $('#itemCard').innerHTML =
            '<div class="dc-item-cover"><img src="' + ITEM.cover + '" alt="' + esc(ITEM.title) + '"><span class="dc-item-flag"><i class="fa-solid fa-book-open"></i> Sản phẩm trong phòng</span></div>' +
            '<div class="dc-item-body">' +
            '<div class="dc-item-tags">' + ITEM.tags.map(function (t) { return '<span class="dc-tag">' + t + '</span>'; }).join('') + '</div>' +
            '<h2 class="dc-item-title">' + ITEM.title + '</h2>' +
            '<dl class="dc-specs">' + ITEM.specs.map(function (s) { return '<div class="dc-spec"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('') + '</dl>' +
            '<p class="dc-item-note"><i class="fa-regular fa-note-sticky"></i> ' + ITEM.note + '</p>' +
            '<div class="dc-wants"><span>Chủ sở hữu đang tìm:</span>' + ITEM.wants.map(function (w) { return '<b>' + w + '</b>'; }).join('') + '</div>' +
            '</div>' +
            '<div class="dc-item-price">' +
            '<span class="dc-price-label">Giá niêm yết</span>' +
            '<div class="dc-price-value">' + fmt(ITEM.price) + '</div>' +
            '<span class="dc-price-sub">Có thể đổi bằng truyện, tiền hoặc cả hai</span>' +
            '<ul class="dc-price-ways"><li><i class="fa-solid fa-book"></i> Truyện</li><li><i class="fa-solid fa-coins"></i> Tiền</li><li><i class="fa-solid fa-layer-group"></i> Cả hai</li></ul>' +
            '</div>';
    }

    /* ---------- RENDER: CHAT ---------- */
    function offerCardHTML(o, forSide) {
        var mine = o.by === state.role;
        var value = offerValue(o);
        var buyer = USERS[o.buyerKey || o.by] || USERS.proposer;
        var head = '<div class="dc-offer-head"><span class="dc-offer-tag"><i class="fa-solid fa-tag"></i> Đề xuất #' + o.id + ' · ' + (mine ? 'Của bạn' : buyer.short) + '</span>' +
            '<span class="dc-badge dc-badge--' + o.status + '">' + STATUS_LABEL[o.status] + '</span></div>';
        var body = '<div class="dc-offer-block"><span class="dc-offer-label">Người đề nghị đưa</span>' + miniComics(o.comics) + '</div>' +
            '<div class="dc-offer-money ' + (o.money === 0 ? 'is-zero' : '') + '"><i class="fa-solid fa-coins"></i><span>' + moneyText(o.money, o.buyerKey || o.by, o.type) + '</span></div>' +
            meterHTML(value) +
            (o.note ? '<p class="dc-offer-note">“' + esc(o.note) + '”</p>' : '') +
            (o.edited ? '<span class="dc-edited"><i class="fa-solid fa-pen"></i> Đã chỉnh sửa</span>' : '');
        return '<div class="dc-offer dc-offer--' + (mine ? 'mine' : 'them') + ' dc-offer--' + o.status + '">' + head + body + offerActions(o, forSide) + '</div>';
    }

    function offerActions(o, big) {
        return '';
    }

    function renderChat() {
        var s = statusInfo();
        var visibleMessages = state.messages.filter(function (message) {
            return state.chatFilter === 'all' || message.type === 'system' || message.by === state.chatFilter;
        });
        $('#chatHead').innerHTML =
            '<div><h3>Trao đổi trong phòng ' + state.room.code + '</h3><div class="dc-chat-sub"><span class="dc-live"></span> ' + ROOM_PARTICIPANTS.filter(function (p) { return p.key !== state.role; }).length + ' thành viên khác · ' + USERS[state.role].roleLabel + ' đang xem</div></div>' +
            '<span class="dc-status dc-status--' + s.cls + '"><i class="fa-solid ' + s.icon + '"></i> ' + s.text + '</span>';

        $('#chatScroll').innerHTML = visibleMessages.map(function (m) {
            if (m.type === 'system') return '<span class="dc-system">' + esc(m.text) + '</span>';
            var mine = m.by === state.role;
            var u = USERS[m.by];
            if (!u) return '';
            var inner = m.type === 'offer'
                ? offerCardHTML(offerById(m.offerId), false)
                : '<div class="dc-bubble">' + esc(m.text) + '</div>';
            var time = m.type === 'offer' ? offerById(m.offerId).time : m.time;
            return '<div class="dc-msg ' + (mine ? 'dc-msg--me' : 'dc-msg--them') + ' dc-msg--' + m.by + '">' +
                '<div class="dc-msg-avatar dc-msg-avatar--' + m.by + '">' + u.initials + '</div>' +
                '<div class="dc-msg-body"><div class="dc-msg-name">' + (mine ? 'Bạn' : u.name) + '</div>' + inner + '<span class="dc-msg-time">' + time + '</span></div></div>';
        }).join('');
        var sc = $('#chatScroll');
        sc.scrollTop = sc.scrollHeight;

        var closed = roomClosed();
        $('#quickReplies').innerHTML = closed ? '' : QUICK[state.role].map(function (q) {
            return '<button type="button" class="dc-chip" data-act="quick" data-text="' + esc(q) + '">' + esc(q) + '</button>';
        }).join('');
        $('#messageInput').disabled = closed;
        $('#messageInput').placeholder = state.room.status === 'locked' ? 'Deal đã sẵn sàng vận chuyển' : state.room.status === 'confirming' ? 'Đang chờ hai bên xác nhận' : 'Nhập tin nhắn…';
        $('#sendBtn').disabled = closed;
        $('#composerOffer').hidden = state.role === 'owner';
        $('#composerOffer').disabled = closed || state.room.status === 'agreed' || state.role === 'owner';
        $('#composerOffer').innerHTML = '<i class="fa-solid fa-coins"></i> ' + (myPending() ? 'Sửa số tiền' : 'Đề xuất tiền');
    }

    /* ---------- RENDER: PANEL BÊN PHẢI ---------- */
    function builderCard() {
        var d = state.draft;
        var editing = !!myPending();
        if (editing) d.mode = optionType(editing);
        d.mode = d.mode || 'money';
        var isMoney = d.mode === 'money';
        var showComics = !isMoney;
        var showMoney = d.mode !== 'comic';
        var selIds = showComics ? d.comics : [];
        var money = showMoney ? d.money : 0;
        var total = comicsValue(selIds) + money;
        var dealOptions = [['money', 'fa-coins', 'Tiền'], ['comic', 'fa-book-open', 'Trao đổi'], ['both', 'fa-layer-group', 'Cả hai']];
        var existingTypes = buyerDeals().map(optionType);
        var typeSelector = editing
            ? '<div class="dc-type-locked"><i class="fa-solid fa-lock"></i> Loại deal đã gửi: <strong>' + (d.mode === 'money' ? 'Tiền' : d.mode === 'comic' ? 'Trao đổi' : 'Cả hai') + '</strong></div>'
            : '<div class="dc-deal-options" role="tablist" aria-label="Chọn loại deal">' + dealOptions.map(function (option) {
                var unavailable = existingTypes.indexOf(option[0]) >= 0;
                return '<button type="button" role="tab" aria-selected="' + (d.mode === option[0]) + '" class="' + (d.mode === option[0] ? 'is-on' : '') + '" data-act="mode" data-mode="' + option[0] + '"' + (unavailable ? ' disabled' : '') + '><i class="fa-solid ' + option[1] + '"></i><span>' + option[2] + '</span>' + (unavailable ? '<small>Đã gửi</small>' : '') + '</button>';
            }).join('') + '</div>';

        var inv = '';
        if (showComics) {
            var sorted = INVENTORY.slice().sort(function (a, b) { return Number(isWanted(b)) - Number(isWanted(a)); });
            inv = '<div class="dc-block-title">Kệ truyện của bạn <small>' + selIds.length + ' đã chọn</small></div><div class="dc-inv-list">' + sorted.map(function (c) {
                var on = d.comics.indexOf(c.id) > -1;
                return '<label class="dc-inv ' + (on ? 'is-selected' : '') + '">' +
                    '<input type="checkbox" data-act="pick" data-comic="' + c.id + '"' + (on ? ' checked' : '') + '>' +
                    '<img class="dc-inv-cover" src="' + cover(c, 72, 96) + '" alt="">' +
                    '<span class="dc-inv-info"><strong>' + esc(c.title) + '</strong><small>' + c.vol + ' · ' + c.cond + '</small>' +
                    (isWanted(c) ? '<span class="dc-wanted"><i class="fa-solid fa-heart"></i> Chủ truyện đang tìm</span>' : '') + '</span>' +
                    '<span class="dc-inv-value">' + fmt(c.value) + '</span></label>';
            }).join('') + '</div>';
        }

        var moneyRow = '';
        if (showMoney) {
            moneyRow = '<div class="dc-block-title">' + (isMoney ? 'Giá mua đứt' : 'Tiền bù') + '</div><div class="dc-money-row"><div><span class="dc-money-cap">' + (isMoney ? 'Số tiền bạn trả' : 'Số tiền bù thêm') + '</span><strong>' + (isMoney ? fmt(d.money || ITEM.price) : moneyText(d.money)) + '</strong></div>' +
                '<button type="button" class="dc-btn dc-btn--outline dc-btn--sm" data-act="draft-money"><i class="fa-solid fa-pen"></i> ' + (d.money ? 'Chỉnh sửa' : 'Đặt số tiền') + '</button></div>';
        }

        return '<div class="dc-deal-composer"><div class="dc-side-head"><div><h3>' + (editing ? 'Chỉnh sửa deal #' + editing.id : 'Tạo deal mới') + '</h3><span class="dc-side-sub">' + (editing ? 'Loại deal được giữ nguyên khi chỉnh sửa' : 'Mỗi loại deal chỉ tạo được một option trong phòng') + '</span></div><button type="button" class="dc-modal-x" data-act="close-deal-form" aria-label="Đóng form"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="dc-buyer-price-summary"><span>Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong></div>' +
            typeSelector + inv + moneyRow + meterHTML(total, isMoney ? 'Giá mua bạn đề xuất' : 'Tổng giá trị bạn đưa ra') +
            '<button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="send-draft"><i class="fa-solid fa-paper-plane"></i> ' + (editing ? 'Cập nhật deal' : 'Gửi deal') + '</button></div>';
    }

    function ownerRequestPanel() {
        var selected = requestById(state.selectedRequestId);
        var filteredRequests = DEAL_REQUESTS.filter(function (request) {
            var matchesType = state.requestFilter === 'all' || request.type === state.requestFilter;
            var matchesStatus = state.requestStatusFilter === 'all' || request.status === state.requestStatusFilter;
            var query = state.requestSearch.trim().toLowerCase();
            var buyer = USERS[request.buyer];
            var matchesSearch = !query || (buyer.name + ' ' + request.id + ' ' + request.note).toLowerCase().includes(query);
            return matchesType && matchesStatus && matchesSearch;
        });
        if (selected && !filteredRequests.some(function (request) { return request.id === selected.id; })) selected = null;
        filteredRequests.sort(function (a, b) {
            if (state.requestSort === 'value-high') return (comicsValue(b.comics) + b.money) - (comicsValue(a.comics) + a.money);
            if (state.requestSort === 'value-low') return (comicsValue(a.comics) + a.money) - (comicsValue(b.comics) + b.money);
            if (state.requestSort === 'oldest') return a.time.localeCompare(b.time);
            return b.time.localeCompare(a.time);
        });
        var rows = filteredRequests.map(function (request) {
            var buyer = USERS[request.buyer];
            var value = comicsValue(request.comics) + request.money;
            var selectedClass = request.id === state.selectedRequestId ? ' is-selected' : '';
            return '<button type="button" class="dc-request-row dc-request-row--' + request.type + selectedClass + '" data-act="select-request" data-request-id="' + request.id + '">' +
                '<span class="dc-request-avatar dc-request-avatar--' + request.buyer + '">' + buyer.initials + '</span><span class="dc-request-copy"><strong>' + buyer.name + '</strong><small><span class="dc-request-kind dc-request-kind--' + request.type + '">' + optionTypeLabel(request.optionType || (request.type === 'buy' ? 'money' : request.comics.length && request.money ? 'both' : 'comic')) + '</span>' + esc(request.note) + '</small></span>' +
                '<span class="dc-request-value"><strong>' + fmt(value) + '</strong><small>' + request.time + '</small><em class="dc-request-status dc-request-status--' + request.status + '">' + (request.status === 'accepted' ? 'Đã chọn' : request.status === 'declined' ? 'Đã từ chối' : 'Chờ xem') + '</em></span></button>';
        }).join('');
        var summary = '';
        if (selected) {
            var selectedBuyer = USERS[selected.buyer];
            var proposedValue = comicsValue(selected.comics) + selected.money;
            summary = '<div class="dc-request-selected"><div class="dc-request-selected-head"><div><span class="dc-request-kind dc-request-kind--' + selected.type + '">' + optionTypeLabel(selected.optionType || (selected.type === 'buy' ? 'money' : selected.comics.length && selected.money ? 'both' : 'comic')) + '</span><span class="dc-request-id">' + selected.id + '</span></div><span class="dc-badge dc-badge--pending">Chờ chủ phòng</span></div>' +
                '<h4>' + selectedBuyer.name + ' gửi yêu cầu</h4><p>' + esc(selected.note) + '</p>' +
                '<div class="dc-request-total"><span>Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong></div>' +
                '<div class="dc-request-total"><span>Giá trị buyer đề xuất</span><strong>' + fmt(proposedValue) + '</strong></div>' +
                '<p class="dc-request-note">Chọn xác nhận để chốt request này. Các request khác sẽ được giữ lại nhưng không thể thắng deal đã chốt.</p>' +
                '<button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="lock"><i class="fa-solid fa-circle-check"></i> Xác nhận request này</button></div>';
        }
        return '<div class="dc-side-card dc-owner-inbox"><div class="dc-listing-price-card"><span><i class="fa-solid fa-tag"></i> Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong><small>Giá sản phẩm trong tin đăng</small></div>' +
            '<div class="dc-side-head"><div><h3>Request từ người mua</h3><span class="dc-side-sub">Chọn request để xem và xác nhận</span></div><span class="dc-request-count">' + filteredRequests.length + '/' + DEAL_REQUESTS.length + '</span></div>' +
            '<div class="dc-request-tools"><label class="dc-request-search"><i class="fa-solid fa-magnifying-glass"></i><input id="requestSearch" type="search" value="' + esc(state.requestSearch) + '" placeholder="Tìm người mua hoặc mã request"></label>' +
            '<div class="dc-request-filters" role="group" aria-label="Lọc request theo hình thức"><button type="button" class="' + (state.requestFilter === 'all' ? 'is-active' : '') + '" data-act="request-filter" data-request-filter="all">Tất cả</button><button type="button" class="' + (state.requestFilter === 'buy' ? 'is-active' : '') + '" data-act="request-filter" data-request-filter="buy">Mua đứt</button><button type="button" class="' + (state.requestFilter === 'trade' ? 'is-active' : '') + '" data-act="request-filter" data-request-filter="trade">Trao đổi</button></div>' +
            '<div class="dc-request-selects"><label for="requestStatusFilter">Tình trạng</label><select id="requestStatusFilter"><option value="all">Tất cả</option><option value="pending" ' + (state.requestStatusFilter === 'pending' ? 'selected' : '') + '>Chờ xem</option><option value="accepted" ' + (state.requestStatusFilter === 'accepted' ? 'selected' : '') + '>Đã chọn</option><option value="declined" ' + (state.requestStatusFilter === 'declined' ? 'selected' : '') + '>Đã từ chối</option></select><label for="requestSort">Sắp xếp</label><select id="requestSort"><option value="newest" ' + (state.requestSort === 'newest' ? 'selected' : '') + '>Mới nhất</option><option value="oldest" ' + (state.requestSort === 'oldest' ? 'selected' : '') + '>Cũ nhất</option><option value="value-high" ' + (state.requestSort === 'value-high' ? 'selected' : '') + '>Giá cao nhất</option><option value="value-low" ' + (state.requestSort === 'value-low' ? 'selected' : '') + '>Giá thấp nhất</option></select></div></div>' +
            '<div class="dc-request-list" aria-label="Danh sách request deal">' + (rows || '<p class="dc-empty-request">Không tìm thấy request phù hợp.</p>') + '</div>' + summary + '</div>';
    }

    function buyerDealsCard() {
        var deals = buyerDeals();
        var types = deals.map(optionType);
        var values = deals.map(function (offer) {
            var type = optionType(offer);
            var total = offerValue(offer);
            var detail = offer.comics.length
                ? offer.comics.map(function (id) { return comicById(id).title; }).join(', ') + (offer.money ? ' · bù ' + fmt(offer.money) : '')
                : 'Thanh toán ' + fmt(offer.money);
            var canEdit = offer.status === 'pending' && !roomClosed();
            return '<article class="dc-my-deal dc-my-deal--' + type + '"><div class="dc-my-deal-heading"><span class="dc-my-deal-type dc-my-deal-type--' + type + '">' + optionTypeLabel(type) + '</span><span class="dc-badge dc-badge--' + offer.status + '">' + STATUS_LABEL[offer.status] + '</span></div>' +
                '<p class="dc-my-deal-detail">' + esc(detail) + '</p><div class="dc-my-deal-footer"><span>Giá trị deal <strong>' + fmt(total) + '</strong></span>' +
                (canEdit ? '<button type="button" class="dc-btn dc-btn--outline dc-btn--sm" data-act="edit-deal" data-offer-id="' + offer.id + '"><i class="fa-solid fa-pen"></i> Chỉnh sửa</button>' : '') + '</div></article>';
        }).join('');
        var available = ['money', 'comic', 'both'].filter(function (type) { return types.indexOf(type) < 0; });
        var canAdd = available.length > 0 && !roomClosed();
        return '<section class="dc-side-card dc-my-deals"><div class="dc-side-head"><div><h3>Các deal của bạn</h3><span class="dc-side-sub">' + deals.length + ' / 3 option đã gửi</span></div>' +
            (canAdd ? '<button class="dc-add-deal" type="button" data-act="new-deal" aria-label="Tạo deal mới" title="Tạo deal mới"><i class="fa-solid fa-plus"></i></button>' : '') + '</div>' +
            '<div class="dc-my-deal-list">' + (values || '<p class="dc-empty-request">Bạn chưa gửi deal nào trong phòng này.</p>') + '</div>' +
            (state.requestFormOpen ? builderCard() : '') +
            (deals.length >= 3 ? '<p class="dc-deal-limit"><i class="fa-solid fa-circle-info"></i> Bạn đã gửi đủ ba loại deal: Tiền, Trao đổi và Cả hai.</p>' : '') +
            '</section>';
    }

    function openDealEdit(offerId) {
        var offer = offerById(offerId);
        if (!offer || offer.status !== 'pending' || (offer.buyerKey || offer.by) !== state.dealBuyer || roomClosed()) return;
        state.editingOfferId = offer.id;
        state.dealEditDraft = { comics: offer.comics.slice(), money: offer.money };
        var type = optionType(offer);
        var typeDescription = { money: 'Thanh toán trực tiếp', comic: 'Trao đổi truyện', both: 'Trao đổi truyện và tiền' }[type];
        $('#dealEditTitle').textContent = 'Chỉnh sửa deal #' + offer.id;
        $('#dealEditType').innerHTML = '<i class="fa-solid fa-lock"></i> Loại deal không đổi: <strong>' + optionTypeLabel(type) + '</strong> · ' + typeDescription;

        var comics = type === 'money' ? '' : '<div class="dc-block-title">Truyện bạn muốn đưa</div><div class="dc-edit-comics">' + INVENTORY.map(function (comic) {
            var checked = offer.comics.indexOf(comic.id) >= 0;
            return '<label class="dc-edit-comic ' + (checked ? 'is-selected' : '') + '"><input type="checkbox" data-edit-comic="' + comic.id + '"' + (checked ? ' checked' : '') + '><span><strong>' + esc(comic.title) + '</strong><small>' + comic.vol + ' · ' + comic.cond + '</small></span><em>' + fmt(comic.value) + '</em></label>';
        }).join('') + '</div>';
        var moneyField = type === 'comic' ? '' : '<div class="dc-field dc-edit-money"><label for="dealEditMoney">' + (type === 'money' ? 'Giá mua đứt bạn đề xuất' : 'Số tiền bù thêm') + '</label><div class="dc-amount"><input id="dealEditMoney" type="text" inputmode="numeric" value="' + (offer.money ? offer.money.toLocaleString('vi-VN') : '') + '"><span>₫</span></div></div>';
        $('#dealEditFields').innerHTML = '<div class="dc-buyer-price-summary"><span>Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong></div>' + comics + moneyField;
        showModal('#dealEditModal');
    }

    function saveDealEdit() {
        var offer = state.offers.filter(function (item) { return item.id === state.editingOfferId; })[0];
        if (!offer || offer.status !== 'pending') return;
        var type = optionType(offer);
        var comics = type === 'money' ? [] : $$('[data-edit-comic]:checked').map(function (input) { return input.getAttribute('data-edit-comic'); });
        var money = type === 'comic' ? 0 : parseAmount($('#dealEditMoney').value);
        if (type !== 'money' && comics.length === 0) { toast('Chọn ít nhất một truyện cho deal.'); return; }
        if (type !== 'comic' && money <= 0) { toast(type === 'money' ? 'Nhập giá mua đứt bạn đề xuất.' : 'Nhập số tiền bù thêm.'); return; }

        offer.comics = comics;
        offer.money = money;
        offer.edited = true;
        var request = requestById(offer.requestId);
        if (request) {
            request.comics = comics.slice();
            request.money = money;
            request.note = type === 'money' ? fmt(money) : comics.map(function (id) { return comicById(id).title; }).join(', ') + (money ? ' · bù ' + fmt(money) : '');
        }
        state.editingOfferId = null;
        state.dealEditDraft = null;
        closeModals();
        renderAll();
        toast('Đã cập nhật deal.');
    }

    function lockedCard() {
        var acc = state.offers.filter(function (o) { return o.status === 'accepted'; }).pop() || latestOffer();
        var buyer = activeBuyer();
        var bothConfirmed = state.confirmations.owner && state.confirmations.buyer;
        var ownConfirmation = state.role === 'owner' ? state.confirmations.owner : state.confirmations.buyer;
        var otherPartyName = state.role === 'owner' ? buyer.short : USERS.owner.short;
        var cta = bothConfirmed
            ? '<div class="dc-notice dc-notice--ok"><i class="fa-solid fa-circle-check"></i><span>Cả hai bên đã xác nhận thông tin. Deal có thể chuyển thành đơn vận chuyển.</span></div><button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="create-order">Tạo đơn vận chuyển <i class="fa-solid fa-arrow-right"></i></button>'
            : '<div class="dc-confirmation-status"><span class="' + (state.confirmations.owner ? 'is-confirmed' : '') + '"><i class="fa-solid ' + (state.confirmations.owner ? 'fa-circle-check' : 'fa-clock') + '"></i> Seller: ' + (state.confirmations.owner ? 'Đã xác nhận' : 'Chờ xác nhận') + '</span><span class="' + (state.confirmations.buyer ? 'is-confirmed' : '') + '"><i class="fa-solid ' + (state.confirmations.buyer ? 'fa-circle-check' : 'fa-clock') + '"></i> ' + buyer.short + ': ' + (state.confirmations.buyer ? 'Đã xác nhận' : 'Chờ xác nhận') + '</span></div>' +
                (ownConfirmation ? '<div class="dc-notice"><i class="fa-regular fa-clock"></i><span>Bạn đã xác nhận. Đang chờ ' + otherPartyName + ' xác nhận thông tin.</span></div>' : '<button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="confirm-details"><i class="fa-solid fa-clipboard-check"></i> Xác nhận thông tin giao dịch</button>');
        return '<div class="dc-side-card dc-side-card--done"><div class="dc-done-icon"><i class="fa-solid fa-lock"></i></div>' +
            '<h3 class="dc-done-title">Deal đã được chốt</h3><p class="dc-hint">Đề xuất #' + acc.id + ' · Phòng chat đã khóa.</p>' +
            '<div class="dc-offer-block"><span class="dc-offer-label">' + buyer.short + ' đưa</span>' + miniComics(acc.comics) + '</div>' +
            '<div class="dc-offer-money ' + (acc.money === 0 ? 'is-zero' : '') + '"><i class="fa-solid fa-coins"></i><span>' + moneyText(acc.money, acc.buyerKey || state.dealBuyer, acc.type) + '</span></div>' +
            '<div class="dc-offer-block"><span class="dc-offer-label">' + USERS.owner.short + ' đưa</span><ul class="dc-minis"><li class="dc-mini"><img src="' + ITEM.cover + '" alt=""><span><strong>' + ITEM.title + '</strong><small>' + ITEM.tags[1] + ' · ~90%</small></span><em>' + fmt(ITEM.price) + '</em></li></ul></div>' +
            '<div class="dc-shipping-confirm"><strong><i class="fa-solid fa-truck-fast"></i> Thông tin cần cùng xác nhận</strong><p>Giá chủ phòng: ' + fmt(ITEM.price) + ' · địa chỉ lấy hàng theo tin đăng Seller · địa chỉ nhận hàng của ' + buyer.short + ' · phí vận chuyển và tổng tiền. Địa chỉ được chốt theo deal này, không tự đổi theo hồ sơ sau đó.</p></div>' +
            cta + '<p class="dc-hint dc-hint--center">Đơn vận chuyển chỉ được tạo sau khi cả Buyer và Seller xác nhận.</p></div>';
    }

    function historyCard() {
        var items = state.offers.slice().reverse().map(function (o) {
            var parts = [];
            if (o.comics.length) parts.push(o.comics.length + ' bộ truyện');
            if (o.money) parts.push(moneyText(o.money, o.buyerKey || o.by, o.type));
            var actor = o.buyerKey ? buyerName(o.buyerKey) : who(o.by);
            return '<li class="dc-hist"><span class="dc-hist-dot dc-hist-dot--' + o.by + '"></span><div><strong>#' + o.id + ' · ' + actor + (o.edited ? ' <em>(đã sửa)</em>' : '') + '</strong><small>' + (parts.join(' + ') || 'Không có nội dung') + ' · ' + o.time + '</small></div>' +
                '<span class="dc-badge dc-badge--' + o.status + '">' + STATUS_LABEL[o.status] + '</span></li>';
        }).join('');
        return '<div class="dc-side-card"><div class="dc-side-head"><h3>Lịch sử đề xuất</h3><span class="dc-side-sub">' + state.offers.length + ' đề xuất</span></div><ul class="dc-hist-list">' + items + '</ul></div>';
    }

    function renderSide() {
        var html = '';
        if (state.room.status === 'locked' || state.room.status === 'confirming') html += lockedCard();
        else {
            if (state.role === 'proposer') html += buyerDealsCard();
            else html += ownerRequestPanel();
        }
        html += historyCard();
        $('#sidePanel').innerHTML = html;
        if (state.focusKey) {
            var el = $('[data-comic="' + state.focusKey + '"]') || $('[data-mode="' + state.focusKey + '"]');
            if (el) el.focus();
            state.focusKey = null;
        }
    }

    function renderRole() {
        $$('.dc-roleswitch button').forEach(function (b) {
            var on = b.getAttribute('data-role') === state.role;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-selected', String(on));
        });
    }

    function renderAll() {
        renderRole(); renderHero(); renderItem(); renderChat(); renderSide();
    }

    /* ---------- LOGIC ĐỀ XUẤT ---------- */
    function syncDraft() {
        if (state.role !== 'proposer') return;
        var mine = myPending();
        if (!mine) return;
        state.draft = {
            mode: optionType(mine),
            comics: mine.comics.slice(),
            money: mine.money
        };
    }

    function commitOffer(p) {
        var mine = myPending();
        if (mine) {
            mine.comics = p.comics; mine.money = p.money;
            mine.optionType = state.draft.mode;
            mine.type = state.draft.mode === 'money' ? 'buy' : 'trade';
            if (p.note !== undefined && p.note !== '') mine.note = p.note;
            mine.edited = true;
            var editedRequest = requestById(mine.requestId);
            if (editedRequest) {
                editedRequest.comics = p.comics.slice();
                editedRequest.money = p.money;
                editedRequest.optionType = state.draft.mode;
                editedRequest.type = mine.type;
                editedRequest.note = p.note || editedRequest.note;
            }
            state.requestFormOpen = false;
            state.editingOfferId = null;
            addSystem(who(state.role) + ' đã chỉnh sửa đề xuất #' + mine.id);
            toast('Đã cập nhật đề xuất của bạn.');
        } else {
            if (buyerDeals().some(function (offer) { return optionType(offer) === state.draft.mode; })) {
                toast('Loại deal này đã được gửi. Hãy chỉnh sửa deal hiện có.');
                return;
            }
            var requestId = 'RQ-' + state.room.code.replace(/\D/g, '') + '-' + String(DEAL_REQUESTS.length + 1).padStart(2, '0');
            var requestTime = nowTime();
            var requestType = state.draft.mode === 'money' ? 'buy' : 'trade';
            var o = { id: state.offers.length + 1, by: state.role, buyerKey: state.dealBuyer, requestId: requestId, type: requestType, optionType: state.draft.mode, comics: p.comics, money: p.money, note: p.note || '', status: 'pending', edited: false, time: requestTime };
            state.offers.push(o);
            DEAL_REQUESTS.push({ id: requestId, buyer: state.dealBuyer, type: requestType, optionType: state.draft.mode, comics: p.comics.slice(), money: p.money, note: p.note || (requestType === 'buy' ? fmt(p.money) : 'Đề xuất ' + (state.draft.mode === 'comic' ? 'trao đổi truyện' : 'trao đổi truyện và tiền')), status: 'pending', time: requestTime });
            var participant = ROOM_PARTICIPANTS.filter(function (person) { return person.key === state.dealBuyer; })[0];
            var participantRequest = requestById(requestId);
            if (participant) {
                participant.dealType = participantRequest.type;
                participant.dealLabel = optionTypeLabel(participantRequest.optionType);
                participant.offer = participantRequest.note;
                participant.status = 'Đang chờ phản hồi';
            } else {
                ROOM_PARTICIPANTS.push({ key: state.dealBuyer, dealType: participantRequest.type, dealLabel: optionTypeLabel(participantRequest.optionType), offer: participantRequest.note, status: 'Đang chờ phản hồi' });
            }
            state.selectedRequestId = requestId;
            state.messages.push({ type: 'offer', offerId: o.id, by: state.dealBuyer });
            state.requestFormOpen = false;
            state.editingOfferId = null;
            toast('Đã gửi đề xuất.');
        }
        syncDraft();
        renderAll();
    }

    function sendDraft() {
        var d = state.draft;
        if (d.mode === 'money') {
            if (!(d.money > 0)) { toast('Nhập số tiền bạn muốn thanh toán.'); return; }
            commitOffer({ comics: [], money: d.money, note: fmt(d.money) });
            return;
        }
        var needMoney = d.mode === 'both';
        if (!d.comics.length) { toast('Hãy chọn ít nhất 1 truyện cho deal này.'); return; }
        if (needMoney && d.money <= 0) { toast('Nhập số tiền bù cho deal này.'); return; }
        commitOffer({ comics: d.comics.slice(), money: needMoney ? d.money : 0 });
    }

    function acceptOffer(id) {
        var o = offerById(id);
        if (!o || o.status !== 'pending' || o.by === state.role || roomClosed()) return;
        o.status = 'accepted';
        state.room.status = 'agreed';
        addSystem(who(state.role) + ' đã đồng ý đề xuất #' + o.id + '. Chờ chủ sở hữu chốt giá & khóa phòng.');
        toast('Bạn đã đồng ý đề xuất #' + o.id);
        renderAll();
    }

    function declineOffer(id) {
        var o = offerById(id);
        if (!o || o.status !== 'pending' || o.by === state.role || roomClosed()) return;
        o.status = 'declined';
        addSystem(who(state.role) + ' đã từ chối đề xuất #' + o.id);
        toast('Đã từ chối đề xuất #' + o.id);
        renderAll();
    }

    function sendMessage(text) {
        text = (text || '').trim();
        if (!text || roomClosed()) return;
        state.messages.push({ type: 'text', by: state.role, text: text, time: nowTime() });
        renderChat();
    }

    /* ---------- CHỐT & KHÓA PHÒNG ---------- */
    function openLockModal() {
        var l = selectedDealOffer();
        var buyer = activeBuyer();
        var selected = requestById(state.selectedRequestId);
        $('#lockSummary').innerHTML =
            '<div class="dc-request-total"><span>Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong></div>' +
            '<div class="dc-offer-block"><span class="dc-offer-label">' + buyer.short + ' · ' + (selected ? optionTypeLabel(selected.optionType || (selected.type === 'buy' ? 'money' : selected.comics.length && selected.money ? 'both' : 'comic')) : 'Deal') + '</span>' + miniComics(l.comics) + '</div>' +
            '<div class="dc-offer-money ' + (l.money === 0 ? 'is-zero' : '') + '"><i class="fa-solid fa-coins"></i><span>' + moneyText(l.money, l.buyerKey || state.dealBuyer, l.type) + '</span></div>' +
            meterHTML(offerValue(l));
        $('#lockModalTitle').innerHTML = '<i class="fa-solid fa-circle-check"></i> Xác nhận request deal';
        $('#lockConfirm').checked = false;
        $('#lockSubmit').disabled = true;
        showModal('#lockModal');
    }

    function lockRoom() {
        var l = selectedDealOffer();
        if (state.role !== 'owner' || !l) return;
        if (l.status === 'pending' && l.by === 'proposer') l.status = 'accepted';
        if (l.status !== 'accepted') return;
        state.offers.forEach(function (offer) {
            if (offer.id !== l.id && offer.status === 'pending') offer.status = 'superseded';
        });
        DEAL_REQUESTS.forEach(function (request) {
            request.status = request.id === state.selectedRequestId ? 'accepted' : 'declined';
        });
        state.room.status = 'confirming';
        state.confirmations = { owner: false, buyer: false };
        addSystem(USERS.owner.short + ' đã chọn request #' + (state.selectedRequestId || l.id) + ' từ ' + activeBuyer().short + '. Phòng đóng nhận request mới; hai bên cần xác nhận thông tin giao dịch.');
        closeModals();
        toast('Đã chốt giá. Chờ hai bên xác nhận giao dịch.');
        renderAll();
    }

    function confirmDetails() {
        var confirmationKey = state.role === 'owner' ? 'owner' : 'buyer';
        if (state.room.status !== 'confirming' || state.confirmations[confirmationKey]) return;
        state.confirmations[confirmationKey] = true;
        addSystem((state.role === 'owner' ? USERS.owner.short : activeBuyer().short) + ' đã xác nhận thông tin hàng hóa, địa chỉ và phí vận chuyển.');
        if (state.confirmations.owner && state.confirmations.buyer) {
            state.room.status = 'locked';
            addSystem('Cả hai bên đã xác nhận. Deal sẵn sàng chuyển thành đơn vận chuyển.');
            toast('Hai bên đã xác nhận giao dịch.');
        } else {
            toast('Đã ghi nhận xác nhận của bạn.');
        }
        renderAll();
    }

    function selectRequest(requestId) {
        if (state.role !== 'owner' || roomClosed()) return;
        var request = requestById(requestId);
        if (!request) return;
        state.selectedRequestId = request.id;
        state.dealBuyer = request.buyer;
        state.draft.mode = request.optionType || (request.type === 'buy' ? 'money' : request.comics.length && request.money ? 'both' : request.comics.length ? 'comic' : 'money');
        state.draft.comics = request.comics.slice();
        state.draft.money = request.money;
        var existing = state.offers.filter(function (offer) { return offer.requestId === request.id; })[0];
        if (existing) {
            if (existing.status === 'pending') existing.status = 'pending';
        } else {
            var offer = {
                id: state.offers.length + 1,
                by: 'proposer',
                buyerKey: request.buyer,
                requestId: request.id,
                type: request.type,
                optionType: request.optionType || state.draft.mode,
                comics: request.comics.slice(),
                money: request.money,
                note: request.note,
                status: 'pending',
                edited: false,
                time: request.time
            };
            state.offers.push(offer);
            state.messages.push({ type: 'offer', offerId: offer.id, by: request.buyer });
        }
        addSystem('Chủ phòng đang xem request ' + request.id + ' của ' + USERS[request.buyer].short + '.');
        renderAll();
    }

    /* ---------- POPUP NHẬP SỐ TIỀN ---------- */
    function parseAmount(v) { return Math.min(MAX_MONEY, parseInt(String(v).replace(/\D/g, ''), 10) || 0); }

    function openModal(kind) {
        if (state.role !== 'proposer') return;
        var mine = myPending();
        var isBuy = state.draft.mode === 'money';
        var money = isBuy ? (state.draft.money || ITEM.price) : 0, title = isBuy ? 'Giá mua đứt' : 'Đưa ra số tiền', submit = isBuy ? 'Lưu giá mua' : 'Gửi đề xuất';
        if (kind === 'edit' && mine) { money = mine.money; title = 'Chỉnh sửa số tiền của bạn'; submit = 'Lưu chỉnh sửa'; }
        else if (kind === 'draft') { money = isBuy ? (state.draft.money || ITEM.price) : state.draft.money; title = isBuy ? 'Đặt giá mua đứt' : 'Đặt số tiền bù'; submit = isBuy ? 'Lưu giá mua' : 'Lưu số tiền'; }
        else if (kind === 'counter') { money = latestOffer().money; title = 'Ra giá lại'; }
        else if (state.role === 'proposer') { money = mine ? mine.money : state.draft.money; if (mine) { kind = 'edit'; title = 'Chỉnh sửa số tiền của bạn'; submit = 'Lưu chỉnh sửa'; } }
        else if (mine) { money = mine.money; kind = 'edit'; title = 'Chỉnh sửa số tiền của bạn'; submit = 'Lưu chỉnh sửa'; }
        else { money = latestOffer() ? latestOffer().money : 0; }

        state.modal = { kind: kind, dir: isBuy ? 'pay' : dirOf(money, state.role), optionType: state.draft.mode };
        $('#offerModalTitle').textContent = title;
        $('#offerSubmit').textContent = submit;
        $('#amountInput').value = money ? Math.abs(money).toLocaleString('vi-VN') : '';
        $('#offerNote').value = '';
        $('#offerNoteField').hidden = kind === 'draft';
        $('#dirGet').hidden = isBuy;
        $('#dirSeg').classList.toggle('dc-seg--single', isBuy);
        $('#dirSeg').setAttribute('aria-label', isBuy ? 'Hình thức thanh toán' : 'Chiều bù tiền');
        $('#dirSeg').parentNode.querySelector('label').textContent = isBuy ? 'Hình thức thanh toán' : 'Bạn muốn làm gì với khoản tiền?';
        $('#dirPay').textContent = isBuy ? 'Tôi thanh toán giá này' : 'Tôi bù thêm tiền';
        updateModalUI();
        showModal('#offerModal');
        setTimeout(function () { $('#amountInput').focus(); }, 30);
    }

    function modalComics() {
        if (state.role === 'owner') return lastProposerComics();
        var d = state.draft;
        return d.mode === 'money' ? [] : d.comics.slice();
    }

    function updateModalUI() {
        var m = state.modal;
        var isBuy = m.optionType === 'money';
        var them = USERS.owner.short;
        var amount = parseAmount($('#amountInput').value);
        $$('#dirSeg button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-dir') === m.dir); });
        $('#dirGet').hidden = isBuy;
        $('#dirSeg').classList.toggle('dc-seg--single', isBuy);
        $('#dirSeg').setAttribute('aria-label', isBuy ? 'Hình thức thanh toán' : 'Chiều bù tiền');
        $('#dirSeg').parentNode.querySelector('label').textContent = isBuy ? 'Hình thức thanh toán' : 'Bạn muốn làm gì với khoản tiền?';
        $('#dirPay').textContent = isBuy ? 'Tôi thanh toán giá này' : 'Tôi bù thêm tiền';
        var comics = modalComics();
        $('#offerModalSummary').innerHTML = '<span class="dc-offer-label">Kèm theo đề xuất</span>' + miniComics(comics);
        var money = isBuy ? amount : signed(m.dir, amount, state.role);
        var txt = amount === 0 ? (isBuy ? 'Nhập số tiền bạn muốn thanh toán.' : 'Bạn chưa nhập số tiền — đề xuất sẽ không bù tiền.')
            : isBuy ? 'Bạn đề nghị thanh toán ' + fmt(amount) + ' để mua đứt sản phẩm.'
            : m.dir === 'pay' ? 'Bạn bù ' + fmt(amount) + ' cho ' + them + '.' : 'Bạn nhận thêm ' + fmt(amount) + ' từ ' + them + '.';
        $('#offerPreview').innerHTML = '<div class="dc-preview-text"><i class="fa-solid fa-circle-info"></i> ' + txt + '</div>' + meterHTML(comicsValue(comics) + money);
        $('#dirGet').textContent = 'Tôi muốn nhận thêm';
    }

    function submitModal() {
        var m = state.modal;
        var amount = parseAmount($('#amountInput').value);
        var money = m.optionType === 'money' ? amount : signed(m.dir, amount, state.role);
        var note = $('#offerNote').value.trim();

        if (state.role === 'proposer') {
            if (m.optionType === 'money' && amount <= 0) { toast('Nhập giá tiền cho option này.'); return; }
            if (m.kind === 'draft') {
                state.draft.money = money;
                if (state.draft.mode === 'comic' && money !== 0) state.draft.mode = 'both';
                closeModals(); renderSide(); return;
            }
            if (state.draft.mode === 'comic' && money !== 0) state.draft.mode = 'both';
            var comics = state.draft.mode === 'money' ? [] : state.draft.comics.slice();
            if (!comics.length && money === 0) { toast('Đề xuất cần có truyện hoặc số tiền.'); return; }
            if (state.draft.mode === 'money' && money === 0) { toast('Hãy nhập số tiền bạn muốn đưa ra.'); return; }
            state.draft.money = money;
            closeModals();
            commitOffer({ comics: comics, money: money, note: note });
            return;
        }
        // owner
        var oc = lastProposerComics();
        closeModals();
        commitOffer({ comics: oc, money: money, note: note });
    }

    function showModal(sel) { var el = $(sel); el.hidden = false; document.body.classList.add('dc-noscroll'); }
    function closeModals() { $$('.dc-modal').forEach(function (m) { m.hidden = true; }); document.body.classList.remove('dc-noscroll'); state.modal = null; }

    /* ---------- SỰ KIỆN ---------- */
    document.addEventListener('click', function (e) {
        var role = e.target.closest('[data-role]');
        if (role) {
            state.role = role.getAttribute('data-role');
            history.replaceState(null, '', '?role=' + state.role);
            syncDraft(); renderAll();
            toast('Đang xem với vai trò: ' + USERS[state.role].roleLabel);
            return;
        }
        if (e.target.closest('[data-close]')) { closeModals(); return; }
        var participant = e.target.closest('[data-chat-participant]');
        if (participant) {
            state.chatFilter = state.chatFilter === participant.getAttribute('data-chat-participant') ? 'all' : participant.getAttribute('data-chat-participant');
            renderHero(); renderChat();
            return;
        }
        var dir = e.target.closest('#dirSeg button');
        if (dir) { state.modal.dir = dir.getAttribute('data-dir'); updateModalUI(); return; }
        var chip = e.target.closest('#amountChips button');
        if (chip) {
            var cur = parseAmount($('#amountInput').value);
            var add = chip.getAttribute('data-add');
            var next = add === 'reset' ? 0 : cur + Number(add);
            $('#amountInput').value = next ? Math.min(next, MAX_MONEY).toLocaleString('vi-VN') : '';
            updateModalUI(); return;
        }

        var btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        var act = btn.getAttribute('data-act');
        var id = btn.getAttribute('data-id');
        switch (act) {
            case 'new-deal': {
                if (roomClosed()) { toast('Phòng đã chốt và không nhận thêm deal.'); break; }
                var usedTypes = buyerDeals().map(optionType);
                var firstAvailable = ['money', 'comic', 'both'].filter(function (type) { return usedTypes.indexOf(type) < 0; })[0];
                if (!firstAvailable) { toast('Bạn đã gửi đủ ba loại deal trong phòng này.'); break; }
                state.editingOfferId = null;
                state.requestFormOpen = true;
                state.draft = { mode: firstAvailable, comics: [], money: firstAvailable === 'money' ? ITEM.price : 0 };
                renderSide();
                break;
            }
            case 'edit-deal': {
                openDealEdit(btn.getAttribute('data-offer-id'));
                break;
            }
            case 'save-deal-edit': saveDealEdit(); break;
            case 'close-deal-form':
                state.requestFormOpen = false;
                state.editingOfferId = null;
                renderSide();
                break;
            case 'request-filter':
                state.requestFilter = btn.getAttribute('data-request-filter');
                renderSide();
                break;
            case 'select-request': selectRequest(btn.getAttribute('data-request-id')); break;
            case 'accept': acceptOffer(id); break;
            case 'decline': declineOffer(id); break;
            case 'counter': openModal('counter'); break;
            case 'edit': openModal('edit'); break;
            case 'mode':
                if (roomClosed() || myPending()) return;
                if (buyerDeals().some(function (offer) { return optionType(offer) === btn.getAttribute('data-mode'); })) {
                    toast('Bạn đã tạo deal thuộc loại này rồi. Hãy chỉnh sửa deal hiện có.');
                    return;
                }
                state.draft.mode = btn.getAttribute('data-mode');
                state.draft.comics = [];
                state.draft.money = state.draft.mode === 'money' ? ITEM.price : 0;
                state.focusKey = state.draft.mode; renderSide(); break;
            case 'draft-money': openModal('draft'); break;
            case 'send-draft': sendDraft(); break;
            case 'lock': openLockModal(); break;
            case 'confirm-details': confirmDetails(); break;
            case 'quick': sendMessage(btn.getAttribute('data-text')); break;
            case 'create-order': location.href = ORDER_PAGE + '?deal=' + DEAL_CODE; break;
        }
    });

    document.addEventListener('change', function (e) {
        if (e.target.id === 'requestStatusFilter') {
            state.requestStatusFilter = e.target.value;
            renderSide();
            return;
        }
        if (e.target.id === 'requestSort') {
            state.requestSort = e.target.value;
            renderSide();
            return;
        }
        if (e.target.id === 'participantFilter') {
            state.participantFilter = e.target.value;
            renderHero();
            return;
        }
        var pick = e.target.closest('[data-act="pick"]');
        if (pick) {
            var cid = pick.getAttribute('data-comic');
            var i = state.draft.comics.indexOf(cid);
            if (i > -1) state.draft.comics.splice(i, 1); else state.draft.comics.push(cid);
            state.focusKey = cid; renderSide(); return;
        }
        if (e.target.id === 'lockConfirm') $('#lockSubmit').disabled = !e.target.checked;
    });

    document.addEventListener('input', function (e) {
        if (e.target.id === 'requestSearch') {
            state.requestSearch = e.target.value;
            renderSide();
            var search = $('#requestSearch');
            if (search) { search.focus(); search.setSelectionRange(state.requestSearch.length, state.requestSearch.length); }
        }
    });

    $('#amountInput').addEventListener('input', function () {
        var v = parseAmount(this.value);
        this.value = v ? v.toLocaleString('vi-VN') : '';
        updateModalUI();
    });
    $('#offerSubmit').addEventListener('click', submitModal);
    $('#lockSubmit').addEventListener('click', lockRoom);
    $('#composer').addEventListener('submit', function (e) {
        e.preventDefault();
        var inp = $('#messageInput');
        sendMessage(inp.value);
        inp.value = '';
    });
    $('#composerOffer').addEventListener('click', function () { openModal('send'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });

    /* ---------- KHỞI TẠO ---------- */
    syncDraft();
    renderAll();
})();
