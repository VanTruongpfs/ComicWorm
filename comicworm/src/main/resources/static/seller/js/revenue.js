/* Database reporting for the existing seller layout. HTML sections and controls are retained. */
(function () {
  'use strict';
  const A = window.BookMoochAnalytics, API = window.BookMoochAnalyticsApi;
  const colors = ['#f97316', '#0f172a', '#8b5cf6', '#ec4899', '#0ea5e9', '#10b981'];
  const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  const count = value => new Intl.NumberFormat('vi-VN').format(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  let root, status, report, requestId = 0, range = A.presetRange(30), grouping = 'day', type = 'doughnut', metric = 'revenue', regionView = 'regions', regionMetric = 'revenue', sort = 'units';
  const charts = new Map(), pieRows = new Map();
  const el = id => root?.querySelector('#' + id) || document.getElementById(id);
  const set = (node, text) => { if (node) node.textContent = text; };
  function badge(node, text) {
    if (!node) return;
    const icon = node.querySelector('.material-symbols-outlined');
    node.replaceChildren(...(icon ? [icon] : []), document.createTextNode(' ' + text));
  }
  function note(node, text) {
    if (!node) return;
    let label = node.querySelector(':scope > span');
    if (!label) { label = document.createElement('span'); node.prepend(label); }
    set(label, text);
  }
  const regionTotal = () => el('regionRankingList')?.previousElementSibling?.querySelector(':scope > span');
  const percent = (value, total) => count(Number((total ? value / total * 100 : 0).toFixed(1))) + '%';
  function segment(button) { button?.parentElement.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button)); }
  function chart(id, config) {
    const canvas = el(id); if (!canvas || typeof Chart === 'undefined') return;
    charts.get(id)?.destroy(); charts.set(id, new Chart(canvas, config));
  }
  function clear() {
    charts.forEach(item => item.destroy()); charts.clear();
    root.querySelectorAll('#chartWrapper svg').forEach(node => node.setAttribute('hidden', ''));
    set(document.querySelector('.store-name'), 'Gian hàng'); set(document.querySelector('.user-name'), 'Chờ xác thực');
    root.querySelectorAll('.kpi-value, .strip-val, .genre-leader-metric .amount').forEach(node => set(node, '—'));
    root.querySelectorAll('.kpi-trend, .genre-leader-info p, .genre-leader-metric .badge, .card-badge-header, .genre-leader-info h4').forEach(node => badge(node, 'Chờ dữ liệu'));
    root.querySelectorAll('.pro-chart-footer-note').forEach(node => note(node, 'Chờ dữ liệu'));
    root.querySelectorAll('#cardBestSellers .content-card-header p, #cardSlowMoving .content-card-header p').forEach(node => set(node, 'Chờ báo cáo từ database.'));
    set(regionTotal(), 'Tổng doanh thu: —');
    root.querySelectorAll('.pro-legend-list, .region-ranking-list').forEach(node => set(node, 'Chưa có dữ liệu.'));
    root.querySelectorAll('.donut-center-info').forEach(node => node.hidden = true);
    root.querySelectorAll('.chart-footer-stat span:not(.material-symbols-outlined)').forEach(node => set(node, 'Chờ dữ liệu từ database.'));
    root.querySelectorAll('.data-table tbody').forEach(body => { body.innerHTML = `<tr><td colspan="${body.closest('table').querySelectorAll('thead th').length}" style="text-align:center;padding:24px">Chưa có dữ liệu báo cáo.</td></tr>`; });
    set(el('regionInsightText'), 'Chưa có dữ liệu vùng giao hàng để phân bổ chi tiết.'); badge(el('regionChartBadge'), 'Chờ dữ liệu');
  }
  async function load() {
    const ticket = ++requestId;
    root.setAttribute('aria-busy', 'true'); set(status, 'Đang tải báo cáo từ database…');
    root.querySelectorAll('.page-header button').forEach(button => { if (button.textContent.includes('CSV')) button.disabled = true; });
    try {
      const result = await API.report('seller', range, grouping);
      if (ticket !== requestId) return;
      report = result;
      status.innerHTML = `Dữ liệu từ database • ${escape(range.from)} – ${escape(range.to)} • Đơn hoàn tất, tiền hàng không gồm phí vận chuyển.`;
      render();
    } catch (error) {
      if (ticket !== requestId) return;
      report = null; clear(); set(status, error.message);
      if (error.loginRequired) { const link = document.createElement('a'); link.href = API.loginUrl(); link.textContent = ' Đăng nhập'; status.appendChild(link); }
      if (error.sellerRequired) { const link = document.createElement('a'); link.href = API.upgradeUrl(); link.textContent = ' Nâng cấp lên Người bán'; status.appendChild(link); }
    } finally { if (ticket === requestId) { root.setAttribute('aria-busy', 'false'); root.querySelectorAll('.page-header button').forEach(button => { if (button.textContent.includes('CSV')) button.disabled = !report; }); } }
  }
  function render() {
    const cards = root.querySelectorAll('.kpi-grid .kpi-card');
    const totalStates = report.states.reduce((sum, row) => sum + row.value, 0);
    const cancelled = report.states.find(row => row.status === 'CANCELLED')?.value || 0;
    const rating = report.rating;
    [money(report.revenue), `${count(report.orders)} đơn`, percent(cancelled, totalStates), rating?.averageRating == null ? 'Chưa có' : `${count(Number(Number(rating.averageRating).toFixed(1)))} / 5.0`].forEach((value, index) => set(cards[index]?.querySelector('.kpi-value'), value));
    ['Doanh thu trong kỳ', 'Đơn hàng hoàn tất', 'Tỷ lệ đơn hủy', 'Đánh giá cửa hàng'].forEach((value, index) => set(cards[index]?.querySelector('.kpi-label'), value));
    ['Không gồm phí vận chuyển', `Đã bán: ${count(report.units)} cuốn`, 'Theo ngày tạo đơn trong kỳ', `${count(rating?.reviews || 0)} lượt đánh giá trong kỳ`].forEach((value, index) => badge(cards[index]?.querySelector('.kpi-trend'), value));
    set(document.querySelector('.store-name'), report.sellerName); set(document.querySelector('.user-name'), report.sellerName);
    const caption = root.querySelector('.chart-title-group p');
    set(caption, `Đơn hoàn tất từ ${range.from} đến ${range.to} • Không gồm phí vận chuyển`);
    const footer = root.querySelector('.chart-footer-stat');
    if (footer) {
      set(footer.querySelector(':scope > div:first-child > span:not(.material-symbols-outlined)'), `Đã bán: ${count(report.units)} cuốn • ${count(report.orders)} đơn hoàn tất`);
      set(footer.querySelector(':scope > div:last-child > span'), `Giá trị đơn trung bình: ${money(report.average)}`);
    }
    renderMain(); renderPies(); renderRegions(); renderProducts();
  }
  function renderMain() {
    if (!report) return;
    let canvas = el('mainRevenueChartCanvas');
    if (!canvas) {
      const wrapper = el('chartWrapper'); if (!wrapper) return;
      wrapper.querySelector('svg')?.setAttribute('hidden', '');
      canvas = document.createElement('canvas'); canvas.id = 'mainRevenueChartCanvas'; wrapper.appendChild(canvas);
    }
    chart('mainRevenueChartCanvas', {
      type: 'bar', data: { labels: report.series.map(row => row.from === row.to ? row.from : `${row.from} – ${row.to}`), datasets: [
        { label: 'Doanh thu (triệu VNĐ)', data: report.series.map(row => row.revenue / 1000000), backgroundColor: '#f97316', borderRadius: 6, maxBarThickness: 30, yAxisID: 'y' },
        { type: 'line', label: 'Số đơn hoàn tất', data: report.series.map(row => row.orders), borderColor: '#0b1c30', backgroundColor: 'rgba(11,28,48,.05)', tension: .35, pointRadius: 2, yAxisID: 'orders' }
      ]}, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => item.datasetIndex === 0 ? money(item.parsed.y * 1000000) : `${count(item.parsed.y)} đơn` } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 14, maxRotation: 45 } }, y: { beginAtZero: true, ticks: { callback: value => `${count(value)}M` } }, orders: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } } } }
    });
  }
  function renderPies() {
    if (!report) return;
    [['genre','categories','topGenreAmount'],['campaign','campaigns','topCampaignAmount'],['priceTier','priceTiers','topPriceAmount']].forEach(([id, key, leader]) => {
      const canvas = el(id + 'ChartCanvas'); if (!canvas) return;
      const rows = report[key].map(row => ({...row, amount: metric === 'revenue' ? row.value : row.units})).filter(row => row.amount > 0).sort((a,b) => b.amount - a.amount || a.label.localeCompare(b.label));
      pieRows.set(id, rows); const total = rows.reduce((sum,row) => sum + row.amount, 0);
      const format = value => metric === 'revenue' ? money(value) : `${count(value)} cuốn`;
      const card = canvas.closest('.pro-chart-card');
      card?.querySelectorAll('.badge').forEach(node => badge(node, rows.length ? 'Trong kỳ đã chọn' : 'Chưa có dữ liệu'));
      badge(card?.querySelector('.card-badge-header'), rows.length ? `${rows[0].label} • ${percent(rows[0].amount,total)}` : 'Chưa có dữ liệu');
      if (key === 'priceTiers') set(card?.querySelector('.chart-header h4'), 'Phân khúc giá thực bán & sức mua');
      set(card?.querySelector('.genre-leader-info h4'), rows.length ? rows[0].label : 'Chưa có đơn hoàn tất');
      set(card?.querySelector('.genre-leader-info p'), rows.length ? `${count(rows[0].units)} cuốn • ${percent(rows[0].amount, total)}` : '0 cuốn');
      set(el(leader), format(rows[0]?.amount || 0));
      note(card?.querySelector('.pro-chart-footer-note'), key === 'campaigns' ? 'Chưa có dữ liệu chiến dịch; đơn chưa gắn chiến dịch được hiển thị riêng.' : key === 'priceTiers' ? 'Phân nhóm theo giá thực bán đã lưu trong đơn hàng.' : `Tổng trong kỳ: ${format(total)}`);
      set(el(id+'CenterVal'), metric === 'revenue' ? new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(total) + ' ₫' : count(total));
      set(el(id+'CenterLbl'), metric === 'revenue' ? 'TỔNG DOANH THU' : 'CUỐN ĐÃ BÁN');
      if (el(id+'CenterInfo')) el(id+'CenterInfo').hidden = type === 'pie' || !rows.length;
      el(id+'LegendList').innerHTML = rows.length ? rows.map((row,index) => `<button type="button" class="pro-legend-item" aria-pressed="true" onclick="toggleChartSlice('${id}',${index})" onmouseenter="hoverChartSlice('${id}',${index},true)" onmouseleave="hoverChartSlice('${id}',${index},false)"><span class="pro-legend-left"><span class="pro-legend-dot" style="background:${colors[index%colors.length]}"></span><span class="pro-legend-name">${escape(row.label)}</span></span><span class="pro-legend-right"><span class="pro-legend-val">${format(row.amount)}</span><span class="pro-legend-pct">${percent(row.amount,total)}</span></span></button>`).join('') : 'Không có đơn hoàn tất trong khoảng ngày này.';
      chart(id+'ChartCanvas', { type, data: {labels: rows.map(row=>row.label),datasets:[{data:rows.map(row=>row.amount),backgroundColor:rows.map((_,index)=>colors[index%colors.length]),borderColor:'#fff',borderWidth:3,hoverOffset:8}]}, options:{responsive:true,maintainAspectRatio:false,animation:false,cutout:type==='doughnut'?'68%':0,layout:{padding:8},plugins:{legend:{display:false},tooltip:{callbacks:{label:item=>`${item.label}: ${format(item.parsed)} (${percent(item.parsed,total)})`}}}} });
    });
  }
  function renderRegions() {
    if (!report || !el('regionChartCanvas')) return;
    const rows = [...report[regionView]].sort((a,b)=>(regionMetric==='revenue'?b.value-a.value:b.orders-a.orders));
    badge(el('regionChartBadge'), rows.length ? 'Chưa có phân bổ địa chỉ chi tiết' : 'Chưa có đơn hoàn tất');
    set(regionTotal(), `Tổng doanh thu: ${money(report.revenue)}`);
    set(el('regionInsightText'), 'Địa chỉ giao hàng chưa được lưu tách riêng vùng/tỉnh thành. Các đơn này nằm trong nhóm Chưa xác định.');
    root.querySelectorAll('.strip-val').forEach(node=>set(node,'Chưa có dữ liệu'));
    el('regionRankingList').innerHTML = rows.length ? rows.map((row,index)=>`<div class="region-rank-item"><div class="region-rank-header"><div class="region-rank-title-box"><span class="region-rank-badge" style="background:${colors[index%colors.length]}">${index+1}</span><span class="region-rank-title">${escape(row.label)}</span></div><span class="region-rank-metric">${regionMetric==='revenue'?money(row.value):`${count(row.orders)} đơn`}</span></div><div class="region-rank-progress-bg"><div class="region-rank-progress-fill" style="width:100%;background:${colors[index%colors.length]}"></div></div></div>`).join('') : 'Không có đơn hoàn tất.';
    chart('regionChartCanvas',{type:'bar',data:{labels:rows.map(row=>row.label),datasets:[{data:rows.map(row=>regionMetric==='revenue'?row.value/1000000:row.orders),backgroundColor:colors,borderRadius:6,maxBarThickness:28}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:regionMetric==='orders'?0:undefined,callback:value=>regionMetric==='revenue'?`${count(value)}M`:count(value)}},y:{grid:{display:false}}}}});
  }
  function renderProducts() {
    if (!report) return;
    const table = root.querySelector('#cardBestSellers table') || root.querySelector('.data-table'); if (!table) return;
    const products = A.rankProducts(report.products,sort).slice(0,5), columns = table.querySelectorAll('thead th').length;
    const productCell = row => `<div class="product-cell"><div class="comic-thumbnail database-cover-placeholder" aria-label="Chưa có ảnh"><span class="material-symbols-outlined">menu_book</span></div><div class="product-meta"><div class="product-title">${escape(row.title)}</div><div class="product-tags"><span class="tag-badge">${count(row.orders)} đơn hoàn tất</span></div></div></div>`;
    table.tBodies[0].innerHTML = products.length ? products.map((row,index) => columns===7 ? `<tr><td style="text-align:center"><span class="rank-badge rank-${Math.min(index+1,3)}">${index+1}</span></td><td>${productCell(row)}</td><td><span class="tag-badge">${escape(row.category)}</span></td><td style="text-align:center"><strong>${count(row.units)}</strong><span class="price-note"> cuốn</span></td><td style="text-align:right"><div class="price-amount">${money(row.revenue)}</div><span class="price-note">Bình quân ${money(row.units ? row.revenue / row.units : 0)}/cuốn</span></td><td style="text-align:center" title="Chưa có dữ liệu so sánh kỳ trước">—</td><td><span class="badge badge-success">${row.stockQuantity==null?'Chưa có dữ liệu':`Còn ${count(row.stockQuantity)} cuốn`}</span></td></tr>` : `<tr><td>${productCell(row)}</td><td>${escape(row.category)}</td><td>${count(row.units)} cuốn</td><td class="price-amount">${money(row.revenue)}</td><td>${row.stockQuantity==null?'—':count(row.stockQuantity)+' cuốn'}</td></tr>`).join('') : `<tr><td colspan="${columns}" style="text-align:center;padding:24px">Không có sản phẩm bán được trong khoảng ngày này.</td></tr>`;
    const card = table.closest('.content-card'); set(card?.querySelector('.content-card-header p'), `Top 5 theo ${sort==='units'?'số lượng':'doanh thu'} từ ${range.from} đến ${range.to}.`);
    badge(card?.querySelector('.card-badge-header'), `${products.length} sản phẩm • ${money(products.reduce((sum,row)=>sum+row.revenue,0))}`);
    const slow = root.querySelector('#cardSlowMoving');
    set(slow?.querySelector('.content-card-header p'), 'Báo cáo tồn kho chưa được kết nối.'); badge(slow?.querySelector('.card-badge-header'),'Chưa có báo cáo');
  }
  function apply(next) { try { A.validateRange(next.from,next.to); } catch(error) { window.showToast?.(error.message,'error'); set(el('previewDaysCount'),error.message); return false; } range={...next}; load(); return true; }
  function preset(name) {
    const today=A.dateKey(new Date());
    if(name==='today') return {from:today,to:today};
    if(name==='thisYear') return {from:today.slice(0,4)+'-01-01',to:today};
    if(name==='thisQuarter') { const month=Math.floor((Number(today.slice(5,7))-1)/3)*3+1; return {from:today.slice(0,4)+'-'+String(month).padStart(2,'0')+'-01',to:today}; }
    return A.presetRange(name==='thisMonth'?'month':name==='7days'?7:30,today);
  }
  window.initRevenueModule = function () {
    if(root) return;
    root=document.querySelector('#view-revenue') || document.querySelector('main.content-body'); if(!root) return;
    status=document.createElement('p'); status.id='revenueDataSource'; status.className='database-report-status'; status.setAttribute('role','status'); root.querySelector('.page-header').after(status);
    clear();
    if(el('filterStartDate')) { el('filterStartDate').value=range.from; el('filterEndDate').value=range.to; }
    else { const form=document.createElement('form'); form.className='database-date-filter'; form.innerHTML=`<label>Từ ngày<input type="date" id="filterStartDate" value="${range.from}" required></label><label>Đến ngày<input type="date" id="filterEndDate" value="${range.to}" required></label><button class="btn btn-primary" type="submit">Áp dụng</button>`; status.after(form); form.addEventListener('submit',event=>{event.preventDefault();window.confirmDateRangeFilter();}); }
    root.querySelectorAll('.page-header button').forEach(button=>{if(button.textContent.includes('CSV')){button.removeAttribute('onclick');button.addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([A.csv([['Từ ngày','Đến ngày','Doanh thu','Số đơn','Sản lượng'],...report.series.map(row=>[row.from,row.to,row.revenue,row.orders,row.units])])],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download=`doanh_thu_${range.from}_${range.to}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});} if(button.textContent.includes('Năm nay'))set(button,'Năm nay');});
    const table=root.querySelector('#cardBestSellers table') || root.querySelector('.data-table');
    table?.querySelectorAll('thead th').forEach((heading,index)=>{const columns=table.querySelectorAll('thead th').length;if(index===(columns===7?3:2)||index===(columns===7?4:3)){heading.style.cursor='pointer';heading.addEventListener('click',()=>{sort=index===(columns===7?4:3)?'revenue':'units';renderProducts();});}});
    el('dateRangeModal')?.addEventListener('click',event=>{if(event.target===el('dateRangeModal'))window.closeDateRangeModal();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')window.closeDateRangeModal();});
    load();
  };
  window.toggleChartMode=(button,mode)=>{grouping=mode==='weekly'?'week':'day';segment(button);load();};
  window.switchGlobalDonutType=(next,button)=>{type=next;segment(button);renderPies();};
  window.switchDonutMetric=(next,button)=>{metric=next==='qty'?'units':'revenue';segment(button);renderPies();};
  window.toggleChartSlice=(id,index)=>{const item=charts.get(id+'ChartCanvas');if(!item)return;item.toggleDataVisibility(index);item.update();const button=el(id+'LegendList').children[index];button.classList.toggle('hidden-slice',!item.getDataVisibility(index));button.setAttribute('aria-pressed',String(item.getDataVisibility(index)));};
  window.hoverChartSlice=(id,index,hover)=>{const item=charts.get(id+'ChartCanvas');if(!item)return;item.setActiveElements(hover?[{datasetIndex:0,index}]:[]);item.update();};
  window.switchRegionView=(next,button)=>{regionView=next==='city'?'cities':'regions';segment(button);renderRegions();};
  window.switchRegionMetric=(next,button)=>{regionMetric=next;segment(button);renderRegions();};
  window.openDateRangeModal=()=>{el('filterStartDate').value=range.from;el('filterEndDate').value=range.to;el('dateRangeModal')?.classList.add('active');window.updateDateRangePreview();};
  window.closeDateRangeModal=()=>el('dateRangeModal')?.classList.remove('active');
  window.applyDatePreset=(name,button)=>{const next=preset(name);el('filterStartDate').value=next.from;el('filterEndDate').value=next.to;segment(button);window.updateDateRangePreview();};
  window.updateDateRangePreview=()=>{try{const selected=A.validateRange(el('filterStartDate').value,el('filterEndDate').value);set(el('previewDaysCount'),`${selected.days} ngày`);set(el('previewEstRevenue'),'Tính từ database sau khi áp dụng');}catch(error){set(el('previewDaysCount'),error.message);set(el('previewEstRevenue'),'—');}};
  window.confirmDateRangeFilter=()=>{if(apply({from:el('filterStartDate').value,to:el('filterEndDate').value})){segment(el('btnCustomDateRange'));set(el('dateRangeLabel'),`${range.from} – ${range.to}`);window.closeDateRangeModal();}};
  window.selectTimeFilter=button=>{const label=button.textContent;const name=label.includes('Hôm nay')?'today':label.includes('7 ngày')?'7days':label.includes('Năm nay')?'thisYear':'30days';segment(button);const next=preset(name);if(el('filterStartDate')){el('filterStartDate').value=next.from;el('filterEndDate').value=next.to;}apply(next);};
  window.switchComicsView=(view,button)=>{segment(button);if(el('cardBestSellers'))el('cardBestSellers').style.display=view==='slow'?'none':'';if(el('cardSlowMoving'))el('cardSlowMoving').style.display=view==='best'?'none':'';};
  document.addEventListener('DOMContentLoaded',window.initRevenueModule);
})();
