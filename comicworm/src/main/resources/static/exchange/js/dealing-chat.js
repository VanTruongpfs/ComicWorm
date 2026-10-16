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
    var DEAL_CODE = '';                   // mã đơn sinh ra sau khi chốt deal
    var MAX_MONEY = 100000000;

    var USERS = {
        owner: { key: 'owner', name: 'Chủ phòng', short: 'Chủ phòng', initials: 'CP', roleLabel: 'Chủ phòng' },
        proposer: { key: 'proposer', name: 'Bạn', short: 'Bạn', initials: 'B', roleLabel: 'Người đề xuất' }
    };
    var ROOM_PARTICIPANTS = [];
    var DEAL_REQUESTS = [];
    var ITEM = { title: '', cover: '', price: 0, tags: [], specs: [], note: '', wants: [] };
    var INVENTORY = [];

    var STATUS_LABEL = { pending: 'Đang chờ', accepted: 'Đã đồng ý', declined: 'Đã từ chối', withdrawn: 'Đã rút', superseded: 'Đã thay thế' };
    var QUICK = {
        proposer: ['Cho mình xin thêm ảnh thực tế nhé', 'Bạn giữ bộ này đến khi nào?', 'Mình có thể nhận trực tiếp không?'],
        owner: ['Mình đang xem request của bạn', 'Bạn có thể gửi thêm ảnh truyện không?', 'Mình sẽ phản hồi request sớm nhé']
    };

    /* ---------- TRẠNG THÁI ---------- */
    var params = new URLSearchParams(location.search);
    var backendRoomParam = params.get('room') || params.get('id') || params.get('code');
    var state = {
        role: 'proposer',
        room: { code: '', status: 'loading', dealType: 'mixed' },
        participantFilter: 'all',
        chatFilter: 'all',
        requestFilter: 'all',
        requestStatusFilter: 'all',
        requestSort: 'newest',
        requestSearch: '',
        confirmations: { owner: false, buyer: false },
        selectedRequestId: null,
        dealBuyer: 'proposer',
        requestFormOpen: false,
        editingOfferId: null,
        offers: [],
        messages: [],
        draft: { mode: 'both', comics: [], money: 0 },
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
        return c.cover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="72" height="96"%3E%3Crect width="72" height="96" fill="%23e2e8f0"/%3E%3C/svg%3E';
    };
    var who = function (r) { return r === state.role || (state.role === 'proposer' && r === state.dealBuyer) ? 'Bạn' : (USERS[r] ? USERS[r].short : 'Thành viên'); };
    var latestOffer = function () { return state.offers[state.offers.length - 1]; };
    var offerById = function (id) { return state.offers.filter(function (o) { return o.id === Number(id); })[0]; };
    var offerForRequest = function (requestId) { return state.offers.filter(function (offer) { return offer.requestId === requestId; })[0]; };
    var selectedDealOffer = function () {
        if (state.selectedOfferId) {
            var bySelectedId = offerById(state.selectedOfferId);
            if (bySelectedId) return bySelectedId;
        }
        var accepted = state.offers.find(function (o) { return o.status === 'accepted'; });
        if (accepted) return accepted;
        return offerForRequest(state.selectedRequestId) || latestOffer();
    };
    var requestById = function (id) { return DEAL_REQUESTS.filter(function (request) { return request.id === id; })[0]; };
    var activeBuyer = function () { return USERS[state.dealBuyer] || USERS.proposer; };
    var buyerName = function (key) { return state.role === 'proposer' && key === state.dealBuyer ? 'Bạn' : (USERS[key] ? USERS[key].short : 'Người mua'); };
    var buyerDeals = function () { return state.offers.filter(function (offer) { return (offer.buyerKey || offer.by) === state.dealBuyer; }); };
    var optionType = function (offer) { return offer.optionType || (offer.comics.length ? (offer.money ? 'both' : 'comic') : 'money'); };
    var optionTypeLabel = function (type) { return type === 'money' ? 'Tiền' : type === 'comic' ? 'Trao đổi' : 'Cả hai'; };
    var roomClosed = function () { return state.room.status !== 'negotiating'; };
    var isDealParty = function (offer) {
        return !backendRoomParam || Boolean(offer && state.currentUserId &&
            (state.currentUserId === state.hostId || state.currentUserId === offer.buyerId));
    };
    var canCreateOrder = function () {
        var offer = selectedDealOffer();
        return offer && offer.status === 'accepted' && state.room.status === 'locked' &&
            state.confirmations.owner && state.confirmations.buyer && isDealParty(offer);
    };

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
            return '<li class="dc-mini"><img src="' + esc(cover(c, 72, 96)) + '" alt=""><span><strong>' + esc(c.title) + '</strong><small>' + esc(c.vol) + ' · ' + esc(c.cond) + '</small></span><em>' + fmt(c.value) + '</em></li>';
        }).join('') + '</ul>';
    }

    /* ---------- RENDER: 2 BÊN ---------- */
    function statusInfo() {
        switch (state.room.status) {
            case 'loading': return { cls: 'confirming', icon: 'fa-clock', text: 'Đang tải phòng' };
            case 'unavailable': return { cls: 'confirming', icon: 'fa-circle-exclamation', text: 'Không tải được phòng' };
            case 'cancelled': return { cls: 'locked', icon: 'fa-lock', text: 'Phòng đã đóng' };
            case 'agreed': return { cls: 'agreed', icon: 'fa-handshake', text: 'Hai bên đã đồng ý · chờ chốt' };
            case 'confirming': return { cls: 'confirming', icon: 'fa-clipboard-check', text: 'Đã chốt giá · chờ xác nhận giao dịch' };
            case 'locked': return { cls: 'locked', icon: 'fa-truck-fast', text: 'Đã xác nhận · sẵn sàng tạo đơn' };
            default: return { cls: 'negotiating', icon: 'fa-comments', text: 'Đang thương lượng' };
        }
    }

    function renderHero() {
        var s = statusInfo();
        var offer = selectedDealOffer();
        var confirmationLink = '';
        if (offer && isDealParty(offer) && (state.room.status === 'confirming' || canCreateOrder())) {
            confirmationLink = '<a href="#sidePanel" class="dc-btn dc-btn--primary dc-btn--sm">' +
                (canCreateOrder() ? 'Tiến hành tạo đơn' : 'Xem và xác nhận giao dịch') + ' <i class="fa-solid fa-arrow-down"></i></a>';
        }
        var shown = ROOM_PARTICIPANTS.filter(function (p) {
            return state.participantFilter === 'all' || p.dealType === state.participantFilter || (state.participantFilter === 'closed' && state.room.status === 'locked');
        });
        $('#hero').innerHTML =
            '<section class="dc-room-summary">' +
            '<div class="dc-room-summary-main"><span class="dc-room-kicker"><i class="fa-solid fa-comments"></i> PHÒNG DEAL CỘNG ĐỒNG</span>' +
            '<h2>Phòng ' + state.room.code + '</h2><p>Chủ phòng: <strong>' + esc(USERS.owner.name) + '</strong> · ' + esc(ITEM.title) + '</p></div>' +
            '<div class="dc-room-summary-meta"><span class="dc-deal-capability">Có thể:</span><span class="dc-deal-type dc-deal-type--trade"><i class="fa-solid fa-arrows-rotate"></i> Trao đổi</span><span class="dc-deal-type dc-deal-type--buy"><i class="fa-solid fa-bag-shopping"></i> Mua đứt</span><span class="dc-status dc-status--' + s.cls + '"><i class="fa-solid ' + s.icon + '"></i> ' + s.text + '</span></div>' +
            '<div class="dc-room-price"><small>Giá niêm yết</small><strong>' + fmt(ITEM.price) + '</strong></div>' + confirmationLink + '</section>' +
            '<section class="dc-participants" aria-label="Thành viên và đề xuất trong phòng">' +
            '<div class="dc-participants-head"><div><h3>Thành viên & đề xuất</h3><p>' + ROOM_PARTICIPANTS.length + ' thành viên · người mua có thể theo dõi và gửi đề xuất</p></div>' +
            '<div class="dc-participant-filters"><label class="sr-only" for="participantFilter">Lọc thành viên theo loại deal</label><select id="participantFilter"><option value="all" ' + (state.participantFilter === 'all' ? 'selected' : '') + '>Tất cả đề xuất</option><option value="trade" ' + (state.participantFilter === 'trade' ? 'selected' : '') + '>Trao đổi</option><option value="buy" ' + (state.participantFilter === 'buy' ? 'selected' : '') + '>Mua đứt</option><option value="closed" ' + (state.participantFilter === 'closed' ? 'selected' : '') + '>Đã chốt</option></select></div></div>' +
            '<div class="dc-participant-list">' + shown.map(function (p) {
                var u = USERS[p.key];
                var status = (state.room.status === 'locked' || state.room.status === 'confirming') && p.key === state.dealBuyer ? (state.room.status === 'locked' ? 'Đã chốt' : 'Đang xác nhận') : p.status;
                var typeClass = p.dealType === 'buy' ? 'buy' : p.dealType === 'trade' ? 'trade' : 'host';
                return '<button type="button" class="dc-participant dc-participant--' + typeClass + ' ' + (state.chatFilter === p.key ? 'is-selected' : '') + '" data-chat-participant="' + p.key + '">' +
                    '<span class="dc-participant-avatar dc-participant-avatar--' + p.key + '">' + esc(u.initials) + '<i></i></span><span class="dc-participant-copy"><strong>' + esc(u.name) + (p.key === state.role ? ' <em>Bạn</em>' : '') + '</strong><small>' + p.dealLabel + ' · ' + esc(p.offer) + '</small></span><span class="dc-participant-state ' + (status === 'Đã chốt' ? 'is-closed' : '') + '">' + status + '</span></button>';
            }).join('') + '</div></section>';
        $$('#participantFilter option').forEach(function (option) { option.selected = option.value === state.participantFilter; });
    }

    /* ---------- RENDER: SẢN PHẨM ---------- */
    function renderItem() {
        $('#itemCard').innerHTML =
            '<div class="dc-item-cover"><img src="' + esc(ITEM.cover) + '" alt="' + esc(ITEM.title) + '"><span class="dc-item-flag"><i class="fa-solid fa-book-open"></i> Sản phẩm trong phòng</span></div>' +
            '<div class="dc-item-body">' +
            '<div class="dc-item-tags">' + ITEM.tags.map(function (t) { return '<span class="dc-tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
            '<h2 class="dc-item-title">' + esc(ITEM.title) + '</h2>' +
            '<dl class="dc-specs">' + ITEM.specs.map(function (s) { return '<div class="dc-spec"><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' +
            '<p class="dc-item-note"><i class="fa-regular fa-note-sticky"></i> ' + esc(ITEM.note) + '</p>' +
            '<div class="dc-wants"><span>Chủ sở hữu đang tìm:</span>' + ITEM.wants.map(function (w) { return '<b>' + esc(w) + '</b>'; }).join('') + '</div>' +
            '</div>' +
            '<div class="dc-item-price">' +
            '<span class="dc-price-label">Giá niêm yết</span>' +
            '<div class="dc-price-value">' + fmt(ITEM.price) + '</div>' +
            '<span class="dc-price-sub">Có thể đổi bằng truyện, tiền hoặc cả hai</span>' +
            '<ul class="dc-price-ways"><li><i class="fa-solid fa-book"></i> Truyện</li><li><i class="fa-solid fa-coins"></i> Tiền</li><li><i class="fa-solid fa-layer-group"></i> Cả hai</li></ul>' +
            '</div>';
    }

    /* ---------- RENDER: CHAT ---------- */
    function isMyMessage(m) {
        if (!m) return false;
        if (m.isMine === true) return true;
        if (backendRoomParam) return Boolean(state.currentUserId && m.senderId === state.currentUserId);
        if (state.currentUserId && m.senderId) {
            return String(m.senderId) === String(state.currentUserId);
        }
        if (m.clientKey && state.myClientKeys && state.myClientKeys.has(m.clientKey)) {
            return true;
        }
        if (state.isCurrentUserHost || state.role === 'owner') {
            return !!m.isHost;
        }
        if (state.role === 'proposer') {
            return !m.isHost && (m.by === 'proposer' || m.by === state.dealBuyer);
        }
        return false;
    }

    function offerCardHTML(o, forSide) {
        var mine = o.by === state.role;
        var value = offerValue(o);
        var buyer = USERS[o.buyerKey || o.by] || USERS.proposer;
        var head = '<div class="dc-offer-head"><span class="dc-offer-tag"><i class="fa-solid fa-tag"></i> Đề xuất #' + o.id + ' · ' + (mine ? 'Của bạn' : esc(buyer.short)) + '</span>' +
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

            var mine = isMyMessage(m);
            var displayName = mine ? 'Bạn' : (m.senderName || (USERS[m.by] ? USERS[m.by].name : (m.isHost ? 'Chủ phòng' : 'Thành viên')));
            if (!mine && m.isHost && displayName.indexOf('Chủ phòng') === -1) {
                displayName += ' (Chủ phòng)';
            }

            var initials = displayName.substring(0, 2).toUpperCase();
            var avatarClass = mine ? 'dc-msg-avatar--me' : (m.isHost ? 'dc-msg-avatar--owner' : 'dc-msg-avatar--proposer');
            var avatarHtml = m.senderAvatar
                ? '<img src="' + esc(m.senderAvatar) + '" alt="' + esc(displayName) + '" class="dc-msg-avatar-img">'
                : initials;

            var inner = m.type === 'offer'
                ? offerCardHTML(offerById(m.offerId), false)
                : '<div class="dc-bubble">' + esc(m.text) + '</div>';
            var time = m.type === 'offer' ? (offerById(m.offerId) ? offerById(m.offerId).time : m.time) : (m.time || '');

            return '<div class="dc-msg ' + (mine ? 'dc-msg--me' : 'dc-msg--them') + '">' +
                '<div class="dc-msg-avatar ' + avatarClass + '">' + avatarHtml + '</div>' +
                '<div class="dc-msg-body">' +
                    '<div class="dc-msg-name">' + esc(displayName) + '</div>' +
                    inner +
                    '<span class="dc-msg-time">' + esc(time) + '</span>' +
                '</div>' +
            '</div>';
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
            var sorted = INVENTORY.filter(function (comic) { return comic.owned; }).slice().sort(function (a, b) { return Number(isWanted(b)) - Number(isWanted(a)); });
            inv = '<div class="dc-block-title">Kệ truyện của bạn <small>' + selIds.length + ' đã chọn</small></div><div class="dc-inv-list">' + sorted.map(function (c) {
                var on = d.comics.indexOf(c.id) > -1;
                return '<label class="dc-inv ' + (on ? 'is-selected' : '') + '">' +
                    '<input type="checkbox" data-act="pick" data-comic="' + c.id + '"' + (on ? ' checked' : '') + '>' +
                    '<img class="dc-inv-cover" src="' + esc(cover(c, 72, 96)) + '" alt="">' +
                    '<span class="dc-inv-info"><strong>' + esc(c.title) + '</strong><small>' + esc(c.vol) + ' · ' + esc(c.cond) + '</small>' +
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
                '<span class="dc-request-avatar dc-request-avatar--' + request.buyer + '">' + esc(buyer.initials) + '</span><span class="dc-request-copy"><strong>' + esc(buyer.name) + '</strong><small><span class="dc-request-kind dc-request-kind--' + request.type + '">' + optionTypeLabel(request.optionType || (request.type === 'buy' ? 'money' : request.comics.length && request.money ? 'both' : 'comic')) + '</span>' + esc(request.note) + '</small></span>' +
                '<span class="dc-request-value"><strong>' + fmt(value) + '</strong><small>' + request.time + '</small><em class="dc-request-status dc-request-status--' + request.status + '">' + (request.status === 'accepted' ? 'Đã chọn' : request.status === 'declined' ? 'Đã từ chối' : 'Chờ xem') + '</em></span></button>';
        }).join('');
        var summary = '';
        if (selected) {
            var selectedBuyer = USERS[selected.buyer];
            var proposedValue = comicsValue(selected.comics) + selected.money;
            summary = '<div class="dc-request-selected"><div class="dc-request-selected-head"><div><span class="dc-request-kind dc-request-kind--' + selected.type + '">' + optionTypeLabel(selected.optionType || (selected.type === 'buy' ? 'money' : selected.comics.length && selected.money ? 'both' : 'comic')) + '</span><span class="dc-request-id">' + selected.id + '</span></div><span class="dc-badge dc-badge--pending">Chờ chủ phòng</span></div>' +
                '<h4>' + esc(selectedBuyer.name) + ' gửi yêu cầu</h4><p>' + esc(selected.note) + '</p>' +
                '<div class="dc-request-total"><span>Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong></div>' +
                '<div class="dc-request-total"><span>Giá trị buyer đề xuất</span><strong>' + fmt(proposedValue) + '</strong></div>' +
                '<p class="dc-request-note">Chọn đề xuất này, sau đó mỗi bên tự xác nhận giao dịch để tiến hành tạo đơn.</p>' +
                (selected.status === 'pending' ? '<button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="lock"' + (state.actionPending ? ' disabled' : '') + '><i class="fa-solid fa-circle-check"></i> Chọn đề xuất này</button>' : '') + '</div>';
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
                (canEdit ? '<button type="button" class="dc-btn dc-btn--outline dc-btn--sm" data-act="edit-deal" data-offer-id="' + offer.id + '"><i class="fa-solid fa-pen"></i> Chỉnh sửa</button><button type="button" class="dc-btn dc-btn--outline dc-btn--sm" data-act="withdraw" data-offer-id="' + offer.id + '">Rút đề xuất</button>' : '') + '</div></article>';
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

        var comics = type === 'money' ? '' : '<div class="dc-block-title">Truyện bạn muốn đưa</div><div class="dc-edit-comics">' + INVENTORY.filter(function (comic) { return comic.owned; }).map(function (comic) {
            var checked = offer.comics.indexOf(comic.id) >= 0;
            return '<label class="dc-edit-comic ' + (checked ? 'is-selected' : '') + '"><input type="checkbox" data-edit-comic="' + comic.id + '"' + (checked ? ' checked' : '') + '><span><strong>' + esc(comic.title) + '</strong><small>' + esc(comic.vol) + ' · ' + esc(comic.cond) + '</small></span><em>' + fmt(comic.value) + '</em></label>';
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
        var money = type === 'comic' ? 0 : parseAmount($('#dealEditMoney').value) * (offer.money < 0 ? -1 : 1);
        if (type !== 'money' && comics.length === 0) { toast('Chọn ít nhất một truyện cho deal.'); return; }
        if (type !== 'comic' && money === 0) { toast(type === 'money' ? 'Nhập giá mua đứt bạn đề xuất.' : 'Nhập số tiền bù thêm.'); return; }

        return persistOffer({ comics: comics, money: money, note: offer.note }, offer.id);

    }

    function lockedCard() {
        var acc = selectedDealOffer();
        var buyer = (acc && acc.buyerKey && USERS[acc.buyerKey]) ? USERS[acc.buyerKey] : activeBuyer();
        var bothConfirmed = state.confirmations.owner && state.confirmations.buyer;
        var ownConfirmation = state.role === 'owner' ? state.confirmations.owner : state.confirmations.buyer;
        var otherPartyName = state.role === 'owner' ? buyer.short : USERS.owner.short;
        var orderUrl = ORDER_PAGE + '?room=' + encodeURIComponent(state.backendRoomId || state.room.code) + '&deal=' + encodeURIComponent(acc ? acc.id : DEAL_CODE);

        var cta;
        if (!isDealParty(acc)) {
            cta = '<div class="dc-notice"><i class="fa-solid fa-circle-info"></i><span>Chủ phòng đã chọn đề xuất của ' + esc(buyer.short) + '. Chỉ hai bên trong giao dịch này có thể xác nhận và tạo đơn.</span></div>';
        } else if (bothConfirmed) {
            if (state.role === 'proposer') {
                cta = '<div class="dc-notice dc-notice--ok"><i class="fa-solid fa-circle-check"></i><span>Cả hai bên đã xác nhận thông tin. Deal có thể chuyển thành đơn vận chuyển.</span></div><button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="create-order">Tạo đơn vận chuyển <i class="fa-solid fa-arrow-right"></i></button>';
            } else {
                cta = '<div class="dc-notice dc-notice--ok"><i class="fa-solid fa-circle-check"></i><span>Hai bên đã xác nhận. Người mua đang tiến hành tạo đơn hàng vận chuyển.</span></div><a href="' + esc(orderUrl) + '" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="create-order"><i class="fa-solid fa-truck-fast"></i> Xem / Tạo đơn vận chuyển</a>';
            }
        } else {
            cta = '<div class="dc-confirmation-status"><span class="' + (state.confirmations.owner ? 'is-confirmed' : '') + '"><i class="fa-solid ' + (state.confirmations.owner ? 'fa-circle-check' : 'fa-clock') + '"></i> Seller: ' + (state.confirmations.owner ? 'Đã xác nhận' : 'Chờ xác nhận') + '</span><span class="' + (state.confirmations.buyer ? 'is-confirmed' : '') + '"><i class="fa-solid ' + (state.confirmations.buyer ? 'fa-circle-check' : 'fa-clock') + '"></i> ' + esc(buyer.short) + ': ' + (state.confirmations.buyer ? 'Đã xác nhận' : 'Chờ xác nhận') + '</span></div>' +
                (ownConfirmation ? '<div class="dc-notice"><i class="fa-regular fa-clock"></i><span>Bạn đã xác nhận. Đang chờ ' + esc(otherPartyName) + ' xác nhận thông tin.</span></div>' : '<button type="button" class="dc-btn dc-btn--primary dc-btn--block dc-btn--lg" data-act="confirm-details"' + (state.actionPending ? ' disabled' : '') + '><i class="fa-solid fa-clipboard-check"></i> ' + (state.actionPending ? 'Đang xác nhận...' : 'Xác nhận giao dịch của tôi') + '</button>');
        }
        return '<div class="dc-side-card dc-side-card--done"><div class="dc-done-icon"><i class="fa-solid fa-lock"></i></div>' +
            '<h3 class="dc-done-title">' + (bothConfirmed ? 'Deal đã sẵn sàng tạo đơn' : 'Deal đã được chốt') + '</h3><p class="dc-hint">Đề xuất #' + (acc ? acc.id : '') + ' · Phòng chat đã khóa.</p>' +
            '<div class="dc-offer-block"><span class="dc-offer-label">' + esc(buyer.short) + ' đưa</span>' + miniComics(acc ? acc.comics : []) + '</div>' +
            '<div class="dc-offer-money ' + (acc && acc.money === 0 ? 'is-zero' : '') + '"><i class="fa-solid fa-coins"></i><span>' + (acc ? moneyText(acc.money, acc.buyerKey || state.dealBuyer, acc.type) : '') + '</span></div>' +
            '<div class="dc-offer-block"><span class="dc-offer-label">' + esc(USERS.owner.short) + ' đưa</span><ul class="dc-minis"><li class="dc-mini"><img src="' + esc(ITEM.cover || cover({})) + '" alt=""><span><strong>' + esc(ITEM.title) + '</strong><small>' + esc(ITEM.tags.join(' · ')) + '</small></span><em>' + fmt(ITEM.price) + '</em></li></ul></div>' +
            '<div class="dc-shipping-confirm"><strong><i class="fa-solid fa-handshake"></i> Xác nhận thỏa thuận trao đổi</strong><p>Kiểm tra truyện và khoản tiền hai bên đã thống nhất ở trên. Mỗi bên cần tự xác nhận. Địa chỉ giao nhận và phí vận chuyển được kiểm tra ở bước tạo đơn.</p></div>' +
            cta + '<p class="dc-hint dc-hint--center">Đơn vận chuyển chỉ được tạo sau khi cả Buyer và Seller xác nhận.</p></div>';
    }

    function historyCard() {
        var items = state.offers.slice().reverse().map(function (o) {
            var parts = [];
            if (o.comics.length) parts.push(o.comics.length + ' bộ truyện');
            if (o.money) parts.push(moneyText(o.money, o.buyerKey || o.by, o.type));
            var actor = o.buyerKey ? buyerName(o.buyerKey) : who(o.by);
            return '<li class="dc-hist"><span class="dc-hist-dot dc-hist-dot--' + o.by + '"></span><div><strong>#' + o.id + ' · ' + esc(actor) + (o.edited ? ' <em>(đã sửa)</em>' : '') + '</strong><small>' + (parts.join(' + ') || 'Không có nội dung') + ' · ' + o.time + '</small></div>' +
                '<span class="dc-badge dc-badge--' + o.status + '">' + STATUS_LABEL[o.status] + '</span></li>';
        }).join('');
        return '<div class="dc-side-card"><div class="dc-side-head"><h3>Lịch sử đề xuất</h3><span class="dc-side-sub">' + state.offers.length + ' đề xuất</span></div><ul class="dc-hist-list">' + items + '</ul></div>';
    }

    function renderSide() {
        var html = '';
        if (state.room.status === 'loading' || state.room.status === 'unavailable' || state.room.status === 'cancelled') {
            $('#sidePanel').innerHTML = '<div class="dc-side-card"><p role="status">' +
                (state.room.status === 'loading' ? 'Đang tải phòng trao đổi...' : state.room.status === 'cancelled' ? 'Phòng trao đổi đã đóng.' : 'Không tải được phòng trao đổi. Vui lòng tải lại trang để thử lại.') + '</p></div>';
            return;
        }
        if (state.room.status === 'locked' || state.room.status === 'confirming') html += lockedCard();
        else {
            if (state.role === 'proposer') html += buyerDealsCard();
            else html += ownerRequestPanel();
        }
        if (state.role === 'owner' && (state.room.status === 'negotiating' || state.room.status === 'confirming')) html += '<button type="button" class="dc-btn dc-btn--outline" data-act="close-room">Đóng phòng</button>';
        html += historyCard();
        $('#sidePanel').innerHTML = html;
        if (state.focusKey) {
            var el = $('[data-comic="' + state.focusKey + '"]') || $('[data-mode="' + state.focusKey + '"]');
            if (el) el.focus();
            state.focusKey = null;
        }
    }

    function renderRole() {
        var roleText = $('#currentRoleText');
        if (roleText) {
            if (state.role === 'owner') {
                roleText.innerHTML = '<i class="fa-solid fa-crown" style="color: #f59e0b;"></i> Chủ sở hữu (Chủ phòng)';
            } else {
                roleText.innerHTML = '<i class="fa-solid fa-hand-holding-heart" style="color: #3b82f6;"></i> Người đề xuất';
            }
        }
    }

    function renderAll() {
        renderRole();
        if (state.room.status === 'loading' || state.room.status === 'unavailable') {
            $('#hero').innerHTML = '';
            $('#itemCard').innerHTML = '';
        } else {
            renderHero(); renderItem();
        }
        renderChat(); renderSide();
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
        if (!state.backendRoomId) return;
        var mine = myPending();
        return persistOffer(p, mine ? mine.id : null);
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
        if (needMoney && d.money === 0) { toast('Nhập số tiền bù cho deal này.'); return; }
        commitOffer({ comics: d.comics.slice(), money: needMoney ? d.money : 0 });
    }

    function acceptOffer(id) {
        var offer = offerById(id);
        if (state.role !== 'owner' || !offer || offer.status !== 'pending' || roomClosed()) return;
        return backendOfferAction(offer, '/respond?accept=true', 'Đã chọn đề xuất. Hai bên hãy xác nhận giao dịch.');
    }

    function declineOffer(id) {
        var offer = offerById(id);
        if (state.role !== 'owner' || !offer || offer.status !== 'pending' || roomClosed()) return;
        return backendOfferAction(offer, '/respond?accept=false', 'Đã từ chối đề xuất.');
    }

    async function sendMessage(text) {
        text = (text || '').trim();
        if (!text || !state.backendRoomId || !state.currentUserId || roomClosed()) return;
        try {
            var message = await ExchangeAPI.post('/api/exchange/rooms/' + state.backendRoomId + '/messages', { content: text, clientMessageKey: crypto.randomUUID() });
            appendIncomingMessage(message);
        } catch (err) { $('#messageInput').value = text; toast(err.message); }
    }

    /* ---------- CHỐT & KHÓA PHÒNG ---------- */
    function openLockModal() {
        var l = selectedDealOffer();
        var buyer = activeBuyer();
        var selected = requestById(state.selectedRequestId);
        $('#lockSummary').innerHTML =
            '<div class="dc-request-total"><span>Giá chủ phòng muốn bán</span><strong>' + fmt(ITEM.price) + '</strong></div>' +
            '<div class="dc-offer-block"><span class="dc-offer-label">' + esc(buyer.short) + ' · ' + (selected ? optionTypeLabel(selected.optionType || (selected.type === 'buy' ? 'money' : selected.comics.length && selected.money ? 'both' : 'comic')) : 'Deal') + '</span>' + miniComics(l.comics) + '</div>' +
            '<div class="dc-offer-money ' + (l.money === 0 ? 'is-zero' : '') + '"><i class="fa-solid fa-coins"></i><span>' + moneyText(l.money, l.buyerKey || state.dealBuyer, l.type) + '</span></div>' +
            meterHTML(offerValue(l));
        $('#lockModalTitle').innerHTML = '<i class="fa-solid fa-circle-check"></i> Xác nhận request deal';
        $('#lockConfirm').checked = false;
        $('#lockSubmit').disabled = true;
        showModal('#lockModal');
    }

    function lockRoom() {
        var offer = selectedDealOffer();
        if (state.role !== 'owner' || !offer || offer.status !== 'pending') return;
        return backendOfferAction(offer, '/respond?accept=true', 'Đã chọn đề xuất. Hai bên hãy xác nhận giao dịch.');
    }

    function confirmDetails() {
        var offer = selectedDealOffer();
        if (state.room.status !== 'confirming' || !offer || offer.status !== 'accepted' || !isDealParty(offer)) return;
        var key = state.role === 'owner' ? 'owner' : 'buyer';
        if (!state.confirmations[key]) return backendOfferAction(offer, '/confirm', 'Đã ghi nhận xác nhận của bạn.');
    }

    function applyConfirmedOffer(updatedOffer, roomStatus) {
        var offer = offerById(updatedOffer.id);
        if (!offer) return;
        offer.status = updatedOffer.status.toLowerCase();
        offer.hostConfirmed = Boolean(updatedOffer.hostConfirmed);
        offer.buyerConfirmed = Boolean(updatedOffer.buyerConfirmed);
        if (offer.status !== 'accepted' || roomStatus === 'CANCELLED' || state.room.status === 'cancelled') return;
        state.selectedOfferId = offer.id;
        state.selectedRequestId = offer.requestId;
        state.dealBuyer = offer.buyerKey;
        state.confirmations.owner = offer.hostConfirmed;
        state.confirmations.buyer = offer.buyerConfirmed;
        state.room.status = offer.hostConfirmed && offer.buyerConfirmed ? 'locked' : 'confirming';
    }

    async function backendOfferAction(offer, action, successMessage) {
        if (state.actionPending) return;
        state.actionPending = true;
        renderSide();
        try {
            var res = await fetch('/api/exchange/rooms/' + state.backendRoomId + '/offers/' + offer.id + action, { method: 'POST' });
            if (!res.ok) {
                var error = await res.json().catch(function () { return {}; });
                throw new Error(error.message || error.detail || (res.status === 401 ? 'Vui lòng đăng nhập để xác nhận giao dịch.' : 'Không thể cập nhật giao dịch. Vui lòng thử lại.'));
            }
            var updated = await res.json().catch(function () { return null; });
            if (updated) applyConfirmedOffer(updated);
            closeModals();
            toast(successMessage);
            await refreshBackendRoom(state.backendRoomId);
        } catch (err) {
            toast(err.message || 'Mất kết nối. Vui lòng thử lại.');
        } finally {
            state.actionPending = false;
            renderAll();
        }
    }

    async function persistOffer(proposal, offerId) {
        if (state.actionPending || roomClosed() || !state.currentUserId) return;
        state.actionPending = true;
        try {
            var items = proposal.comics.map(function (cid) {
                var c = comicById(cid);
                if (!c || !c.owned) throw new Error('Chỉ chọn truyện trong kệ của bạn.');
                return { productId: c.productId, quantity: c.quantity || 1 };
            });
            await ExchangeAPI.request('/api/exchange/rooms/' + state.backendRoomId + '/offers' + (offerId ? '/' + offerId : ''), {
                method: offerId ? 'PUT' : 'POST',
                body: JSON.stringify({ items: items, cashCompensation: Math.abs(proposal.money || 0),
                    compensationDirection: proposal.money < 0 ? 'get' : 'pay', note: proposal.note || '' })
            });
            state.requestFormOpen = false;
            state.editingOfferId = null;
            closeModals();
            await refreshBackendRoom(state.backendRoomId);
            toast('Đã lưu đề xuất.');
        } catch (err) { toast(err.message); }
        finally { state.actionPending = false; }
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
            case 'close-room':
                if (confirm('Đóng phòng trao đổi này?')) ExchangeAPI.post('/api/exchange/rooms/' + state.backendRoomId + '/close').then(function () { refreshBackendRoom(state.backendRoomId); }).catch(function (err) { toast(err.message); });
                break;
            case 'withdraw': backendOfferAction(offerById(btn.getAttribute('data-offer-id')), '/withdraw', 'Đã rút đề xuất.'); break;
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
            case 'create-order': {
                e.preventDefault();
                if (!canCreateOrder()) { toast('Cần cả hai bên xác nhận trước khi tạo đơn.'); break; }
                var curOffer = selectedDealOffer();
                var dealId = curOffer ? curOffer.id : DEAL_CODE;
                var rCode = state.backendRoomId || params.get('room') || state.room.code;
                location.href = ORDER_PAGE + '?room=' + encodeURIComponent(rCode) + '&deal=' + encodeURIComponent(dealId);
                break;
            }
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
    if (backendRoomParam) {
        state.room.status = 'loading';
        state.offers = [];
        state.messages = [];
        state.selectedRequestId = null;
        state.draft.comics = [];
        DEAL_REQUESTS = [];
        ROOM_PARTICIPANTS = [];
        INVENTORY = [];
    }
    renderAll();

    /* ---------- TÍCH HỢP DỮ LIỆU BACKEND THẬT ---------- */
    if (backendRoomParam) {
        initBackendRoom(backendRoomParam);
    }

    function initBackendRoom(roomParam) {
        var isNum = /^\d+$/.test(String(roomParam).trim());
        var url = isNum ? ('/api/exchange/rooms/' + encodeURIComponent(roomParam))
                        : ('/api/exchange/rooms/by-code/' + encodeURIComponent(roomParam));

        fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (data) {
                state.backendRoomId = data.id;
                applyBackendRoomData(data);
                loadBackendInventory();
                loadBackendMessages(data.id);
                initExchangeWebSocket(data.id);
            })
            .catch(function (err) {
                state.room.status = 'unavailable';
                renderAll();
                toast('Không tải được phòng trao đổi. Vui lòng tải lại trang.');
            });
    }

    function applyBackendRoomData(data) {
        state.room.id = data.id;
        state.room.code = data.roomCode;
        state.currentUserId = data.currentUserId;
        state.isCurrentUserHost = Boolean(data.isCurrentUserHost || data.currentUserHost ||
            (data.currentUserId && data.currentUserId === data.hostId));
        state.hostId = data.hostId;

        if (data.status === 'OPEN') state.room.status = 'negotiating';
        else if (data.status === 'AGREED') state.room.status = 'agreed';
        else if (data.status === 'COMPLETED') state.room.status = 'locked';
        else state.room.status = 'locked';

        ITEM.title = data.targetProductTitle || 'Truyện đã ngừng hoạt động';
        ITEM.price = Number(data.targetProductPrice || 0);
        ITEM.cover = data.targetProductCover || cover({});
        ITEM.tags = [data.targetProductCategory, data.targetProductEdition, data.targetProductVolumeNumbers].filter(Boolean);
        ITEM.wants = data.targetProductWishNote ? data.targetProductWishNote.split(',').map(s => s.trim()) : [];
        ITEM.note = data.targetProductDescription || '';
        if (data.targetProductWishNote) {
            ITEM.wants = data.targetProductWishNote.split(',').map(function (s) { return s.trim(); });
        }
        ITEM.specs = [
            ['Tình trạng', (data.targetProductCondition ?? 0) + '%'],
            ['Tập truyện', data.targetProductVolumeNumbers || 'Chưa cập nhật'],
            ['Nhà xuất bản', data.targetProductPublisher || 'Chưa cập nhật'],
            ['Tác giả', data.targetProductAuthor || 'N/A']
        ];
        

        if (data.hostName) {
            USERS.owner.name = data.hostName;
            USERS.owner.short = data.hostName;
            USERS.owner.initials = data.hostName.substring(0, 2).toUpperCase();
        }

        if (state.isCurrentUserHost) {
            state.role = 'owner';
        } else {
            state.role = 'proposer';
        }

        renderRole();

        var pageTitleHeading = document.querySelector('.page-title h1');
        if (pageTitleHeading) {
            pageTitleHeading.innerText = 'Phòng trao đổi giá #' + data.roomCode;
        }
        var breadcrumbStrong = document.querySelector('.breadcrumb strong');
        if (breadcrumbStrong) {
            breadcrumbStrong.innerText = '#' + data.roomCode;
        }

        ROOM_PARTICIPANTS = (data.members || []).map(function (m) {
            var memberIsHost = Boolean(m.isHost || m.host || m.userId === data.hostId);
            var uKey = memberIsHost ? 'owner' : (m.userId === data.currentUserId ? 'proposer' : 'buyer_' + m.userId);
            USERS[uKey] = {
                key: uKey,
                name: m.fullName,
                short: m.fullName,
                initials: m.fullName ? m.fullName.substring(0, 2).toUpperCase() : 'TV',
                roleLabel: memberIsHost ? 'Chủ phòng' : 'Người đề xuất',
                
            };
            return {
                key: uKey,
                dealType: memberIsHost ? 'host' : 'trade',
                dealLabel: memberIsHost ? 'Chủ phòng' : 'Thành viên',
                offer: memberIsHost ? ('Giá niêm yết ' + fmt(ITEM.price)) : 'Đang tham gia trao đổi',
                status: 'Đang mở'
            };
        });

            state.offers = (data.offers || []).map(function (o) {
                var isMine = (o.buyerId === data.currentUserId);
                var bKey = isMine ? 'proposer' : ('buyer_' + o.buyerId);
                if (!USERS[bKey]) {
                    USERS[bKey] = {
                        key: bKey,
                        name: o.buyerName || 'Người mua',
                        short: o.buyerName || 'Người mua',
                        initials: o.buyerName ? o.buyerName.substring(0, 2).toUpperCase() : 'NM',
                        roleLabel: 'Người đề xuất',
                        
                    };
                }
                var cIds = (o.items || []).map(function (it) {
                    var cid = 'c_' + it.productId;
                    if (!comicById(cid)) {
                        INVENTORY.push({
                            id: cid,
                            productId: it.productId,
                            title: it.titleSnapshot,
                            vol: 'Số lượng: ' + it.quantity,
                            quantity: it.quantity,
                            cover: it.coverImageUrl,
                            cond: it.conditionSnapshot + '%',
                            value: Number(it.price || 0),
                            series: it.titleSnapshot,
                            bg: '1E293B'
                        });
                    }
                    return cid;
                });

                var mVal = o.compensationDirection === 'get' ? -Number(o.cashCompensation) : Number(o.cashCompensation || 0);
                var optType = cIds.length > 0 ? (mVal !== 0 ? 'both' : 'comic') : 'money';

                return {
                    id: o.id,
                    by: bKey,
                    buyerKey: bKey,
                    buyerId: o.buyerId,
                    requestId: 'RQ-' + o.id,
                    type: optType === 'money' ? 'buy' : 'trade',
                    optionType: optType,
                    comics: cIds,
                    money: mVal,
                    note: o.note || '',
                    status: o.status.toLowerCase(),
                    buyerConfirmed: Boolean(o.buyerConfirmed),
                    hostConfirmed: Boolean(o.hostConfirmed),
                    edited: false,
                    time: o.createdAt ? o.createdAt.substring(11, 16) : nowTime()
                };
            });

            DEAL_REQUESTS = state.offers.map(function (o) {
                return {
                    id: o.requestId,
                    buyer: o.buyerKey,
                    type: o.type,
                    optionType: o.optionType,
                    comics: o.comics.slice(),
                    money: o.money,
                    note: o.note || (o.type === 'buy' ? fmt(o.money) : 'Đề xuất trao đổi'),
                    status: o.status,
                    time: o.time
                };
            });

        state.selectedOfferId = data.selectedOfferId || null;
        state.confirmations = { owner: false, buyer: false };

        var activeOffer = (data.selectedOfferId ? offerById(data.selectedOfferId) : null)
                       || state.offers.find(function (o) { return o.status === 'accepted'; });
        var selectedRequest = requestById(state.selectedRequestId);
        if (!activeOffer) {
            activeOffer = selectedRequest ? offerForRequest(selectedRequest.id) : state.offers[0];
        }

        if (activeOffer) {
            state.selectedRequestId = activeOffer.requestId;
            state.dealBuyer = activeOffer.buyerKey;
            state.confirmations.owner = Boolean(activeOffer.hostConfirmed);
            state.confirmations.buyer = Boolean(activeOffer.buyerConfirmed);
        } else {
            state.selectedRequestId = null;
        }
        if (state.role === 'proposer' && data.status === 'OPEN') state.dealBuyer = 'proposer';

        if (data.status === 'CANCELLED') {
            state.room.status = 'cancelled';
        } else if (data.status === 'COMPLETED' && activeOffer && activeOffer.status === 'accepted'
                && state.confirmations.owner && state.confirmations.buyer) {
            state.room.status = 'locked';
        } else if (data.status === 'AGREED' || (activeOffer && activeOffer.status === 'accepted')) {
            state.room.status = 'confirming';
        } else if (data.status === 'OPEN') {
            state.room.status = 'negotiating';
        } else {
            state.room.status = data.status ? data.status.toLowerCase() : 'negotiating';
        }

        syncDraft();
        renderAll();
    }

    function loadBackendInventory() {
        fetch('/api/exchange/rooms/inventory')
            .then(function (res) {
                if (!res.ok) return [];
                return res.json();
            })
            .then(function (items) {
                if (Array.isArray(items) && items.length > 0) {
                    items.forEach(function (p) {
                        var cid = 'c_' + p.id;
                        var existing = comicById(cid);
                        if (existing) { existing.owned = true; existing.cover = p.coverImageUrl; }
                        if (!comicById(cid)) {
                            INVENTORY.push({
                                id: cid,
                                productId: p.id,
                                owned: true,
                                cover: p.coverImageUrl,
                                title: p.title,
                                vol: p.volumeNumbers || '',
                                cond: (p.conditionPercent ?? 0) + '%',
                                value: Number(p.price || 0),
                                series: p.title,
                                bg: 'C2410C'
                            });
                        }
                    });
                    renderSide();
                }
            })
            .catch(function () {});
    }

    function loadBackendMessages(roomId) {
        fetch('/api/exchange/rooms/' + roomId + '/messages')
            .then(function (res) {
                if (!res.ok) return [];
                return res.json();
            })
            .then(function (msgs) {
                if (Array.isArray(msgs) && msgs.length > 0) {
                    state.messages = msgs.map(function (m) {
                        var mine = isMyMessage(m);
                        return {
                            id: m.id,
                            clientKey: m.clientMessageKey,
                            senderId: m.senderId,
                            senderName: m.senderName,
                            senderAvatar: m.senderAvatar,
                            isHost: !!m.isHost,
                            isMine: mine,
                            type: 'text',
                            by: m.isHost ? 'owner' : (mine ? 'proposer' : 'buyer_' + m.senderId),
                            text: m.content,
                            time: m.createdAt ? m.createdAt.substring(11, 16) : ''
                        };
                    });
                    renderChat();
                }
            })
            .catch(function () {});
    }

    /* ---------- WEBSOCKET REAL-TIME TRONG PHÒNG TRAO ĐỔI ---------- */
    var exchangeWs = null;
    var wsReconnectTimer = null;
    var fallbackPollingTimer = null;

    function initExchangeWebSocket(roomId) {
        if (!roomId || typeof WebSocket === 'undefined') {
            startFallbackPolling(roomId);
            return;
        }

        if (exchangeWs) {
            try {
                exchangeWs.onclose = null;
                exchangeWs.close();
            } catch (e) {}
            exchangeWs = null;
        }

        var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        var wsUrl = protocol + '//' + location.host + '/ws/exchange/' + encodeURIComponent(roomId);
        console.log('[WebSocket] Đang kết nối tới phòng #' + roomId + ' qua ' + wsUrl);

        try {
            exchangeWs = new WebSocket(wsUrl);

            exchangeWs.onopen = function () {
                console.log('[WebSocket] Kết nối thời gian thực thành công (Phòng #' + roomId + ')');
                if (wsReconnectTimer) {
                    clearTimeout(wsReconnectTimer);
                    wsReconnectTimer = null;
                }
                stopFallbackPolling();
                refreshBackendRoom(roomId);
            };

            exchangeWs.onmessage = function (event) {
                try {
                    var data = JSON.parse(event.data);
                    handleWebSocketEvent(data);
                } catch (err) {
                    console.warn('[WebSocket] Không thể phân tích JSON tin nhắn:', event.data, err);
                }
            };

            exchangeWs.onerror = function (err) {
                console.warn('[WebSocket] Gặp sự cố kết nối:', err);
            };

            exchangeWs.onclose = function (evt) {
                console.log('[WebSocket] Mất kết nối (' + evt.code + '). Sẽ tự động kết nối lại sau 3 giây...');
                startFallbackPolling(roomId);
                if (!wsReconnectTimer) {
                    wsReconnectTimer = setTimeout(function () {
                        wsReconnectTimer = null;
                        if (state.backendRoomId) {
                            initExchangeWebSocket(state.backendRoomId);
                        }
                    }, 3000);
                }
            };
        } catch (e) {
            console.error('[WebSocket] Lỗi khi tạo WebSocket, dùng fallback polling:', e);
            startFallbackPolling(roomId);
        }
    }

    function handleWebSocketEvent(data) {
        if (!data) return;

        // Xử lý tin nhắn chat trực tiếp hoặc sự kiện dạng CHAT_MESSAGE
        if (data.type === 'CHAT_MESSAGE' || (!data.type && data.content)) {
            var msg = data.message || data;
            appendIncomingMessage(msg);
            return;
        }

        // Xử lý các sự kiện đề xuất và chốt thỏa thuận (OFFER_PROPOSED, OFFER_ACCEPTED, OFFER_DECLINED, DEAL_CONFIRMED)
        if (data.type === 'OFFER_PROPOSED' || data.type === 'OFFER_UPDATED' || data.type === 'OFFER_ACCEPTED' ||
            data.type === 'OFFER_DECLINED' || data.type === 'DEAL_CONFIRMED') {
            if (data.message) {
                appendIncomingMessage(data.message);
            }
            if (data.offer) {
                applyConfirmedOffer(data.offer, data.roomStatus);
                renderAll();
            }
            if (state.backendRoomId) {
                refreshBackendRoom(state.backendRoomId);
            }
            return;
        }

        // Xử lý sự kiện rút đề xuất hoặc đóng phòng (OFFER_WITHDRAWN, ROOM_CLOSED)
        if (data.type === 'OFFER_WITHDRAWN' || data.type === 'ROOM_CLOSED') {
            if (data.message) {
                appendIncomingMessage(data.message);
            }
            if (state.backendRoomId) {
                refreshBackendRoom(state.backendRoomId);
            }
            return;
        }
    }

    function appendIncomingMessage(m) {
        if (!m || !m.content) return;

        var senderName = m.senderName || 'Thành viên';
        var isHost = !!m.isHost;
        var formattedTime = m.createdAt ? m.createdAt.substring(11, 16) : nowTime();
        var mine = isMyMessage(m);

        // 1. Nếu tin nhắn từ server có clientMessageKey trùng với tin nhắn vừa gửi ở local -> gắn ID thật vào
        if (m.clientMessageKey) {
            var localMatch = state.messages.find(function (item) {
                return (item.clientKey && item.clientKey === m.clientMessageKey) ||
                       (m.id && item.id && item.id === m.id);
            });
            if (localMatch) {
                localMatch.id = m.id;
                localMatch.senderId = m.senderId;
                localMatch.senderName = senderName;
                localMatch.senderAvatar = m.senderAvatar;
                localMatch.isMine = true;
                return;
            }
        }

        // 2. Kiểm tra tránh trùng lặp tin nhắn nếu đã có ID tương ứng hoặc clientKey tương ứng
        if (m.id) {
            var idExists = state.messages.some(function (item) {
                return item.id && item.id === m.id;
            });
            if (idExists) return;
        }
        if (m.clientMessageKey) {
            var keyExists = state.messages.some(function (item) {
                return item.clientKey && item.clientKey === m.clientMessageKey;
            });
            if (keyExists) return;
            if (state.myClientKeys && state.myClientKeys.has(m.clientMessageKey)) return;
        }

        // 3. Đẩy tin nhắn mới vào giao diện chat
        state.messages.push({
            id: m.id,
            clientKey: m.clientMessageKey,
            senderId: m.senderId,
            senderName: senderName,
            senderAvatar: m.senderAvatar,
            isHost: isHost,
            isMine: mine,
            type: 'text',
            by: isHost ? 'owner' : (mine ? 'proposer' : 'buyer_' + m.senderId),
            text: m.content,
            time: formattedTime
        });

        renderChat();
    }

    function refreshBackendRoom(roomId) {
        if (!roomId) return;
        var requestVersion = (state.refreshVersion || 0) + 1;
        state.refreshVersion = requestVersion;
        return fetch('/api/exchange/rooms/' + roomId)
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                if (data && requestVersion === state.refreshVersion) {
                    applyBackendRoomData(data);
                }
            })
            .catch(function () {});
    }

    function startFallbackPolling(roomId) {
        if (fallbackPollingTimer) return;
        fallbackPollingTimer = setInterval(function () {
            if (document.hidden || !roomId) return;
            refreshBackendRoom(roomId);
            fetch('/api/exchange/rooms/' + roomId + '/messages')
                .then(function (res) { return res.ok ? res.json() : []; })
                .then(function (msgs) {
                    if (Array.isArray(msgs) && msgs.length > state.messages.length) {
                        msgs.forEach(function (m) {
                            appendIncomingMessage(m);
                        });
                    }
                })
                .catch(function () {});
        }, 10000);
    }

    function stopFallbackPolling() {
        if (fallbackPollingTimer) {
            clearInterval(fallbackPollingTimer);
            fallbackPollingTimer = null;
        }
    }
})();

