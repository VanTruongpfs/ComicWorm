/**
 * Admin: duyệt giao dịch trao đổi trước khi gửi hàng và quản lý ký quỹ tiền bù.
 * API: /api/admin/exchange (ROLE_ADMIN, CSRF khi ghi). Mọi chuỗi từ API đi qua escapeHtml (common.js).
 */
const XD_API = '/api/admin/exchange';

const XD_REVIEW = {
    PENDING: { label: 'Chờ duyệt', badge: 'warning' },
    APPROVED: { label: 'Đã duyệt', badge: 'success' },
    REJECTED: { label: 'Đã từ chối', badge: 'danger' },
};
const XD_ESCROW = {
    HELD: { label: 'Đang giữ', badge: 'info' },
    READY: { label: 'Sẵn sàng giải ngân', badge: 'primary' },
    RELEASED: { label: 'Đã giải ngân', badge: 'success' },
    REFUNDED: { label: 'Đã hoàn', badge: 'danger' },
};
const XD_ORDER = {
    WAITING_CONFIRM: 'Chờ chuẩn bị', PACKING: 'Đang chuẩn bị', SHIPPING: 'Đang giao',
    DELIVERED: 'Đã giao', COMPLETED: 'Đã nhận', CANCELLED: 'Đã hủy',
};

const xdState = { dealStatus: 'PENDING', escrowStatus: 'ALL', deals: [], escrows: [], action: null, busy: false };

async function xdRequest(path, options = {}) {
    const res = await fetch(XD_API + path, {
        ...options,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error((body && body.message) || (res.status === 401 || res.status === 403
            ? 'Phiên đăng nhập quản trị đã hết hạn. Vui lòng tải lại trang.'
            : `Yêu cầu thất bại (mã ${res.status}).`));
    }
    return body;
}

// Lấy token mới cho mỗi lần ghi: token CSRF đổi khi đăng nhập/đăng xuất.
async function xdWrite(path, body) {
    const csrf = await xdRequest('/csrf');
    return xdRequest(path, {
        method: 'POST',
        headers: { [csrf.headerName]: csrf.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });
}

function xdMoney(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')}₫`;
}

function xdDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(String(value)) : escapeHtml(date.toLocaleString('vi-VN'));
}

// Ngày + giờ:phút, gọn cho cột bảng.
function xdDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
    return escapeHtml(date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }));
}

function xdBadge(map, status) {
    const meta = map[status] || { label: status || '—', badge: 'info' };
    return `<span class="badge badge-${meta.badge}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>`;
}

function xdEmpty(text) {
    return `<div class="xd-empty"><span class="material-symbols-outlined">inbox</span><p>${escapeHtml(text)}</p></div>`;
}

/* ------------------------------------------------------------------ Giao dịch */

function xdBookList(items) {
    if (!items.length) return '<p class="xd-muted">Không gửi truyện (chỉ trả tiền)</p>';
    return `<ul class="xd-books">${items.map((i) => `<li>${escapeHtml(i.title)} <span class="xd-muted">× ${Number(i.quantity) || 1} · ${Number(i.conditionPercent) || 0}%</span></li>`).join('')}</ul>`;
}

function xdOrderRows(orders) {
    if (!orders.length) return '<p class="xd-muted">Chưa có đơn nhận truyện.</p>';
    return `<table class="xd-orders"><thead><tr><th>Đơn</th><th>Gửi → Nhận</th><th>Giao tới</th><th>Trạng thái</th><th>COD</th></tr></thead><tbody>${orders.map((o) => `
        <tr>
            <td><strong>${escapeHtml(o.orderCode)}</strong></td>
            <td>${escapeHtml(o.sellerName)} → ${escapeHtml(o.buyerName)}</td>
            <td>${escapeHtml(o.recipientName)} · ${escapeHtml(o.recipientPhone)}<br><span class="xd-muted">${escapeHtml(o.shippingAddress)}</span></td>
            <td>${escapeHtml(XD_ORDER[o.status] || o.status)}</td>
            <td>${xdMoney(o.totalAmount)}<br><span class="xd-muted">bù ${xdMoney(o.subtotalAmount)} · ship ${xdMoney(o.shippingFee)}</span></td>
        </tr>`).join('')}</tbody></table>`;
}

