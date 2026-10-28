document.addEventListener("DOMContentLoaded", () => {
  let currentStatus = "PENDING";
  let rejectingRequestId = null;
  let allRequests = [];

  const reqTableBody = document.getElementById("reqTableBody");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const searchInput = document.getElementById("upgradeSearchInput");

  const zoomModal = document.getElementById("zoomModal");
  const zoomImg = document.getElementById("zoomImg");
  const closeZoomBtn = document.getElementById("closeZoomBtn");

  const rejectModal = document.getElementById("rejectModal");
  const rejectReasonInput = document.getElementById("rejectReasonInput");
  const closeRejectBtn = document.getElementById("closeRejectBtn");
  const confirmRejectBtn = document.getElementById("confirmRejectBtn");

  // KPI elements
  const kpiPending = document.getElementById("kpiPendingCount");
  const kpiApproved = document.getElementById("kpiApprovedCount");
  const kpiRejected = document.getElementById("kpiRejectedCount");
  const kpiRevenue = document.getElementById("kpiTotalRevenue");

  // Tab badges
  const badgePending = document.getElementById("tabBadgePending");
  const badgeApproved = document.getElementById("tabBadgeApproved");
  const badgeRejected = document.getElementById("tabBadgeRejected");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatus = btn.dataset.status;
      loadRequests();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      if (!term) {
        renderRows(allRequests);
        return;
      }
      const filtered = allRequests.filter((r) => {
        return (
          (r.id && String(r.id).includes(term)) ||
          (r.userFullName && r.userFullName.toLowerCase().includes(term)) ||
          (r.userEmail && r.userEmail.toLowerCase().includes(term)) ||
          (r.shopName && r.shopName.toLowerCase().includes(term)) ||
          (r.transactionCode && r.transactionCode.toLowerCase().includes(term))
        );
      });
      renderRows(filtered);
    });
  }

  window.reloadCurrentList = function () {
    loadRequests();
  };

  async function loadRequests() {
    if (reqTableBody) {
      reqTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#64748b;">Đang tải danh sách yêu cầu...</td></tr>`;
    }

    try {
      // Load current filtered list
      const res = await fetch(`/api/admin/seller-upgrades?status=${currentStatus}&page=0&size=100`, {
        credentials: "include"
      });

      if (res.status === 401 || res.status === 403) {
        window.location.href = "/auth/login";
        return;
      }

      if (!res.ok) throw new Error("Không thể tải danh sách đơn nâng cấp");

      const data = await res.json();
      allRequests = data.content || [];

      if (allRequests.length === 0) {
        if (reqTableBody) {
          reqTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:40px; color:#94a3b8;">Không có yêu cầu nào trong mục này.</td></tr>`;
        }
      } else {
        renderRows(allRequests);
      }

      // Also refresh summary KPI stats in the background
      fetchStats();
    } catch (err) {
      console.error(err);
      if (reqTableBody) {
        reqTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#ef4444;">Lỗi: ${err.message}</td></tr>`;
      }
    }
  }

  async function fetchStats() {
    try {
      const resAll = await fetch(`/api/admin/seller-upgrades?status=&page=0&size=500`, {
        credentials: "include"
      });
      if (!resAll.ok) return;
      const data = await resAll.json();
      const list = data.content || [];

      let pending = 0;
      let approved = 0;
      let rejected = 0;
      let revenue = 0;

      list.forEach((r) => {
        if (r.status === "PENDING") pending++;
        else if (r.status === "APPROVED") {
          approved++;
          revenue += Number(r.feeAmount) || 0;
        } else if (r.status === "REJECTED") {
          rejected++;
        }
      });

      if (kpiPending) kpiPending.textContent = pending;
      if (kpiApproved) kpiApproved.textContent = approved;
      if (kpiRejected) kpiRejected.textContent = rejected;
      if (kpiRevenue) kpiRevenue.textContent = revenue.toLocaleString("vi-VN") + " ₫";

      if (badgePending) badgePending.textContent = pending;
      if (badgeApproved) badgeApproved.textContent = approved;
      if (badgeRejected) badgeRejected.textContent = rejected;

      // Update badge in sidebar if present
      const sideBadge = document.getElementById("sidebarUpgradeBadge");
      if (sideBadge) {
        if (pending > 0) {
          sideBadge.textContent = pending;
          sideBadge.style.display = "inline-block";
        } else {
          sideBadge.style.display = "none";
        }
      }
    } catch (e) {
      console.warn("Could not fetch stats", e);
    }
  }

  function renderRows(list) {
    if (!reqTableBody) return;
    reqTableBody.innerHTML = "";

    if (list.length === 0) {
      reqTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#94a3b8;">Không tìm thấy bản ghi phù hợp.</td></tr>`;
      return;
    }

    list.forEach((req) => {
      const tr = document.createElement("tr");

      const fromTitle = req.fromLevel === 0 ? "Khách (User)" : `Cấp ${req.fromLevel}`;
      const toTitle = `Cấp ${req.toLevel}`;

      let statusBadge = "";
      if (req.status === "PENDING") {
        statusBadge = `<span class="status-badge badge-pending">Chờ duyệt</span>`;
      } else if (req.status === "APPROVED") {
        statusBadge = `<span class="status-badge badge-approved">Đã duyệt</span>`;
      } else {
        statusBadge = `<span class="status-badge badge-rejected" title="${req.rejectionReason || ''}">Đã từ chối</span>`;
      }

      const billImg = req.paymentProofUrl
        ? `<img src="${req.paymentProofUrl}" class="bill-thumb" alt="Bill" onclick="window.zoomBill('${req.paymentProofUrl}')">`
        : `<span style="color:#94a3b8; font-size:0.8rem;">Không có</span>`;

      let actionHtml = "";
      if (req.status === "PENDING") {
        actionHtml = `
          <div style="display:flex; justify-content:flex-end; gap:6px;">
            <button class="btn-act btn-approve" onclick="window.approveUpgrade(${req.id})">Duyệt</button>
            <button class="btn-act btn-reject" onclick="window.openRejectModal(${req.id})">Từ chối</button>
          </div>
        `;
      } else if (req.status === "APPROVED") {
        actionHtml = `<div style="text-align:right;"><span style="font-size:0.8rem; font-weight:600; color:#15803d;">✓ Duyệt bởi ${req.adminName || 'Admin'}</span></div>`;
      } else {
        actionHtml = `<div style="text-align:right;"><span style="font-size:0.8rem; color:#b91c1c;" title="${req.rejectionReason || ''}">Lý do: ${req.rejectionReason || 'N/A'}</span></div>`;
      }

      const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleString("vi-VN") : "N/A";

      tr.innerHTML = `
        <td><strong style="color:#0f172a;">#${req.id}</strong></td>
        <td>
          <div style="font-weight:700; color:#0f172a;">${req.userFullName}</div>
          <div style="font-size:0.8rem; color:#64748b;">${req.userEmail}</div>
          ${req.userPhone ? `<div style="font-size:0.75rem; color:#94a3b8;">SĐT: ${req.userPhone}</div>` : ''}
        </td>
        <td>
          <strong style="color:#0f172a;">${req.shopName || 'N/A'}</strong>
          ${req.shopDescription ? `<div style="font-size:0.78rem; color:#64748b; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${req.shopDescription}</div>` : ''}
        </td>
        <td><span style="font-weight:700; color:#ea580c;">${fromTitle} &rarr; ${toTitle}</span></td>
        <td><strong style="color:#0f172a;">${Number(req.feeAmount).toLocaleString('vi-VN')} ₫</strong></td>
        <td>${billImg}</td>
        <td><code style="font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:600;">${req.transactionCode || 'N/A'}</code></td>
        <td style="font-size:0.8rem; color:#64748b;">${dateStr}</td>
        <td>${statusBadge}</td>
        <td>${actionHtml}</td>
      `;

      reqTableBody.appendChild(tr);
    });
  }

  // Zoom Bill
  window.zoomBill = function (url) {
    if (zoomImg && zoomModal) {
      zoomImg.src = url;
      zoomModal.style.display = "flex";
    }
  };

  if (closeZoomBtn) {
    closeZoomBtn.addEventListener("click", () => {
      if (zoomModal) zoomModal.style.display = "none";
    });
  }

  // Approve Upgrade
  window.approveUpgrade = async function (id) {
    if (!confirm(`Bạn có chắc chắn muốn DUYỆT yêu cầu #${id}? Người dùng sẽ được thăng cấp gian hàng ngay lập tức.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/seller-upgrades/${id}/approve`, {
        method: "POST",
        credentials: "include"
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Duyệt thất bại");
      }

      if (typeof window.showToast === "function") {
        window.showToast("✓ Đã duyệt yêu cầu nâng cấp thành công!");
      } else {
        alert("✓ Đã duyệt yêu cầu thành công!");
      }
      loadRequests();
    } catch (e) {
      alert("Lỗi khi duyệt: " + e.message);
    }
  };

  // Reject Modal
  window.openRejectModal = function (id) {
    rejectingRequestId = id;
    if (rejectReasonInput) rejectReasonInput.value = "";
    if (rejectModal) rejectModal.style.display = "flex";
  };

  if (closeRejectBtn) {
    closeRejectBtn.addEventListener("click", () => {
      if (rejectModal) rejectModal.style.display = "none";
    });
  }

  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener("click", async () => {
      if (!rejectingRequestId) return;
      const reason = rejectReasonInput ? rejectReasonInput.value.trim() : "";
      if (!reason) {
        alert("Vui lòng nhập lý do từ chối!");
        return;
      }

      try {
        const res = await fetch(`/api/admin/seller-upgrades/${rejectingRequestId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reason: reason })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Từ chối thất bại");
        }

        if (typeof window.showToast === "function") {
          window.showToast("✓ Đã từ chối yêu cầu thành công!");
        } else {
          alert("✓ Đã từ chối yêu cầu thành công!");
        }
        if (rejectModal) rejectModal.style.display = "none";
        loadRequests();
      } catch (e) {
        alert("Lỗi khi từ chối: " + e.message);
      }
    });
  }

  loadRequests();
});
