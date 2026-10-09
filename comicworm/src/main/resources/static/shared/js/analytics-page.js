/* UI shared by seller revenue and admin statistics; calculations live in analytics-data.js. */
(function () {
  'use strict';
  const A = window.BookMoochAnalytics;
  const colors = ['#f97316', '#2563eb', '#8b5cf6', '#10b981', '#ec4899', '#eab308', '#0891b2', '#64748b'];
  const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  const count = value => new Intl.NumberFormat('vi-VN').format(value);
  const date = value => value.split('-').reverse().join('/');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const sellerPies = [
    { id: 'genre', key: 'categories', title: 'Tỷ trọng Thể loại truyện tranh', caption: 'Phân bổ sức mua theo từng dòng manga & comic.', colors: ['#f97316', '#0f172a', '#8b5cf6', '#ec4899', '#0ea5e9'] },
    { id: 'campaign', key: 'campaigns', title: 'Hiệu quả theo Sự kiện & Chiến dịch', caption: 'Đóng góp doanh số từ các sự kiện và chiến dịch đã lưu trong đơn hàng.', colors: ['#ec4899', '#f97316', '#8b5cf6', '#0ea5e9', '#64748b'] },
    { id: 'priceTier', key: 'priceTiers', title: 'Phân khúc Giá bìa & Sức mua', caption: 'Phân bổ theo giá bìa đã lưu; dùng giá thực bán khi chưa có giá bìa.', colors: ['#38bdf8', '#f97316', '#6366f1', '#14b8a6'] }
  ];
  function sellerChartsMarkup() {
    return `<section class="analytics-seller-suite" aria-labelledby="sellerPieTitle">
      <div class="charts-suite-header" id="pieChartsSection">
        <div class="suite-title-group"><div class="suite-badge"><span class="material-symbols-outlined" aria-hidden="true">pie_chart</span>BÁO CÁO CƠ CẤU & TỶ TRỌNG KINH DOANH</div>
          <h2 class="suite-title" id="sellerPieTitle">Hệ thống Biểu đồ tròn Phân tích Chuyên sâu</h2><p class="suite-subtitle">Thể loại truyện, sự kiện bán hàng và phân khúc giá trong cùng khoảng ngày đã chọn.</p></div>
        <div class="suite-controls">
          <div class="pill-segmented-group" role="group" aria-label="Kiểu biểu đồ tròn"><button type="button" class="pill-seg-btn active" data-seller-pie-type="doughnut" aria-pressed="true">Doughnut (Vành tròn)</button><button type="button" class="pill-seg-btn" data-seller-pie-type="pie" aria-pressed="false">Pie (Hình quạt)</button></div>
          <div class="pill-segmented-group" role="group" aria-label="Chỉ số biểu đồ tròn"><button type="button" class="pill-seg-btn active" data-seller-pie-metric="revenue" aria-pressed="true">Doanh thu (₫)</button><button type="button" class="pill-seg-btn" data-seller-pie-metric="units" aria-pressed="false">Sản lượng (Cuốn)</button></div>
        </div>
      </div>
      <p class="analytics-muted analytics-suite-note">Chỉ tính đơn hoàn tất của gian hàng. Nhấn vào chú giải để ẩn/hiện một nhóm.</p>
      <div class="pro-charts-grid">${sellerPies.map(pie => `<article class="pro-chart-card" aria-labelledby="${pie.id}ChartTitle">
        <div class="analytics-seller-card-heading"><h3 id="${pie.id}ChartTitle">${escape(pie.title)}</h3><p class="analytics-muted">${escape(pie.caption)}</p></div>
        <div class="pro-donut-chart-box"><canvas id="${pie.id}ChartCanvas" role="img" aria-label="${escape(pie.title)}; số liệu và tỷ lệ trong chú giải bên dưới"></canvas><div class="donut-center-info" id="${pie.id}CenterInfo"><div class="donut-center-value" id="${pie.id}CenterVal"></div><div class="donut-center-label" id="${pie.id}CenterLbl"></div></div></div>
        <p class="analytics-empty" id="${pie.id}ChartEmpty" hidden>Không có đơn hoàn tất trong khoảng thời gian này.</p>
        <div class="pro-legend-list" id="${pie.id}LegendList" aria-label="Số liệu ${escape(pie.title)}"></div>
        <p class="pro-chart-footer-note" id="${pie.id}ChartNote"></p>
      </article>`).join('')}</div>
    </section>
    <section class="analytics-panel" aria-labelledby="sellerRegionTitle">
      <div class="analytics-section-heading"><div><h2 id="sellerRegionTitle">Thống kê Doanh thu & Sức mua theo Khu vực</h2><p class="analytics-muted">Theo địa chỉ giao hàng đã lưu trong đơn hoàn tất, trong cùng khoảng ngày đã chọn.</p></div>
        <div class="analytics-controls"><label>Phân bố khu vực<select id="sellerRegionView"><option value="regions">Theo vùng miền</option><option value="cities">Theo tỉnh/thành</option></select></label><label>Chỉ số khu vực<select id="sellerRegionMetric"><option value="revenue">Doanh thu</option><option value="orders">Số đơn hàng</option></select></label></div>
      </div><div class="analytics-region-layout"><div class="analytics-region-frame"><canvas id="regionChartCanvas" role="img" aria-label="Biểu đồ cột theo khu vực; số liệu trong bảng bên cạnh"></canvas><p class="analytics-empty" id="sellerRegionEmpty" hidden>Không có đơn hoàn tất trong khoảng thời gian này.</p></div>
      <div class="analytics-table-scroll"><table class="analytics-table"><caption>Phân bổ doanh thu và đơn hàng theo khu vực</caption><thead><tr><th scope="col">Khu vực</th><th scope="col">Doanh thu</th><th scope="col">Số đơn</th><th scope="col">Tỷ lệ</th></tr></thead><tbody id="sellerRegionBody"></tbody></table></div></div>
    </section>`;
  }

  function mount(root) {
    if (!root || root.analyticsController) return root?.analyticsController;
    const admin = root.dataset.role === 'admin';
    const initial = A.presetRange(30);
    const state = { range: initial, grouping: 'day', metric: 'revenue', sort: 'units', limit: '5', pie: 'categories', bar: null, pieChart: null, data: null, report: null, sellerId: null,
      sellerPieType: 'doughnut', sellerPieMetric: 'revenue', sellerCharts: new Map(), regionView: 'regions', regionMetric: 'revenue', regionChart: null, requestId: 0 };
    root.innerHTML = `
      <div class="analytics-heading">
        <div><p class="analytics-eyebrow">${admin ? 'QUẢN TRỊ HỆ THỐNG' : 'BÁO CÁO GIAN HÀNG'}</p>
          <h1>${admin ? 'Thống kê toàn sàn' : 'Doanh thu & sản phẩm bán chạy'}</h1>
          <p class="analytics-muted">${admin ? 'Theo dõi doanh thu và cơ cấu hoạt động trên BookMooch.' : 'Theo dõi kết quả kinh doanh của gian hàng trong khoảng ngày bạn chọn.'}</p>
        </div><button type="button" class="btn btn-outline" id="analyticsRefresh"><span class="material-symbols-outlined" aria-hidden="true">refresh</span>Làm mới</button>
      </div>
      <div class="analytics-source" id="analyticsSource" role="status"></div>
      <form class="analytics-panel analytics-filter" id="analyticsFilter" novalidate>
        <div class="analytics-filter-fields">
          <label for="analyticsFrom">Từ ngày<input type="date" id="analyticsFrom" value="${initial.from}" required aria-describedby="analyticsError"></label>
          <label for="analyticsTo">Đến ngày<input type="date" id="analyticsTo" value="${initial.to}" required aria-describedby="analyticsError"></label>
          <button class="btn btn-primary" type="submit"><span class="material-symbols-outlined" aria-hidden="true">filter_alt</span>Áp dụng</button>
        </div>
        <div class="analytics-presets" aria-label="Chọn nhanh khoảng thời gian">
          <button type="button" data-preset="7">7 ngày</button><button type="button" data-preset="30" class="active">30 ngày</button>
          <button type="button" data-preset="90">90 ngày</button><button type="button" data-preset="month">Tháng này</button><button type="button" data-preset="previousMonth">Tháng trước</button>
        </div><p class="analytics-error" id="analyticsError" role="alert" hidden></p>
      </form>
      <div class="analytics-results" id="analyticsResults">
        <div class="analytics-period"><p id="analyticsPeriod" aria-live="polite"></p><span id="analyticsScope"></span></div>
        <div class="analytics-kpis" aria-label="Tổng quan trong khoảng thời gian">
          <article class="analytics-panel"><span>Tổng doanh thu tiền hàng</span><strong id="analyticsRevenue">—</strong><small>Đơn hoàn tất • không gồm phí vận chuyển</small></article>
          <article class="analytics-panel"><span>Đơn hàng hoàn tất</span><strong id="analyticsOrders">—</strong><small>Theo ngày hoàn tất đơn hàng</small></article>
          <article class="analytics-panel"><span>Sản phẩm đã bán</span><strong id="analyticsUnits">—</strong><small>Tổng số lượng trong đơn hoàn tất</small></article>
          <article class="analytics-panel"><span>Giá trị đơn trung bình</span><strong id="analyticsAverage">—</strong><small>Doanh thu tiền hàng / đơn hoàn tất</small></article>
        </div>
        <section class="analytics-panel analytics-chart-panel" aria-labelledby="analyticsBarTitle">
          <div class="analytics-section-heading"><div><h2 id="analyticsBarTitle">Biểu đồ cột theo thời gian</h2><p class="analytics-muted" id="analyticsBarCaption"></p></div>
            <div class="analytics-controls"><label>Chỉ số<select id="analyticsMetric"><option value="revenue">Doanh thu</option><option value="orders">Đơn hoàn tất</option><option value="units">Số lượng bán</option></select></label>
            <label>Nhóm theo<select id="analyticsGrouping"><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option></select></label>
            <button type="button" class="btn btn-outline btn-sm" id="analyticsExportSeries">Xuất CSV</button></div>
          </div>
          <p class="analytics-empty" id="analyticsBarEmpty" hidden>Không có đơn hoàn tất trong khoảng thời gian này.</p>
          <p class="analytics-error" id="analyticsChartWarning" hidden>Không tải được thư viện biểu đồ. Bạn vẫn có thể xem số liệu chi tiết bên dưới.</p>
          <div class="analytics-chart-scroll"><div class="analytics-bar-frame" id="analyticsBarFrame"><canvas id="analyticsBar" role="img" aria-label="Biểu đồ cột; số liệu đầy đủ trong bảng chi tiết bên dưới"></canvas></div></div>
          <details class="analytics-details"><summary>Xem số liệu chi tiết theo thời gian</summary><div class="analytics-table-scroll"><table class="analytics-table"><caption id="analyticsSeriesCaption">Số liệu theo thời gian</caption><thead><tr><th scope="col">Khoảng thời gian</th><th scope="col">Doanh thu</th><th scope="col">Đơn hoàn tất</th><th scope="col">Số lượng bán</th></tr></thead><tbody id="analyticsSeriesBody"></tbody><tfoot id="analyticsSeriesTotal"></tfoot></table></div></details>
        </section>
        ${admin ? `<section class="analytics-panel" aria-labelledby="analyticsPieTitle"><div class="analytics-section-heading"><div><h2 id="analyticsPieTitle">Thống kê biểu đồ tròn</h2><p class="analytics-muted" id="analyticsPieCaption"></p></div><label>Cơ cấu thống kê<select id="analyticsPieDimension"><option value="categories">Doanh thu theo thể loại</option><option value="sellers">Doanh thu theo người bán</option><option value="states">Đơn hàng theo trạng thái</option><option value="roles">Tài khoản theo vai trò</option></select></label></div>
          <div class="analytics-pie-layout"><div class="analytics-pie-frame"><canvas id="analyticsPie" role="img" aria-label="Biểu đồ tròn; xem giá trị và tỷ lệ trong bảng bên cạnh"></canvas><p class="analytics-empty" id="analyticsPieEmpty" hidden>Không có dữ liệu cho thống kê này.</p></div>
          <div class="analytics-table-scroll"><table class="analytics-table analytics-pie-table"><caption id="analyticsPieTableCaption">Cơ cấu thống kê</caption><thead><tr><th scope="col">Nhóm</th><th scope="col">Giá trị</th><th scope="col">Tỷ lệ</th></tr></thead><tbody id="analyticsPieBody"></tbody><tfoot id="analyticsPieTotal"></tfoot></table></div></div></section>` : sellerChartsMarkup()}
        <section class="analytics-panel" id="best-selling" aria-labelledby="analyticsTopTitle">
          <div class="analytics-section-heading"><div><h2 id="analyticsTopTitle">${admin ? 'Sản phẩm bán chạy toàn sàn' : 'Sản phẩm bán chạy của gian hàng'}</h2><p class="analytics-muted">Xếp hạng từ chi tiết đơn hoàn tất trong cùng khoảng ngày đã chọn.</p></div>
            <div class="analytics-controls"><label>Xếp hạng theo<select id="analyticsSort"><option value="units">Số lượng bán</option><option value="revenue">Doanh thu</option></select></label>
            <label>Hiển thị<select id="analyticsLimit"><option value="5">Top 5</option><option value="10">Top 10</option><option value="all">Tất cả</option></select></label><button type="button" class="btn btn-outline btn-sm" id="analyticsExportProducts">Xuất CSV</button></div>
          </div><div class="analytics-table-scroll"><table class="analytics-table analytics-products"><caption id="analyticsProductCaption">Sản phẩm bán chạy</caption><thead><tr><th scope="col">Hạng</th><th scope="col">Sản phẩm</th>${admin ? '<th scope="col">Gian hàng</th>' : ''}<th scope="col">Đã bán</th><th scope="col">Số đơn</th><th scope="col">Doanh thu</th><th scope="col">Tỷ trọng doanh thu</th></tr></thead><tbody id="analyticsProductsBody"></tbody></table></div>
          <p class="analytics-muted analytics-table-note" id="analyticsProductCount"></p>
        </section>
      </div>`;
    const el = id => root.querySelector('#' + id);
    const set = (id, text) => { el(id).textContent = text; };
    function error(message, dates = false) {
      el('analyticsError').hidden = !message;
      set('analyticsError', message || '');
      ['analyticsFrom', 'analyticsTo'].forEach(id => el(id).setAttribute('aria-invalid', dates ? 'true' : 'false'));
    }
    async function read() {
      const requestId = ++state.requestId;
      root.setAttribute('aria-busy', 'true');
      set('analyticsSource', 'Đang tải báo cáo từ database…');
      el('analyticsSource').classList.remove('is-demo');
      try {
        const report = await window.BookMoochAnalyticsApi.report(admin ? 'admin' : 'seller', state.range, state.grouping);
        if (requestId !== state.requestId) return;
        state.report = report;
        state.sellerId = report.sellerId;
        ['analyticsExportSeries', 'analyticsExportProducts'].forEach(id => { el(id).disabled = false; });
        set('analyticsScope', report.sellerName || (admin ? 'Tất cả người bán' : 'Gian hàng của bạn'));
        set('analyticsSource', 'Dữ liệu từ database • Báo cáo theo đơn hàng đã lưu, nhấn Làm mới để cập nhật.');
        el('analyticsResults').hidden = false;
        error('');
        render();
      } catch (err) {
        if (requestId !== state.requestId) return;
        state.report = null;
        el('analyticsResults').hidden = false;
        set('analyticsSource', 'Chưa thể hiển thị thống kê.');
        error(err.message);
        if (err.loginRequired) {
          const link = document.createElement('a');
          link.href = window.BookMoochAnalyticsApi.loginUrl(); link.textContent = ' Đăng nhập';
          el('analyticsError').appendChild(link);
        }
        if (err.sellerRequired) {
          const link = document.createElement('a');
          link.href = window.BookMoochAnalyticsApi.upgradeUrl(); link.textContent = ' Nâng cấp lên Người bán';
          el('analyticsError').appendChild(link);
        }
        destroyCharts();
        clearReport();
      } finally {
        if (requestId === state.requestId) root.setAttribute('aria-busy', 'false');
      }
    }
    function destroyCharts() {
      state.bar?.destroy(); state.pieChart?.destroy();
      state.bar = null; state.pieChart = null;
      state.sellerCharts.forEach(chart => chart.destroy()); state.sellerCharts.clear();
      state.regionChart?.destroy(); state.regionChart = null;
    }
    function clearReport() {
      ['analyticsRevenue', 'analyticsOrders', 'analyticsUnits', 'analyticsAverage'].forEach(id => set(id, '—'));
      ['analyticsExportSeries', 'analyticsExportProducts'].forEach(id => { el(id).disabled = true; });
      set('analyticsScope', '');
      set('analyticsPeriod', `Khoảng ngày đang chọn: ${date(state.range.from)} – ${date(state.range.to)}`);
      set('analyticsBarCaption', 'Chưa tải được dữ liệu từ database.');
      set('analyticsBarEmpty', 'Chưa có dữ liệu báo cáo để vẽ biểu đồ.'); el('analyticsBarEmpty').hidden = false; el('analyticsBar').hidden = true;
      el('analyticsSeriesBody').innerHTML = '<tr><td colspan="4" class="analytics-empty">Chưa tải được dữ liệu.</td></tr>';
      el('analyticsSeriesTotal').innerHTML = '';
      el('analyticsProductsBody').innerHTML = `<tr><td colspan="${admin ? 7 : 6}" class="analytics-empty">Chưa tải được dữ liệu sản phẩm bán chạy.</td></tr>`;
      set('analyticsProductCount', '');
      if (admin) {
        set('analyticsPieEmpty', 'Chưa có dữ liệu báo cáo để vẽ biểu đồ.'); el('analyticsPieEmpty').hidden = false; el('analyticsPie').hidden = true;
        el('analyticsPieBody').innerHTML = '<tr><td colspan="3" class="analytics-empty">Chưa tải được dữ liệu.</td></tr>'; el('analyticsPieTotal').innerHTML = '';
      } else {
        sellerPies.forEach(pie => {
          el(`${pie.id}ChartCanvas`).hidden = true; el(`${pie.id}CenterInfo`).hidden = true;
          set(`${pie.id}ChartEmpty`, 'Chưa có dữ liệu báo cáo để vẽ biểu đồ.'); el(`${pie.id}ChartEmpty`).hidden = false;
          set(`${pie.id}LegendList`, ''); set(`${pie.id}ChartNote`, 'Chờ dữ liệu từ database.');
        });
        el('regionChartCanvas').hidden = true; el('sellerRegionEmpty').hidden = false;
        set('sellerRegionEmpty', 'Chưa có dữ liệu báo cáo để vẽ biểu đồ.');
        el('sellerRegionBody').innerHTML = '<tr><td colspan="4" class="analytics-empty">Chưa tải được dữ liệu.</td></tr>';
      }
    }
    function apply(range, preset = null) {
      try { A.validateRange(range.from, range.to); }
      catch (err) { error(err.message, true); return false; }
      state.range = { from: range.from, to: range.to };
      el('analyticsFrom').value = range.from;
      el('analyticsTo').value = range.to;
      root.querySelectorAll('[data-preset]').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
      // Keep long intervals legible without dropping any dates from the totals.
      const days = A.validateRange(range.from, range.to).days;
      state.grouping = days > 180 ? 'month' : days > 60 ? 'week' : 'day';
      el('analyticsGrouping').value = state.grouping;
      error('');
      read();
      return true;
    }
    function label(bucket) { return bucket.from === bucket.to ? date(bucket.from) : `${date(bucket.from)} – ${date(bucket.to)}`; }
    function render() {
      const report = state.report;
      const period = `${date(state.range.from)} – ${date(state.range.to)}`;
      set('analyticsPeriod', `Đang xem: ${period} (bao gồm cả ngày bắt đầu và kết thúc)`);
      set('analyticsRevenue', money(report.revenue)); set('analyticsOrders', count(report.orders));
      set('analyticsUnits', count(report.units)); set('analyticsAverage', money(report.average));
      set('analyticsBarCaption', `Theo ngày hoàn tất • ${period} • tiền hàng không gồm phí vận chuyển`);
      set('analyticsSeriesCaption', `Thống kê từ ${period}`);
      el('analyticsSeriesBody').innerHTML = report.series.map(bucket => `<tr><th scope="row">${label(bucket)}</th><td>${money(bucket.revenue)}</td><td>${count(bucket.orders)}</td><td>${count(bucket.units)}</td></tr>`).join('');
      el('analyticsSeriesTotal').innerHTML = `<tr><th scope="row">Tổng cộng</th><td>${money(report.revenue)}</td><td>${count(report.orders)}</td><td>${count(report.units)}</td></tr>`;
      renderBar(); renderProducts();
      if (admin) renderPie(); else { renderSellerPies(); renderRegions(); }
    }
    function renderBar() {
      const report = state.report;
      if (!report) return;
      el('analyticsBar').hidden = false;
      set('analyticsBarEmpty', 'Không có đơn hoàn tất trong khoảng thời gian này.');
      el('analyticsBarEmpty').hidden = report.orders > 0;
      el('analyticsChartWarning').hidden = typeof Chart !== 'undefined';
      if (typeof Chart === 'undefined') return;
      state.bar?.destroy();
      el('analyticsBarFrame').style.minWidth = Math.max(480, Math.min(report.series.length, 120) * 32) + 'px';
      const metricLabel = { revenue: 'Doanh thu tiền hàng', orders: 'Đơn hoàn tất', units: 'Số lượng bán' }[state.metric];
      const format = state.metric === 'revenue' ? money : count;
      state.bar = new Chart(el('analyticsBar'), {
        type: 'bar', data: { labels: report.series.map(label), datasets: [{ label: metricLabel, data: report.series.map(bucket => bucket[state.metric]), backgroundColor: '#f97316', hoverBackgroundColor: '#c2410c', borderRadius: 5, maxBarThickness: 36 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${metricLabel}: ${format(context.parsed.y)}` } } },
          scales: { x: { grid: { display: false }, ticks: { maxRotation: 45, maxTicksLimit: 14 } },
            y: { beginAtZero: true, ticks: { precision: state.metric === 'revenue' ? undefined : 0, callback: value => state.metric === 'revenue' ? new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value) + ' ₫' : count(value) } } }
        }
      });
    }
    function renderProducts() {
      if (!state.report) return;
      const products = A.rankProducts(state.report.products, state.sort);
      const visible = state.limit === 'all' ? products : products.slice(0, Number(state.limit));
      const span = admin ? 7 : 6;
      el('analyticsProductsBody').innerHTML = visible.length ? visible.map((product, index) => {
        const pct = state.report.revenue ? product.revenue / state.report.revenue * 100 : 0;
        return `<tr><td><span class="analytics-rank ${index < 3 ? 'leading' : ''}">${index + 1}</span></td><th scope="row"><span class="analytics-product-title">${escape(product.title)}</span><small>${escape(product.id)} • ${escape(product.category)}</small></th>${admin ? `<td>${escape(product.sellerName)}</td>` : ''}<td><strong>${count(product.units)}</strong></td><td>${count(product.orders)}</td><td>${money(product.revenue)}</td><td><div class="analytics-share"><span>${count(Number(pct.toFixed(1)))}%</span><div><i style="width:${pct.toFixed(2)}%"></i></div></div></td></tr>`;
      }).join('') : `<tr><td colspan="${span}" class="analytics-empty">Chưa có sản phẩm bán được trong khoảng thời gian này.</td></tr>`;
      set('analyticsProductCount', `Hiển thị ${visible.length}/${products.length} sản phẩm • Ưu tiên ${state.sort === 'units' ? 'số lượng bán' : 'doanh thu'} giảm dần.`);
      set('analyticsProductCaption', `Sản phẩm bán chạy từ ${date(state.range.from)} đến ${date(state.range.to)}`);
    }
    function renderPie() {
      if (!state.report) return;
      const descriptions = {
        categories: 'Doanh thu tiền hàng theo thể loại • Đơn hoàn tất trong khoảng ngày đã chọn.',
        sellers: 'Doanh thu tiền hàng theo người bán • Đơn hoàn tất trong khoảng ngày đã chọn.',
        states: 'Số đơn theo trạng thái hiện tại • Lọc theo ngày tạo đơn trong khoảng đã chọn.',
        roles: 'Số tài khoản đang lưu theo vai trò • Toàn bộ dữ liệu tài khoản, không áp dụng khoảng ngày.'
      };
      const rows = [...state.report[state.pie]].filter(row => row.value > 0).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
      const total = rows.reduce((sum, row) => sum + row.value, 0);
      const currency = ['categories', 'sellers'].includes(state.pie);
      const format = currency ? money : count;
      set('analyticsPieCaption', descriptions[state.pie]);
      set('analyticsPieTableCaption', el('analyticsPieDimension').selectedOptions[0].textContent);
      set('analyticsPieEmpty', 'Không có dữ liệu cho thống kê này.');
      el('analyticsPieEmpty').hidden = rows.length > 0;
      el('analyticsPie').hidden = rows.length === 0;
      el('analyticsPieBody').innerHTML = rows.length ? rows.map((row, index) => `<tr><th scope="row"><span class="analytics-swatch" style="background:${colors[index % colors.length]}"></span>${escape(row.label)}</th><td>${format(row.value)}</td><td>${count(Number((row.value / total * 100).toFixed(1)))}%</td></tr>`).join('') : '<tr><td colspan="3" class="analytics-empty">Không có dữ liệu.</td></tr>';
      el('analyticsPieTotal').innerHTML = `<tr><th scope="row">Tổng cộng</th><td>${format(total)}</td><td>${total ? '100%' : '0%'}</td></tr>`;
      state.pieChart?.destroy(); state.pieChart = null;
      if (!rows.length || typeof Chart === 'undefined') return;
      state.pieChart = new Chart(el('analyticsPie'), {
        type: 'pie', data: { labels: rows.map(row => row.label), datasets: [{ data: rows.map(row => row.value), backgroundColor: rows.map((_, index) => colors[index % colors.length]), borderWidth: 3, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${format(context.parsed)} (${count(Number((context.parsed / total * 100).toFixed(1)))}%)` } } } }
      });
    }
    function renderSellerPies() {
      if (!state.report) return;
      const currency = state.sellerPieMetric === 'revenue';
      const format = currency ? money : value => `${count(value)} cuốn`;
      sellerPies.forEach(pie => {
        state.sellerCharts.get(pie.id)?.destroy(); state.sellerCharts.delete(pie.id);
        const rows = state.report[pie.key].map(row => ({ ...row, amount: currency ? row.value : row.units })).filter(row => row.amount > 0).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
        const total = rows.reduce((sum, row) => sum + row.amount, 0);
        const pct = value => `${count(Number((total ? value / total * 100 : 0).toFixed(1)))}%`;
        const compact = value => currency ? new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value) + ' ₫' : count(value);
        const resetCenter = () => { set(`${pie.id}CenterVal`, compact(total)); set(`${pie.id}CenterLbl`, currency ? 'TỔNG DOANH THU' : 'CUỐN ĐÃ BÁN'); };
        const hoverCenter = index => { set(`${pie.id}CenterVal`, pct(rows[index].amount)); set(`${pie.id}CenterLbl`, rows[index].label); };
        resetCenter();
        el(`${pie.id}CenterInfo`).hidden = !rows.length || state.sellerPieType === 'pie' || typeof Chart === 'undefined';
        el(`${pie.id}ChartCanvas`).hidden = !rows.length;
        set(`${pie.id}ChartEmpty`, 'Không có đơn hoàn tất trong khoảng thời gian này.');
        el(`${pie.id}ChartEmpty`).hidden = rows.length > 0;
        el(`${pie.id}LegendList`).innerHTML = rows.map((row, index) => `<button type="button" class="pro-legend-item" data-slice="${index}" aria-pressed="true" aria-label="${escape(row.label)}: ${escape(format(row.amount))}, ${pct(row.amount)}"><span class="pro-legend-left"><span class="pro-legend-dot" style="background:${pie.colors[index % pie.colors.length]}"></span><span class="pro-legend-name">${escape(row.label)}</span></span><span class="pro-legend-right"><span class="pro-legend-val">${format(row.amount)}</span><span class="pro-legend-pct">${pct(row.amount)}</span></span></button>`).join('');
        set(`${pie.id}ChartNote`, pie.id === 'priceTier' && state.report.unitsWithoutCoverPrice
          ? `${count(state.report.unitsWithoutCoverPrice)} cuốn chưa lưu giá bìa: phân nhóm theo giá thực bán. Tổng: ${format(total)}.`
          : `Tổng: ${format(total)} • ${rows.length} nhóm.`);
        if (!rows.length || typeof Chart === 'undefined') return;
        const chart = new Chart(el(`${pie.id}ChartCanvas`), {
          type: state.sellerPieType,
          data: { labels: rows.map(row => row.label), datasets: [{ data: rows.map(row => row.amount), backgroundColor: rows.map((_, index) => pie.colors[index % pie.colors.length]), borderWidth: 3, borderColor: '#fff', hoverOffset: 8 }] },
          options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: state.sellerPieType === 'doughnut' ? '68%' : 0, layout: { padding: 8 },
            onHover: (_, elements) => elements.length ? hoverCenter(elements[0].index) : resetCenter(),
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${format(context.parsed)} (${pct(context.parsed)})` } } }
          }
        });
        state.sellerCharts.set(pie.id, chart);
        el(`${pie.id}LegendList`).querySelectorAll('[data-slice]').forEach(button => {
          const index = Number(button.dataset.slice);
          button.addEventListener('click', () => {
            chart.toggleDataVisibility(index); chart.update();
            const visible = chart.getDataVisibility(index);
            button.classList.toggle('hidden-slice', !visible); button.setAttribute('aria-pressed', String(visible));
            resetCenter();
          });
          button.addEventListener('mouseenter', () => {
            if (!chart.getDataVisibility(index)) return;
            chart.setActiveElements([{ datasetIndex: 0, index }]); chart.update(); hoverCenter(index);
          });
          button.addEventListener('mouseleave', () => { chart.setActiveElements([]); chart.update(); resetCenter(); });
        });
      });
    }
    function renderRegions() {
      if (!state.report) return;
      const currency = state.regionMetric === 'revenue';
      const value = row => currency ? row.value : row.orders;
      const format = currency ? money : count;
      const rows = [...state.report[state.regionView]].sort((a, b) => value(b) - value(a) || a.label.localeCompare(b.label));
      const total = rows.reduce((sum, row) => sum + value(row), 0);
      set('sellerRegionEmpty', 'Không có đơn hoàn tất trong khoảng thời gian này.');
      el('sellerRegionEmpty').hidden = rows.length > 0;
      el('regionChartCanvas').hidden = !rows.length;
      el('sellerRegionBody').innerHTML = rows.length ? rows.map((row, index) => `<tr><th scope="row"><span class="analytics-swatch" style="background:${colors[index % colors.length]}"></span>${escape(row.label)}</th><td>${money(row.value)}</td><td>${count(row.orders)}</td><td>${count(Number((total ? value(row) / total * 100 : 0).toFixed(1)))}%</td></tr>`).join('') : '<tr><td colspan="4" class="analytics-empty">Không có dữ liệu.</td></tr>';
      state.regionChart?.destroy(); state.regionChart = null;
      if (!rows.length || typeof Chart === 'undefined') return;
      el('regionChartCanvas').parentElement.style.height = Math.max(260, rows.length * 38) + 'px';
      state.regionChart = new Chart(el('regionChartCanvas'), {
        type: 'bar', data: { labels: rows.map(row => row.label), datasets: [{ data: rows.map(value), backgroundColor: rows.map((_, index) => colors[index % colors.length]), borderRadius: 5, maxBarThickness: 26 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${currency ? 'Doanh thu' : 'Số đơn'}: ${format(context.parsed.x)}` } } },
          scales: { x: { beginAtZero: true, ticks: { precision: currency ? undefined : 0, callback: value => currency ? new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value) + ' ₫' : count(value) } }, y: { grid: { display: false } } }
        }
      });
    }
    function download(rows, name) {
      const url = URL.createObjectURL(new Blob([A.csv(rows)], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `${name}_${state.range.from}_${state.range.to}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    el('analyticsFilter').addEventListener('submit', event => { event.preventDefault(); apply({ from: el('analyticsFrom').value, to: el('analyticsTo').value }); });
    root.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => apply(A.presetRange(btn.dataset.preset), btn.dataset.preset)));
    ['analyticsFrom', 'analyticsTo'].forEach(id => el(id).addEventListener('input', () => {
      root.querySelectorAll('[data-preset]').forEach(btn => btn.classList.remove('active'));
      error('');
    }));
    el('analyticsRefresh').addEventListener('click', read);
    el('analyticsGrouping').addEventListener('change', event => { state.grouping = event.target.value; read(); });
    el('analyticsMetric').addEventListener('change', event => { state.metric = event.target.value; renderBar(); });
    el('analyticsSort').addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
    el('analyticsLimit').addEventListener('change', event => { state.limit = event.target.value; renderProducts(); });
    if (admin) el('analyticsPieDimension').addEventListener('change', event => { state.pie = event.target.value; renderPie(); });
    else {
      const bindSegments = (attribute, key) => root.querySelectorAll(`[${attribute}]`).forEach(button => button.addEventListener('click', () => {
        state[key] = button.getAttribute(attribute);
        root.querySelectorAll(`[${attribute}]`).forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
        renderSellerPies();
      }));
      bindSegments('data-seller-pie-type', 'sellerPieType');
      bindSegments('data-seller-pie-metric', 'sellerPieMetric');
      el('sellerRegionView').addEventListener('change', event => { state.regionView = event.target.value; renderRegions(); });
      el('sellerRegionMetric').addEventListener('change', event => { state.regionMetric = event.target.value; renderRegions(); });
    }
    el('analyticsExportSeries').addEventListener('click', () => download([
      ['Từ ngày', 'Đến ngày', 'Doanh thu tiền hàng (VND)', 'Đơn hoàn tất', 'Số lượng bán'],
      ...state.report.series.map(bucket => [bucket.from, bucket.to, bucket.revenue, bucket.orders, bucket.units]),
      ['Tổng cộng', '', state.report.revenue, state.report.orders, state.report.units]
    ], admin ? 'thong_ke_toan_san' : 'doanh_thu_nguoi_ban'));
    el('analyticsExportProducts').addEventListener('click', () => {
      const products = A.rankProducts(state.report.products, state.sort);
      const visible = state.limit === 'all' ? products : products.slice(0, Number(state.limit));
      const rows = [['Hạng', 'Mã sản phẩm', 'Tên sản phẩm', 'Thể loại', ...(admin ? ['Gian hàng'] : []), 'Số lượng bán', 'Số đơn', 'Doanh thu tiền hàng (VND)'],
        ...visible.map((product, index) => [index + 1, product.id, product.title, product.category, ...(admin ? [product.sellerName] : []), product.units, product.orders, product.revenue])];
      download(rows, 'san_pham_ban_chay');
    });
    window.addEventListener('bookmooch:analytics-updated', read);
    root.analyticsController = { apply, refresh: read, getReport: () => state.report };
    clearReport();
    read();
    return root.analyticsController;
  }
  window.BookMoochAnalyticsPage = { mount };
})();
