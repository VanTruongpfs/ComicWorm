/**
 * ComicHub / BookMooch - Thống kê doanh thu (Revenue Logic)
 * Phục vụ riêng cho: revenue.html
 * 
 * Tính năng chính:
 * 1. Chart.js Combo Chart: Biến động doanh thu (Bar Gradient) & Đơn hàng (Spline Curve)
 * 2. Toggle biểu đồ (Theo ngày / Theo tuần) mượt mà 60fps
 * 3. HỆ THỐNG BIỂU ĐỒ TRÒN PRO (Pie & Doughnut Charts Suite):
 *    - Biểu đồ 1: Tỷ trọng Thể loại truyện tranh (Manga / Comic Genres)
 *    - Biểu đồ 2: Cơ cấu Thanh toán & Ký quỹ Escrow ComicHub (Bảo đảm dòng tiền)
 *    - Biểu đồ 3: Tỷ trọng theo Phân khúc Giá bìa truyện (Price Tiers)
 * 4. Chuyển đổi toàn cục: Doughnut (Vành tròn) ⇄ Pie (Hình quạt)
 * 5. Chuyển đổi chỉ số: Theo Doanh thu (₫) ⇄ Theo Sản lượng (Cuốn)
 * 6. Tương tác đa chiều: Click Legend ẩn/hiện lát cắt, Hover cập nhật Center Badge động
 * 7. Modal Lọc theo ngày tùy chọn (Custom Date Range Picker) kèm presets nhanh
 * 8. Top 5 truyện bán chạy & Top 5 truyện bán ế / tồn kho lâu kèm hành động xả kho
 */

document.addEventListener('DOMContentLoaded', () => {
  initRevenueModule();
});

let mainChartInstance = null;
let genreChartInstance = null;
let campaignChartInstance = null;
let priceTierChartInstance = null;
let regionChartInstance = null;

let currentDonutType = 'doughnut'; // 'doughnut' | 'pie'
let currentDonutMetric = 'revenue'; // 'revenue' | 'qty'

let currentRegionView = 'region'; // 'region' | 'city'
let currentRegionMetric = 'revenue'; // 'revenue' | 'orders'

// Dữ liệu đa chiều cho hệ thống biểu đồ tròn
const proDonutData = {
  genre: {
    labels: ['Shonen Manga', 'Seinen & Trinh thám', 'Isekai & Kỳ ảo', 'Shojo & Romance', 'Artbook & Khác'],
    colors: ['#f97316', '#0f172a', '#8b5cf6', '#ec4899', '#0ea5e9'],
    revenue: [66.5, 41.2, 25.35, 15.84, 9.53],
    revenueFmt: ['66.500.000 ₫', '41.200.000 ₫', '25.350.000 ₫', '15.840.000 ₫', '9.530.000 ₫'],
    pcts: ['42.0%', '26.0%', '16.0%', '10.0%', '6.0%'],
    qty: [395, 215, 128, 74, 30],
    qtyFmt: ['395 cuốn', '215 cuốn', '128 cuốn', '74 cuốn', '30 cuốn'],
    centerValRev: '158.4M',
    centerLblRev: 'TỔNG GMV',
    centerValQty: '842',
    centerLblQty: 'TỔNG CUỐN'
  },
  campaign: {
    labels: ['Manga Weekend', 'Siêu Sale 10.10', 'Ra mắt Tập mới', 'Flash Sale xả kho', 'Ngày thường'],
    colors: ['#ec4899', '#f97316', '#8b5cf6', '#0ea5e9', '#64748b'],
    revenue: [60.2, 44.35, 28.51, 15.84, 9.52],
    revenueFmt: ['60.200.000 ₫', '44.350.000 ₫', '28.510.000 ₫', '15.840.000 ₫', '9.520.000 ₫'],
    pcts: ['38.0%', '28.0%', '18.0%', '10.0%', '6.0%'],
    qty: [295, 240, 135, 112, 60],
    qtyFmt: ['295 đơn', '240 đơn', '135 đơn', '112 đơn', '60 đơn'],
    centerValRev: '38.0%',
    centerLblRev: 'MANGA WEEKEND',
    centerValQty: '295',
    centerLblQty: 'ĐƠN SỰ KIỆN'
  },
  priceTier: {
    labels: ['Phổ thông (< 50k)', 'Tiêu chuẩn (50k-100k)', 'Cao cấp (100k-200k)', 'Boxset (> 200k)'],
    colors: ['#38bdf8', '#f97316', '#6366f1', '#14b8a6'],
    revenue: [28.51, 76.04, 38.02, 15.85],
    revenueFmt: ['28.510.000 ₫', '76.040.000 ₫', '38.020.000 ₫', '15.850.000 ₫'],
    pcts: ['18.0%', '48.0%', '24.0%', '10.0%'],
    qty: [310, 425, 142, 35],
    qtyFmt: ['310 cuốn', '425 cuốn', '142 cuốn', '35 cuốn'],
    centerValRev: '48.0%',
    centerLblRev: '50K - 100K',
    centerValQty: '425',
    centerLblQty: 'CUỐN TOP'
  }
};

