'use strict';
// Ví của tôi: GET /api/wallet/me. Mọi chuỗi từ API được gán bằng textContent.
(function () {
    const TYPE_LABEL = {
        ESCROW_RELEASE: 'Nhận tiền bù giao dịch trao đổi',
        ESCROW_REFUND: 'Hoàn tiền bù giao dịch trao đổi'
    };
    const balanceEl = document.querySelector('[data-wallet-balance]');
    const historyEl = document.querySelector('[data-wallet-history]');
    const alertEl = document.querySelector('[data-wallet-alert]');

    const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
    const dateTime = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
    };

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function showAlert(text, withLogin) {
        alertEl.hidden = false;
        alertEl.replaceChildren(document.createTextNode(text));
        if (withLogin) {
            const link = el('a', null, ' Đăng nhập');
            link.href = '/auth/login?redirect=' + encodeURIComponent(location.pathname);
            alertEl.appendChild(link);
        }
    }

    function render(wallet) {
        balanceEl.textContent = money(wallet.balance);
        const items = wallet.transactions || [];
        if (!items.length) {
            historyEl.replaceChildren(el('li', 'wallet-empty', 'Chưa có giao dịch nào trong ví.'));
            return;
        }
        historyEl.replaceChildren(...items.map((tx) => {
            const li = el('li', 'wallet-entry');
            const main = el('div', 'wallet-entry-main');
            main.appendChild(el('strong', null, TYPE_LABEL[tx.type] || tx.type));
            main.appendChild(el('span', 'wallet-entry-meta', `${dateTime(tx.createdAt)} · Ký quỹ #${tx.escrowId}`));
            if (tx.note) main.appendChild(el('span', 'wallet-entry-note', tx.note));
            const side = el('div', 'wallet-entry-side');
            side.appendChild(el('strong', 'wallet-amount', `+${money(tx.amount)}`));
            side.appendChild(el('span', 'wallet-entry-meta', `Số dư: ${money(tx.balanceAfter)}`));
            li.append(main, side);
            return li;
        }));
    }

    async function load() {
        try {
            const res = await fetch('/api/wallet/me', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
            if (res.status === 401) {
                balanceEl.textContent = '—';
                historyEl.replaceChildren();
                showAlert('Vui lòng đăng nhập để xem ví.', true);
                return;
            }
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || 'Không tải được ví.');
            render(body);
        } catch (error) {
            historyEl.replaceChildren();
            showAlert(error.message || 'Không tải được ví. Vui lòng tải lại trang.', false);
        }
    }

    load();
})();
