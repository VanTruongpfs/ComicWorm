# ComicWorm

Ảnh sản phẩm của seller được upload lên Cloudinary và lưu URL vào MySQL.
Form thêm/sửa sản phẩm có **Ảnh bìa** và **Ảnh chi tiết**. Bấm **Lưu** để
tải ảnh lên Cloudinary và lưu sản phẩm cùng ảnh trong một transaction.
Xem [hướng dẫn Cloudinary](docs/cloudinary.md) để biết cấu hình và API.

Chức năng **Tìm bằng bìa** dùng CLIP để tạo vector ảnh, lưu trong MySQL và tìm
sản phẩm bằng cosine similarity. Xem [cách chạy tìm kiếm bằng ảnh](docs/image-search.md)
để cài môi trường Python một lần. Sau đó Spring Boot tự khởi động CLIP local
cùng web và tự lập chỉ mục ảnh.

Project Spring Boot 3.5.6, Gradle và Java 21 theo `build.gradle`. Giao diện nằm trong `src/main/resources/templates/view` (HTML) và `src/main/resources/static` (CSS/JS).

## Chạy trên máy mới

Xem [hướng dẫn cài đặt trên máy mới](docs/new-machine-setup.md) để tạo MySQL,
copy cấu hình local, cài dịch vụ Python và chạy tìm kiếm ảnh.
Để cài Ollama và tạo model chatbot local, xem [hướng dẫn cấu hình chatbot](docs/chatbot-ollama-setup.md).
Chạy lệnh sau tại thư mục backend sau khi chuẩn bị database và cấu hình:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

Truy cập:

- Cổng điều hướng: http://localhost:8080/
- Người mua: http://localhost:8080/buyer/html/home.html
- Người bán: http://localhost:8080/seller/html/index.html
- Quản trị: http://localhost:8080/admin/html/dashboard.html
- Đăng nhập: http://localhost:8080/auth/html/login.html

`application-local.properties`, môi trường Python, model và dữ liệu MySQL
không được đưa vào Git. Bản clone mới cần tạo cấu hình từ
`application-local.example.properties`; profile `local` nạp file cấu hình này.
Profile `preview` tắt scheduling nên không dùng cho lập chỉ mục ảnh.

## Cấu trúc

```text
comicworm/
├── build.gradle
├── gradlew.bat
├── database/                         # SQL, DBML và bảng ánh xạ 25 chức năng
├── tools/verify_spring_mysql.py      # Kiểm tra với MySQL tách biệt
└── src/
    ├── main/
    │   ├── java/com/example/comicworm/
    │   │   ├── ComicwormApplication.java
    │   │   ├── config/SecurityConfig.java
    │   │   ├── controller/ViewController.java
    │   │   ├── service/               # Interface nghiệp vụ
    │   │   │   └── impl/              # Các lớp @Service triển khai
    │   │   ├── repository/            # 32 JpaRepository
    │   │   ├── model/                 # 32 entity, khớp 232 cột SQL
    │   │   │   ├── id/                # 2 lớp khóa chính ghép
    │   │   │   └── enums/             # 14 enum trạng thái
    │   │   ├── dto/request/
    │   │   ├── dto/response/
    │   │   ├── mapper/
    │   │   └── exception/
    │   └── resources/
    │       ├── application.properties
    │       ├── application-preview.properties
    │       ├── static/                # 54 CSS + 52 JS, theo từng khu vực
    │       └── templates/
    │           └── view/             # 61 HTML, theo từng khu vực
    └── test/java/com/example/comicworm/
        ├── ComicwormApplicationTests.java
        └── JpaMappingIntegrationTests.java
```

`model` chứa 32 entity cùng khóa chính ghép và enum; `repository` truy cập database. `dto/request` và `dto/response` chứa dữ liệu nhận/trả của API. `controller` nhận request; `service` và `service/impl` xử lý nghiệp vụ, transaction. `mapper` chuyển model/DTO và `exception` dành cho xử lý lỗi.

