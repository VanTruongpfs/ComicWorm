/**
 * ComicHub / BookMooch - Yêu cầu rút tiền (Withdrawal Logic)
 * Phục vụ riêng cho: withdraw.html
 * 
 * Tính năng chính:
 * 1. Hiển thị thẻ ngân hàng liên kết nhận tiền (Virtual Bank Card)
 * 2. KHÔNG hiển thị số dư người dùng
 * 3. Kiểm tra hạn mức giao dịch (Tối thiểu 50.000 ₫, tối đa 200.000.000 ₫/ngày)
 * 4. Tương tác chuyển đổi thẻ ngân hàng trực quan (Vietcombank, MB Bank, MoMo)
 * 5. Button loading state & Stepper modal tiến trình rút tiền qua Napas 24/7
 */

const DAILY_WITHDRAW_LIMIT = 200000000; // 200 triệu / ngày

document.addEventListener('DOMContentLoaded', () => {
  initWithdrawModule();
});

function initWithdrawModule() {
  const input = document.getElementById('withdrawAmountInput');
  if (!input) return;

  // Realtime validate + auto-format number khi gõ
  input.addEventListener('input', () => {
    const rawValue = typeof parseFormattedNumber === 'function' ? parseFormattedNumber(input.value) : parseInt(input.value.replace(/\D/g, '') || 0, 10);
    input.value = rawValue > 0 ? (typeof formatNumber === 'function' ? formatNumber(rawValue) : rawValue.toLocaleString('vi-VN')) : '';
    validateWithdrawAmount(rawValue);
  });

  validateWithdrawAmount(typeof parseFormattedNumber === 'function' ? parseFormattedNumber(input.value) : 5000000);
}

/**
 * 1. Validate realtime số tiền rút (không phụ thuộc vào số dư người dùng)
 */
function validateWithdrawAmount(amount) {
  const input = document.getElementById('withdrawAmountInput');
  const errorHint = document.getElementById('withdrawErrorHint');
  const submitBtn = document.getElementById('submitWithdrawBtn');

  if (!input) return;

  if (amount > DAILY_WITHDRAW_LIMIT) {
    input.classList.add('shake-error');
    if (errorHint) {
      errorHint.style.display = 'flex';
      const errText = document.getElementById('withdrawErrorText');
      if (errText) errText.textContent = `Số tiền rút vượt quá hạn mức tối đa trong ngày (${(DAILY_WITHDRAW_LIMIT).toLocaleString('vi-VN')} ₫)!`;
    }
    if (submitBtn) submitBtn.disabled = true;

    setTimeout(() => {
      input.classList.remove('shake-error');
      input.style.borderColor = '#ef4444';
    }, 450);
  } else if (amount < 50000 && amount > 0) {
    if (errorHint) {
      errorHint.style.display = 'flex';
      const errText = document.getElementById('withdrawErrorText');
      if (errText) errText.textContent = 'Số tiền rút tối thiểu là 50.000 ₫!';
    }
    if (submitBtn) submitBtn.disabled = true;
    input.style.borderColor = '#ef4444';
  } else {
    input.style.borderColor = '';
    if (errorHint) errorHint.style.display = 'none';
    if (submitBtn) submitBtn.disabled = (amount < 50000);
  }
}

/**
 * 2. Nút cộng nhanh số tiền
 */
function addAmount(amount) {
  const input = document.getElementById('withdrawAmountInput');
  if (!input) return;
  const current = typeof parseFormattedNumber === 'function' ? parseFormattedNumber(input.value) : parseInt(input.value.replace(/\D/g, '') || 0, 10);
  const next = current + amount;
  input.value = typeof formatNumber === 'function' ? formatNumber(next) : next.toLocaleString('vi-VN');
  validateWithdrawAmount(next);
  if (typeof showToast === 'function') {
    showToast(`Đã thêm +${(amount).toLocaleString('vi-VN')} ₫ vào số tiền rút`, 'info');
  }
}