// Dữ liệu Phân bổ Thị trường theo Khu vực & Tỉnh thành
const regionAnalyticsData = {
  region: {
    labels: ['Miền Nam', 'Miền Bắc', 'Miền Trung', 'Tây Nguyên & ĐBSCL'],
    colors: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'],
    revenue: [82.37, 49.10, 17.42, 9.51],
    revenueFmt: ['82.370.000 ₫', '49.100.000 ₫', '17.420.000 ₫', '9.510.000 ₫'],
    orders: [438, 261, 93, 50],
    ordersFmt: ['438 đơn', '261 đơn', '93 đơn', '50 đơn'],
    pcts: ['52.0%', '31.0%', '11.0%', '6.0%'],
    tags: ['Kho Tân Bình', 'Tăng trưởng +14.2%', 'Đà Nẵng & Huế', 'GHTK & Viettel'],
    deliverySpeed: ['1.2 ngày', '2.4 ngày', '2.6 ngày', '2.8 ngày'],
    successRate: ['98.4%', '96.2%', '95.8%', '94.5%'],
    topBadge: 'Miền Nam dẫn đầu 52.0%',
    insightText: 'Sức mua tại <strong>Hà Nội & Miền Bắc</strong> tăng trưởng mạnh <strong>+14.2%</strong>. Đề xuất luân chuyển thêm 500 cuốn sách hot (One Piece, Jujutsu Kaisen) sang điểm kho liên kết Long Biên để giảm thời gian phát hàng xuống còn 24h và tiết kiệm 18% phí ship liên miền.'
  },
  city: {
    labels: ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương & Đ.Nai', 'Hải Phòng & Q.Ninh', 'Cần Thơ', 'Tỉnh thành khác'],
    colors: ['#2563eb', '#7c3aed', '#d97706', '#059669', '#0891b2', '#ea580c', '#64748b'],
    revenue: [70.48, 42.77, 12.67, 11.89, 6.33, 5.54, 8.72],
    revenueFmt: ['70.480.000 ₫', '42.770.000 ₫', '12.670.000 ₫', '11.890.000 ₫', '6.330.000 ₫', '5.540.000 ₫', '8.720.000 ₫'],
    orders: [375, 227, 68, 63, 34, 30, 45],
    ordersFmt: ['375 đơn', '227 đơn', '68 đơn', '63 đơn', '34 đơn', '30 đơn', '45 đơn'],
    pcts: ['44.5%', '27.0%', '8.0%', '7.5%', '4.0%', '3.5%', '5.5%'],
    tags: ['Kho Tân Bình (Hỏa tốc 4h)', 'Tăng +14.2% • Nhu cầu cao', 'Seinen & Boxset cao', 'Mật độ KCN & ĐH cao', 'Vùng Duyên hải Bắc Bộ', 'Trung tâm ĐBSCL', 'Toàn quốc (57 tỉnh)'],
    deliverySpeed: ['0.8 ngày', '2.2 ngày', '2.5 ngày', '1.4 ngày', '2.6 ngày', '1.8 ngày', '3.2 ngày'],
    successRate: ['98.8%', '96.5%', '96.0%', '97.2%', '95.5%', '95.0%', '93.8%'],
    topBadge: 'TP.HCM dẫn đầu 44.5%',
    insightText: '<strong>TP. Hồ Chí Minh</strong> và <strong>Hà Nội</strong> chiếm tới <strong>71.5%</strong> tổng doanh số toàn sàn. Tiếp tục duy trì ưu đãi freeship đơn từ 200k và đẩy mạnh dịch vụ giao hỏa tốc 4h tại 2 siêu đô thị này.'
  }
};