`ViewController` dùng Thymeleaf để render 61 HTML trong `resources/templates/view`. CSS/JS ở `resources/static`. Các URL cũ, ví dụ `/buyer/html/home.html` và `/shared/footer/footer.html`, được giữ nguyên, nên liên kết và fetch thành phần giao diện vẫn hoạt động. Mã nguồn HTML không bị thay đổi khi chuyển thư mục. [Spring Boot hỗ trợ template trong thư mục templates](https://docs.spring.io/spring-boot/reference/web/servlet.html#web.servlet.spring-mvc.template-engines).

Luồng xử lý: `request → controller → service → repository → model/database`; controller trả DTO cho API hoặc tên view để render HTML. Các package nghiệp vụ còn là khung để triển khai tiếp; ViewController đã hoạt động.

## Chạy cùng MySQL

Import `database/schema.sql`, rồi `database/seed.sql` bằng MySQL Workbench hoặc mysql CLI. Schema tạo database `bookmooch_db_v3`, dùng MySQL 8.0.16+; seed chỉ có danh mục/tác giả/nhà xuất bản.

```powershell
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = 'mat_khau_mysql_cua_ban'
# Nếu đổi host/cổng/tên database, đặt thêm DB_URL.
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

Mẫu local dùng `ddl-auto=update` cho môi trường phát triển để bổ sung các
thay đổi entity sau khi import schema. SQL/script nằm ở thư mục `database`,
bên ngoài thư mục giao diện công khai. Không commit file chứa mật khẩu.

Luồng đăng nhập, nâng cấp seller và thống kê có thể chạy với profile `local`.
Cấu hình `app.base.url` và Spring Mail nằm trong `application-local.properties`
để các bean xác thực khởi tạo đầy đủ. Khi cần gửi email xác minh đăng ký,
đặt `MAIL_USERNAME` và `MAIL_PASSWORD` bằng tài khoản SMTP và mật khẩu ứng
dụng của bạn. Có thể đổi `MAIL_HOST`, `MAIL_PORT`, `MAIL_SMTP_AUTH`,
`MAIL_STARTTLS` và `APP_BASE_URL`; mặc định dùng Gmail SMTP cổng 587.

## Quy ước entity

- Dữ liệu và enum khớp schema 32 bảng phục vụ 25 chức năng trong `Nhom8_ChucNang.docx`; không thêm bảng của các chức năng đã bỏ khỏi database.
- Tiền dùng `BigDecimal`, ID dùng `Long`/`Integer`, JSON dùng `List<Double>` hoặc `List<Long>`, thời gian lưu UTC.
- Các trường ID khóa ngoại là nơi ghi dữ liệu: ví dụ `product.setSellerId(userId)`. Quan hệ như `product.getSeller()` chỉ đọc, tải lazy; không có setter cho quan hệ. Cách này xử lý nhất quán các khóa ghép dùng chung cột trong phòng trao đổi.
- `PaymentAllocationId(paymentId, orderId)` và `ExchangeRoomMemberId(roomId, userId)` là khóa ghép dùng cho `findById`.
- Không có cascade xóa dữ liệu lịch sử. Service cần dùng soft delete cho người dùng/sản phẩm và kiểm tra quyền, trạng thái, tồn kho, idempotency trong transaction.
- Không trả entity trực tiếp từ controller. DTO sẽ tránh lộ dữ liệu riêng tư và tránh phụ thuộc quan hệ lazy. Password/token hash đã có `@JsonIgnore`.
- Các màn hình cũ như voucher/ví/CSKH vẫn được chuyển nguyên vẹn; database chỉ triển khai phạm vi chức năng trong tài liệu đã chốt.

## Kiểm tra và đóng gói

```powershell
.\gradlew.bat test bootWar
```

Kiểm tra thường chạy profile preview, kiểm tra HTTP của 106 tài nguyên CSS/JS, 61 view HTML, trang không tồn tại và quyền truy cập. Các bài kiểm tra JPA trên MySQL chỉ chạy khi đặt `JPA_INTEGRATION_TEST=true`; có thể dùng script tạo MySQL riêng biệt, import schema, chạy test rồi dừng MySQL:

```powershell
python tools/verify_spring_mysql.py --mysql-bin 'C:\Program Files\MySQL\MySQL Server 9.0\bin' --java-home "$env:JAVA_HOME"
```

Kết quả nằm trong `build/reports/tests/test/index.html` và `build/reports/mysql-integration.txt`. File chạy nằm ở `build/libs/comicworm-0.0.1-SNAPSHOT.war`:

```powershell
& "$env:JAVA_HOME\bin\java.exe" -jar build/libs/comicworm-0.0.1-SNAPSHOT.war --spring.profiles.active=preview
```


## Báo cáo doanh thu từ MySQL

Biểu đồ cột theo khoảng ngày, ba biểu đồ tròn người bán, thống kê admin và
bảng bán chạy dùng Chart.js với API xác thực `/api/analytics/seller` và
`/api/analytics/admin`. Người bán chỉ xem dữ liệu của tài khoản đăng nhập.
Giữ giao diện người bán hiện có; không dùng dữ liệu mẫu khi lỗi kết nối.

Đăng nhập tại `/auth/login`, rồi mở `/seller/html/revenue.html` hoặc
`/admin/html/statistics.html`. Cần database có schema của project; profile
`preview` không cung cấp API MySQL. Xem [hướng dẫn thống kê](docs/analytics.md)
để biết cấu hình, quy tắc ngày/doanh thu và các trường chưa có trong schema.

## CRUD sản phẩm cho seller

Đăng nhập tại `/auth/login`, nâng cấp tài khoản tại `/user/seller-upgrade`,
rồi mở `/seller/html/quan-ly-san-pham.html`. Trang dùng jTable để thêm, xem,
sửa và xóa sản phẩm trong MySQL; có tìm kiếm, lọc thể loại/tồn kho, sắp xếp
và phân trang. Seller chỉ quản lý sản phẩm của chính mình. Sản phẩm mới hoặc
chỉnh sửa chuyển sang chờ duyệt; xóa mềm giữ nguyên lịch sử đơn hàng.

Xem [hướng dẫn CRUD sản phẩm](docs/seller-products.md) để biết API, dữ liệu
và cách chạy kiểm thử trên MySQL riêng biệt.