function xdDealCard(d) {
    const cash = Number(d.cashCompensation) > 0
        ? `<strong>${escapeHtml(d.compensationPayerName || 'Một bên')}</strong> trả bù <strong>${xdMoney(d.cashCompensation)}</strong> (sàn giữ đến khi giải ngân)`
        : 'Không bù tiền';
    const escrow = d.escrow
        ? `<div class="xd-escrow-line">Ký quỹ #${Number(d.escrow.id)}: ${xdBadge(XD_ESCROW, d.escrow.status)} ${xdMoney(d.escrow.amount)}</div>`
        : '';
    const review = d.reviewStatus === 'REJECTED' && d.reviewNote
        ? `<p class="xd-reject-note">Lý do từ chối: ${escapeHtml(d.reviewNote)}</p>`
        : '';
    const actions = d.reviewStatus === 'PENDING'
        ? `<div class="xd-actions">
               <button class="btn btn-outline btn-sm xd-danger" type="button" data-deal-action="reject" data-offer="${Number(d.offerId)}">Từ chối</button>
               <button class="btn btn-primary btn-sm" type="button" data-deal-action="approve" data-offer="${Number(d.offerId)}">Duyệt giao dịch</button>
           </div>`
        : '';
    return `<article class="xd-deal" data-offer-id="${Number(d.offerId)}">
        <header class="xd-deal-head">
            <div>
                <h3>Phòng ${escapeHtml(d.roomCode)} <span class="xd-muted">· giao dịch #${Number(d.offerId)}</span></h3>
                <p class="xd-muted">${d.reviewedAt ? `Xử lý lúc ${xdDateTime(d.reviewedAt)}` : 'Hai bên đã tạo đủ đơn nhận truyện'}</p>
            </div>
            ${xdBadge(XD_REVIEW, d.reviewStatus)}
        </header>
        <div class="xd-parties">
            <section>
                <h4>${escapeHtml(d.hostName)} <span class="xd-muted">(chủ phòng) gửi</span></h4>
                <div class="xd-target">
                    ${d.targetProductCover ? `<img src="${escapeHtml(d.targetProductCover)}" alt="" loading="lazy">` : ''}
                    <span>${escapeHtml(d.targetProductTitle)}</span>
                </div>
            </section>
            <section>
                <h4>${escapeHtml(d.partnerName)} <span class="xd-muted">(đối tác) gửi</span></h4>
                ${xdBookList(d.partnerItems || [])}
            </section>
        </div>
        <p class="xd-cash">${cash}</p>
        ${escrow}
        ${xdOrderRows(d.orders || [])}
        ${review}
        ${actions}
    </article>`;
}

async function xdLoadDeals() {
    const list = document.getElementById('dealList');
    list.innerHTML = '<p class="xd-muted">Đang tải giao dịch...</p>';
    try {
        xdState.deals = await xdRequest(`/deals?status=${encodeURIComponent(xdState.dealStatus)}`);
        list.innerHTML = xdState.deals.length
            ? xdState.deals.map(xdDealCard).join('')
            : xdEmpty(xdState.dealStatus === 'PENDING' ? 'Không có giao dịch nào đang chờ duyệt.' : 'Chưa có giao dịch nào.');
        if (xdState.dealStatus === 'PENDING') xdSetPendingCount(xdState.deals.length);
    } catch (error) {
        list.innerHTML = xdEmpty(error.message);
    }
}

async function xdLoadPendingCount() {
    if (xdState.dealStatus === 'PENDING') return;
    try {
        const pending = await xdRequest('/deals?status=PENDING');
        xdSetPendingCount(pending.length);
    } catch (_) { /* số đếm chỉ để tham khảo */ }
}

function xdSetPendingCount(count) {
    document.getElementById('kpiPendingDeals').textContent = count;
    document.getElementById('xdPendingBadge').textContent = count;
}

/* ------------------------------------------------------------------ Ký quỹ */

