document.addEventListener("DOMContentLoaded", () => {
  const tabs = [...document.querySelectorAll(".order-tab-btn")];
  const cards = [...document.querySelectorAll(".order-card")];
  const searchInput = document.getElementById("search-input");
  const emptyMessage = document.getElementById("empty-message");
  const toast = document.getElementById("toast");

  let activeFilter = "all";
  let toastTimer;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  function filterOrders() {
    const keyword = (searchInput?.value || "").trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const status = card.dataset.status || "";
      const searchText = (card.dataset.search || "").toLowerCase();

      const matchesStatus =
        activeFilter === "all" || status === activeFilter;

      const matchesSearch =
        !keyword || searchText.includes(keyword);

      const visible = matchesStatus && matchesSearch;

      card.style.display = visible ? "" : "none";

      if (visible) visibleCount++;
    });

    if (emptyMessage) {
      emptyMessage.classList.toggle("show", visibleCount === 0);
    }
  }

  /* =========================
     STATUS TABS
  ========================= */

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(item => item.classList.remove("active"));
      tab.classList.add("active");

      activeFilter = tab.dataset.filter || "all";
      filterOrders();
    });
  });

  /* =========================
     SEARCH
  ========================= */

  searchInput?.addEventListener("input", filterOrders);

  window.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      document.activeElement === searchInput
    ) {
      searchInput.value = "";
      searchInput.blur();
      filterOrders();
      showToast("Đã xóa nội dung tìm kiếm.");
    }
  });

  /* =========================
     ORDER CARD SELECTION
  ========================= */

  cards.forEach(card => {
    card.addEventListener("click", event => {
      const clickedButton = event.target.closest("button, a");

      if (clickedButton) return;

      cards.forEach(item => {
        item.classList.remove("active-card");

        const oldLine = item.querySelector(".active-line");
        if (oldLine) oldLine.remove();
      });

      card.classList.add("active-card");

      const line = document.createElement("div");
      line.className = "active-line";
      card.prepend(line);

      updateDetailPanel(card);
    });
  });

  function updateDetailPanel(card) {
    const orderId = card.dataset.orderId || "ORD-8831";
    const productName =
      card.querySelector(".product-info h3")?.textContent ||
      "One Piece Tập 100";

    const detailOrderId = document.querySelector(".detail-title > span");

    if (detailOrderId) {
      detailOrderId.textContent = `#${orderId}`;
    }

    const detailProduct =
      document.querySelector(".detail-product div strong");

    if (detailProduct) {
      detailProduct.textContent = productName;
    }

    showToast(`Đã chọn đơn hàng #${orderId}`);
  }

  /* =========================
     ACTION BUTTONS
  ========================= */

  document.querySelectorAll(".remind-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      showToast("Đã gửi lời nhắc đóng gói đến người bán.");
    });
  });

  document.querySelectorAll(".cancel-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const confirmed = window.confirm(
        "Bạn có chắc muốn gửi yêu cầu hủy/đổi trả cho đơn hàng này?"
      );

      if (confirmed) {
        showToast("Yêu cầu hủy/đổi trả đã được ghi nhận.");
      }
    });
  });

  document.querySelectorAll(".review-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      showToast("Mở biểu mẫu đánh giá đơn hàng.");
    });
  });

  document.querySelectorAll(".chat-button").forEach(button => {
    button.addEventListener("click", () => {
      showToast("Đang mở cuộc trò chuyện với người bán.");
    });
  });

  document.querySelector(".close-detail")?.addEventListener("click", () => {
    showToast("Bảng chi tiết vẫn được giữ để tiện theo dõi đơn hàng.");
  });

  /* =========================
     GLOBAL NAVIGATION
  ========================= */

  const pathMap = {
    "kham-pha": "home.html",
    "dang-tin-tim-mua": "page1.html",
    "quan-ly-don-hang": "page2.html",
    "theo-doi-trang-thai": "page3.html",
    "huy-va-doi-tra": "page5.html",
    "danh-gia-truyen": "page4.html",
    "truyen-yeu-thich": "page6.html"
  };

  document.querySelectorAll("[data-path]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const path = link.dataset.path;
      if (pathMap[path] && path !== "quan-ly-don-hang") {
        window.location.href = pathMap[path];
        return;
      }
      document.querySelectorAll("[data-path]").forEach(item => {
        item.classList.remove("active");
      });
      document
        .querySelectorAll(`[data-path="${path}"]`)
        .forEach(item => item.classList.add("active"));
      showToast(`Đã chọn: ${link.textContent.trim()}`);
    });
  });

  /* =========================
     HEADER SEARCH
  ========================= */

  document.getElementById("global-search")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const value = event.currentTarget.value.trim();

      if (value) {
        searchInput.value = value;
        filterOrders();
        showToast(`Đang tìm đơn hàng với từ khóa "${value}".`);
      }
    }
  });

  /* =========================
     NEWSLETTER
  ========================= */

  document.getElementById("newsletter-button")?.addEventListener("click", () => {
    const input = document.getElementById("newsletter-email");
    const email = input?.value.trim();

    if (!email) {
      showToast("Vui lòng nhập email.");
      input?.focus();
      return;
    }

    if (!input.checkValidity()) {
      showToast("Email chưa đúng định dạng.");
      input.focus();
      return;
    }

    input.value = "";
    showToast("Đã đăng ký nhận bản tin thành công.");
  });

  filterOrders();
});
