# Database theo Nhom8_ChucNang.docx

Phạm vi hiện tại chỉ dựa trên 25 chức năng trong tài liệu Word người dùng gửi:
12 chức năng bắt buộc/đặc trưng, 10 tự chọn, 3 bổ sung. Cả ba nhóm được giữ.
Schema có **32 bảng, 232 thuộc tính, 49 khóa ngoại, 44 CHECK**.

## File cần dùng

| File | Nội dung |
| --- | --- |
| [schema.sql](schema.sql) | MySQL DDL cho database mới bookmooch_db_v3 |
| [seed.sql](seed.sql) | Danh mục, tác giả và NXB tham chiếu; không có user/số dư giả |
| [bookmooch.dbml](bookmooch.dbml) | Mã dán vào dbdiagram, dùng khi không hỗ trợ TableGroup |
| [bookmooch.grouped.dbml](bookmooch.grouped.dbml) | Cùng cấu trúc, thêm 7 nhóm với tên tg_* đúng cú pháp |
| [FUNCTION_MAP.md](FUNCTION_MAP.md) | Ánh xạ đủ 25 chức năng và lý do giữ từng bảng |
| [example_queries.sql](example_queries.sql) | Chi tiết/lọc sản phẩm, mới nhất/bán chạy, lịch sử và biểu đồ |
| [schema_model.py](schema_model.py) | Nguồn định nghĩa bảng/thuộc tính theo tài liệu |
| [schema_tools.py](schema_tools.py) | Sinh SQL/DBML và kiểm tra quan hệ/định danh |
| [build_schema.py](build_schema.py) | Điểm chạy để sinh lại schema |
| [verify_mysql.py](verify_mysql.py) | Điểm chạy kiểm tra SQL trên MySQL tạm riêng |
| [validation.txt](validation.txt) | Kết quả kiểm tra bản hiện tại |

Bản 76 bảng và schema gốc được giữ trong archive/v2 chỉ để đối chiếu, không
được nhập hoặc sinh lại trong schema hiện tại.

## Cách sử dụng

Trong MySQL Workbench, chạy schema.sql rồi seed.sql trên database v3 trống.
File không DROP hoặc sửa database cũ; không chạy lại DDL lên database đã có
các bảng v3. Đây là bản khởi tạo, không tự chuyển dữ liệu cũ sang bảng mới.

Mở [dbdiagram.io](https://dbdiagram.io/d) và dán bookmooch.dbml. Bản grouped dùng
cú pháp `TableGroup tg_auth { ... }`, không đặt tên trong nháy đơn và không dùng
tên bắt đầu bằng số. Tài khoản phải hỗ trợ TableGroup để hiển thị bản có nhóm.
Dùng schema.sql để triển khai vì DBML chỉ giữ ON UPDATE trong note.

```powershell
python database/build_schema.py
python database/verify_mysql.py --mysql-bin "C:\Program Files\MySQL\MySQL Server 9.0\bin"
```

## Đã rút gọn

- Gộp comic_series/comic_items/posts thành products: tên, mô tả, giá, tồn,
  tác giả/NXB/thể loại, tình trạng và thuộc tính xem chi tiết.
- User dùng role USER/ADMIN và is_seller; bỏ RBAC chi tiết, staff, KYC,
  đăng ký gian hàng, tài khoản ngân hàng và dữ liệu cấp bậc shop.
- Bỏ wishlist, tin tìm mua, voucher/Coins đổi voucher, kho SKU nâng cao,
  phụ kiện, lịch sử nhập/xuất, supplier, giá vốn và ngưỡng tồn.
- Bỏ ví tiền, rút tiền, escrow/cọc hai chiều, biểu phí và doanh thu phí sàn.
  Loyalty chỉ là điểm tự tích khi mua; refund về thanh toán gốc khi hủy đơn.
- Bỏ ticket CSKH, SLA/Tier 2, tranh chấp đổi trả, báo cáo/kháng cáo, bài cộng
  đồng và audit console. Chatbot tư vấn dùng consultation_* riêng, không phải CSKH.
- Phòng trao đổi giữ thành viên, tin nhắn, đề nghị từng sản phẩm và xác nhận;
  không có đơn vận chuyển hai chiều/thu cọc vì tài liệu chỉ yêu cầu phòng trao đổi.
- Giữ embedding ảnh, lịch sử chatbot và kết quả phân loại để phục vụ 3 chức
  năng bổ sung. Không tạo bảng lưu biểu đồ: thống kê được truy vấn từ dữ liệu gốc.

Database là phần lưu trữ. Dự án vẫn cần backend/API thay mock/localStorage,
Google OAuth, gateway thanh toán và mô hình AI để chạy các chức năng thật.
Máy hiện có MySQL 9.0.1; các kiểm tra engine thực tế dùng phiên bản này.
SQL dùng các tính năng MySQL 8.0.16+; chưa chạy lại trên MySQL 8/MariaDB.

Sơ đồ đã cập nhật: [ComicWorm Nhóm 8](https://dbdiagram.io/d/ComicWorm-Nhom-8-25-chuc-nang-6ac507790f25a52d01a7df53).
