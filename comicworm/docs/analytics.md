# Thống kê doanh thu — Chart.js và MySQL

Giữ các phần giao diện hiện có, menu, thẻ KPI, bộ lọc ngày và biểu đồ.
Trang người bán gốc trong backend ComicWorm được nối dữ liệu ngay trên các
canvas và bảng cũ, không thay toàn bộ HTML. Dashboard được bổ sung các biểu
đồ tròn cùng phong cách. Chart.js dùng file local seller/js/chart.min.js.

## Chạy và đăng nhập

Backend: D:\hoc tap\ComicWorm\comicworm.
Giao diện Spring nằm trong src/main/resources/templates/view; CSS/JS nằm
trong src/main/resources/static.

Cần import database/schema.sql và database/seed.sql vào database mới
bookmooch_db_v3, hoặc cấu hình datasource trỏ đúng database đã có schema.
Seed chỉ có danh mục/tác giả/NXB, không tạo đơn hàng hay tài khoản giả.
Chạy gradlew.bat bootRun với Java 21, không chạy profile preview khi đọc MySQL.
Có thể thêm --args='--spring.jpa.hibernate.ddl-auto=validate' để kiểm tra schema.

Đăng nhập ở http://localhost:8080/auth/login bằng tài khoản trong MySQL.
Người bán cần is_seller=true; quản trị cần role=ADMIN.

Tài khoản đăng nhập chưa có quyền seller chọn **Nâng cấp lên Người bán**
trong hồ sơ `/user/html/profile.html`, hoặc mở `/user/seller-upgrade`.
Trang này chỉ nâng cấp khi người dùng bấm nút gửi form; quyền `is_seller`
được lưu cho đúng tài khoản đang đăng nhập. Không đổi role USER thành ADMIN.
JWT hiện có sử dụng được ngay vì mỗi request nạp lại quyền từ database.

Tất cả `/seller/html/**` yêu cầu quyền SELLER, gồm dashboard, doanh thu,
quản lý sản phẩm và sidebar. Chưa đăng nhập chuyển đến `/auth/login`;
đã đăng nhập nhưng chưa nâng cấp chuyển đến `/user/seller-upgrade`.
Trang thống kê admin yêu cầu ADMIN. Hồ sơ và menu lấy danh tính từ
`/api/account/me`, không lấy quyền từ `localStorage.userRole`.
Trang seller tại cổng 5500/5501 chuyển sang backend 8080 để kiểm tra quyền
trước khi hiển thị; đăng nhập bằng endpoint `/auth/login` hiện có.

- Seller: /seller/html/revenue.html hoặc tab doanh thu trong dashboard.
- Admin: /admin/html/statistics.html.
- Các trang tại cổng 5500 gọi API cùng hostname ở cổng 8080. Đăng nhập trên
  cùng hostname (localhost hoặc 127.0.0.1) để cookie được gửi đúng.

## Nguồn dữ liệu và API

Các trang báo cáo gọi API, không đọc số liệu từ localStorage và không tự
đổi sang dữ liệu minh họa khi mất kết nối hoặc chưa đăng nhập.

GET /api/analytics/seller?from=2026-10-01&to=2026-10-07&grouping=day
GET /api/analytics/admin?from=2026-10-01&to=2026-10-07&grouping=week

API xác thực bằng cookie JWT hiện có. Mã người bán lấy từ phiên đã xác thực
trên server, không lấy từ tham số hay localStorage. Buyer bị từ chối 403;
người bán không đọc được báo cáo admin hoặc số liệu shop khác. Chưa đăng
nhập trả 401, khoảng ngày/cách nhóm sai trả 400.

API trả doanh thu, số đơn, số lượng, AOV, chuỗi thời gian, sản phẩm bán chạy,
cơ cấu thể loại/người bán/giá/trạng thái/vai trò và thông tin nguồn DATABASE.
Giá và tên sản phẩm dùng snapshot order_items, không dùng giá hiện tại.
Thể loại và tồn kho dùng dữ liệu sản phẩm hiện tại vì schema chưa có snapshot.

## Quy tắc báo cáo

Ngày đầu và ngày cuối đều được tính theo giờ Việt Nam. Backend chuyển
giới hạn sang UTC (database/backend đang lưu UTC), lọc từ đầu ngày đầu đến
đầu ngày sau ngày cuối. Chỉ đơn COMPLETED theo completed_at tạo doanh thu;
tiền hàng là tổng quantity * unit_price, không gồm phí vận chuyển. Thống kê
trạng thái dùng created_at; vai trò tài khoản dùng toàn bộ user chưa xóa.

Cột nhóm ngày/tuần/tháng, bao gồm ngày không có đơn, tuần bắt đầu thứ Hai.
Các tuần/tháng đầu và cuối chỉ tính phần trong khoảng được chọn. Tối đa
3.660 ngày. Bảng bán chạy đổi thứ tự số lượng/doanh thu và xuất CSV UTF-8.

Ba biểu đồ tròn người bán giữ thể loại, sự kiện/chiến dịch và phân khúc giá;
đổi được vành tròn/hình quạt, doanh thu/sản lượng và ẩn/hiện lát cắt.
Khu vực vẫn là biểu đồ cột. Schema hiện chưa lưu chiến dịch, giá bìa hoặc
tỉnh/vùng giao hàng riêng: báo cáo ghi Không gắn chiến dịch/Chưa xác định,
phân khúc dùng giá thực bán và nêu rõ trên giao diện. Không tạo tỷ lệ giả.

## Kiểm tra

Frontend: node --test scratch/test_analytics.js scratch/test_analytics_api.js.

Backend: gradlew.bat test --tests com.example.comicworm.AnalyticsTests.
Phân quyền/nâng cấp: gradlew.bat test --tests com.example.comicworm.SellerAccessTests.
Kiểm tra HTTP/MySQL dùng AnalyticsMySqlTests trên instance riêng, có đơn
fixture cho biên múi giờ, hai người bán, đơn hủy/đang giao, giá bán khác giá
hiện tại và đánh giá. Kết quả ở build/reports/analytics-mysql.txt.
Test kiểm tra đúng @@datadir của instance tạm và database chưa có tài khoản
trước khi thêm fixture; không chạy bài test này trên database đang sử dụng.

shared/js/analytics-data.js vẫn giữ bộ tính toán và dữ liệu mẫu phục vụ
kiểm tra cũ; các trang báo cáo thực tế không gọi loadDataset/demoDataset.
