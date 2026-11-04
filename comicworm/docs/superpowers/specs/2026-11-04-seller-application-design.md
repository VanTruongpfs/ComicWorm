# Đăng ký mở bán bằng CCCD và admin duyệt

Ngày: 2026-11-04 · Trạng thái: chờ duyệt spec

## Mục tiêu

Người dùng thường (Người mua) muốn trở thành Người bán phải gửi một hồ sơ đăng ký kèm
thông tin CCCD. Tài khoản chỉ có quyền Người bán (`users.is_seller = true`, sinh ra
`ROLE_SELLER`) sau khi admin duyệt hồ sơ. Admin từ chối phải ghi lý do; người dùng sửa
và gửi lại được.

Trước mắt CCCD chỉ là **bước thủ tục để demo**: form điền sẵn một bộ dữ liệu mẫu cố
định và hai ảnh mẫu có sẵn trong dự án. Không tải lên hay lưu ảnh của người dùng, và
không xác minh CCCD với bất kỳ nguồn bên ngoài nào.

### Thành công khi

- Người mua gửi được hồ sơ hợp lệ; trong lúc chờ duyệt vẫn chưa vào được khu vực Người bán.
- Admin thấy danh sách hồ sơ chờ duyệt, xem chi tiết, duyệt hoặc từ chối kèm lý do.
- Duyệt thì tài khoản có quyền Người bán ngay ở request kế tiếp (`JwtAuthenticationFilter`
  đọc lại user từ DB mỗi request).
- Bị từ chối thì người dùng thấy lý do và gửi lại được.

### Ngoài phạm vi

- Lưu ảnh CCCD thật, xác minh CCCD, OCR.
- Thông báo trong hệ thống: bảng `notifications.order_id` là `NOT NULL`, không dùng
  được cho hồ sơ không gắn đơn hàng. Người dùng xem trạng thái trên trang đăng ký.
- Thu hồi quyền Người bán qua hồ sơ: admin vẫn bật/tắt thủ công ở trang quản lý tài
  khoản như hiện tại (`AdminUserServiceImpl`).

## Hiện trạng

- `POST /user/seller-upgrade` luôn trả 403 "Chức năng tự nâng cấp Người bán đã bị vô
  hiệu hóa" (`SellerAccountController`). `GET` cũng trả 403 với người mua.
- `SellerUpgradeService` (nâng cấp ngay, không duyệt) tồn tại nhưng không được gọi.
- Sidebar, `products.js`, `revenue.js`, `analytics-page.js` đã link tới
  `/user/seller-upgrade` qua `upgradeUrl()`.
- CSRF đã bật cho `/user/seller-upgrade` và các thao tác ghi trên `/api/admin/**`;
  `/api/admin/**` yêu cầu `ROLE_ADMIN`.

## Luồng và trạng thái

```
Người mua ──gửi hồ sơ──▶ PENDING ──admin duyệt──▶ APPROVED  (users.is_seller = true)
                            │
                            └──admin từ chối + lý do──▶ REJECTED ──gửi lại──▶ PENDING (dòng mới)
```

Quy tắc:

1. Chỉ tài khoản `account_status = ACTIVE`, chưa xóa, chưa là Người bán mới gửi được hồ sơ.
2. Mỗi người tối đa **một** hồ sơ `PENDING`. Gửi khi đã có hồ sơ chờ duyệt trả 409. Khi gửi,
   service khóa dòng `users` (`UserRepository.lockById`) rồi mới kiểm tra, nên hai lần gửi
   đồng thời (hai tab) chỉ tạo một hồ sơ. (`schema_tools.py` không hỗ trợ cột sinh, nên
   không dùng UNIQUE ở mức DB.)
3. Mỗi lần gửi tạo một dòng mới; hồ sơ cũ giữ nguyên để làm lịch sử.
4. Duyệt: trong một transaction, khóa dòng hồ sơ (`PESSIMISTIC_WRITE`), kiểm tra vẫn
   `PENDING`, đặt `APPROVED` + người duyệt + thời gian, và đặt `users.is_seller = true`.
   Nếu tài khoản đã bị khóa hoặc xóa trong lúc chờ thì trả 409, không bật quyền.
