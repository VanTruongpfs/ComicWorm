(function () {
    'use strict';
    const E = ExchangeAPI, { esc, money, image, request, post, status } = E;
    let data, addresses = [], view, roomId, content, selectedAddress, draft = {};
    const draftKey = () => 'exchange-draft-' + data.room.currentUserId + '-' + roomId;
    const roomURL = id => 'dealing-chat.html?room=' + id;
    function itemsHTML(items) {
        return items.map(i => `<div class="ex-item">${image(i.coverImageUrl || i.cover, i.titleSnapshot || i.title)}<div><strong>${esc(i.titleSnapshot || i.title)}</strong><small>${i.quantity || 1} bộ · ${i.conditionSnapshot ?? i.conditionPercent}%</small></div></div>`).join('');
    }
    function summary(ctx) {
        const r = ctx.room, o = r.offers.find(o => o.id === r.selectedOfferId);
        return `<section class="ex-panel"><h2>Thỏa thuận #${o.id}</h2><p>Phòng <a href="${roomURL(r.id)}">${esc(r.roomCode)}</a> · ${r.status === 'COMPLETED' ? 'Hai bên đã xác nhận' : esc(status(r.status))}</p><h3>${esc(r.hostName)} gửi</h3>${itemsHTML([{ title: r.targetProductTitle, cover: r.targetProductCover, conditionPercent: r.targetProductCondition, quantity: 1 }])}<h3>${esc(o.buyerName)} gửi</h3>${itemsHTML(o.items)}<p>${Number(o.cashCompensation) ? `${o.compensationPayerId === r.hostId ? esc(r.hostName) : esc(o.buyerName)} thanh toán ${money(o.cashCompensation)}` : 'Không bù tiền'}</p>${r.status !== 'CANCELLED' && !ctx.orders.length ? `<button class="danger" data-cancel-room="${r.id}">Hủy giao dịch</button>` : ''}</section>`;
    }
    function orderHTML(o, ctx) {
        const userId = ctx.room.currentUserId;
        const canCancel = ctx.room.status !== 'CANCELLED' && !ctx.orders.some(x => ['SHIPPING', 'DELIVERED', 'COMPLETED'].includes(x.status));
        let actions = '';
        if (o.sellerId === userId && o.status === 'WAITING_CONFIRM') actions += `<button data-status="ACCEPT" data-order="${o.id}">Xác nhận chuẩn bị hàng</button>`;
        if (o.sellerId === userId && o.status === 'PACKING') actions += `<button data-status="SHIP" data-order="${o.id}">Đã gửi hàng</button>`;
        if (o.buyerId === userId && ['SHIPPING', 'DELIVERED'].includes(o.status)) actions += `<button data-status="RECEIVE" data-order="${o.id}">Đã nhận truyện và trả tiền COD</button>`;
        if (canCancel && o.status !== 'CANCELLED') actions += `<button class="danger" data-status="CANCEL" data-order="${o.id}">Hủy toàn bộ giao dịch</button>`;
        return `<article class="ex-panel" data-order-id="${o.id}"><h3>${esc(o.orderCode)} · ${esc(status(o.status))}</h3><p>${esc(o.sellerName)} → ${esc(o.buyerName)}</p>${itemsHTML(o.items)}<p>Người nhận: <strong>${esc(o.recipientName)}</strong> · ${esc(o.recipientPhone)}</p><p>${esc(o.shippingAddress)}</p><p>${o.shippingMethod === 'EXPRESS' ? 'Giao nhanh' : 'Giao tiêu chuẩn'} · COD · ${o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán khi nhận hàng'}</p><div class="ex-total"><span>Tiền thỏa thuận</span><strong>${money(o.subtotalAmount)}</strong></div><div class="ex-total"><span>Phí vận chuyển</span><strong>${money(o.shippingFee)}</strong></div><div class="ex-total"><span>Tổng thanh toán</span><strong>${money(o.totalAmount)}</strong></div>${o.note ? `<p>Ghi chú: ${esc(o.note)}</p>` : ''}<div class="ex-actions">${actions}</div></article>`;
    }
    function feedback(message) {
        let node = document.getElementById('exchangeFeedback');
        if (!node) { node = document.createElement('p'); node.id = 'exchangeFeedback'; node.className = 'ex-feedback'; node.setAttribute('role', 'alert'); content.prepend(node); }
        node.textContent = message;
        node.scrollIntoView({ block: 'nearest' });
    }
    function saveDraft() {
        if (!data) return;
        draft.addressId = document.getElementById('receiveAddress')?.value || selectedAddress;
        draft.note = document.getElementById('orderNote')?.value || '';
        draft.shippingMethod = document.getElementById('shippingMethod')?.value || draft.shippingMethod;
        sessionStorage.setItem(draftKey(), JSON.stringify(draft));
    }
    function addressForm() {
        return `<details class="ex-panel" ${addresses.length ? '' : 'open'}><summary>Thêm địa chỉ nhận hàng</summary><form id="exchangeAddressForm" class="ex-form">${[['recipientName', 'Tên người nhận', 100], ['phone', 'Số điện thoại', 20], ['province', 'Tỉnh / thành phố', 100], ['district', 'Quận / huyện', 100], ['ward', 'Phường / xã', 100], ['addressDetail', 'Số nhà, đường', 500]].map(([name, label, max]) => `<label>${label}<input name="${name}" required maxlength="${max}"></label>`).join('')}<button type="submit">Lưu địa chỉ</button><a href="/user/html/manage_address.html">Quản lý địa chỉ</a></form></details>`;
    }
    function renderCheckout() {
        const r = data.room, offer = r.offers.find(o => o.id === r.selectedOfferId);
        const existing = data.orders.find(o => o.buyerId === r.currentUserId);
        const ready = r.status === 'COMPLETED' && offer.hostConfirmed && offer.buyerConfirmed;
        content.innerHTML = summary(data);
        if (existing) {
            content.innerHTML += orderHTML(existing, data) + '<a class="ex-link" href="exchange-orders.html">Quản lý đơn trao đổi</a>';
            return;
        }
        if (!ready) { content.innerHTML += `<p class="ex-feedback">${r.status === 'CANCELLED' ? 'Giao dịch đã hủy.' : 'Cần cả hai bên xác nhận giao dịch trước khi tạo đơn.'} <a href="${roomURL(r.id)}">Về phòng trao đổi</a></p>`; return; }
        if (!data.receivesBooks) { content.innerHTML += '<p class="ex-panel">Giao dịch mua bằng tiền: người mua tạo đơn nhận truyện. Bạn theo dõi và xác nhận gửi hàng tại <a href="exchange-orders.html">Đơn trao đổi của tôi</a>.</p>'; return; }
        const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
        selectedAddress = addresses.some(a => String(a.id) === String(draft.addressId)) ? draft.addressId : defaultAddr?.id;
        const select = `<label>Địa chỉ nhận truyện của bạn<select id="receiveAddress" required>${addresses.length ? addresses.map(a => `<option value="${a.id}" ${String(a.id) === String(selectedAddress) ? 'selected' : ''}>${esc(a.recipientName)} · ${esc(a.phone)} · ${esc([a.addressDetail, a.ward, a.district, a.province].join(', '))}</option>`).join('') : '<option value="">Chưa có địa chỉ, hãy thêm bên dưới</option>'}</select></label>`;
        const shipping = data.shippingOptions.find(s => s.code === draft.shippingMethod) || data.shippingOptions[0];
        const fee = shipping?.fee || 0;
        content.innerHTML += `<div class="ex-grid"><section class="ex-panel"><h2>Đơn nhận truyện của bạn</h2><p>Mỗi bên nhận truyện tạo một đơn riêng. Người gửi chỉ được gửi hàng sau khi đủ ${data.requiredOrderCount} đơn cần thiết.</p><form id="exchangeOrderForm" class="ex-form">${select}<label>Ghi chú<textarea id="orderNote" maxlength="1000">${esc(draft.note || '')}</textarea></label>${view === 'shipping' ? `<label>Vận chuyển<select id="shippingMethod">${data.shippingOptions.map(s => `<option value="${esc(s.code)}" ${s.code === shipping?.code ? 'selected' : ''}>${esc(s.name)} · ${money(s.fee)}</option>`).join('')}</select></label><p>Thanh toán: COD. Thanh toán khoản tiền thỏa thuận và phí vận chuyển khi nhận truyện.</p><button type="submit" ${addresses.length ? '' : 'disabled'}>Xác nhận tạo đơn COD</button>` : `<button type="submit" ${addresses.length ? '' : 'disabled'}>Tiếp tục vận chuyển</button>`}</form></section><aside class="ex-panel"><h2>Tổng thanh toán</h2><div class="ex-total"><span>Tiền bạn phải trả theo thỏa thuận</span><strong>${money(data.cashToPay)}</strong></div><div class="ex-total"><span>Vận chuyển</span><strong id="shippingFee">${view === 'shipping' ? money(fee) : 'Chọn ở bước tiếp theo'}</strong></div><div class="ex-total"><span>Tổng COD</span><strong id="orderTotal">${money(Number(data.cashToPay) + (view === 'shipping' ? Number(fee) : 0))}</strong></div><p>Phí vận chuyển được tính theo bảng phí của hệ thống và kiểm tra lại khi tạo đơn.</p></aside></div>${addressForm()}`;
    }
    async function load() {
        if (view === 'orders') {
            const deals = await request('/api/exchange/orders');
            content.innerHTML = '<div class="ex-panel"><label>Tìm giao dịch <input id="dealSearch" type="search" placeholder="Tên truyện, mã phòng hoặc mã đơn"></label><button data-refresh> Tải lại</button></div>' + (deals.length ? deals.map(ctx => `<section class="ex-deal">${summary(ctx)}${ctx.orders.map(o => orderHTML(o, ctx)).join('')}${ctx.room.status !== 'CANCELLED' && !ctx.orders.some(o => o.buyerId === ctx.room.currentUserId) ? `<div class="ex-panel"><a class="ex-link" href="negotiation-order.html?room=${ctx.room.id}&deal=${ctx.room.selectedOfferId}">Tạo / Xem đơn nhận truyện</a></div>` : ''}</section>`).join('') : '<p class="ex-panel">Bạn chưa có giao dịch được chọn.</p>');
            return;
        }
        data = await request('/api/exchange/rooms/' + encodeURIComponent(roomId) + '/checkout');
        const query = new URLSearchParams(location.search);
        if (query.has('deal') && Number(query.get('deal')) !== data.room.selectedOfferId) throw new Error('Đề xuất không khớp giao dịch được chọn.');
        draft = JSON.parse(sessionStorage.getItem(draftKey()) || '{}');
        addresses = data.receivesBooks ? await request('/api/user/addresses') : [];
        renderCheckout();
    }
    async function start(pageView) {
        view = pageView; content = document.getElementById('exchangeContent');
        roomId = new URLSearchParams(location.search).get('room');
        if (view !== 'orders' && !/^\d+$/.test(roomId || '')) { E.error(content, 'Thiếu mã phòng. Vui lòng mở bước tạo đơn từ phòng trao đổi.'); return; }
        content.addEventListener('input', e => {
            if (e.target.id === 'dealSearch') document.querySelectorAll('.ex-deal').forEach(el => el.hidden = !el.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
        });
        content.addEventListener('change', e => {
            if (e.target.id === 'shippingMethod') {
                const option = data.shippingOptions.find(s => s.code === e.target.value);
                document.getElementById('shippingFee').textContent = money(option.fee);
                document.getElementById('orderTotal').textContent = money(Number(data.cashToPay) + Number(option.fee));
            }
            if (view !== 'orders') saveDraft();
        });
        content.addEventListener('click', async e => {
            const button = e.target.closest('button'); if (!button) return;
            if (button.hasAttribute('data-refresh')) { await load().catch(err => feedback(err.message)); return; }
            if (button.dataset.cancelRoom) {
                if (!confirm('Hủy giao dịch trao đổi này?')) return;
                button.disabled = true;
                try { await post('/api/exchange/rooms/' + button.dataset.cancelRoom + '/cancel-deal'); await load(); }
                catch (err) { feedback(err.message); button.disabled = false; }
                return;
            }
            if (!button.dataset.status) return;
            if (button.dataset.status === 'CANCEL' && !confirm('Hủy toàn bộ giao dịch và trả lại tồn kho cho cả hai bên?')) return;
            if (button.dataset.status === 'RECEIVE' && !confirm('Bạn xác nhận đã nhận đủ truyện và thanh toán tiền COD?')) return;
            button.disabled = true;
            try { await post('/api/exchange/orders/' + button.dataset.order + '/status', { action: button.dataset.status }); await load(); }
            catch (err) { feedback(err.message); button.disabled = false; }
        });
        content.addEventListener('submit', async e => {
            e.preventDefault(); const form = e.target, button = form.querySelector('button[type="submit"]');
            if (!button || button.disabled) return;
            button.disabled = true;
            try {
                saveDraft();
                if (form.id === 'exchangeAddressForm') {
                    const payload = Object.fromEntries(new FormData(form)); payload.isDefault = addresses.length === 0;
                    const address = await post('/api/user/addresses', payload);
                    draft.addressId = address.id; sessionStorage.setItem(draftKey(), JSON.stringify(draft)); await load();
                } else if (form.id === 'exchangeOrderForm') {
                    if (!draft.addressId) throw new Error('Vui lòng thêm địa chỉ nhận hàng.');
                    if (view === 'checkout') location.href = 'shipping-fee.html?room=' + roomId + '&deal=' + data.room.selectedOfferId;
                    else {
                        await post('/api/exchange/rooms/' + roomId + '/orders', { addressId: Number(draft.addressId), shippingMethod: draft.shippingMethod || data.shippingOptions[0].code, paymentMethod: 'COD', note: draft.note });
                        sessionStorage.removeItem(draftKey()); location.href = 'exchange-orders.html';
                    }
                }
            } catch (err) { feedback(err.message); button.disabled = false; }
        });
        await load().catch(e => E.error(content, e.message));
    }
    window.ExchangeCheckoutPage = { start };
})();
