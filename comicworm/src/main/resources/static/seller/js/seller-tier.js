document.addEventListener("DOMContentLoaded", async () => {
  let tierInfo = null;
  let selectedTargetTier = null;
  let uploadedProofUrl = "";

  const topStoreName = document.getElementById("topStoreName");
  const heroShopName = document.getElementById("heroShopName");
  const currentTierBadge = document.getElementById("currentTierBadge");
  const tierBadgeText = document.getElementById("tierBadgeText");
  const statMaxPosts = document.getElementById("statMaxPosts");
  const statCommission = document.getElementById("statCommission");
  const statOrders = document.getElementById("statOrders");
  const tiersGrid = document.getElementById("tiersGrid");

  const pendingAlert = document.getElementById("pendingAlert");
  const pendingTitle = document.getElementById("pendingTitle");
  const pendingDesc = document.getElementById("pendingDesc");
  const rejectedAlert = document.getElementById("rejectedAlert");
  const rejectedReason = document.getElementById("rejectedReason");

  const checkoutModal = document.getElementById("checkoutModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalTitle = document.getElementById("modalTitle");
  const modalShopName = document.getElementById("modalShopName");
  const modalShopDesc = document.getElementById("modalShopDesc");
  const qrFeeAmount = document.getElementById("qrFeeAmount");
  const qrImage = document.getElementById("qrImage");
  const qrContentCode = document.getElementById("qrContentCode");
  const proofFileInput = document.getElementById("proofFileInput");
  const proofUploadStatus = document.getElementById("proofUploadStatus");
  const modalTransactionCode = document.getElementById("modalTransactionCode");
  const btnSubmitUpgrade = document.getElementById("btnSubmitUpgrade");

  async function loadData() {
    try {
      const res = await fetch("/api/seller/tier/info", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/auth/login";
        return;
      }
      if (!res.ok) throw new Error("Không thể tải thông tin cấp bậc");

      tierInfo = await res.json();
      renderTierInfo();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi kết nối máy chủ: " + err.message);
    }
  }

  function renderTierInfo() {
    if (!tierInfo) return;

    if (topStoreName) topStoreName.textContent = tierInfo.shopName || "Gian hàng";
    if (heroShopName) heroShopName.textContent = tierInfo.shopName || "Gian hàng của bạn";
    if (tierBadgeText) tierBadgeText.textContent = tierInfo.currentLevelName;
    if (currentTierBadge) {
      currentTierBadge.style.background = tierInfo.badgeColor ? `${tierInfo.badgeColor}33` : "rgba(255,255,255,0.15)";
      currentTierBadge.style.border = `1px solid ${tierInfo.badgeColor || '#fff'}`;
    }

    if (statMaxPosts) {
      statMaxPosts.textContent = tierInfo.maxPostLimit === -1
        ? "Vô hạn"
        : `${tierInfo.currentPostCount}/${tierInfo.maxPostLimit}`;
    }
    if (statCommission) statCommission.textContent = `${tierInfo.commissionRate}%`;
    if (statOrders) statOrders.textContent = tierInfo.totalCompletedOrders || 0;

    // Hiển thị trạng thái đơn PENDING nếu có
    if (tierInfo.pendingRequest) {
      pendingAlert.style.display = "flex";
      pendingTitle.textContent = `Yêu cầu lên Cấp ${tierInfo.pendingRequest.toLevel} đang chờ Admin duyệt`;
      pendingDesc.textContent = `Số tiền phí: ${Number(tierInfo.pendingRequest.feeAmount).toLocaleString('vi-VN')}₫. Mã đơn: #${tierInfo.pendingRequest.id}. Thời gian nộp: ${new Date(tierInfo.pendingRequest.createdAt).toLocaleString('vi-VN')}.`;
    } else {
      pendingAlert.style.display = "none";
    }

    // Hiển thị trạng thái REJECTED nếu có
    if (!tierInfo.pendingRequest && tierInfo.latestRequest && tierInfo.latestRequest.status === "REJECTED") {
      rejectedAlert.style.display = "flex";
      rejectedReason.textContent = `Lý do từ chối: "${tierInfo.latestRequest.rejectionReason || 'Không rõ'}". Bạn có thể kiểm tra lại biên lai và nộp lại yêu cầu.`;
    } else {
      rejectedAlert.style.display = "none";
    }

    renderTiersGrid();
  }

  function renderTiersGrid() {
    if (!tiersGrid || !tierInfo || !tierInfo.tiers) return;
    tiersGrid.innerHTML = "";

    const hasPending = Boolean(tierInfo.pendingRequest);

    tierInfo.tiers.forEach((tier) => {
      const isCurrent = tier.level === tierInfo.currentLevel;
      const isPassed = tier.level < tierInfo.currentLevel;

      const card = document.createElement("div");
      card.className = `tier-card ${isCurrent ? 'active-tier' : ''}`;

      const perksHtml = (tier.benefits || [])
        .map((b) => `<li><span class="material-symbols-outlined">check_circle</span> ${b}</li>`)
        .join("");

      let actionBtnHtml = "";
      if (isCurrent) {
        actionBtnHtml = `<button class="btn-upgrade-select disabled" disabled>Cấp độ hiện tại</button>`;
      } else if (isPassed) {
        actionBtnHtml = `<button class="btn-upgrade-select disabled" disabled>Đã đạt được</button>`;
      } else {
        const disabledAttr = hasPending ? "disabled" : "";
        const btnClass = hasPending ? "disabled" : "primary";
        const btnText = hasPending ? "Đang có đơn chờ duyệt" : `Nâng cấp lên Cấp ${tier.level}`;
        actionBtnHtml = `<button class="btn-upgrade-select ${btnClass}" data-level="${tier.level}" ${disabledAttr}>${btnText}</button>`;
      }

      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="tier-name" style="color: ${tier.badgeColor || '#1e293b'}">${tier.name}</div>
            <span class="material-symbols-outlined" style="color:${tier.badgeColor}; font-size:24px;">military_tech</span>
          </div>
          <div class="tier-fee">${Number(tier.fee).toLocaleString('vi-VN')}₫</div>
          <ul class="tier-perks">
            ${perksHtml}
            <li><span class="material-symbols-outlined">payments</span> Rút tiền: ${tier.withdrawSpeed}</li>
          </ul>
        </div>
        ${actionBtnHtml}
      `;

      const btn = card.querySelector(".btn-upgrade-select.primary");
      if (btn) {
        btn.addEventListener("click", () => openCheckout(tier));
      }

      tiersGrid.appendChild(card);
    });
  }

  function openCheckout(tier) {
    selectedTargetTier = tier;
    uploadedProofUrl = "";
    if (proofUploadStatus) proofUploadStatus.style.display = "none";
    if (proofFileInput) proofFileInput.value = "";
    if (modalTransactionCode) modalTransactionCode.value = "";

    if (modalTitle) modalTitle.textContent = `Nâng cấp lên ${tier.name}`;
    if (modalShopName) modalShopName.value = tierInfo.shopName || "";
    if (modalShopDesc) modalShopDesc.value = tierInfo.shopDescription || "";
    if (qrFeeAmount) qrFeeAmount.textContent = `${Number(tier.fee).toLocaleString('vi-VN')}₫`;

    const contentCode = `NANG_CAP_SELLER_CAP_${tier.level}`;
    if (qrContentCode) qrContentCode.textContent = contentCode;

    // VietQR quick image generator
    const qrUrl = `https://api.vietqr.io/image/970422-0393710777-compact2.png?amount=${tier.fee}&addInfo=${encodeURIComponent(contentCode)}&accountName=COMICWORM_ADMIN`;
    if (qrImage) qrImage.src = qrUrl;

    if (checkoutModal) checkoutModal.style.display = "flex";
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      if (checkoutModal) checkoutModal.style.display = "none";
    });
  }

  // Upload proof image
  if (proofFileInput) {
    proofFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        if (proofUploadStatus) {
          proofUploadStatus.style.display = "block";
          proofUploadStatus.style.color = "#3b82f6";
          proofUploadStatus.textContent = "Đang tải ảnh biên lai lên máy chủ...";
        }

        const res = await fetch("/api/seller/tier/upload-proof", {
          method: "POST",
          credentials: "include",
          body: formData
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Không thể tải ảnh lên máy chủ");
        }

        const data = await res.json();
        uploadedProofUrl = data.url;

        if (proofUploadStatus) {
          proofUploadStatus.style.color = "#10b981";
          proofUploadStatus.textContent = "✓ Tải ảnh biên lai thành công!";
        }
      } catch (err) {
        console.error(err);
        if (proofUploadStatus) {
          proofUploadStatus.style.color = "#ef4444";
          proofUploadStatus.textContent = "Lỗi tải ảnh: " + err.message;
        }
      }
    });
  }

  // Submit Upgrade Request
  if (btnSubmitUpgrade) {
    btnSubmitUpgrade.addEventListener("click", async () => {
      if (!selectedTargetTier) return;

      if (!uploadedProofUrl) {
        alert("Vui lòng tải lên ảnh chụp biên lai chuyển khoản (Bill) trước khi gửi!");
        return;
      }

      const shopNameVal = modalShopName ? modalShopName.value.trim() : "";
      if (!shopNameVal) {
        alert("Vui lòng nhập tên gian hàng / Shop!");
        return;
      }

      btnSubmitUpgrade.disabled = true;
      btnSubmitUpgrade.textContent = "Đang gửi yêu cầu...";

      try {
        const body = {
          toLevel: selectedTargetTier.level,
          shopName: shopNameVal,
          shopDescription: modalShopDesc ? modalShopDesc.value.trim() : "",
          paymentProofUrl: uploadedProofUrl,
          transactionCode: modalTransactionCode ? modalTransactionCode.value.trim() : ""
        };

        const res = await fetch("/api/seller/tier/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Gửi yêu cầu thất bại");
        }

        alert("✓ Gửi yêu cầu nâng cấp thành công! Vui lòng chờ Admin kiểm tra và duyệt trong vòng 24h.");
        if (checkoutModal) checkoutModal.style.display = "none";
        await loadData();
      } catch (err) {
        alert(err.message);
      } finally {
        btnSubmitUpgrade.disabled = false;
        btnSubmitUpgrade.textContent = "Gửi yêu cầu & Xác nhận đã chuyển khoản";
      }
    });
  }

  loadData();
});

