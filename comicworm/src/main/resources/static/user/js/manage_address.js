function setFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.setAttribute("aria-invalid", String(Boolean(message)));
    if (errorEl) errorEl.textContent = message;
}

function showToast(message, type = "error") {
    const region = document.querySelector("[data-toast-region]");
    if (!region) return;
    region.replaceChildren();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4000);
}

const STORAGE_KEY = "bookmooch_addresses";
const form = document.querySelector("#address-form");
const formCard = document.querySelector("[data-address-form-card]");
const list = document.querySelector("[data-address-list]");
const formTitle = document.querySelector("[data-form-title]");
const fields = Object.fromEntries(["id", "recipientName", "phone", "province", "district", "ward", "addressDetail", "isDefault"].map((name) => [name, form.elements[name]]));
const readAddresses = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const writeAddresses = (addresses) => localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
const addressText = (item) => `${item.addressDetail}, ${item.ward}, ${item.district}, ${item.province}`;

function render() {
    const addresses = readAddresses();
    list.replaceChildren();
    if (!addresses.length) { list.innerHTML = "<p class='empty-state'>Bạn chưa lưu địa chỉ nào.</p>"; return; }
    addresses.forEach((item) => {
        const card = document.createElement("article");
        card.className = `address-card ${item.isDefault ? "default" : ""}`;
        card.innerHTML = `<header><div><h2>${item.recipientName}</h2><p class="phone">${item.phone}</p></div>${item.isDefault ? "<span class='default-label'>Mặc định</span>" : ""}</header><p class="address-text">${addressText(item)}</p><div class="address-actions"><button class="button secondary" type="button" data-edit="${item.id}">Chỉnh sửa</button>${item.isDefault ? "" : `<button class="button secondary" type="button" data-default="${item.id}">Đặt mặc định</button>`}<button class="button secondary danger" type="button" data-delete="${item.id}">Xóa</button></div>`;
        list.append(card);
    });
}

function openForm(item = null) {
    form.reset();
    fields.id.value = item?.id || "";
    ["recipientName", "phone", "province", "district", "ward", "addressDetail"].forEach((name) => { fields[name].value = item?.[name] || ""; });
    fields.isDefault.checked = Boolean(item?.isDefault);
    formTitle.textContent = item ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới";
    formCard.hidden = false;
    form.querySelector("input:not([type='hidden'])").focus();
}
function closeForm() { formCard.hidden = true; }

document.querySelectorAll("[data-open-address-form]").forEach((button) => button.addEventListener("click", () => openForm()));
document.querySelectorAll("[data-close-address-form]").forEach((button) => button.addEventListener("click", closeForm));

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const required = ["recipientName", "phone", "province", "district", "ward", "addressDetail"];
    const missing = required.find((name) => !values[name]?.trim());
    setFieldError(form.elements[missing || "recipientName"], document.querySelector(`[data-error-for='${missing || "recipientName"}']`) || document.createElement("small"), missing ? "Vui lòng nhập đầy đủ thông tin địa chỉ." : "");
    if (missing) { const target = form.elements[missing]; target.focus(); return; }
    let addresses = readAddresses();
    const address = { id: values.id || crypto.randomUUID(), recipientName: values.recipientName.trim(), phone: values.phone.trim(), province: values.province.trim(), district: values.district.trim(), ward: values.ward.trim(), addressDetail: values.addressDetail.trim(), isDefault: fields.isDefault.checked };
    if (address.isDefault) addresses = addresses.map((item) => ({ ...item, isDefault: false }));
    const index = addresses.findIndex((item) => item.id === address.id);
    if (index >= 0) addresses[index] = address; else addresses.unshift(address);
    if (!addresses.some((item) => item.isDefault)) addresses[0].isDefault = true;
    writeAddresses(addresses); closeForm(); render(); showToast("Địa chỉ đã được lưu.", "success");
});

list.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const id = button.dataset.edit || button.dataset.default || button.dataset.delete;
    let addresses = readAddresses();
    const item = addresses.find((address) => address.id === id);
    if (button.dataset.edit) openForm(item);
    if (button.dataset.default) { addresses = addresses.map((address) => ({ ...address, isDefault: address.id === id })); writeAddresses(addresses); render(); showToast("Đã chọn địa chỉ mặc định.", "success"); }
    if (button.dataset.delete) { addresses = addresses.filter((address) => address.id !== id); if (item?.isDefault && addresses[0]) addresses[0].isDefault = true; writeAddresses(addresses); render(); showToast("Địa chỉ đã được xóa.", "success"); }
});

render();
