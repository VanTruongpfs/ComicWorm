/**
 * BookMooch - Shared Utilities & Mock Data Engine for Seller Module
 * Designed specifically for Trường T (Seller: Bài đăng & Sản phẩm)
 */

// Key constants in LocalStorage
const STORAGE_KEYS = {
  POSTS: 'BOOKMOOCH_SELLER_POSTS_V1',
  PRODUCTS: 'BOOKMOOCH_SELLER_PRODUCTS_V1',
  VOUCHERS: 'BOOKMOOCH_SELLER_VOUCHERS_V1'
};

// Initial Mock Posts Data
const DEFAULT_POSTS = [
  {
    id: "POST-001",
    title: "One Piece - Tập 100 (Bản Đặc Biệt Bìa Rời)",
    author: "Eiichiro Oda",
    category: "Manga Shounen",
    volume: "Tập 100",
    publisher: "NXB Kim Đồng",
    year: 2022,
    condition: "Mới 100% Nguyên Seal",
    price: 65000,
    originalPrice: 80000,
    stock: 15,
    views: 450,
    isTradeable: false,
    status: "active", // active | pending | hidden | out_of_stock
    hideReason: "",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=60",
    description: "Tập 100 kỷ niệm One Piece, bản đặc biệt có poster và obi bìa gập đi kèm. Sách mới 100% bọc màng co nguyên vẹn, góc cạnh vuông vức.",
    weight: 250,
    dimensions: "13x19x1.5 cm",
    createdAt: "2026-09-10"
  },
  {
    id: "POST-002",
    title: "Thám Tử Lừng Danh Conan - Trọn bộ 10 tập Bản Màu",
    author: "Gosho Aoyama",
    category: "Trinh thám / Mystery",
    volume: "Bộ 1-10",
    publisher: "NXB Kim Đồng",
    year: 2023,
    condition: "Like New 99% (Đã đọc 1 lần)",
    price: 320000,
    originalPrice: 400000,
    stock: 3,
    views: 890,
    isTradeable: true,
    status: "active",
    hideReason: "",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=60",
    description: "Bộ truyện màu Conan tuyển chọn các vụ án đặc sắc. Giấy bóng in màu chất lượng cao, không rách gáy, nhận trao đổi với bộ Bleach tương đương.",
    weight: 1200,
    dimensions: "15x20x10 cm",
    createdAt: "2026-09-12"
  },
  {
    id: "POST-003",
    title: "Chú Thuật Hồi Chiến (Jujutsu Kaisen) - Tập 0 đến 15",
    author: "Gege Akutami",
    category: "Hành động / Siêu nhiên",
    volume: "Tập 0-15",
    publisher: "NXB Kim Đồng",
    year: 2024,
    condition: "95% Giữ gìn cẩn thận",
    price: 450000,
    originalPrice: 550000,
    stock: 2,
    views: 620,
    isTradeable: true,
    status: "pending",
    hideReason: "",
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&auto=format&fit=crop&q=60",
    description: "Tập 0 đến 15 đầy đủ bookmark quà tặng theo từng tập. Bài đăng đang chờ BQT kiểm duyệt nội dung theo chính sách bảo hộ bản quyền.",
    weight: 1800,
    dimensions: "13x19x15 cm",
    createdAt: "2026-09-15"
  },
  {
    id: "POST-004",
    title: "Doraemon Truyện Dài - Trọn Bộ 24 Tập Màu",
    author: "Fujiko F. Fujio",
    category: "Hài hước / Thiếu nhi",
    volume: "Trọn bộ 24 tập",
    publisher: "NXB Kim Đồng",
    year: 2021,
    condition: "90% Giấy ngả vàng nhẹ thời gian",
    price: 480000,
    originalPrice: 600000,
    stock: 0,
    views: 1420,
    isTradeable: false,
    status: "out_of_stock",
    hideReason: "",
    image: "https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=300&auto=format&fit=crop&q=60",
    description: "Bộ truyện tuổi thơ huyền thoại, đầy đủ các chuyến phiêu lưu thám hiểm. Hiện kho tạm hết sách, đang chờ gom thêm từ cộng đồng trao đổi.",
    weight: 2400,
    dimensions: "14x20x18 cm",
    createdAt: "2026-08-20"
  },
  {
    id: "POST-005",
    title: "Spy x Family - Tập 1 đến 11 Kèm Postcard Limited",
    author: "Tatsuya Endo",
    category: "Hài hước / Gia đình",
    volume: "Tập 1-11",
    publisher: "NXB Kim Đồng",
    year: 2023,
    condition: "Mới 98%",
    price: 360000,
    originalPrice: 420000,
    stock: 1,
    views: 510,
    isTradeable: true,
    status: "hidden",
    hideReason: "Đang thương lượng trao đổi riêng với khách hàng tại Hà Nội",
    image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&auto=format&fit=crop&q=60",
    description: "Gia đình Forger siêu đáng yêu. Đang tạm ẩn do có khách đặt gạch trao đổi trực tiếp, sẽ mở lại nếu deal không thành công.",
    weight: 1100,
    dimensions: "13x18x10 cm",
    createdAt: "2026-09-02"
  },
  {
    id: "POST-006",
    title: "Thanh Gươm Diệt Quỷ (Kimetsu no Yaiba) - Boxset 23 Tập",
    author: "Koyoharu Gotouge",
    category: "Manga Shounen",
    volume: "Boxset Full 23 tập",
    publisher: "NXB Kim Đồng",
    year: 2022,
    condition: "Mới 100% Hộp Boxset nguyên vẹn",
    price: 790000,
    originalPrice: 950000,
    stock: 4,
    views: 2100,
    isTradeable: false,
    status: "active",
    hideReason: "",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=60",
    description: "Bộ Boxset cao cấp, có kèm hộp cứng và toàn bộ phụ kiện độc quyền, thích hợp cho người sưu tầm.",
    weight: 2900,
    dimensions: "22x30x18 cm",
    createdAt: "2026-09-05"
  }
];

