/**
 * ComicHub / BookMooch - Quản lý ví & Ký quỹ Escrow (Wallet Logic)
 * Phục vụ riêng cho: wallet.html
 * 
 * Tính năng chính:
 * 1. Phân tách rõ Số dư giam giữ khả dụng và Số dư đơn hàng chưa thành công
 * 2. Cơ chế rút tiền thủ công từ Seller (Không chuyển tự động)
 * 3. Kiểm soát giới hạn số lần rút trên ngày (Daily Withdrawal Limit: 3 lần/ngày)
 * 4. Tabs lọc đơn hàng (Tất cả, Khả dụng rút, Đơn đang giam) & tìm kiếm nhanh
 * 5. Cập nhật số dư trực quan tức thì (Realtime Wallet Synchronization)
 */

// Global State
const EscrowState = {
  mainBalance: 48650000,
  escrowAvailable: 8650000,
  escrowPending: 6170000,
  dailyLimit: 3,
  dailyUsed: 1, // Đã rút 1 lần trong ngày, còn 2 lượt
  currentFilter: 'all',
  selectedOrderId: null
};

document.addEventListener('DOMContentLoaded', () => {
  initEscrowSystem();
});

/**
 * Khởi tạo toàn bộ module ví và ký quỹ
 */
function initEscrowSystem() {
  updateUIBalanceDisplays();
  initEscrowTooltips();
  initEscrowCountdown();
  setupModalBackdropListener();
}

/**
 * Cập nhật hiển thị số dư và hạn mức trên toàn giao diện
 */
function updateUIBalanceDisplays() {
  // 1. Số dư ví chính
  const mainWalletEl = document.getElementById('mainWalletAmount');
  if (mainWalletEl) {
    mainWalletEl.textContent = formatMoney(EscrowState.mainBalance);
  }

  // 2. Số dư giam giữ khả dụng
  const escrowAvailEl = document.getElementById('escrowAvailAmount');
  if (escrowAvailEl) {
    escrowAvailEl.textContent = formatMoney(EscrowState.escrowAvailable);
  }

  // 3. Số dư đơn chưa thành công
  const escrowPendingEl = document.getElementById('escrowPendingAmount');
  if (escrowPendingEl) {
    escrowPendingEl.textContent = formatMoney(EscrowState.escrowPending);
  }

  // 4. Badge hạn mức rút trong ngày
  const remainingCount = Math.max(0, EscrowState.dailyLimit - EscrowState.dailyUsed);
  const remainingCountEl = document.getElementById('remainingWithdrawCount');
  if (remainingCountEl) {
    remainingCountEl.textContent = remainingCount;
  }

  const limitBadge = document.getElementById('dailyLimitBadge');
  const btnHeroWithdraw = document.getElementById('btnOpenWithdrawModal');

  if (limitBadge) {
    if (remainingCount === 0) {
      limitBadge.className = 'limit-badge-count limit-reached';
      limitBadge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 13px;">block</span> Hết lượt (${EscrowState.dailyUsed}/${EscrowState.dailyLimit})`;
    } else {
      limitBadge.className = 'limit-badge-count';
      limitBadge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 13px;">check</span> Còn <strong>${remainingCount}</strong>/${EscrowState.dailyLimit} lượt`;
    }
  }

  // Nếu hết số dư khả dụng hoặc hết lượt rút thì disable nút trên Hero card
  if (btnHeroWithdraw) {
    if (EscrowState.escrowAvailable <= 0) {
      btnHeroWithdraw.disabled = true;
      btnHeroWithdraw.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">done_all</span> Đã rút hết số dư khả dụng`;
      btnHeroWithdraw.classList.add('disabled');
    } else if (remainingCount === 0) {
      btnHeroWithdraw.disabled = false; // Vẫn cho bấm để xem thông báo giới hạn chi tiết
      btnHeroWithdraw.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">lock_clock</span> Đã đạt giới hạn hôm nay (${EscrowState.dailyLimit}/${EscrowState.dailyLimit})`;
    } else {
      btnHeroWithdraw.disabled = false;
      btnHeroWithdraw.classList.remove('disabled');
      btnHeroWithdraw.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">move_to_inbox</span> Rút thủ công về Ví chính`;
    }
  }

  // Header badge trong bảng
  const headerBadgeAvail = document.getElementById('headerBadgeAvail');
  if (headerBadgeAvail) {
    headerBadgeAvail.textContent = `Khả dụng rút: ${formatMoney(EscrowState.escrowAvailable)} ₫`;
  }
}

