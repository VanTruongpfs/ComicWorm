// Renders navigation from the account authenticated by the backend.
const commonGroups = [
    { title: "Tài khoản & Khám phá", items: [
        ["◈", "Trang Chủ ComicHub", "../../buyer/html/home.html"],
        ["★", "Master Portal", "../../index.html"],
        ["◉", "Hồ sơ cá nhân", "../../user/html/profile.html"],
        ["⌂", "Quản lý địa chỉ", "../../user/html/manage_address.html"],
        ["¤", "Ví & Rút tiền", "../../seller/html/wallet.html"]
    ] },
    { title: "Mua hàng & Đơn hàng", items: [
        ["+", "Đăng tin tìm mua", "../../buyer/html/page1.html"],
        ["▣", "Quản lý đơn hàng mua", "../../buyer/html/page2.html"],
        ["↗", "Trạng thái đơn hàng GHN", "../../buyer/html/page3.html"],
        ["★", "Truyện yêu thích", "../../buyer/html/page6.html"]
    ] },
    { title: "Trao đổi & Đàm phán", items: [
        ["⇄", "Phòng trao đổi giá", "../../exchange/html/dealing-room.html"],
        ["💬", "Chat đàm phán", "../../exchange/html/dealing-chat.html"],
        ["≋", "Đơn hàng trao đổi", "../../exchange/html/exchange-orders.html"]
    ] },
    { title: "Hỗ trợ & Chăm sóc", items: [
        ["!", "Gửi khiếu nại", "../../user/html/complain.html"],
        ["?", "Gửi yêu cầu hỗ trợ", "../../user/html/request_support.html"],
        ["◷", "Đánh giá truyện", "../../buyer/html/page4.html"]
    ] }
];

const roleGroups = {
    SELLER: { title: "Giao diện Người bán", items: [
        ["◈", "Kênh Người Bán", "../../seller/html/index.html"],
        ["+", "Đăng bán truyện", "../../seller/html/dang-ban-truyen.html"],
        ["▤", "Quản lý bài đăng", "../../seller/html/quan-ly-bai-dang.html"],
        ["▦", "Quản lý sản phẩm", "../../seller/html/quan-ly-san-pham.html"],
        ["▣", "Đơn hàng bán", "../../seller/html/orders.html"],
        ["◇", "Voucher shop", "../../seller/html/quan-ly-voucher.html"],
        ["▥", "Thống kê doanh thu", "../../seller/html/revenue.html"]
    ] },
    ADMIN: { title: "Quản trị / Kiểm duyệt", items: [
        ["◆", "Admin Dashboard", "../../tu/html/dashboard.html"],
        ["✓", "Kiểm duyệt bài đăng", "../../Toan/html/postModeration.html"],
        ["!", "Khiếu nại & báo cáo", "../../Toan/html/report_resolution.html"],
        ["♙", "Quản lý tài khoản", "../../tu/html/accounts.html"],
        ["₫", "Cấu hình biểu phí", "../../tu/html/fees.html"],
        ["↥", "Bàn CSKH", "../../Toan/html/customer-support.html"]
    ] },
    MANAGER: { title: "Quản trị / Kiểm duyệt", items: [
        ["◆", "Admin Dashboard", "../../tu/html/dashboard.html"],
        ["✓", "Kiểm duyệt bài đăng", "../../Toan/html/postModeration.html"],
        ["!", "Khiếu nại & báo cáo", "../../Toan/html/report_resolution.html"],
        ["♙", "Quản lý tài khoản", "../../tu/html/accounts.html"],
        ["₫", "Cấu hình biểu phí", "../../tu/html/fees.html"],
        ["↥", "Bàn CSKH", "../../Toan/html/customer-support.html"]
    ] }
};

function renderGroup(group, currentPath) {
    const section = document.createElement("section");
    section.className = "sidebar-group";
    section.innerHTML = `<h2 class="sidebar-group-title">${group.title}</h2>`;
    const curPath = (currentPath || window.location.pathname || "").toLowerCase().replace(/\\/g, "/");
    const curFile = curPath.split("/").pop();
    group.items.forEach(([icon, label, href]) => {
        const link = document.createElement("a");
        let isActive = false;
        try {
            const targetUrl = new URL(href, window.location.href);
            const targetPath = targetUrl.pathname.toLowerCase().replace(/\\/g, "/");
            const targetFile = targetPath.split("/").pop();
            isActive = Boolean(targetFile && curFile && targetFile === curFile) || curPath.endsWith(targetPath) || curPath === targetPath;
        } catch { }
        link.className = `sidebar-link ${isActive ? "active" : ""}`;
        link.href = href;
        link.innerHTML = `<span class="sidebar-link-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
        section.append(link);
    });
    return section;
}

function logout() {
    const keysToClear = [
        "bookmooch_session",
        "bookmooch_profile",
        "bookmooch_avatar",
        "userRole",
        "userName",
        "rememberMe"
    ];
    keysToClear.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
    window.location.href = window.BookMoochAccountApi.baseUrl() + "/auth/logout";
}

async function mountSidebar(mount = document.querySelector("[data-sidebar-mount]")) {
    if (!mount) return;
    const template = `
        <aside class="app-sidebar" data-sidebar aria-label="Điều hướng chính">
            <div class="sidebar-brand">ComicHub <span>Hub</span></div>
            <div class="sidebar-profile"><span class="sidebar-avatar" data-sidebar-avatar>BM</span><div><strong data-sidebar-name>Thành viên</strong><small data-sidebar-role>BUYER</small></div></div>
            <nav data-sidebar-nav></nav>
            <button class="sidebar-logout" type="button" data-sidebar-logout>Đăng xuất</button>
        </aside>`;
    mount.innerHTML = template;
    const account = await window.BookMoochAccountApi.currentUser().catch(() => null);
    const role = account?.role === "ADMIN" ? "ADMIN" : account?.isSeller ? "SELLER" : "BUYER";
    const userName = account?.fullName || "Khách";
    const nameEl = mount.querySelector("[data-sidebar-name]");
    const roleEl = mount.querySelector("[data-sidebar-role]");
    const avatarEl = mount.querySelector("[data-sidebar-avatar]");
    const logoutButton = mount.querySelector("[data-sidebar-logout]");
    if (nameEl) nameEl.textContent = userName;
    if (roleEl) roleEl.textContent = role;
    if (avatarEl) avatarEl.textContent = userName.slice(0, 2).toUpperCase();
    if (logoutButton) logoutButton.addEventListener("click", logout);
    const currentPath = window.location.pathname;
    const navigation = mount.querySelector("[data-sidebar-nav]");
    if (navigation) {
        commonGroups.forEach((group) => navigation.append(renderGroup({ ...group,
            items: group.items.filter((item) => account?.isSeller || !item[2].includes("/seller/"))
        }, currentPath)));
        if (account?.isSeller) navigation.append(renderGroup(roleGroups.SELLER, currentPath));
        if (role === "ADMIN") navigation.append(renderGroup(roleGroups.ADMIN, currentPath));
        if (account && !account.isSeller) navigation.append(renderGroup({ title: "Kênh Người bán", items: [
            ["+", "Nâng cấp lên Người bán", window.BookMoochAccountApi.upgradeUrl()]
        ] }, currentPath));
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountSidebar());
} else {
    mountSidebar();
}

window.mountSidebar = mountSidebar;