// Initial Mock Products Inventory Data
const DEFAULT_PRODUCTS = [
  {
    sku: "MANGA-OP-100",
    isbn: "978-604-2-28100-1",
    name: "One Piece - Tập 100 Bìa Rời",
    category: "Shounen",
    format: "Bản đặc biệt",
    costPrice: 42000,
    sellingPrice: 65000,
    stockQty: 15,
    minStockWarning: 5,
    supplier: "Kim Đồng Distribution",
    status: "in_stock", // in_stock | low_stock | out_of_stock
    lastRestocked: "2026-09-01",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=60"
  },
  {
    sku: "MANGA-CONAN-COL",
    isbn: "978-604-2-19283-4",
    name: "Conan Bản Màu Đặc Biệt",
    category: "Trinh thám",
    format: "Bìa mềm màu",
    costPrice: 220000,
    sellingPrice: 320000,
    stockQty: 3,
    minStockWarning: 5,
    supplier: "Thu mua lại từ Reader",
    status: "low_stock",
    lastRestocked: "2026-09-08",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=60"
  },
  {
    sku: "MANGA-JJK-SET",
    isbn: "978-604-2-24519-5",
    name: "Chú Thuật Hồi Chiến Bộ 0-15",
    category: "Hành động",
    format: "Bìa gập kèm Bookmark",
    costPrice: 310000,
    sellingPrice: 450000,
    stockQty: 2,
    minStockWarning: 3,
    supplier: "Ký gửi cá nhân",
    status: "low_stock",
    lastRestocked: "2026-09-11",
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&auto=format&fit=crop&q=60"
  },
  {
    sku: "MANGA-DORA-24",
    isbn: "978-604-2-00124-7",
    name: "Doraemon Truyện Dài 24 Tập",
    category: "Thiếu nhi",
    format: "Bìa mềm truyền thống",
    costPrice: 350000,
    sellingPrice: 480000,
    stockQty: 0,
    minStockWarning: 2,
    supplier: "Kho truyện cũ SG",
    status: "out_of_stock",
    lastRestocked: "2026-08-15",
    image: "https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=300&auto=format&fit=crop&q=60"
  },
  {
    sku: "MANGA-SPY-11",
    isbn: "978-604-2-31011-4",
    name: "Spy x Family Set 1-11",
    category: "Hài hước",
    format: "Bản giới hạn",
    costPrice: 250000,
    sellingPrice: 360000,
    stockQty: 1,
    minStockWarning: 2,
    supplier: "Kim Đồng Distribution",
    status: "low_stock",
    lastRestocked: "2026-08-28",
    image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&auto=format&fit=crop&q=60"
  },
  {
    sku: "MANGA-KMY-BOX",
    isbn: "978-604-2-22923-0",
    name: "Kimetsu no Yaiba Boxset 23 Tập",
    category: "Shounen",
    format: "Boxset Hardcover",
    costPrice: 580000,
    sellingPrice: 790000,
    stockQty: 4,
    minStockWarning: 2,
    supplier: "NXB Kim Đồng",
    status: "in_stock",
    lastRestocked: "2026-09-02",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=60"
  }
];

