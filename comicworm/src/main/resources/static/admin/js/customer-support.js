/* ==========================================================================
   AGENT CONSOLE – customer-support.js
   Chức năng: hàng đợi, nhận/đóng vé, SLA đếm ngược, KPI, phản hồi mẫu,
   tra cứu acc, SOP, ghi chú, chat 1:1, tìm kiếm, phím tắt, toast/modal.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------ Helpers ------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) =>
    String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const fmtSla = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  const AVATARS = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
  ];

  /* ------------------------------- State ------------------------------- */
  const state = {
    online: true,
    maxCapacity: 10,
    held: 8,
    resolved: 18,
    quota: 20,
    waiting: 4,
    sla: 96.4,
    responseTime: 1.8,
    lastUpdate: Date.now(),
    filter: 'urgent',
    activeId: 'TK-9921',
    notes: [],
    queue: [
      { id: 'TK-9923', cat: 'urgent', title: 'Tố cáo mạo danh', user: '@vip_media', tier: 'User VIP',
        preview: 'Tài khoản VIP yêu cầu can thiệp khẩn...', sla: 252, wait: '2 phút',
        message: 'Có tài khoản đang dùng tên và ảnh đại diện của tôi để kêu gọi chuyển khoản. Nhờ admin khóa gấp.',
        flag: null, tags: [['neutral', 'Báo cáo: 27 lượt / 30 phút'], ['neutral', 'IP: 27.72.xx.xx (Việt Nam)']] },
      { id: 'TK-9925', cat: 'urgent', title: 'Thanh toán bị trừ 2 lần', user: '@minh_pham', tier: 'User Cấp 2',
        preview: 'Bị trừ tiền 2 lần cho gói Premium...', sla: 610, wait: '5 phút',
        message: 'Tôi mua gói Premium nhưng bị trừ tiền 2 lần lúc 09:58. Vui lòng hoàn tiền giao dịch dư.',
        flag: null, tags: [['neutral', 'Giao dịch: 2 x 199.000đ'], ['neutral', 'Cổng: VNPay']] },
      { id: 'TK-9924', cat: 'other', title: 'Lỗi nạp tiền', user: '@khanh_linh', tier: 'User Cấp 1',
        preview: 'Người dùng @khanh_linh báo lỗi nạp...', sla: 0, wait: '10 phút',
        message: 'Tôi nạp 100k qua ví nhưng số dư chưa cập nhật sau 30 phút.',
        flag: null, tags: [['neutral', 'Cổng: MoMo'], ['neutral', 'Thiết bị: Android 14']] },
      { id: 'TK-9926', cat: 'appeal', title: 'Kháng nghị gỡ bài viết', user: '@thu_ha', tier: 'User Cấp 1',
        preview: 'Bài viết bị gỡ nhầm do từ khóa nhạy cảm...', sla: 0, wait: '18 phút',
        message: 'Bài viết review sách của tôi bị gỡ với lý do vi phạm nội dung. Tôi cho rằng hệ thống nhận diện nhầm.',
        flag: null, tags: [['neutral', 'Từ khóa bị bắt: "đột kích"'], ['neutral', 'Thiết bị: Safari iOS']] },
      { id: 'TK-9927', cat: 'appeal', title: 'Kháng nghị khóa bình luận', user: '@dev_tuan', tier: 'User Cấp 1',
        preview: 'Bị khóa bình luận 7 ngày không rõ lý do...', sla: 0, wait: '25 phút',
        message: 'Tôi bị khóa bình luận 7 ngày nhưng không nhận được thông báo vi phạm cụ thể nào.',
        flag: null, tags: [['neutral', 'Vi phạm: 1 lần'], ['neutral', 'IP: 113.161.xx.xx']] },
      { id: 'TK-9928', cat: 'appeal', title: 'Kháng nghị khóa tài khoản', user: '@bao_anh_92', tier: 'User Cấp 1',
        preview: 'Tài khoản bị khóa do nghi vấn đăng nhập lạ...', sla: 0, wait: '31 phút',
        message: 'Tôi vừa đổi điện thoại nên đăng nhập từ thiết bị mới, hệ thống khóa tài khoản. Nhờ xác minh giúp.',
        flag: null, tags: [['neutral', 'Thiết bị mới: iPhone 15'], ['neutral', 'IP: 171.250.xx.xx']] }
    ],
    active: {
      id: 'TK-9921', cat: 'appeal', title: 'Kháng nghị mở khóa tài khoản sau cảnh báo bot AI',
      user: '@hoangnam_tech', tier: 'User Cấp 1', sentAt: '10:24', wait: '12 phút trước',
      message: 'Chào đội ngũ CSKH, tài khoản của tôi vừa bị hệ thống tự động khóa tính năng đăng bài với lý do <mark class="mark-highlight">Nghi vấn spam tự động bot v3</mark>. Tôi chỉ chia sẻ bộ tài liệu lập trình cho nhóm bạn lúc 10:15. Mong admin kiểm tra lại lịch sử log thiết bị và mở khóa giúp tôi.',
      flag: { label: 'CẢNH BÁO BOT', match: 94 },
      tags: [['danger', 'Tần suất: 18 bài / 60 giây'], ['neutral', 'IP: 14.162.xx.xx (Việt Nam)'], ['neutral', 'Thiết bị: Chrome Win64']],
      replied: false
    }
  };

  const TEMPLATES = [
    { title: 'Đã mở khóa – nhắc quy định', text: 'Chào bạn, sau khi kiểm tra lại log thiết bị, chúng tôi xác nhận cảnh báo là nhầm lẫn và đã mở khóa tính năng đăng bài. Bạn vui lòng tuân thủ tần suất đăng bài theo quy định để tránh bị khóa lại nhé.' },
    { title: 'Giữ nguyên hình thức xử lý', text: 'Chào bạn, sau khi xem xét, hành vi của tài khoản vẫn phù hợp với dấu hiệu vi phạm quy chuẩn cộng đồng. Chúng tôi giữ nguyên hình thức xử lý. Bạn có thể bổ sung bằng chứng trong 48 giờ.' },
    { title: 'Yêu cầu bổ sung thông tin', text: 'Chào bạn, để xử lý yêu cầu, vui lòng cung cấp ảnh chụp màn hình lỗi và thời điểm xảy ra sự cố. Yêu cầu sẽ tự động đóng nếu không có phản hồi sau 48 giờ.' },
    { title: 'Hoàn tiền giao dịch dư', text: 'Chào bạn, chúng tôi đã ghi nhận giao dịch bị trừ trùng và chuyển yêu cầu hoàn tiền. Tiền sẽ về tài khoản trong 3–5 ngày làm việc.' }
  ];

  const SOP = [
    ['Bot spam / đăng bài tự động', 'Kiểm tra tần suất & log thiết bị. Trùng mẫu ≥ 90% + tần suất > 10 bài/phút → chuyển Tier-2. Trùng < 90% và không có log bất thường → mở khóa.'],
    ['Mạo danh (VIP)', 'Ưu tiên SLA 5 phút. Khóa tạm thời tài khoản bị tố cáo, chụp bằng chứng, chuyển An ninh.'],
    ['Lỗi thanh toán', 'Đối soát mã giao dịch với cổng thanh toán. Trừ trùng → tạo yêu cầu hoàn tiền, thông báo 3–5 ngày làm việc.'],
    ['Kháng nghị nội dung', 'Đọc lại nội dung gốc, xác định từ khóa/điều khoản. Vi phạm lần đầu, nhẹ → khôi phục kèm nhắc nhở.']
  ];

  /* ------------------------- Injected UI styles ------------------------ */
  const style = document.createElement('style');
  style.textContent = `
    .toast-wrap{position:fixed;right:24px;bottom:24px;display:flex;flex-direction:column;gap:10px;z-index:1000}
    .toast{background:var(--secondary);color:#fff;padding:12px 18px;border-radius:var(--radius-md);font-size:.9rem;font-weight:600;box-shadow:0 8px 24px rgba(15,23,42,.25);animation:toastIn .25s ease;max-width:360px}
    .toast.error{background:var(--danger)} .toast.success{background:var(--success)}
    @keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:900;padding:16px;animation:toastIn .2s ease}
    .modal{background:#fff;border-radius:var(--radius-lg);width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(15,23,42,.3)}
    .modal-head{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--neutral-200)}
    .modal-head h3{font-family:var(--font-headline);font-size:1.15rem}
    .modal-x{background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--neutral-500);line-height:1}
    .modal-body{padding:20px 24px;overflow:auto;display:flex;flex-direction:column;gap:12px}
    .modal-foot{padding:16px 24px;border-top:1px solid var(--neutral-200);display:flex;justify-content:flex-end;gap:10px}
    .m-btn{height:40px;padding:0 18px;border-radius:var(--radius-sm);border:1px solid var(--neutral-300);background:#fff;font-weight:700;cursor:pointer;font-family:var(--font-body)}
    .m-btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
    .m-btn.dark{background:var(--secondary);border-color:var(--secondary);color:#fff}
    .m-item{border:1px solid var(--neutral-200);border-radius:var(--radius-md);padding:14px;background:var(--neutral-50);cursor:pointer;text-align:left;font-family:var(--font-body);transition:border-color .2s}
    .m-item:hover{border-color:var(--primary)} .m-item strong{display:block;margin-bottom:4px}
    .m-item p{font-size:.85rem;color:var(--neutral-500)}
    .m-input,.m-area,.m-select{width:100%;padding:10px 12px;border:1px solid var(--neutral-300);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:.9rem}
    .m-area{min-height:100px;resize:vertical}
    .m-table{width:100%;border-collapse:collapse;font-size:.85rem}
    .m-table td,.m-table th{padding:8px 6px;border-bottom:1px solid var(--neutral-200);text-align:left}
    .chat-box{display:flex;flex-direction:column;gap:8px;min-height:220px;max-height:320px;overflow:auto;background:var(--neutral-50);border:1px solid var(--neutral-200);border-radius:var(--radius-md);padding:12px}
    .bubble{padding:8px 12px;border-radius:12px;max-width:80%;font-size:.9rem}
    .bubble.me{align-self:flex-end;background:var(--primary);color:#fff}
    .bubble.them{align-self:flex-start;background:#fff;border:1px solid var(--neutral-200)}
    .sla-badge.critical{color:var(--danger)}
    .flash{animation:flash 1.6s ease}
    @keyframes flash{0%,60%{box-shadow:0 0 0 3px var(--primary)}100%{box-shadow:none}}
    .spin svg{animation:spin .7s linear}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty-state{text-align:center;color:var(--neutral-500);padding:32px 12px;font-size:.95rem}
    .btn:disabled,.btn-accept:disabled{opacity:.45;cursor:not-allowed;transform:none}
  `;
  document.head.appendChild(style);

  /* ------------------------------ Toast -------------------------------- */
  const toastWrap = document.createElement('div');
  toastWrap.className = 'toast-wrap';
  document.body.appendChild(toastWrap);

  function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    toastWrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2800);
  }

  /* ------------------------------ Modal -------------------------------- */
  let closeCurrentModal = null;

  function openModal({ title, body, actions = [], onOpen }) {
    if (closeCurrentModal) closeCurrentModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x" aria-label="Đóng">&times;</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot"></div>
      </div>`;
    const bodyEl = $('.modal-body', backdrop);
    typeof body === 'string' ? (bodyEl.innerHTML = body) : bodyEl.appendChild(body);
    const foot = $('.modal-foot', backdrop);
    const close = () => { backdrop.remove(); closeCurrentModal = null; };
    closeCurrentModal = close;

    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = `m-btn ${a.cls || ''}`;
      b.textContent = a.label;
      b.onclick = () => { if (!a.onClick || a.onClick(bodyEl) !== false) close(); };
      foot.appendChild(b);
    });
    if (!actions.length) foot.remove();

    $('.modal-x', backdrop).onclick = close;
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    if (onOpen) onOpen(bodyEl, close);
    return close;
  }

  /* ------------------------ Agent status & capacity -------------------- */
  function renderCapacity() {
    const pct = Math.round((state.held / state.maxCapacity) * 100);
    $('.capacity-labels strong').textContent = `${state.held} / ${state.maxCapacity} vé đang giữ (${pct}%)`;
    const bar = $('.capacity-bar');
    bar.style.width = `${pct}%`;
    bar.style.background = pct >= 100 ? 'var(--danger)' : 'var(--primary)';
  }

  function renderOnline() {
    const dot = $('.online-indicator-dot');
    const badge = $('.active-badge');
    const label = $('.agent-submeta span:nth-child(2)');
    const color = state.online ? 'var(--success)' : 'var(--neutral-400)';
    dot.style.background = color;
    badge.style.background = color;
    label.textContent = state.online ? 'Agent #SP-104 • Ca Trực Sáng' : 'Agent #SP-104 • Ngoại tuyến';
  }

  $('.switch-toggle input').addEventListener('change', (e) => {
    state.online = e.target.checked;
    renderOnline();
    renderQueue();
    toast(state.online ? 'Bạn đã chuyển sang trạng thái TRỰC' : 'Bạn đã chuyển sang NGOẠI TUYẾN', state.online ? 'success' : '');
  });

  /* -------------------------------- KPIs ------------------------------- */
  function renderKpis() {
    const cells = $$('.kpi-cell');
    const gain = Math.max(0, state.resolved - 14);
    cells[0].querySelector('.kpi-metric').innerHTML = `${state.resolved} <span class="kpi-badge-gain">+${gain} KPI</span>`;
    cells[0].querySelector('.kpi-footnote').textContent = `Hạn ngạch ca: ${state.quota} vé`;
    cells[1].querySelector('.kpi-metric').innerHTML = `${pad(state.waiting)} <small class="text-muted">Đang Hold</small>`;
    cells[2].querySelector('.kpi-metric').innerHTML = `${state.sla.toFixed(1)}% <span class="kpi-badge-gain">↑ 1.2%</span>`;
    cells[3].querySelector('.kpi-metric').innerHTML = `${state.responseTime.toFixed(1)} <small>phút</small>`;
    touchUpdate();
  }

  function touchUpdate() { state.lastUpdate = Date.now(); renderUpdateLabel(); }
  function renderUpdateLabel() {
    const m = Math.floor((Date.now() - state.lastUpdate) / 60000);
    $('.kpi-section .text-meta').textContent = m < 1 ? 'Cập nhật: vừa xong' : `Cập nhật: ${m} phút trước`;
  }
  setInterval(renderUpdateLabel, 20000);

  /* -------------------------------- Queue ------------------------------ */
  const triage = $('.triage-card');
  const queueList = document.createElement('div');
  queueList.className = 'queue-list';
  queueList.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  $$('.urgent-card-alert, .queue-list-item', triage).forEach((el) => el.remove());
  triage.appendChild(queueList);

  const chips = $$('.queue-chips-bar .chip');
  const CHIP_KEYS = ['urgent', 'appeal', 'other'];

  function renderChipCounts() {
    const count = (c) => state.queue.filter((t) => t.cat === c).length;
    chips.forEach((chip, i) => {
      const b = $('.badge-chip', chip);
      if (b) { b.textContent = count(CHIP_KEYS[i]); b.style.display = count(CHIP_KEYS[i]) ? '' : 'none'; }
    });
  }

  function renderQueue() {
    renderChipCounts();
    const list = state.queue.filter((t) => t.cat === state.filter);
    if (!list.length) {
      queueList.innerHTML = '<div class="empty-state">🎉 Không còn vé trong mục này.</div>';
      return;
    }
    const full = state.held >= state.maxCapacity;
    queueList.innerHTML = list.map((t) => {
      if (t.cat === 'urgent') {
        return `
        <div class="urgent-card-alert" data-id="${t.id}">
          <div class="urgent-left">
            <div class="sla-badge" data-sla-id="${t.id}">SLA CÒN ${fmtSla(t.sla)}</div>
            <div class="urgent-info">
              <strong class="urgent-code">#${t.id} • ${esc(t.title)}</strong>
              <p>${esc(t.preview)}</p>
            </div>
          </div>
          <button class="btn-accept" data-accept="${t.id}" ${full || !state.online ? 'disabled' : ''}>Nhận ngay</button>
        </div>`;
      }
      return `
        <div class="queue-list-item" data-id="${t.id}" data-accept="${t.id}" title="Nhấn để nhận vé">
          <div class="queue-item-head"><strong>#${t.id} • ${esc(t.title)}</strong><span class="time-wait">${esc(t.wait)}</span></div>
          <p>${esc(t.preview)}</p>
        </div>`;
    }).join('');
  }

  chips.forEach((chip, i) => chip.addEventListener('click', () => {
    state.filter = CHIP_KEYS[i];
    chips.forEach((c) => c.classList.toggle('chip-active', c === chip));
    renderQueue();
  }));

  queueList.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accept]');
    if (el) acceptTicket(el.dataset.accept);
  });

  // Refresh
  $('.btn-refresh').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spin');
    setTimeout(() => {
      btn.classList.remove('spin');
      renderQueue();
      touchUpdate();
      toast('Đã làm mới hàng đợi');
    }, 700);
  });

  // SLA countdown
  setInterval(() => {
    state.queue.forEach((t) => {
      if (t.cat !== 'urgent') return;
      if (t.sla > 0) t.sla--;
      const el = $(`[data-sla-id="${t.id}"]`);
      if (el) {
        el.textContent = t.sla > 0 ? `SLA CÒN ${fmtSla(t.sla)}` : 'QUÁ HẠN SLA';
        el.classList.toggle('critical', t.sla <= 60);
      }
      if (t.sla === 60) toast(`⚠ #${t.id} sắp quá hạn SLA (còn 1 phút)`, 'error');
    });
  }, 1000);

  /* ---------------------------- Accept / resolve ----------------------- */
  function acceptTicket(id) {
    if (!state.online) return toast('Bạn đang ngoại tuyến – hãy bật trạng thái trực', 'error');
    if (state.held >= state.maxCapacity) return toast('Đã đạt tải tối đa, hãy xử lý bớt vé', 'error');
    const idx = state.queue.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [t] = state.queue.splice(idx, 1);

    if (state.active) { state.waiting++; toast(`Vé #${state.active.id} chuyển sang trạng thái chờ phản hồi`); }
    state.active = {
      ...t, sentAt: nowHM(), wait: t.wait + ' trước', replied: false,
      message: esc(t.message),
      flag: null
    };
    state.held++;
    renderCapacity(); renderKpis(); renderQueue(); renderActive();
    toast(`Đã nhận vé #${t.id}`, 'success');
  }

  function closeActive(reason) {
    const id = state.active.id;
    state.active = null;
    state.held = Math.max(0, state.held - 1);
    state.resolved++;
    state.responseTime = Math.max(0.8, +(state.responseTime - 0.02).toFixed(2));
    renderCapacity(); renderKpis(); renderActive();
    toast(`${reason} #${id}`, 'success');
  }

  /* ---------------------------- Active workspace ----------------------- */
  const ticketArea = $('.ticket-content-area');
  const badgeHolding = $('.badge-holding');
  const actionBtns = $$('.workspace-action-bar .btn'); // [tier2, template, log, chat]

  function renderActive() {
    const t = state.active;
    actionBtns.forEach((b) => (b.disabled = !t));
    if (!t) {
      badgeHolding.textContent = 'TRỐNG';
      ticketArea.innerHTML = '<div class="empty-state">Chưa có phiếu nào đang xử lý.<br>Hãy nhận vé từ hàng đợi bên trái.</div>';
      return;
    }
    badgeHolding.textContent = t.replied ? 'ĐÃ PHẢN HỒI' : 'ĐANG GIỮ';
    const avatar = AVATARS[t.id.charCodeAt(t.id.length - 1) % AVATARS.length];
    const title = t.cat === 'appeal' && t.id === 'TK-9921' ? t.title : `${t.title}`;
    const flag = t.flag
      ? `<div class="risk-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg><span>${t.flag.label}</span></div>` : '';
    const detect = `
      <div class="ai-detect-box">
        <div class="detect-header">
          <span class="detect-title">PHÁT HIỆN TỪ HỆ THỐNG SENTINEL AI</span>
          <span class="detect-val">${t.flag ? `Trùng khớp ${t.flag.match}% mẫu bot spam` : 'Không phát hiện bất thường'}</span>
        </div>
        <div class="detect-tags">${t.tags.map(([k, txt]) => `<span class="chip-flag-${k}">${esc(txt)}</span>`).join('')}</div>
      </div>`;
    ticketArea.innerHTML = `
      <div class="ticket-user-header">
        <div class="user-profile-meta">
          <img class="avatar avatar-lg" src="${avatar}" alt="User">
          <div>
            <div class="user-row">
              <strong class="username">${esc(t.user)}</strong>
              <span class="user-tier">${esc(t.tier)}</span>${flag}
            </div>
            <div class="ticket-meta-detail">Gửi lúc: ${t.sentAt} (${esc(t.wait)}) • ID #${t.id}</div>
          </div>
        </div>
      </div>
      <h3 class="ticket-title-bold">${esc(title)}</h3>
      <div class="user-message-box"><p>"${t.message}"</p></div>
      ${detect}`;
  }

  /* ---------------------- Workspace action buttons --------------------- */
  function templatePicker(onPick) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    wrap.innerHTML = TEMPLATES.map((t, i) => `<button class="m-item" data-i="${i}"><strong>${esc(t.title)}</strong><p>${esc(t.text)}</p></button>`).join('');
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('.m-item'); if (!b) return;
      onPick(TEMPLATES[+b.dataset.i]);
    });
    return wrap;
  }

  function applyTemplate() {
    if (!state.active) return toast('Chưa có phiếu đang xử lý', 'error');
    openModal({
      title: 'Chọn phản hồi mẫu',
      body: templatePicker((tpl) => {
        closeCurrentModal();
        state.active.replied = true;
        state.waiting++;
        badgeHolding.textContent = 'ĐÃ PHẢN HỒI';
        renderKpis();
        toast(`Đã gửi phản hồi mẫu: ${tpl.title}`, 'success');
      })
    });
  }

  // Chuyển Tier-2
  actionBtns[0].addEventListener('click', () => {
    if (!state.active) return;
    openModal({
      title: `Chuyển #${state.active.id} lên Tier-2 / An ninh`,
      body: `<label>Lý do chuyển</label>
             <select class="m-select"><option>Nghi vấn bot – cần phân tích sâu</option><option>Rủi ro bảo mật / mạo danh</option><option>Ngoài thẩm quyền Tier-1</option></select>
             <label>Ghi chú thêm</label><textarea class="m-area" placeholder="Nhập ghi chú cho Tier-2..."></textarea>`,
      actions: [
        { label: 'Hủy' },
        { label: 'Xác nhận chuyển', cls: 'primary', onClick: () => { closeActive('Đã chuyển Tier-2 vé'); } }
      ]
    });
  });

  // Phản hồi mẫu
  actionBtns[1].addEventListener('click', applyTemplate);

  // Log bằng chứng
  actionBtns[2].addEventListener('click', () => {
    const t = state.active; if (!t) return;
    const rows = [
      ['10:15:02', 'POST /posts', '200', t.flag ? 'Chrome Win64' : 'Thiết bị hợp lệ'],
      ['10:15:09', 'POST /posts', '200', t.flag ? 'Chrome Win64' : 'Thiết bị hợp lệ'],
      ['10:15:17', 'POST /posts', t.flag ? '429' : '200', t.flag ? 'Rate-limit kích hoạt' : 'Bình thường'],
      ['10:16:40', 'SENTINEL', '—', t.flag ? `Khớp mẫu bot v3 (${t.flag.match}%)` : 'Không có cảnh báo']
    ];
    openModal({
      title: `Log bằng chứng #${t.id}`,
      body: `<table class="m-table"><tr><th>Giờ</th><th>Sự kiện</th><th>Mã</th><th>Ghi chú</th></tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`,
      actions: [{ label: 'Đóng', cls: 'dark' }]
    });
  });

  // Chat 1:1
  actionBtns[3].addEventListener('click', () => {
    const t = state.active; if (!t) return;
    const box = document.createElement('div');
    box.innerHTML = `<div class="chat-box"><div class="bubble them">${esc(t.user)} đang trực tuyến.</div></div>
      <div style="display:flex;gap:8px;margin-top:10px"><input class="m-input" placeholder="Nhập tin nhắn..."><button class="m-btn primary">Gửi</button></div>`;
    const chat = $('.chat-box', box), input = $('input', box);
    const add = (cls, txt) => { const b = document.createElement('div'); b.className = `bubble ${cls}`; b.textContent = txt; chat.appendChild(b); chat.scrollTop = chat.scrollHeight; };
    const send = () => {
      const v = input.value.trim(); if (!v) return;
      add('me', v); input.value = '';
      setTimeout(() => add('them', 'Cảm ơn admin, tôi đã hiểu. Bao lâu thì được mở khóa ạ?'), 1200);
    };
    $('button', box).onclick = send;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    openModal({ title: `Chat 1:1 – ${t.user}`, body: box, actions: [{ label: 'Đóng' }, { label: 'Giải quyết & đóng vé', cls: 'primary', onClick: () => closeActive('Đã giải quyết vé') }], onOpen: () => input.focus() });
  });

  /* ------------------------------- Toolkit ----------------------------- */
  const tools = $$('.tool-card');

  tools[0].addEventListener('click', applyTemplate);

  tools[1].addEventListener('click', () => {
    openModal({
      title: 'Tra cứu tài khoản',
      body: `<input class="m-input" id="lookup-q" placeholder="@username" value="${esc(state.active ? state.active.user : '')}">
             <div id="lookup-res"></div>`,
      actions: [{ label: 'Đóng' }, { label: 'Tra cứu', cls: 'primary', onClick: (b) => {
        const q = $('#lookup-q', b).value.trim();
        if (!q) { toast('Nhập username cần tra cứu', 'error'); return false; }
        $('#lookup-res', b).innerHTML = `<table class="m-table">
          <tr><th>Tài khoản</th><td>${esc(q)}</td></tr><tr><th>Ngày tạo</th><td>12/03/2024</td></tr>
          <tr><th>Vi phạm trước đó</th><td>1 lần (cảnh báo)</td></tr><tr><th>IP gần nhất</th><td>14.162.xx.xx</td></tr>
          <tr><th>Thiết bị</th><td>Chrome Win64 • 2 thiết bị</td></tr></table>`;
        return false;
      } }]
    });
  });

  tools[2].addEventListener('click', () => {
    openModal({
      title: 'Quy chuẩn xử lý (SOP)',
      body: SOP.map(([h, p]) => `<div class="m-item" style="cursor:default"><strong>${esc(h)}</strong><p>${esc(p)}</p></div>`).join(''),
      actions: [{ label: 'Đóng', cls: 'dark' }]
    });
  });

  tools[3].addEventListener('click', () => {
    const notes = state.notes.length
      ? state.notes.map((n) => `<div class="m-item" style="cursor:default"><p>${esc(n.time)}</p>${esc(n.text)}</div>`).join('')
      : '<p class="text-muted">Chưa có ghi chú trong ca.</p>';
    openModal({
      title: 'Ghi chú ca trực',
      body: `<textarea class="m-area" id="note-in" placeholder="Nhập ghi chú mới..."></textarea>${notes}`,
      actions: [{ label: 'Đóng' }, { label: 'Lưu ghi chú', cls: 'primary', onClick: (b) => {
        const v = $('#note-in', b).value.trim();
        if (!v) { toast('Ghi chú đang trống', 'error'); return false; }
        state.notes.unshift({ time: nowHM(), text: v });
        toast('Đã lưu ghi chú', 'success');
      } }]
    });
  });

  /* ------------------------------ Search ------------------------------- */
  const searchInput = $('.quick-search-box input');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = searchInput.value.trim().toLowerCase().replace('#', '');
    if (!q) return;
    if (state.active && (state.active.id.toLowerCase().includes(q) || state.active.user.toLowerCase().includes(q))) {
      const box = $('.active-ticket-workspace');
      box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 1600);
      return toast(`Vé #${state.active.id} đang được bạn xử lý`);
    }
    const t = state.queue.find((x) => x.id.toLowerCase().includes(q) || x.user.toLowerCase().includes(q));
    if (!t) return toast('Không tìm thấy vé phù hợp', 'error');
    state.filter = t.cat;
    chips.forEach((c, i) => c.classList.toggle('chip-active', CHIP_KEYS[i] === t.cat));
    renderQueue();
    const el = $(`[data-id="${t.id}"]`, queueList);
    if (el) { el.classList.add('flash'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); setTimeout(() => el.classList.remove('flash'), 1600); }
    toast(`Tìm thấy #${t.id}`, 'success');
  });
  /* ---------------------------- Sidebar nav ---------------------------- */
$$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
        // Chỉ đổi trạng thái active
        $$('.nav-item').forEach((n) => {
            n.classList.remove('nav-item-active');
        });

        item.classList.add('nav-item-active');
    });
});

  /* ------------------------- Help & shortcuts -------------------------- */
  function openHelp() {
    openModal({
      title: 'Trung tâm trợ giúp',
      body: `<table class="m-table">
        <tr><th>Phím</th><th>Chức năng</th></tr>
        <tr><td>/ hoặc Ctrl+K</td><td>Tìm kiếm ticket</td></tr>
        <tr><td>F2</td><td>Mở phản hồi mẫu</td></tr>
        <tr><td>Esc</td><td>Đóng cửa sổ</td></tr></table>`,
      actions: [{ label: 'Đóng', cls: 'dark' }]
    });
  }
  $('.icon-btn').addEventListener('click', openHelp);

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === 'Escape' && closeCurrentModal) closeCurrentModal();
    else if (e.key === 'F2') { e.preventDefault(); applyTemplate(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.focus(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); searchInput.focus(); }
  });

  /* ------------------------------ Init --------------------------------- */
  renderOnline();
  renderCapacity();
  renderKpis();
  renderQueue();
  renderActive();
})();