/**
 * 3. Chuyển đổi phương thức nhận tiền & đồng bộ giao diện Thẻ liên kết
 */
function selectBank(card) {
  document.querySelectorAll('.bank-option-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');

  const bankTitle = card.querySelector('.bank-text h4');
  const bankName = bankTitle ? bankTitle.childNodes[0].textContent.trim() : 'Vietcombank';

  // Cập nhật thẻ vật lý ảo trực quan
  const cardEl = document.getElementById('primaryVirtualCard');
  const cardBankNameEl = document.getElementById('cardBankName');
  const cardBranchEl = document.getElementById('cardBranch');
  const cardNumberDisplay = document.getElementById('cardNumberDisplay');

  if (bankName.includes('Vietcombank')) {
    if (cardBankNameEl) cardBankNameEl.textContent = 'VIETCOMBANK';
    if (cardBranchEl) cardBranchEl.textContent = 'Chi nhánh Thủ Đức • TP. Hồ Chí Minh';
    if (cardNumberDisplay) cardNumberDisplay.textContent = '•••• •••• •••• 8829';
    if (cardEl) {
      cardEl.style.background = 'linear-gradient(135deg, #0b1c30 0%, #064e3b 55%, #022c22 100%)';
      cardEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    }
  } else if (bankName.includes('MB Bank')) {
    if (cardBankNameEl) cardBankNameEl.textContent = 'MB BANK';
    if (cardBranchEl) cardBranchEl.textContent = 'MB Priority • Chi nhánh Hội Sở';
    if (cardNumberDisplay) cardNumberDisplay.textContent = '•••• •••• •••• 9999';
    if (cardEl) {
      cardEl.style.background = 'linear-gradient(135deg, #0b1c30 0%, #1e3a8a 55%, #172554 100%)';
      cardEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    }
  } else {
    // MoMo / ZaloPay
    if (cardBankNameEl) cardBankNameEl.textContent = 'VÍ MOMO / ZALOPAY';
    if (cardBranchEl) cardBranchEl.textContent = 'Ví điện tử đã định danh eKYC';
    if (cardNumberDisplay) cardNumberDisplay.textContent = '0988 •••• 999';
    if (cardEl) {
      cardEl.style.background = 'linear-gradient(135deg, #0b1c30 0%, #831843 55%, #500724 100%)';
      cardEl.style.borderColor = 'rgba(236, 72, 153, 0.3)';
    }
  }

  if (typeof showToast === 'function') {
    showToast(`Đã chọn nhận tiền qua thẻ: ${bankName}`, 'info');
  }
}

/**
 * 4. Xử lý Submit rút tiền với Button Loading + Progress Stepper Modal
 */