function xdEscrowRow(e) {
    const times = [`Giữ: ${xdDate(e.heldAt)}`];
    if (e.readyAt) times.push(`Sẵn sàng: ${xdDate(e.readyAt)}`);
    if (e.resolvedAt) times.push(`Xử lý: ${xdDate(e.resolvedAt)}`);
    let actions = '';
    if (e.status === 'READY') {
        actions += `<button class="btn btn-primary btn-sm" type="button" data-escrow-action="release" data-escrow="${Number(e.id)}">Giải ngân</button>`;
    }
    if (e.status === 'HELD' || e.status === 'READY') {
        actions += `<button class="btn btn-outline btn-sm xd-danger" type="button" data-escrow-action="refund" data-escrow="${Number(e.id)}">Hoàn tiền</button>`;
    }
    return `<tr>
        <td><strong>#${Number(e.id)}</strong></td>
        <td><span class="xd-nowrap">${escapeHtml(e.roomCode || '')}</span><br><span class="xd-muted xd-nowrap">Đơn ${escapeHtml(e.sourceOrderCode || '')}</span></td>
        <td>${escapeHtml(e.payerName)} → <strong>${escapeHtml(e.payeeName)}</strong></td>
        <td class="xd-nowrap"><strong>${xdMoney(e.amount)}</strong></td>
        <td>${xdBadge(XD_ESCROW, e.status)}</td>
        <td class="xd-times">${times.join('<br>')}</td>
        <td class="xd-note-cell">${e.resolutionNote ? escapeHtml(e.resolutionNote) : '<span class="xd-muted">—</span>'}</td>
        <td><div class="xd-row-actions">${actions || '<span class="xd-muted">—</span>'}</div></td>
    </tr>`;
}

function xdRenderTotals(totals) {
    const t = (key) => totals[key] || { count: 0, amount: 0 };
    document.getElementById('kpiHeld').textContent = xdMoney(t('HELD').amount);
    document.getElementById('kpiHeldCount').textContent = `${t('HELD').count} khoản`;
    document.getElementById('kpiReady').textContent = xdMoney(t('READY').amount);
    document.getElementById('kpiReadyCount').textContent = `${t('READY').count} khoản`;
    document.getElementById('kpiResolved').textContent = xdMoney(t('RELEASED').amount);
    document.getElementById('kpiResolvedDetail').textContent = `${xdMoney(t('REFUNDED').amount)} đã hoàn`;
}

async function xdLoadEscrows() {
    const body = document.getElementById('escrowTableBody');
    body.innerHTML = '<tr><td colspan="8" class="xd-muted">Đang tải ký quỹ...</td></tr>';
    try {
        const data = await xdRequest(`/escrows?status=${encodeURIComponent(xdState.escrowStatus)}`);
        xdState.escrows = data.items || [];
        xdRenderTotals(data.totals || {});
        body.innerHTML = xdState.escrows.length
            ? xdState.escrows.map(xdEscrowRow).join('')
            : `<tr><td colspan="8">${xdEmpty('Không có khoản ký quỹ nào.')}</td></tr>`;
    } catch (error) {
        body.innerHTML = `<tr><td colspan="8">${xdEmpty(error.message)}</td></tr>`;
    }
}

/* ------------------------------------------------------------------ Hộp xác nhận */

const XD_ACTIONS = {
    approve: {
        title: 'Duyệt giao dịch trao đổi',
        desc: (d) => `Cho phép hai bên chuẩn bị và gửi truyện ở phòng ${d.roomCode}.`,
        note: false, confirm: 'Duyệt', run: (d) => xdWrite(`/deals/${d.offerId}/approve`),
        done: 'Đã duyệt giao dịch.',
    },
    reject: {
        title: 'Từ chối giao dịch',
        desc: (d) => `Giao dịch ở phòng ${d.roomCode} sẽ bị hủy: trả tồn kho, hủy các đơn nhận truyện. Hai bên nhận thông báo kèm lý do.`,
        note: 'Lý do từ chối (bắt buộc)', confirm: 'Từ chối và hủy', danger: true,
        run: (d, note) => xdWrite(`/deals/${d.offerId}/reject`, { note }), done: 'Đã từ chối và hủy giao dịch.',
    },
    release: {
        title: 'Giải ngân tiền bù',
        desc: (e) => `Cộng ${xdMoney(e.amount)} vào ví của ${e.payeeName}. Thao tác không hoàn tác được.`,
        note: 'Ghi chú / mã đối soát COD (bắt buộc)', confirm: 'Giải ngân',
        run: (e, note) => xdWrite(`/escrows/${e.id}/release`, { note }), done: 'Đã giải ngân vào ví người nhận.',
    },
    refund: {
        title: 'Hoàn tiền bù',
        desc: (e) => `Hoàn ${xdMoney(e.amount)} vào ví của ${e.payerName} (người đã trả bù). Thao tác không hoàn tác được.`,
        note: 'Lý do hoàn tiền (bắt buộc)', confirm: 'Hoàn tiền', danger: true,
        run: (e, note) => xdWrite(`/escrows/${e.id}/refund`, { note }), done: 'Đã hoàn tiền vào ví người trả.',
    },
};