// Danh sách tài khoản ngân hàng liên kết
const BankAccounts = [
  {
    id: 'bank-1',
    bankName: 'Vietcombank • CN Tân Bình',
    bankCode: 'VCB',
    accountNumber: '1029 3847 56',
    accountHolder: 'TRẦN ĐĂNG KHOA',
    isDefault: true,
    color: '#005a3c'
  },
  {
    id: 'bank-2',
    bankName: 'MBBank • CN TP.HCM',
    bankCode: 'MB',
    accountNumber: '9999 8888 7777',
    accountHolder: 'TRẦN ĐĂNG KHOA',
    isDefault: false,
    color: '#1b4098'
  },
  {
    id: 'bank-3',
    bankName: 'Techcombank • CN Sài Gòn',
    bankCode: 'TCB',
    accountNumber: '1903 6789 5432',
    accountHolder: 'TRẦN ĐĂNG KHOA',
    isDefault: false,
    color: '#d62828'
  }
];

let selectedBankId = 'bank-1';

function getSelectedBank() {
  return BankAccounts.find(b => b.id === selectedBankId) || BankAccounts[0];
}

function updateSelectedBankDisplay() {
  const bank = getSelectedBank();
  const logoEl = document.getElementById('selectedBankLogo');
  const nameEl = document.getElementById('selectedBankName');
  const numEl = document.getElementById('selectedBankAccountNum');
  const holderEl = document.getElementById('selectedBankHolder');
  const badgeEl = document.getElementById('selectedBankBadge');

  if (logoEl) {
    logoEl.textContent = bank.bankCode;
    logoEl.style.backgroundColor = bank.color;
  }
  if (nameEl) nameEl.textContent = bank.bankName;
  if (numEl) numEl.textContent = bank.accountNumber;
  if (holderEl) holderEl.textContent = bank.accountHolder;
  if (badgeEl) {
    badgeEl.style.display = bank.isDefault ? 'inline-block' : 'none';
  }
}

function openBankSelectionModal() {
  renderBankAccountsList();
  const modal = document.getElementById('bankSelectionModal');
  if (modal) modal.classList.add('active');
}

function closeBankSelectionModal() {
  const modal = document.getElementById('bankSelectionModal');
  if (modal) modal.classList.remove('active');
}

function renderBankAccountsList() {
  const container = document.getElementById('bankAccountsList');
  if (!container) return;

  container.innerHTML = BankAccounts.map(b => {
    const isSelected = b.id === selectedBankId;
    return `
      <div class="bank-account-item ${isSelected ? 'selected' : ''}" onclick="selectBankAccount('${b.id}')">
        <input type="radio" name="bankAccountRadio" class="bank-item-radio" ${isSelected ? 'checked' : ''}>
        <div class="bank-logo-badge" style="background: ${b.color}; width: 38px; height: 38px; font-size: 0.8rem;">
          ${b.bankCode}
        </div>
        <div class="bank-info-col">
          <div class="bank-name-row">
            <strong class="bank-name-text" style="font-size: 0.84rem;">${b.bankName}</strong>
            ${b.isDefault ? '<span class="bank-badge-default">Mặc định</span>' : ''}
          </div>
          <div class="bank-account-num" style="font-size: 0.88rem;">${b.accountNumber}</div>
          <div class="bank-holder-name" style="font-size: 0.72rem;">Chủ TK: <strong>${b.accountHolder}</strong></div>
        </div>
        ${isSelected ? '<span class="material-symbols-outlined" style="color: var(--primary-container); font-size: 20px;">check_circle</span>' : ''}
      </div>
    `;
  }).join('');
}