function handleWithdrawSubmit() {
  const input = document.getElementById('withdrawAmountInput');
  const amount = typeof parseFormattedNumber === 'function' ? parseFormattedNumber(input ? input.value : 0) : parseInt((input ? input.value : '0').replace(/\D/g, '') || 0, 10);

  if (amount < 50000) {
    if (typeof showToast === 'function') {
      showToast('Số tiền rút tối thiểu là 50.000 ₫!', 'warning');
    }
    return;
  }

  if (amount > DAILY_WITHDRAW_LIMIT) {
    if (typeof showToast === 'function') {
      showToast('Số tiền rút vượt quá hạn mức tối đa trong ngày (200.000.000 ₫)!', 'danger');
    }
    return;
  }

  const submitBtn = document.getElementById('submitWithdrawBtn');
  if (submitBtn) {
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;
  }

  const selectedBank = document.querySelector('.bank-option-card.selected .bank-text h4');
  const bankName = selectedBank ? selectedBank.childNodes[0].textContent.trim() : 'Vietcombank';

  setTimeout(() => {
    if (submitBtn) {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
    openWithdrawStepperModal(amount, bankName);
  }, 400);
}

/**
 * 5. Progress Stepper Modal 4 bước Napas 24/7
 */
function openWithdrawStepperModal(amount, bankName) {
  let modal = document.getElementById('withdrawStepperModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'withdrawStepperModal';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 520px; text-align: left;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="modal-icon-circle success" style="margin-bottom: 0; width: 44px; height: 44px;">
              <span class="material-symbols-outlined" style="font-size: 24px;">bolt</span>
            </div>
            <div>
              <h3 class="modal-title" style="font-size: 1.15rem; margin-bottom: 2px;">Tiến trình xử lý rút tiền 24/7</h3>
              <span style="font-size: 0.78rem; color: var(--text-muted);">Cổng liên ngân hàng Napas 247</span>
            </div>
          </div>
          <button class="nav-icon-btn" onclick="closeWithdrawModal()" title="Đóng">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Số tiền yêu cầu rút:</span>
            <strong style="color: var(--primary); font-family: var(--font-heading); font-size: 1.15rem;" id="stepperModalAmount">0 ₫</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Tài khoản nhận:</span>
            <strong style="color: var(--text-main);" id="stepperModalBank">Vietcombank</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
            <span style="color: var(--text-muted);">Phí giao dịch:</span>
            <span class="badge badge-success" style="font-size: 0.75rem;">Miễn phí (0đ)</span>
          </div>
        </div>

        <!-- 4-STEP TIMELINE -->
        <div class="stepper-timeline" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
          <div class="step-item step-done" id="step1" style="display: flex; gap: 12px; align-items: flex-start;">
            <span class="material-symbols-outlined" style="color: #10b981; font-size: 20px;">check_circle</span>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">1. Khởi tạo yêu cầu rút tiền</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Hệ thống đã mã hóa và tiếp nhận lệnh thanh khoản</div>
            </div>
          </div>
          <div class="step-item step-done" id="step2" style="display: flex; gap: 12px; align-items: flex-start;">
            <span class="material-symbols-outlined" style="color: #10b981; font-size: 20px;">check_circle</span>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">2. Xác thực thẻ ngân hàng liên kết</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Tài khoản thụ hưởng đã được định danh chính chủ</div>
            </div>
          </div>
          <div class="step-item step-active" id="step3" style="display: flex; gap: 12px; align-items: flex-start;">
            <span class="material-symbols-outlined" style="color: #2563eb; font-size: 20px;">sync</span>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: #2563eb;">3. Chuyển tiền qua cổng Napas 24/7</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Đang thực hiện điện chuyển tiền liên ngân hàng tức thì</div>
            </div>
          </div>
          <div class="step-item" id="step4" style="display: flex; gap: 12px; align-items: flex-start; opacity: 0.5;">
            <span class="material-symbols-outlined" style="color: #94a3b8; font-size: 20px;">radio_button_unchecked</span>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">4. Tiền nổi trong tài khoản người bán</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Dự kiến hoàn tất trong 5 - 15 phút</div>
            </div>
          </div>
        </div>

        <div class="modal-actions" style="justify-content: flex-end;">
          <button class="btn btn-primary" onclick="closeWithdrawModal()">
            <span class="material-symbols-outlined" style="font-size: 18px;">check</span>
            Đã hiểu, đóng thông báo
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeWithdrawModal();
    });
  }

  const amtEl = document.getElementById('stepperModalAmount');
  const bankEl = document.getElementById('stepperModalBank');
  if (amtEl) amtEl.textContent = `${(amount).toLocaleString('vi-VN')} ₫`;
  if (bankEl) bankEl.textContent = bankName;

  modal.classList.add('active');

  if (typeof showToast === 'function') {
    showToast(`Đã gửi lệnh rút ${(amount).toLocaleString('vi-VN')} ₫ về ${bankName}!`, 'success');
  }
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdrawStepperModal');
  if (modal) modal.classList.remove('active');
}