function initRevenueModule() {
  initMainRevenueChart();
  initProDonutCharts();
  initRegionChart();
  updateRegionRankings();
  initTopProductsSorting();
  setupDateModalListeners();
  updateDateRangePreview();
}

/**
 * 1. BIỂU ĐỒ COMBO CHÍNH: DOANH THU & SỐ LƯỢNG ĐƠN HÀNG (CHART.JS)
 */
const mainChartData = {
  daily: {
    labels: ['Ngày 01', 'Ngày 05', 'Ngày 10', 'Ngày 15 (Sale)', 'Ngày 20', 'Ngày 25 (Hội sách)', 'Ngày 28', 'Ngày 30'],
    revenue: [3.2, 4.5, 5.8, 2.6, 5.2, 7.3, 6.1, 6.8],
    orders: [18, 26, 34, 14, 30, 48, 38, 42]
  },
  weekly: {
    labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5', 'Tuần 6 (Đỉnh)', 'Tuần 7', 'Tuần 8'],
    revenue: [28.4, 34.8, 42.1, 38.6, 46.0, 52.3, 48.9, 54.2],
    orders: [152, 190, 235, 204, 260, 310, 280, 325]
  }
};

function initMainRevenueChart() {
  const canvas = document.getElementById('mainRevenueChartCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');

  // Gradient màu cam rực rỡ cho cột doanh thu
  const barGradient = ctx.createLinearGradient(0, 0, 0, 280);
  barGradient.addColorStop(0, '#f97316');
  barGradient.addColorStop(1, '#ea580c');

  mainChartInstance = new Chart(ctx, {
    data: {
      labels: mainChartData.daily.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Doanh thu (triệu VNĐ)',
          data: mainChartData.daily.revenue,
          backgroundColor: barGradient,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 24,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Số lượng đơn hàng',
          data: mainChartData.daily.orders,
          borderColor: '#0b1c30',
          borderWidth: 3,
          backgroundColor: 'rgba(11, 28, 48, 0.04)',
          fill: true,
          tension: 0.38,
          pointBackgroundColor: '#f97316',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#ea580c',
          pointHoverBorderColor: '#ffffff',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleColor: '#fb923c',
          bodyColor: '#ffffff',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: 'bold' },
          bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          padding: 12,
          cornerRadius: 8,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          boxPadding: 4,
          callbacks: {
            label: function(context) {
              if (context.dataset.type === 'bar') {
                return `💰 Doanh thu: ${context.parsed.y} Triệu VNĐ`;
              }
              return `📦 Đơn hàng: ${context.parsed.y} đơn đã duyệt`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            callback: value => value + 'tr'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            callback: value => value + ' đơn'
          }
        }
      }
    }
  });
}