function selectBankAccount(id) {
  selectedBankId = id;
  updateSelectedBankDisplay();
  renderBankAccountsList();
  const selectedBank = getSelectedBank();
  if (typeof showToast === 'function') {
    showToast(`Đã chọn tài khoản nhận: ${selectedBank.bankName}`, 'info');
  }
  closeBankSelectionModal();
}

function addNewBankPrompt() {
  const bankName = prompt('Nhập tên ngân hàng & chi nhánh (Ví dụ: ACB • CN Sài Gòn):');
  if (!bankName) return;
  const accNum = prompt('Nhập số tài khoản ngân hàng:');
  if (!accNum) return;

  const newBank = {
    id: `bank-${Date.now()}`,
    bankName: bankName.trim(),
    bankCode: bankName.substring(0, 3).toUpperCase(),
    accountNumber: accNum.trim(),
    accountHolder: 'TRẦN ĐĂNG KHOA',
    isDefault: false,
    color: '#0284c7'
  };

  BankAccounts.push(newBank);
  selectedBankId = newBank.id;
  updateSelectedBankDisplay();
  renderBankAccountsList();
  if (typeof showToast === 'function') {
    showToast(`Đã liên kết tài khoản: ${newBank.bankName}`, 'success');
  }
}

/**
 * Mở modal rút tiền Escrow về Ví chính
 * @param {number} [targetAmount] - Số tiền chỉ định nếu rút từ 1 đơn cụ thể
 * @param {string} [orderId] - Mã đơn nếu rút từ 1 đơn cụ thể
 */
function openEscrowWithdrawModal(targetAmount, orderId) {
  const modal = document.getElementById('escrowWithdrawModal');
  if (!modal) return;

  const remainingCount = Math.max(0, EscrowState.dailyLimit - EscrowState.dailyUsed);
  EscrowState.selectedOrderId = orderId || null;

  // Cập nhật số dư hiển thị trong modal
  const modalAvailDisplay = document.getElementById('modalAvailDisplay');
  if (modalAvailDisplay) {
    modalAvailDisplay.innerHTML = `${formatMoney(EscrowState.escrowAvailable)} <span style="font-size: 1rem; font-weight: 600;">VNĐ</span>`;
  }

  const modalRemainingTimes = document.getElementById('modalRemainingTimes');
  if (modalRemainingTimes) {
    modalRemainingTimes.textContent = remainingCount;
  }

  const modalLimitAlert = document.getElementById('modalLimitAlert');
  const modalLimitTitle = document.getElementById('modalLimitTitle');
  const modalLimitSub = document.getElementById('modalLimitSub');
  const modalLimitIcon = document.getElementById('modalLimitIcon');
  const btnConfirm = document.getElementById('btnConfirmEscrowWithdraw');
  const amountInput = document.getElementById('modalWithdrawAmountInput');
  const amountGroup = document.getElementById('modalAmountGroup');
  const quickChips = document.getElementById('modalQuickChips');

  // Kiểm tra nếu hết lượt rút hôm nay
  if (remainingCount === 0) {
    if (modalLimitAlert) {
      modalLimitAlert.className = 'modal-limit-alert alert-danger';
    }
    if (modalLimitIcon) modalLimitIcon.textContent = 'block';
    if (modalLimitTitle) modalLimitTitle.textContent = `Đã đạt giới hạn rút: ${EscrowState.dailyLimit}/${EscrowState.dailyLimit} lần hôm nay`;
    if (modalLimitSub) {
      modalLimitSub.innerHTML = `Bạn đã sử dụng hết số lần rút Ký quỹ trong ngày. Để bảo vệ an toàn dòng tiền, vui lòng quay lại sau <strong>00:00</strong> đêm nay để tiếp tục.`;
    }
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">lock</span> Đã hết lượt hôm nay`;
    }
    if (amountGroup) amountGroup.style.opacity = '0.5';
    if (quickChips) quickChips.style.opacity = '0.5';
  } else if (EscrowState.escrowAvailable <= 0) {
    if (modalLimitAlert) modalLimitAlert.className = 'modal-limit-alert';
    if (modalLimitTitle) modalLimitTitle.textContent = 'Không có số dư khả dụng';
    if (modalLimitSub) modalLimitSub.textContent = 'Toàn bộ số dư ký quỹ đã được rút hoặc đang trong thời gian giam giữ.';
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Số dư khả dụng bằng 0';
    }
    if (amountGroup) amountGroup.style.opacity = '0.5';
    if (quickChips) quickChips.style.opacity = '0.5';
  } else {
    // Trạng thái bình thường còn lượt rút
    if (modalLimitAlert) {
      modalLimitAlert.className = 'modal-limit-alert';
    }
    if (modalLimitIcon) modalLimitIcon.textContent = 'alarm';
    if (modalLimitTitle) modalLimitTitle.textContent = `Giới hạn rút tiền: Tối đa ${EscrowState.dailyLimit} lần/ngày`;
    if (modalLimitSub) {
      modalLimitSub.innerHTML = `Hôm nay bạn còn <strong id="modalRemainingTimes">${remainingCount}</strong>/3 lượt rút. Làm mới lúc <strong>00:00</strong>.`;
    }
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">check</span> Xác nhận chuyển về Ví chính`;
    }
    if (amountGroup) amountGroup.style.opacity = '1';
    if (quickChips) quickChips.style.opacity = '1';

    // Điền số tiền
    if (amountInput) {
      const defaultAmount = targetAmount ? Math.min(targetAmount, EscrowState.escrowAvailable) : EscrowState.escrowAvailable;
      amountInput.value = formatMoney(defaultAmount);
    }
  }

  hideModalInputError();
  modal.classList.add('active');
}