// Initial Mock Vouchers Data
const DEFAULT_VOUCHERS = [
  {
    id: "VOUCHER-01",
    code: "MOOCH10K",
    title: "Giảm ngay 10.000đ cho đơn truyện từ 150.000đ",
    type: "fixed", // 'fixed' | 'percent'
    value: 10000,
    maxDiscount: 10000,
    minOrderValue: 150000,
    totalQuantity: 100,
    usedQuantity: 42,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    status: "active" // active | paused | expired
  },
  {
    id: "VOUCHER-02",
    code: "MANGA15",
    title: "Ưu đãi 15% khi mua từ 2 bộ truyện",
    type: "percent",
    value: 15,
    maxDiscount: 45000,
    minOrderValue: 300000,
    totalQuantity: 50,
    usedQuantity: 38,
    startDate: "2026-09-05",
    endDate: "2026-09-25",
    status: "active"
  },
  {
    id: "VOUCHER-03",
    code: "FREESHIP20",
    title: "Hỗ trợ 20k phí vận chuyển GHN đơn từ 200k",
    type: "fixed",
    value: 20000,
    maxDiscount: 20000,
    minOrderValue: 200000,
    totalQuantity: 80,
    usedQuantity: 80,
    startDate: "2026-08-15",
    endDate: "2026-09-15",
    status: "expired"
  },
  {
    id: "VOUCHER-04",
    code: "VIPREAD50",
    title: "Tri ân thành viên VIP giảm 50.000đ cho đơn 500k",
    type: "fixed",
    value: 50000,
    maxDiscount: 50000,
    minOrderValue: 500000,
    totalQuantity: 30,
    usedQuantity: 7,
    startDate: "2026-09-20",
    endDate: "2026-10-10",
    status: "upcoming"
  }
];

// Data Access Layer
function getStoredData(key, defaultData) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Lỗi đọc LocalStorage", e);
    return defaultData;
  }
}

function saveStoredData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Lỗi ghi LocalStorage", e);
  }
}

// Data Methods
const DataStore = {
  getPosts: () => getStoredData(STORAGE_KEYS.POSTS, DEFAULT_POSTS),
  savePosts: (posts) => saveStoredData(STORAGE_KEYS.POSTS, posts),
  
  getProducts: () => {
    const products = getStoredData(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    let updated = false;
    const defaultImgMap = {
      'MANGA-OP-100': 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=60',
      'MANGA-CONAN-COL': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=60',
      'MANGA-JJK-SET': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&auto=format&fit=crop&q=60',
      'MANGA-DORA-24': 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=300&auto=format&fit=crop&q=60',
      'MANGA-SPY-11': 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=300&auto=format&fit=crop&q=60',
      'MANGA-KMY-BOX': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=60',
    };
    products.forEach((p, index) => {
      if (!p.image) {
        p.image = defaultImgMap[p.sku] || DEFAULT_PRODUCTS[index % DEFAULT_PRODUCTS.length]?.image || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300';
        updated = true;
      }
    });
    if (updated) {
      saveStoredData(STORAGE_KEYS.PRODUCTS, products);
    }
    return products;
  },
  saveProducts: (products) => saveStoredData(STORAGE_KEYS.PRODUCTS, products),
  
  getVouchers: () => getStoredData(STORAGE_KEYS.VOUCHERS, DEFAULT_VOUCHERS),
  saveVouchers: (vouchers) => saveStoredData(STORAGE_KEYS.VOUCHERS, vouchers),

  // Reset to default sample data
  resetAll: () => {
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(DEFAULT_POSTS));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(DEFAULT_VOUCHERS));
  }
};

// Toast notification helper
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 20px;">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Format currency VND helper
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Quick switcher active state helper
document.addEventListener('DOMContentLoaded', () => {
  // Ensure container exists
  if (!document.getElementById('toastContainer')) {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
});