function toggleChartMode(btn, mode) {
  const container = btn.closest('.filter-tabs-bar');
  if (container) {
    container.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');

  if (!mainChartInstance) return;

  const targetData = mainChartData[mode] || mainChartData.daily;
  mainChartInstance.data.labels = targetData.labels;
  mainChartInstance.data.datasets[0].data = targetData.revenue;
  mainChartInstance.data.datasets[1].data = targetData.orders;
  mainChartInstance.update();

  if (typeof showToast === 'function') {
    showToast(`Đã chuyển biểu đồ: ${mode === 'daily' ? 'Theo ngày (30 ngày vừa qua)' : 'Theo tuần (8 tuần gần nhất)'}`, 'info');
  }
}

/**
 * 2. HỆ THỐNG BIỂU ĐỒ TRÒN PRO (PIE & DOUGHNUT CHARTS SUITE)
 */
function initProDonutCharts() {
  if (typeof Chart === 'undefined') return;

  const defaultDonutOptions = (chartKey) => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: currentDonutType === 'doughnut' ? '68%' : '0%',
    hoverOffset: 10,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 'bold' },
        bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
        callbacks: {
          label: function(context) {
            const idx = context.dataIndex;
            const dataObj = proDonutData[chartKey];
            const pct = dataObj.pcts[idx];
            const val = currentDonutMetric === 'revenue' ? dataObj.revenueFmt[idx] : dataObj.qtyFmt[idx];
            return ` ${context.label}: ${val} (${pct})`;
          }
        }
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 800
    }
  });

  // Chart 1: Thể loại truyện
  const ctxGenre = document.getElementById('genreChartCanvas');
  if (ctxGenre) {
    genreChartInstance = new Chart(ctxGenre.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: proDonutData.genre.labels,
        datasets: [{
          data: proDonutData.genre.revenue,
          backgroundColor: proDonutData.genre.colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: defaultDonutOptions('genre')
    });
  }

  // Chart 2: Sự kiện & Chiến dịch
  const ctxCampaign = document.getElementById('campaignChartCanvas');
  if (ctxCampaign) {
    campaignChartInstance = new Chart(ctxCampaign.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: proDonutData.campaign.labels,
        datasets: [{
          data: proDonutData.campaign.revenue,
          backgroundColor: proDonutData.campaign.colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: defaultDonutOptions('campaign')
    });
  }

  // Chart 3: Phân khúc giá
  const ctxPrice = document.getElementById('priceTierChartCanvas');
  if (ctxPrice) {
    priceTierChartInstance = new Chart(ctxPrice.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: proDonutData.priceTier.labels,
        datasets: [{
          data: proDonutData.priceTier.revenue,
          backgroundColor: proDonutData.priceTier.colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: defaultDonutOptions('priceTier')
    });
  }
}

/**
 * Chuyển đổi toàn cục giữa Doughnut (Vành tròn) & Pie (Hình quạt)
 */
function switchGlobalDonutType(type, btn) {
  currentDonutType = type;

  const control = document.getElementById('donutTypeControl');
  if (control) {
    control.querySelectorAll('.pill-seg-btn').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');

  const cutoutValue = type === 'doughnut' ? '68%' : '0%';
  const showCenter = type === 'doughnut';

  [genreChartInstance, campaignChartInstance, priceTierChartInstance].forEach(chart => {
    if (chart) {
      chart.options.cutout = cutoutValue;
      chart.update();
    }
  });

  // Ẩn/Hiện center badge
  ['genreCenterInfo', 'campaignCenterInfo', 'priceTierCenterInfo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = showCenter ? 'block' : 'none';
  });

  if (typeof showToast === 'function') {
    showToast(`Đã chuyển chế độ: Biểu đồ ${type === 'doughnut' ? 'Doughnut (Vành tròn)' : 'Pie (Hình quạt)'}`, 'info');
  }
}

/**
 * Chuyển đổi toàn cục giữa Doanh thu (₫) & Sản lượng (Cuốn/Đơn)
 */
function switchDonutMetric(metric, btn) {
  currentDonutMetric = metric;

  const control = document.getElementById('donutMetricControl');
  if (control) {
    control.querySelectorAll('.pill-seg-btn').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');

  const isRev = metric === 'revenue';

  // Cập nhật dữ liệu biểu đồ
  if (genreChartInstance) {
    genreChartInstance.data.datasets[0].data = isRev ? proDonutData.genre.revenue : proDonutData.genre.qty;
    genreChartInstance.update();
  }
  if (campaignChartInstance) {
    campaignChartInstance.data.datasets[0].data = isRev ? proDonutData.campaign.revenue : proDonutData.campaign.qty;
    campaignChartInstance.update();
  }
  if (priceTierChartInstance) {
    priceTierChartInstance.data.datasets[0].data = isRev ? proDonutData.priceTier.revenue : proDonutData.priceTier.qty;
    priceTierChartInstance.update();
  }

  // Cập nhật giá trị hiển thị trên Legend & Center badge
  updateDonutLegendAndCenter(isRev);

  if (typeof showToast === 'function') {
    showToast(`Đã đổi chỉ số biểu đồ: ${isRev ? 'Theo Doanh thu (VNĐ)' : 'Theo Sản lượng (Cuốn/Đơn hàng)'}`, 'info');
  }
}

function updateDonutLegendAndCenter(isRev) {
  // Chart 1
  proDonutData.genre.labels.forEach((_, idx) => {
    const el = document.getElementById(`genreVal-${idx}`);
    if (el) el.textContent = isRev ? proDonutData.genre.revenueFmt[idx] : proDonutData.genre.qtyFmt[idx];
  });
  const gVal = document.getElementById('genreCenterVal');
  const gLbl = document.getElementById('genreCenterLbl');
  if (gVal) gVal.textContent = isRev ? proDonutData.genre.centerValRev : proDonutData.genre.centerValQty;
  if (gLbl) gLbl.textContent = isRev ? proDonutData.genre.centerLblRev : proDonutData.genre.centerLblQty;

  // Chart 2: Campaign
  proDonutData.campaign.labels.forEach((_, idx) => {
    const el = document.getElementById(`campaignVal-${idx}`);
    if (el) el.textContent = isRev ? proDonutData.campaign.revenueFmt[idx] : proDonutData.campaign.qtyFmt[idx];
  });
  const cVal = document.getElementById('campaignCenterVal');
  const cLbl = document.getElementById('campaignCenterLbl');
  if (cVal) cVal.textContent = isRev ? proDonutData.campaign.centerValRev : proDonutData.campaign.centerValQty;
  if (cLbl) cLbl.textContent = isRev ? proDonutData.campaign.centerLblRev : proDonutData.campaign.centerLblQty;

  // Chart 3
  proDonutData.priceTier.labels.forEach((_, idx) => {
    const el = document.getElementById(`priceTierVal-${idx}`);
    if (el) el.textContent = isRev ? proDonutData.priceTier.revenueFmt[idx] : proDonutData.priceTier.qtyFmt[idx];
  });
  const pVal = document.getElementById('priceTierCenterVal');
  const pLbl = document.getElementById('priceTierCenterLbl');
  if (pVal) pVal.textContent = isRev ? proDonutData.priceTier.centerValRev : proDonutData.priceTier.centerValQty;
  if (pLbl) pLbl.textContent = isRev ? proDonutData.priceTier.centerLblRev : proDonutData.priceTier.centerLblQty;
}

/**
 * Click Legend để Ẩn/Hiện lát cắt trên biểu đồ tròn
 */
function toggleChartSlice(chartName, sliceIdx) {
  let chart = null;
  let legendContainerId = '';

  if (chartName === 'genre') {
    chart = genreChartInstance;
    legendContainerId = 'genreLegendList';
  } else if (chartName === 'campaign') {
    chart = campaignChartInstance;
    legendContainerId = 'campaignLegendList';
  } else if (chartName === 'priceTier') {
    chart = priceTierChartInstance;
    legendContainerId = 'priceTierLegendList';
  }

  if (!chart) return;

  chart.toggleDataVisibility(sliceIdx);
  chart.update();

  const container = document.getElementById(legendContainerId);
  if (container) {
    const items = container.querySelectorAll('.pro-legend-item');
    if (items[sliceIdx]) {
      items[sliceIdx].classList.toggle('hidden-slice');
    }
  }
}

/**
 * Hover Legend để highlight lát cắt & cập nhật Center text động
 */
function hoverChartSlice(chartName, sliceIdx, isHover) {
  if (currentDonutType !== 'doughnut') return;

  const dataObj = proDonutData[chartName];
  if (!dataObj) return;

  const centerVal = document.getElementById(`${chartName}CenterVal`);
  const centerLbl = document.getElementById(`${chartName}CenterLbl`);
  if (!centerVal || !centerLbl) return;

  if (isHover) {
    centerVal.textContent = dataObj.pcts[sliceIdx];
    centerVal.style.color = dataObj.colors[sliceIdx];
    centerLbl.textContent = dataObj.labels[sliceIdx];
  } else {
    const isRev = currentDonutMetric === 'revenue';
    centerVal.textContent = isRev ? dataObj.centerValRev : dataObj.centerValQty;
    centerVal.style.color = 'var(--text-main)';
    centerLbl.textContent = isRev ? dataObj.centerLblRev : dataObj.centerLblQty;
  }
}

/**
 * 3. CHỌN BỘ LỌC THỜI GIAN TRÊN PAGE HEADER
 */
function selectTimeFilter(btn) {
  const bar = btn.closest('.filter-tabs-bar');
  if (bar) {
    bar.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');

  const text = btn.textContent.trim();
  if (typeof showToast === 'function') {
    showToast(`Đã áp dụng bộ lọc dữ liệu: ${text}`, 'info');
  }
}

/**
 * 4. MODAL LỌC THEO NGÀY TÙY CHỌN (CUSTOM DATE RANGE PICKER)
 */
function openDateRangeModal() {
  const modal = document.getElementById('dateRangeModal');
  if (modal) {
    updateDateRangePreview();
    modal.classList.add('active');
  }
}

function closeDateRangeModal() {
  const modal = document.getElementById('dateRangeModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function applyDatePreset(preset, btn) {
  const chips = document.querySelectorAll('.modal-preset-chip');
  chips.forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const startInput = document.getElementById('filterStartDate');
  const endInput = document.getElementById('filterEndDate');
  if (!startInput || !endInput) return;

  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  let startD = new Date();
  let endD = new Date();

  switch (preset) {
    case 'today':
      startD = new Date();
      endD = new Date();
      break;
    case '7days':
      startD.setDate(today.getDate() - 7);
      break;
    case '30days':
      startD.setDate(today.getDate() - 30);
      break;
    case 'thisMonth':
      startD = new Date(today.getFullYear(), today.getMonth(), 1);
      endD = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'thisQuarter':
      const qMonth = Math.floor(today.getMonth() / 3) * 3;
      startD = new Date(today.getFullYear(), qMonth, 1);
      endD = new Date(today.getFullYear(), qMonth + 3, 0);
      break;
    case 'thisYear':
      startD = new Date(today.getFullYear(), 0, 1);
      endD = new Date(today.getFullYear(), 11, 31);
      break;
  }

  startInput.value = formatDate(startD);
  endInput.value = formatDate(endD);
  updateDateRangePreview();
}

function updateDateRangePreview() {
  const startInput = document.getElementById('filterStartDate');
  const endInput = document.getElementById('filterEndDate');
  const daysCountEl = document.getElementById('previewDaysCount');
  const estRevEl = document.getElementById('previewEstRevenue');

  if (!startInput || !endInput) return;

  const d1 = new Date(startInput.value);
  const d2 = new Date(endInput.value);

  let diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 0 || isNaN(diffDays)) {
    diffDays = 1;
  }

  const estTotal = diffDays * 5280000;

  if (daysCountEl) daysCountEl.textContent = `${diffDays} ngày`;
  if (estRevEl) estRevEl.textContent = `${estTotal.toLocaleString('vi-VN')} ₫`;
}

function confirmDateRangeFilter() {
  const startInput = document.getElementById('filterStartDate');
  const endInput = document.getElementById('filterEndDate');
  const dateRangeLabel = document.getElementById('dateRangeLabel');
  const btnCustom = document.getElementById('btnCustomDateRange');

  if (!startInput || !endInput) return;

  const d1 = new Date(startInput.value);
  const d2 = new Date(endInput.value);
  const formatDisplay = (d) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  const labelStr = `${formatDisplay(d1)} - ${formatDisplay(d2)}`;
  if (dateRangeLabel) {
    dateRangeLabel.textContent = labelStr;
  }

  const filterTabsBar = document.querySelector('.page-header .filter-tabs-bar');
  if (filterTabsBar) {
    filterTabsBar.querySelectorAll('.tab-chip').forEach(b => b.classList.remove('active'));
    if (btnCustom) btnCustom.classList.add('active');
  }

  closeDateRangeModal();

  if (typeof showToast === 'function') {
    showToast(`Đã áp dụng bộ lọc tùy chọn: ${labelStr}. Chỉ số đã được cập nhật!`, 'success');
  }

  // Trigger biểu đồ cập nhật
  if (mainChartInstance) {
    mainChartInstance.update();
  }
}

function setupDateModalListeners() {
  const modal = document.getElementById('dateRangeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDateRangeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDateRangeModal();
  });
}

/**
 * 5. CHUYỂN ĐỔI CHẾ ĐỘ XEM TRUYỆN TRANH (Tất cả / Bán chạy / Bán ế)
 */
function switchComicsView(viewType, btn) {
  const tabsContainer = document.getElementById('comicsViewTabs');
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.comics-view-tab').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');

  const cardBest = document.getElementById('cardBestSellers');
  const cardSlow = document.getElementById('cardSlowMoving');

  if (viewType === 'best') {
    if (cardBest) cardBest.style.display = 'block';
    if (cardSlow) cardSlow.style.display = 'none';
  } else if (viewType === 'slow') {
    if (cardBest) cardBest.style.display = 'none';
    if (cardSlow) cardSlow.style.display = 'block';
  } else {
    if (cardBest) cardBest.style.display = 'block';
    if (cardSlow) cardSlow.style.display = 'block';
  }
}

/**
 * 6. HÀNH ĐỘNG XẢ KHO CHO TRUYỆN BÁN Ế (SLOW-MOVING)
 */
function showClearanceAction(comicTitle, actionType, btn) {
  if (typeof showToast === 'function') {
    showToast(`Đã áp dụng chiến dịch [${actionType}] cho ${comicTitle}! Bắt đầu kích cầu xả kho.`, 'success');
  }

  const targetBtn = btn || (typeof event !== 'undefined' ? event.currentTarget : null);
  if (targetBtn) {
    targetBtn.className = 'btn btn-primary btn-sm';
    targetBtn.style.fontSize = '0.78rem';
    targetBtn.style.padding = '5px 12px';
    targetBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">check</span> Đã chạy`;
    targetBtn.disabled = true;
  }
}

/**
 * 7. SẮP XẾP BẢNG TOP SẢN PHẨM
 */
function initTopProductsSorting() {
  const tables = document.querySelectorAll('.data-table');
  tables.forEach(table => {
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, colIdx) => {
      const title = th.textContent.trim();
      if (!title || title.includes('Hạng') || title.includes('Xử lý')) return;

      th.classList.add('sortable');
      th.style.cursor = 'pointer';

      th.addEventListener('click', () => {
        const isAsc = th.classList.contains('sort-asc');
        ths.forEach(t => t.classList.remove('sort-asc', 'sort-desc'));

        if (isAsc) {
          th.classList.add('sort-desc');
        } else {
          th.classList.add('sort-asc');
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const aText = a.cells[colIdx]?.textContent.replace(/\D/g, '') || '0';
          const bText = b.cells[colIdx]?.textContent.replace(/\D/g, '') || '0';
          const aVal = parseInt(aText, 10);
          const bVal = parseInt(bText, 10);

          if (!isNaN(aVal) && !isNaN(bVal) && aVal !== bVal) {
            return !isAsc ? aVal - bVal : bVal - aVal;
          }
          return (a.cells[colIdx]?.textContent || '').localeCompare(b.cells[colIdx]?.textContent || '', 'vi');
        });

        rows.forEach(r => tbody.appendChild(r));
      });
    });
  });
}

