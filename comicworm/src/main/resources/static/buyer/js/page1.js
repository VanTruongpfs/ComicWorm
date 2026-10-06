document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("manga-bounty-form");
  const submitButton = document.getElementById("submit-button");
  const saveDraftButton = document.getElementById("save-draft-button");
  const textarea = document.getElementById("post-description");
  const toast = document.getElementById("toast");

  /* =========================
     HELPERS
  ========================= */

  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  function getButtonOriginalHTML(button) {
    return button ? button.dataset.originalHtml || button.innerHTML : "";
  }

  /* =========================
     ACTIVE NAVIGATION
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

  document.querySelectorAll("[data-path]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const path = link.dataset.path;
      if (pathMap[path] && path !== "dang-tin-tim-mua") {
        window.location.href = pathMap[path];
        return;
      }
      document.querySelectorAll("[data-path]").forEach((item) => {
        item.classList.remove("active");
      });
      document
        .querySelectorAll(`[data-path="${path}"]`)
        .forEach((item) => item.classList.add("active"));
    });
  });

  /* =========================
     QUICK TAGS
  ========================= */

  document.querySelectorAll(".quick-tag").forEach((tagButton) => {
    tagButton.addEventListener("click", () => {
      if (!textarea) return;

      const textToAdd = tagButton.dataset.tag?.trim();

      if (!textToAdd) return;

      if (textarea.value.includes(textToAdd)) {
        tagButton.classList.add("active");
        showToast(`Yêu cầu "${textToAdd}" đã có trong mô tả.`);
        return;
      }

      const currentText = textarea.value.trim();

      textarea.value = currentText
        ? `${currentText} | Có yêu cầu: ${textToAdd}.`
        : `Có yêu cầu: ${textToAdd}.`;

      tagButton.classList.add("active");

      showToast(`Đã thêm yêu cầu: ${textToAdd}`);
    });
  });

  /* =========================
     SCOPE RADIO
  ========================= */

  document.querySelectorAll('input[name="scope-type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      showToast(`Đã chọn hình thức: ${getRadioLabel(radio)}`);
    });
  });

  function getRadioLabel(radio) {
    const label = radio.closest("label");

    if (!label) return radio.value;

    const span = label.querySelector("span");

    return span ? span.textContent.trim() : radio.value;
  }

  /* =========================
     CONDITION
  ========================= */

  document.querySelectorAll('input[name="condition"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      showToast(`Đã chọn tình trạng: ${getRadioLabel(radio)}`);
    });
  });

  /* =========================
     VIP TIER
  ========================= */

  document.querySelectorAll('input[name="vip-tier"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const label = radio.closest(".vip-option");
      const name = label?.querySelector("strong");

      if (name) {
        showToast(`Đã chọn: ${name.textContent.trim()}`);
      }
    });
  });

  /* =========================
     PRICE VALIDATION
  ========================= */

  const minPrice = document.getElementById("price-min");
  const maxPrice = document.getElementById("price-max");

  function validatePriceRange() {
    if (!minPrice || !maxPrice) return true;

    const min = Number(minPrice.value);
    const max = Number(maxPrice.value);

    if (!min || !max) return true;

    if (min > max) {
      maxPrice.setCustomValidity(
        "Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu."
      );
      return false;
    }

    maxPrice.setCustomValidity("");
    return true;
  }

  minPrice?.addEventListener("input", validatePriceRange);
  maxPrice?.addEventListener("input", validatePriceRange);

  /* =========================
     SUGGEST NAME
  ========================= */

  const suggestButton = document.getElementById("suggest-name-button");
  const seriesInput = document.getElementById("series-name");

  suggestButton?.addEventListener("click", () => {
    if (!seriesInput) return;

    if (!seriesInput.value.trim()) {
      seriesInput.value = "One Piece Tập 100 Bản Giới Hạn bìa gập vàng";
    }

    showToast("Đã áp dụng gợi ý tên tác phẩm.");
  });

  /* =========================
     IMAGE UPLOAD
  ========================= */

  const uploadButton = document.getElementById("upload-button");
  const imageInput = document.getElementById("image-input");

  uploadButton?.addEventListener("click", () => {
    imageInput?.click();
  });

  imageInput?.addEventListener("change", () => {
    const files = Array.from(imageInput.files || []);

    if (!files.length) return;

    if (files.length > 5) {
      showToast("Bạn chỉ có thể chọn tối đa 5 ảnh.");
      imageInput.value = "";
      return;
    }

    const invalidFile = files.find((file) => {
      const validType =
        file.type === "image/jpeg" || file.type === "image/png";
      const validSize = file.size <= 5 * 1024 * 1024;

      return !validType || !validSize;
    });

    if (invalidFile) {
      showToast("Ảnh phải là PNG/JPG và có dung lượng dưới 5MB.");
      imageInput.value = "";
      return;
    }

    showToast(`Đã chọn ${files.length} ảnh.`);
  });

  /* =========================
     REMOVE PREVIEW
  ========================= */

  document.querySelectorAll(".remove-image").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const preview = button.closest(".image-preview");

      if (!preview) return;

      preview.remove();

      showToast("Đã xóa ảnh khỏi danh sách.");
    });
  });

  /* =========================
     SAVE DRAFT
  ========================= */

  saveDraftButton?.addEventListener("click", () => {
    const formData = new FormData(form);

    const draft = {
      seriesName: formData.get("seriesName") || "",
      scopeType:
        document.querySelector('input[name="scope-type"]:checked')?.value || "",
      condition:
        document.querySelector('input[name="condition"]:checked')?.value || "",
      priceMin: minPrice?.value || "",
      priceMax: maxPrice?.value || "",
      negotiable:
        document.getElementById("price-negotiable")?.checked || false,
      genre: document.getElementById("genre-select")?.value || "",
      publisher: document.getElementById("publisher-select")?.value || "",
      city: document.getElementById("city-target")?.value || "",
      description: textarea?.value || "",
      vipTier:
        document.querySelector('input[name="vip-tier"]:checked')?.value || "",
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(
        "mangaTradeBountyDraft",
        JSON.stringify(draft)
      );

      showToast("Đã lưu bản nháp thành công.");
    } catch (error) {
      console.error("Không thể lưu bản nháp:", error);
      showToast("Không thể lưu bản nháp trên trình duyệt.");
    }
  });

  /* =========================
     LOAD DRAFT
  ========================= */

  function loadDraft() {
    try {
      const savedDraft = localStorage.getItem("mangaTradeBountyDraft");

      if (!savedDraft) return;

      const draft = JSON.parse(savedDraft);

      if (seriesInput && draft.seriesName) {
        seriesInput.value = draft.seriesName;
      }

      if (textarea && draft.description) {
        textarea.value = draft.description;
      }

      if (minPrice && draft.priceMin) {
        minPrice.value = draft.priceMin;
      }

      if (maxPrice && draft.priceMax) {
        maxPrice.value = draft.priceMax;
      }

      if (draft.negotiable !== undefined) {
        const checkbox = document.getElementById("price-negotiable");

        if (checkbox) {
          checkbox.checked = draft.negotiable;
        }
      }

      setSelectValue("genre-select", draft.genre);
      setSelectValue("publisher-select", draft.publisher);
      setSelectValue("city-target", draft.city);
      setRadioValue("scope-type", draft.scopeType);
      setRadioValue("condition", draft.condition);
      setRadioValue("vip-tier", draft.vipTier);
    } catch (error) {
      console.error("Không thể đọc bản nháp:", error);
    }
  }

  function setSelectValue(id, value) {
    if (!value) return;

    const select = document.getElementById(id);

    if (!select) return;

    const exists = Array.from(select.options).some(
      (option) => option.value === value
    );

    if (exists) {
      select.value = value;
    }
  }

  function setRadioValue(name, value) {
    if (!value) return;

    const radio = document.querySelector(
      `input[name="${name}"][value="${value}"]`
    );

    if (radio) {
      radio.checked = true;
    }
  }

  loadDraft();

  /* =========================
     SUBMIT SIMULATION
  ========================= */

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!validatePriceRange()) {
      maxPrice?.reportValidity();
      return;
    }

    if (!submitButton) return;

    if (!submitButton.dataset.originalHtml) {
      submitButton.dataset.originalHtml = submitButton.innerHTML;
    }

    const originalHtml = getButtonOriginalHTML(submitButton);

    submitButton.disabled = true;
    submitButton.classList.remove("btn-success");
    submitButton.classList.add("btn-primary");

    submitButton.innerHTML = `
      <span class="material-symbols-outlined spin">refresh</span>
      <span>Đang đẩy tin lên sàn...</span>
    `;

    setTimeout(() => {
      submitButton.innerHTML = `
        <span class="material-symbols-outlined">check</span>
        <span>Đã Đăng Thành Công!</span>
      `;

      submitButton.classList.remove("btn-primary");
      submitButton.classList.add("btn-success");

      showToast("Tin tìm mua đã được đăng thành công.");

      setTimeout(() => {
        submitButton.innerHTML = originalHtml;
        submitButton.disabled = false;
        submitButton.classList.remove("btn-success");
        submitButton.classList.add("btn-primary");
      }, 3000);
    }, 1200);
  });

  /* =========================
     NEWSLETTER
  ========================= */

  const newsletterButton = document.getElementById("newsletter-button");

  newsletterButton?.addEventListener("click", () => {
    const newsletterInput =
      document.querySelector(".newsletter input");

    const email = newsletterInput?.value.trim();

    if (!email) {
      showToast("Vui lòng nhập email.");
      newsletterInput?.focus();
      return;
    }

    if (!newsletterInput.checkValidity()) {
      showToast("Email chưa đúng định dạng.");
      newsletterInput.focus();
      return;
    }

    showToast("Đã đăng ký nhận bản tin thành công.");
    newsletterInput.value = "";
  });
});