/**
 * Đóng modal rút tiền Escrow
 */
function closeEscrowWithdrawModal() {
  const modal = document.getElementById('escrowWithdrawModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Chọn nhanh số tiền rút qua quick chips
 * @param {number|'max'} val 
 */
function setQuickWithdrawAmount(val) {
  const amountInput = document.getElementById('modalWithdrawAmountInput');
  if (!amountInput) return;

  if (val === 'max') {
    amountInput.value = formatMoney(EscrowState.escrowAvailable);
  } else {
    const finalVal = Math.min(val, EscrowState.escrowAvailable);
    amountInput.value = formatMoney(finalVal);
  }
  validateModalWithdrawInput();
}

/**
 * Xác thực số tiền nhập trong modal
 */
function validateModalWithdrawInput() {
  const amountInput = document.getElementById('modalWithdrawAmountInput');
  const btnConfirm = document.getElementById('btnConfirmEscrowWithdraw');
  if (!amountInput) return;

  const rawVal = amountInput.value.replace(/\D/g, '');
  const numVal = parseInt(rawVal, 10);

  if (isNaN(numVal) || numVal <= 0) {
    showModalInputError('Vui lòng nhập số tiền lớn hơn 0 ₫');
    if (btnConfirm) btnConfirm.disabled = true;
    return false;
  }

  if (numVal < 50000) {
    showModalInputError('Số tiền rút tối thiểu là 50.000 ₫');
    if (btnConfirm) btnConfirm.disabled = true;
    return false;
  }

  if (numVal > EscrowState.escrowAvailable) {
    showModalInputError(`Số tiền vượt quá số dư khả dụng (${formatMoney(EscrowState.escrowAvailable)} ₫)`);
    if (btnConfirm) btnConfirm.disabled = true;
    return false;
  }

  hideModalInputError();
  if (btnConfirm && EscrowState.dailyLimit - EscrowState.dailyUsed > 0) {
    btnConfirm.disabled = false;
  }
  return true;
}

function showModalInputError(msg) {
  const errorBox = document.getElementById('modalInputError');
  const errorText = document.getElementById('modalInputErrorText');
  if (errorBox && errorText) {
    errorText.textContent = msg;
    errorBox.style.display = 'flex';
  }
}

function hideModalInputError() {
  const errorBox = document.getElementById('modalInputError');
  if (errorBox) {
    errorBox.style.display = 'none';
  }
}

/**
 * Xác nhận thực hiện rút tiền từ Escrow về Ví chính
 */
function confirmEscrowWithdrawal() {
  // 1. Kiểm tra hạn mức ngày
  const remainingCount = EscrowState.dailyLimit - EscrowState.dailyUsed;
  if (remainingCount <= 0) {
    if (typeof showToast === 'function') {
      showToast('Bạn đã hết lượt rút tiền Escrow hôm nay (tối đa 3 lần/ngày). Vui lòng thử lại vào ngày mai!', 'danger');
    }
    closeEscrowWithdrawModal();
    return;
  }

  // 2. Kiểm tra số tiền
  const amountInput = document.getElementById('modalWithdrawAmountInput');
  if (!amountInput) return;
  const rawVal = amountInput.value.replace(/\D/g, '');
  const withdrawAmount = parseInt(rawVal, 10);

  if (!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > EscrowState.escrowAvailable) {
    showModalInputError('Số tiền rút không hợp lệ!');
    return;
  }

  // 3. Thực hiện chuyển tiền nội bộ (State Update)
  EscrowState.escrowAvailable -= withdrawAmount;
  EscrowState.mainBalance += withdrawAmount;
  EscrowState.dailyUsed += 1;

  // 4. Cập nhật các dòng đơn hàng trong bảng nếu rút
  if (EscrowState.selectedOrderId) {
    markOrderAsWithdrawn(EscrowState.selectedOrderId);
  } else if (EscrowState.escrowAvailable === 0) {
    // Nếu rút hết sạch khả dụng, đánh dấu toàn bộ đơn available là đã giải ngân
    markOrderAsWithdrawn('ORD-90214');
    markOrderAsWithdrawn('ORD-90185');
  }

  // 5. Cập nhật UI
  updateUIBalanceDisplays();
  closeEscrowWithdrawModal();

  // 6. Hiển thị thông báo Toast thành công rực rỡ
  const newRemaining = EscrowState.dailyLimit - EscrowState.dailyUsed;
  if (typeof showToast === 'function') {
    showToast(
      `Đã gửi yêu cầu rút thành công +${formatMoney(withdrawAmount)} ₫ về tài khoản ngân hàng liên kết! Số lượt rút còn lại hôm nay: ${newRemaining}/3`,
      'success'
    );
  }

  // 7. Hiệu ứng flash cho số dư ví chính
  const mainWalletEl = document.getElementById('mainWalletAmount');
  if (mainWalletEl) {
    mainWalletEl.style.color = '#10b981';
    mainWalletEl.style.transition = 'color 0.5s ease';
    setTimeout(() => {
      mainWalletEl.style.color = '';
    }, 1500);
  }
}

/**
 * Đánh dấu một đơn hàng đã được giải ngân thủ công về ví chính
 */
function markOrderAsWithdrawn(orderId) {
  const row = document.getElementById(`row-${orderId}`);
  if (!row) return;

  const statusBadge = row.querySelector('.status-cell-badge');
  if (statusBadge) {
    statusBadge.className = 'badge badge-outline';
    statusBadge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; color: #10b981;">done_all</span> Đã chuyển vào Ví chính`;
  }

  const actionBtn = row.querySelector('.action-withdraw-btn');
  if (actionBtn) {
    actionBtn.className = 'btn btn-outline btn-sm';
    actionBtn.disabled = true;
    actionBtn.innerHTML = `Đã tất toán`;
  }

  // Cập nhật số đếm trên tab
  const countAvailable = document.getElementById('countAvailable');
  if (countAvailable) {
    countAvailable.innerHTML = `Còn ${formatMoney(EscrowState.escrowAvailable)} ₫`;
  }
}

/**
 * Bộ lọc danh sách bảng theo Tabs
 * @param {'all'|'available'|'pending'} filterType 
 */
function setEscrowTab(filterType) {
  EscrowState.currentFilter = filterType;

  // Active tab button
  const tabBtns = document.querySelectorAll('.escrow-tab-btn');
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-filter') === filterType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  filterEscrowTable();
}

/**
 * Lọc bảng kết hợp giữa tab hiện tại và từ khóa tìm kiếm
 */
function filterEscrowTable() {
  const searchInput = document.getElementById('tableSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const rows = document.querySelectorAll('#escrowOrdersTable tbody tr');
  let matchCount = 0;

  rows.forEach(row => {
    const rowStatus = row.getAttribute('data-status');
    const textContent = row.textContent.toLowerCase();

    // Check Tab Match
    const matchesTab = (EscrowState.currentFilter === 'all') || (rowStatus === EscrowState.currentFilter);
    // Check Search Match
    const matchesSearch = !query || textContent.includes(query);

    if (matchesTab && matchesSearch) {
      row.style.display = '';
      matchCount++;
    } else {
      row.style.display = 'none';
    }
  });

  // Cập nhật thông tin phân trang
  const paginationInfo = document.getElementById('tablePaginationInfo');
  if (paginationInfo) {
    paginationInfo.innerHTML = `Hiển thị <strong>${matchCount} / 5</strong> đơn hàng theo bộ lọc`;
  }
}

/**
 * Tiến độ đếm ngược cho đơn đang thẩm định
 */
function initEscrowCountdown() {
  const pendingRow = document.getElementById('row-ORD-89942');
  if (pendingRow) {
    const timeCell = pendingRow.querySelector('td:nth-child(5)');
    if (timeCell && !timeCell.querySelector('.escrow-countdown-box')) {
      const countdownBox = document.createElement('div');
      countdownBox.className = 'escrow-countdown-box';
      countdownBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
          <span style="color: #ea580c; font-weight: 700;">Đã an toàn 70%</span>
          <span>50/72h</span>
        </div>
        <div class="countdown-track">
          <div class="countdown-fill" style="width: 70%;"></div>
        </div>
      `;
      timeCell.appendChild(countdownBox);
    }
  }
}

/**
 * Tooltip giải thích các trạng thái
 */
function initEscrowTooltips() {
  const pendingLabel = document.querySelector('.wallet-card.escrow-pending .wallet-amount-label');
  if (pendingLabel && !pendingLabel.querySelector('.tooltip-container')) {
    pendingLabel.style.display = 'inline-flex';
    pendingLabel.style.alignItems = 'center';
    pendingLabel.style.gap = '6px';
    pendingLabel.innerHTML += `
      <span class="tooltip-container">
        <span class="material-symbols-outlined" style="font-size: 16px; color: #ea580c; cursor: pointer;">help</span>
        <span class="tooltip-bubble">
          <strong>Vì sao chưa rút được?</strong><br>
          Bao gồm đơn đang vận chuyển hoặc đang trong 72h đồng kiểm. Sau khi an toàn, tiền chuyển sang Số dư khả dụng và người bán tự thao tác rút thủ công.
        </span>
      </span>
    `;
  }
}

/**
 * Lắng nghe click ngoài backdrop để đóng modal
 */
function setupModalBackdropListener() {
  const modal = document.getElementById('escrowWithdrawModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEscrowWithdrawModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEscrowWithdrawModal();
    }
  });
}

/**
 * Helper: Format số tiền theo định dạng Việt Nam (1.000.000)
 */
function formatMoney(num) {
  return (num || 0).toLocaleString('vi-VN');
}