/**
 * 8. HỆ THỐNG BIỂU ĐỒ & THỐNG KÊ DOANH THU THEO KHU VỰC (GEOGRAPHIC SALES ANALYTICS)
 */
function initRegionChart() {
  const canvas = document.getElementById('regionChartCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const dataObj = regionAnalyticsData[currentRegionView];
  const datasetValues = currentRegionMetric === 'revenue' ? dataObj.revenue : dataObj.orders;

  if (regionChartInstance) {
    regionChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  regionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dataObj.labels,
      datasets: [{
        label: currentRegionMetric === 'revenue' ? 'Doanh thu (triệu ₫)' : 'Số đơn hàng',
        data: datasetValues,
        backgroundColor: dataObj.colors,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 28,
        barPercentage: 0.72,
        categoryPercentage: 0.85
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 550,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: '700' },
          bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          padding: 12,
          cornerRadius: 8,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          boxPadding: 4,
          callbacks: {
            label: function(ctx) {
              const idx = ctx.dataIndex;
              const rev = dataObj.revenueFmt[idx];
              const ord = dataObj.ordersFmt[idx];
              const pct = dataObj.pcts[idx];
              return ` ${rev} (${ord}) • Chiếm ${pct}`;
            },
            afterLabel: function(ctx) {
              const idx = ctx.dataIndex;
              return `⚡ Phát TB: ${dataObj.deliverySpeed[idx]} • Thành công: ${dataObj.successRate[idx]}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#f1f5f9',
            drawBorder: false
          },
          ticks: {
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' },
            color: '#64748b',
            callback: function(val) {
              return currentRegionMetric === 'revenue' ? val + 'M' : val;
            }
          }
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: {
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '700' },
            color: '#334155'
          }
        }
      }
    }
  });
}

function switchRegionView(viewMode, btnEl) {
  if (currentRegionView === viewMode) return;
  currentRegionView = viewMode;

  const group = document.getElementById('regionViewControl');
  if (group) {
    group.querySelectorAll('.pill-seg-btn').forEach(b => b.classList.remove('active'));
  }
  if (btnEl) btnEl.classList.add('active');

  const titleEl = document.getElementById('regionChartTitle');
  const subEl = document.getElementById('regionChartSubtitle');
  const badgeEl = document.getElementById('regionChartBadge');
  const insightEl = document.getElementById('regionInsightText');
  const dataObj = regionAnalyticsData[currentRegionView];

  if (viewMode === 'region') {
    if (titleEl) titleEl.textContent = 'Mật độ Doanh thu theo Vùng miền';
    if (subEl) subEl.textContent = 'So sánh tỷ trọng đóng góp doanh thu giữa các khu vực địa lý';
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">location_on</span> ${dataObj.topBadge}`;
    }
  } else {
    if (titleEl) titleEl.textContent = 'Doanh số theo Top Tỉnh & Thành phố';
    if (subEl) subEl.textContent = 'Xếp hạng các đô thị có lượng tiêu thụ sách và truyện tranh lớn nhất';
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">location_city</span> ${dataObj.topBadge}`;
    }
  }

  if (insightEl) {
    insightEl.innerHTML = dataObj.insightText;
  }

  initRegionChart();
  updateRegionRankings();
}

function switchRegionMetric(metricMode, btnEl) {
  if (currentRegionMetric === metricMode) return;
  currentRegionMetric = metricMode;

  const group = document.getElementById('regionMetricControl');
  if (group) {
    group.querySelectorAll('.pill-seg-btn').forEach(b => b.classList.remove('active'));
  }
  if (btnEl) btnEl.classList.add('active');

  initRegionChart();
  updateRegionRankings();
}

function updateRegionRankings() {
  const container = document.getElementById('regionRankingList');
  if (!container) return;

  const dataObj = regionAnalyticsData[currentRegionView];
  const maxVal = Math.max(...(currentRegionMetric === 'revenue' ? dataObj.revenue : dataObj.orders));

  let html = '';
  dataObj.labels.forEach((label, idx) => {
    const valFmt = currentRegionMetric === 'revenue' ? dataObj.revenueFmt[idx] : dataObj.ordersFmt[idx];
    const rawVal = currentRegionMetric === 'revenue' ? dataObj.revenue[idx] : dataObj.orders[idx];
    const pct = dataObj.pcts[idx];
    const fillWidth = Math.round((rawVal / maxVal) * 100);
    const color = dataObj.colors[idx];
    const tag = dataObj.tags[idx];
    const speed = dataObj.deliverySpeed[idx];
    const success = dataObj.successRate[idx];

    html += `
      <div class="region-rank-item" onmouseenter="highlightRegionBar(${idx})" onmouseleave="resetRegionBar()">
        <div class="region-rank-header">
          <div class="region-rank-title-box">
            <span class="region-rank-badge" style="background-color: ${color};">${idx + 1}</span>
            <span class="region-rank-title">${label}</span>
          </div>
          <div class="region-rank-metric-box">
            <span class="region-rank-metric">${valFmt}</span>
            <span class="region-rank-pct-pill" style="color: ${color}; background-color: ${color}18;">${pct}</span>
          </div>
        </div>
        <div class="region-rank-progress-bg">
          <div class="region-rank-progress-fill" style="width: ${fillWidth}%; background-color: ${color};"></div>
        </div>
        <div class="region-rank-tags">
          <span class="rank-tag-chip">
            <span class="material-symbols-outlined" style="font-size: 13px;">schedule</span>
            ${speed}
          </span>
          <span class="rank-tag-chip success">
            <span class="material-symbols-outlined" style="font-size: 13px;">verified</span>
            ${success}
          </span>
          <span class="rank-tag-chip note" style="margin-left: auto;">
            ${tag}
          </span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function highlightRegionBar(idx) {
  if (!regionChartInstance) return;
  const activeElements = [{ datasetIndex: 0, index: idx }];
  regionChartInstance.setActiveElements(activeElements);
  regionChartInstance.tooltip.setActiveElements(activeElements, { x: 0, y: 0 });
  regionChartInstance.update();
}

function resetRegionBar() {
  if (!regionChartInstance) return;
  regionChartInstance.setActiveElements([]);
  regionChartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
  regionChartInstance.update();
}