5. Từ chối: lý do bắt buộc, 1–500 ký tự; hồ sơ phải đang `PENDING`.
6. Tài khoản đã là Người bán từ trước giữ nguyên quyền, không cần hồ sơ.

## Dữ liệu

Bảng mới `seller_applications` (khai báo trong `database/schema_model.py`, sinh
`schema.sql` và DBML bằng `build_schema.py`, kèm migration
`database/migrations/20261104_seller_applications.sql` chạy tay):

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | BIGINT PK | |
| `user_id` | BIGINT NOT NULL | FK `users` |
| `status` | VARCHAR(20) NOT NULL | `PENDING` / `APPROVED` / `REJECTED`, có CHECK |
| `id_number` | CHAR(12) NOT NULL | đúng 12 chữ số |
| `id_full_name` | VARCHAR(100) NOT NULL | |
| `id_date_of_birth` | DATE NOT NULL | |
| `id_issue_date` | DATE NOT NULL | |
| `id_issue_place` | VARCHAR(200) NOT NULL | |
| `submitted_at` | TIMESTAMP NOT NULL | mặc định thời điểm hiện tại |
| `reviewed_by` | BIGINT NULL | FK `users` (admin) |
| `reviewed_at` | DATETIME NULL | |
| `review_note` | VARCHAR(500) NULL | bắt buộc khi `REJECTED` (CHECK) |

Index `(status, submitted_at)` cho danh sách của admin.

Lưu ý khi sinh lại schema: thay đổi bảng `product_reviews` ngày 2026-10-19 có trong
`schema.sql` nhưng chưa có trong `schema_model.py`. Phải đưa thay đổi đó vào
`schema_model.py` (hoặc diff kết quả) để không mất khi chạy `build_schema.py`.

Entity `SellerApplication` + enum `SellerApplicationStatus` trong `model/`; ghi khóa
ngoại qua trường ID như quy ước dự án. Thời gian lưu UTC.

Profile `local` dùng `ddl-auto=update`: nếu app chạy trước migration, Hibernate tự tạo
bảng **thiếu** CHECK và khóa ngoại có tên. Vì vậy migration dùng `CREATE TABLE IF NOT
EXISTS` đầy đủ; nếu bảng đã do Hibernate tạo thì xóa bảng rỗng đó rồi tạo lại (bảng mới,
chưa có dữ liệu thật). Hướng dẫn trong `docs/new-machine-setup.md` ghi rõ chạy
migration trước khi khởi động app.

## Dữ liệu mẫu

Form điền sẵn bộ giá trị cố định (người dùng vẫn sửa được):

| Trường | Giá trị mẫu |
| --- | --- |
| Số CCCD | `001099012345` |
| Họ tên | `NGUYỄN VĂN MẪU` |
| Ngày sinh | `1999-01-01` |
| Ngày cấp | `2021-06-15` |
| Nơi cấp | `Cục Cảnh sát quản lý hành chính về trật tự xã hội` |

Hai ảnh `static/user/images/cccd-sample-front.svg` và `cccd-sample-back.svg` là hình
minh họa tự vẽ, ghi rõ chữ "MẪU", không chứa dữ liệu của người thật. Ảnh chỉ để hiển
thị trên form và trang admin, không gửi lên server.

## Kiểm tra hợp lệ

Áp dụng ở server (Bean Validation trên DTO + kiểm tra trong service); form HTML cũng có
`required`/`pattern` để báo sớm.

- Mọi trường bắt buộc, cắt khoảng trắng hai đầu.
- `id_number`: đúng 12 chữ số.
- Ngày sinh: đủ 18 tuổi tính đến hôm nay, không trước năm 1900.
- Ngày cấp: không ở tương lai, sau ngày sinh.
- Họ tên tối đa 100 ký tự, nơi cấp tối đa 200 ký tự.

## Giao diện và API

### Người dùng: `/user/seller-upgrade` (Thymeleaf, form POST, CSRF sẵn có)

| Trạng thái | Hiển thị |
| --- | --- |
| Chưa có hồ sơ | Form CCCD điền sẵn dữ liệu mẫu, hai ảnh mẫu, nút "Gửi hồ sơ" |
| `PENDING` | "Hồ sơ đang chờ duyệt", ngày gửi, thông tin đã gửi (chỉ đọc) |
| `REJECTED` (hồ sơ mới nhất) | Lý do từ chối + form để sửa và gửi lại (điền sẵn thông tin lần trước) |
| Đã là Người bán | Chuyển hướng sang `/seller/html/index.html` (khớp `SellerAccessTests`) |

