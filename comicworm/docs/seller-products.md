# Quản lý sản phẩm seller

Chức năng chạy với profile mặc định và MySQL. Khởi động lại backend sau khi
cập nhật mã nguồn, đăng nhập tại `/auth/login`, rồi mở
`/seller/html/quan-ly-san-pham.html`. Tài khoản mua hàng phải nâng cấp tại
`/user/seller-upgrade` trước khi vào trang seller.

Token CSRF của form được giữ ổn định khi server nạp JWT trên các request.
Đăng nhập và đăng xuất sẽ xóa token cũ. Nếu phiên xác nhận hết hạn (ví dụ
backend vừa khởi động lại), trang nâng cấp tự tải lại và hiện thông báo để
bạn bấm xác nhận lần nữa; yêu cầu bị từ chối không thay đổi tài khoản.

Trang dùng jTable 2.6.0, jQuery 3.7.1 và jQuery UI 1.14.2 được lưu tại
`static/shared/vendor`, cùng thông tin nguồn và giấy phép. Giao diện gốc tại
`D:\hoc tap\TMDT CuoiKy\src` cũng đã được đồng bộ. Live Server chuyển trang
seller sang backend để kiểm tra quyền truy cập.

## Sử dụng

- **Thêm sản phẩm:** nhập tên, mô tả, thể loại, độ mới, giá bán, tồn kho,
  hình thức bán/trao đổi và trạng thái hiển thị. Có thể bổ sung tác giả, nhà
  xuất bản, số tập, phiên bản, năm xuất bản và mong muốn trao đổi.
  Chọn 1 ảnh bìa và tối đa 7 ảnh chi tiết ngay trong form; mỗi ảnh tối đa 5 MB.
  Bấm **Lưu** để upload Cloudinary và lưu cả sản phẩm lẫn URL vào MySQL.
- **Xem:** tìm theo tên hoặc mã, lọc theo thể loại/tồn kho, sắp xếp bằng
  tiêu đề cột; nút **Xem** mở thông tin đầy đủ.
- **Sửa:** nút bút chì mở form có dữ liệu hiện tại. Giá/tồn kho không âm;
  độ mới từ 0–100%; giá tối đa 13 chữ số nguyên và 2 chữ số thập phân.
  Có thể thay ảnh bìa, thêm ảnh chi tiết hoặc tích gỡ ảnh cũ. Nếu không chọn
  ảnh mới thì giữ nguyên ảnh. Khi upload thất bại, cả thông tin và ảnh cũ
  được giữ nguyên; form cho phép sửa và thử lại.
- **Xóa:** nút thùng rác yêu cầu xác nhận, sau đó đặt `deleted_at` và tắt
  hiển thị. Sản phẩm biến mất khỏi danh sách nhưng đơn hàng cũ vẫn tồn tại.

Mỗi lần thêm hoặc sửa, `moderation_status` chuyển về `PENDING`; seller không
thể tự duyệt sản phẩm. Tổng quan kho tính trên mọi sản phẩm chưa xóa của
seller, độc lập với bộ lọc đang chọn. Giá trị kho là giá bán × tồn kho.

## API

Tất cả endpoint dưới `/api/seller/products` yêu cầu JWT của seller. Server
lấy seller ID từ tài khoản đăng nhập, không nhận chủ sở hữu từ client.

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `/api/seller/products` | Danh sách và tổng quan kho |
| GET | `/api/seller/products/options` | Thể loại, tác giả, nhà xuất bản |
| GET | `/api/seller/products/{id}` | Chi tiết sản phẩm của seller |
| GET | `/api/seller/products/csrf` | Token và tên header CSRF |
| POST | `/api/seller/products` | Tạo sản phẩm |
| PUT | `/api/seller/products/{id}` | Cập nhật sản phẩm |
| DELETE | `/api/seller/products/{id}` | Xóa mềm sản phẩm |

Danh sách nhận `jtStartIndex`, `jtPageSize` (1–100), `jtSorting`, `search`,
`categoryId`, `stock` (`all`, `in_stock`, `low_stock`, `out_of_stock`).
Start index phải chia hết cho page size. Các cột sắp xếp được kiểm tra bằng
danh sách cho phép, không đưa trực tiếp vào câu SQL.

Form POST/PUT gửi multipart: `product` là JSON tương ứng `SellerProductRequest`,
`coverImage` là ảnh bìa, `detailImages` là các ảnh chi tiết và `removeImageIds`
là JSON danh sách ảnh chi tiết cần gỡ khi sửa. API vẫn hỗ trợ JSON cho các
client cũ chỉ cập nhật thông tin. POST/PUT/DELETE cần
cookie đăng nhập và header CSRF từ endpoint `/csrf`. `products-api.js` tự
lấy token và gửi cookie. Response theo định dạng jTable: `Result: "OK"`,
`Records`/`Record`; lỗi trả `Result: "ERROR"`, `Message` cùng HTTP status.
Sản phẩm của shop khác hoặc đã xóa trả 404. Khách chưa đăng nhập trả 401;
tài khoản chưa là seller trả 403.

## Kiểm thử

Script Windows tạo MySQL trong thư mục tạm, import schema/seed và chạy HTTP
CRUD bằng tài khoản mẫu. Script xác minh đường dẫn dữ liệu trước khi chạy;
không dùng database đang cấu hình của ứng dụng.

```powershell
python tools/verify_products_mysql.py --mysql-bin 'C:\Program Files\MySQL\MySQL Server 9.0\bin' --java-home 'C:\Users\PC\.jdks\ms-21.0.11'
```

Báo cáo tại `build/reports/products-mysql.txt` và
`build/reports/tests/test/index.html`. Các ca kiểm tra gồm CRUD, sở hữu sản
phẩm, dữ liệu sai, CSRF, phân trang/sắp xếp/lọc, ký tự tìm kiếm `%`/`_` và
giữ lịch sử doanh thu sau xóa.

Entity `Product.coverImageUrl` ánh xạ `products.cover_image_url`; `Product.images`
liên kết các dòng `ProductImage` qua `@OneToMany`. `ProductImage.imageType`
ánh xạ `product_images.image_type` với `COVER` hoặc `DETAIL`.
Database cũ cần chạy `python tools/migrate_product_images.py` rồi khởi động
lại backend. Xem [hướng dẫn ảnh Cloudinary](cloudinary.md).

Thêm `--preview` để mở backend kiểm thử tại cổng 18081 trong tối đa 15 phút.
Có thể chạy `tools/verify_product_images_browser.cjs` bằng Node với package
`playwright` để kiểm tra upload thật từ form jTable bằng Chrome. Kiểm thử
tự dọn các ảnh thử trên Cloudinary; ảnh chụp và kết quả ở `build/reports`. Tạo file
`build/reports/products-preview-stop.signal` để dừng bản kiểm thử sớm.