function xdOpenAction(kind, target) {
    const action = XD_ACTIONS[kind];
    xdState.action = { kind, target };
    document.getElementById('xdModalTitle').textContent = action.title;
    document.getElementById('xdModalDesc').textContent = action.desc(target);
    const noteWrap = document.getElementById('xdNoteWrap');
    const note = document.getElementById('xdNote');
    noteWrap.hidden = !action.note;
    document.getElementById('xdNoteLabel').textContent = action.note || '';
    note.value = '';
    document.getElementById('xdNoteCount').textContent = '0';
    const confirm = document.getElementById('xdModalConfirm');
    confirm.textContent = action.confirm;
    confirm.classList.toggle('xd-danger-solid', Boolean(action.danger));
    confirm.disabled = false;
    xdModalError('');
    openModal('xdActionModal');
    if (action.note) setTimeout(() => note.focus(), 50);
}

function xdModalError(message) {
    const el = document.getElementById('xdModalError');
    el.textContent = message;
    el.hidden = !message;
}

async function xdConfirmAction() {
    if (!xdState.action || xdState.busy) return;
    const { kind, target } = xdState.action;
    const action = XD_ACTIONS[kind];
    const note = document.getElementById('xdNote').value.trim();
    if (action.note && !note) {
        xdModalError('Vui lòng nhập nội dung ghi chú.');
        return;
    }
    const confirm = document.getElementById('xdModalConfirm');
    xdState.busy = true;
    confirm.disabled = true;
    try {
        await action.run(target, note);
        closeModal('xdActionModal');
        showToast(action.done, 'success');
        await xdReloadAll();
    } catch (error) {
        xdModalError(error.message);
        confirm.disabled = false;
    } finally {
        xdState.busy = false;
    }
}

/* ------------------------------------------------------------------ Khởi tạo */

async function xdReloadAll() {
    await Promise.all([xdLoadDeals(), xdLoadEscrows(), xdLoadPendingCount()]);
}

function xdBindTabs(containerId, onChange) {
    document.querySelectorAll(`#${containerId} .tab-chip`).forEach((chip) => {
        chip.addEventListener('click', () => {
            document.querySelectorAll(`#${containerId} .tab-chip`).forEach((c) => c.classList.toggle('active', c === chip));
            onChange(chip.dataset.status);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSlidingTabs(document.getElementById('xdViewTabs'), (tab) => {
        const deals = tab.dataset.view === 'deals';
        document.getElementById('dealsView').hidden = !deals;
        document.getElementById('escrowsView').hidden = deals;
    });
    xdBindTabs('dealFilterTabs', (status) => { xdState.dealStatus = status; xdLoadDeals(); });
    xdBindTabs('escrowFilterTabs', (status) => { xdState.escrowStatus = status; xdLoadEscrows(); });

    document.getElementById('dealList').addEventListener('click', (event) => {
        const button = event.target.closest('[data-deal-action]');
        if (!button) return;
        const deal = xdState.deals.find((d) => String(d.offerId) === button.dataset.offer);
        if (deal) xdOpenAction(button.dataset.dealAction, deal);
    });
    document.getElementById('escrowTableBody').addEventListener('click', (event) => {
        const button = event.target.closest('[data-escrow-action]');
        if (!button) return;
        const escrow = xdState.escrows.find((e) => String(e.id) === button.dataset.escrow);
        if (escrow) xdOpenAction(button.dataset.escrowAction, escrow);
    });

    document.getElementById('xdNote').addEventListener('input', (event) => {
        document.getElementById('xdNoteCount').textContent = event.target.value.length;
    });
    document.getElementById('xdModalCancel').addEventListener('click', () => closeModal('xdActionModal'));
    document.getElementById('xdModalConfirm').addEventListener('click', xdConfirmAction);
    document.getElementById('xdRefresh').addEventListener('click', xdReloadAll);

    xdReloadAll();
});