`POST /user/seller-upgrade` nhận các trường form. Lỗi hợp lệ thì hiển thị lại form với
lỗi dưới từng ô; thành công thì redirect về `GET` (mẫu Post/Redirect/Get) để hiện trạng
thái chờ duyệt. Người dùng chưa đăng nhập bị chuyển tới trang đăng nhập như hiện tại.

### Admin: trang `admin/html/seller-applications.html`

Mục sidebar mới "Duyệt đăng ký Người bán" ngay dưới "Kiểm duyệt bài đăng" (nhóm ADMIN
và MANAGER trong `shared/sidebar/sidebar.js`). Trang gồm bộ lọc trạng thái (mặc định
chờ duyệt), danh sách hồ sơ, khung chi tiết (tài khoản, email, thông tin CCCD, ảnh
mẫu), nút Duyệt và nút Từ chối (mở ô nhập lý do bắt buộc). JS ở
`static/admin/js/seller-applications.js`, lấy CSRF token từ endpoint `/csrf` rồi gửi
qua header như `postModeration.js`.

API mới `AdminSellerApplicationController`, theo khuôn `AdminModerationController`:

```
GET  /api/admin/seller-applications?status=PENDING   danh sách (mới nhất trước)
GET  /api/admin/seller-applications/{id}              chi tiết
POST /api/admin/seller-applications/{id}/approve
POST /api/admin/seller-applications/{id}/reject      {"reason": "..."}
GET  /api/admin/seller-applications/csrf
```

Controller trả DTO, không trả entity. Mã lỗi: 404 không có hồ sơ, 409 hồ sơ không còn
`PENDING` hoặc tài khoản không còn hợp lệ, 400 lý do từ chối trống.

## Thành phần

| Thành phần | Trách nhiệm |
| --- | --- |
| `SellerApplicationService` | Gửi hồ sơ, đọc hồ sơ mới nhất của người dùng, danh sách/chi tiết cho admin, duyệt, từ chối. Thay thế `SellerUpgradeService` (xóa lớp cũ). |
| `SellerApplicationRepository` | Truy vấn theo người dùng/trạng thái, `findByIdForUpdate` có khóa ghi. |
| `SellerAccountController` | Trang và form `/user/seller-upgrade` theo trạng thái. |
| `AdminSellerApplicationController` | API admin ở trên. |
| DTO | `SellerApplicationForm` (form người dùng, có validation), `SellerApplicationDTO`, `RejectSellerApplicationRequest`. |

## Kiểm thử

- `SellerApplicationServiceTests` (Mockito): gửi hợp lệ tạo `PENDING`; từ chối gửi khi
  đã có hồ sơ chờ, khi đã là Người bán, khi tài khoản bị khóa/xóa; các lỗi hợp lệ (CCCD
  sai độ dài, chưa đủ 18 tuổi, ngày cấp tương lai/trước ngày sinh); duyệt bật
  `is_seller`; duyệt hồ sơ không còn `PENDING` trả 409; từ chối thiếu lý do trả 400;
  gửi lại sau khi bị từ chối tạo dòng mới.
- `AdminSellerApplicationControllerSecurityTests` (`@WebMvcTest`): người mua và khách
  nhận 403/401; admin thiếu CSRF bị chặn khi duyệt/từ chối; admin có CSRF thành công.
- `SellerAccessTests`: viết lại theo luồng mới (người mua gửi hồ sơ được nhưng vẫn
  không vào được `/seller/**` và `/api/seller/**` trước khi được duyệt).
- Controller trang người dùng: render đúng theo từng trạng thái, lỗi hợp lệ hiện lại form.
- Kiểm tra schema: `python database/build_schema.py` và `verify_mysql.py`.

Mốc so sánh toàn bộ test: 297 test, 13 hỏng sẵn có (`AccountProfileTests`,
`ComicwormApplicationTests`, `ProductModerationTests`, `SellerAccessTests`). Sau thay
đổi, không được có test hỏng mới; hai test của `SellerAccessTests` được viết lại.
