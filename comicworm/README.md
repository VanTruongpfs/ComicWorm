# ComicWorm

Project Spring Boot 4.1.1, Gradle và Java 25. Giao diện được chuyển từ `D:\hoc tap\TMDT CuoiKy\src` vào `src/main/resources/templates/view` (HTML) và `src/main/resources/static` (CSS/JS); giữ nguyên 167 file (61 HTML, 54 CSS, 52 JS) và các đường dẫn tương đối. Bản gốc vẫn được giữ tại project cũ.

## Chạy giao diện ngay, chưa cần MySQL

Mở terminal tại thư mục này:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.2'
.\gradlew.bat bootRun --args='--spring.profiles.active=preview'
```

Truy cập:

- Cổng điều hướng: http://localhost:8080/
- Người mua: http://localhost:8080/buyer/html/home.html
- Người bán: http://localhost:8080/seller/html/index.html
- Quản trị: http://localhost:8080/admin/html/dashboard.html
- Đăng nhập: http://localhost:8080/auth/html/login.html

Profile `preview` tắt kết nối database/JPA. Các trang hiện dùng dữ liệu mẫu/localStorage như giao diện cũ; đăng nhập, thanh toán, AI và các chức năng nghiệp vụ chưa được nối với API. SecurityConfig cho phép đọc các tài nguyên giao diện; các đường dẫn API cần xác thực và CSRF vẫn được giữ.

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
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.2'
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = 'mat_khau_mysql_cua_ban'
# Nếu đổi host/cổng/tên database, đặt thêm DB_URL.
.\gradlew.bat bootRun
```

`ddl-auto=validate` kiểm tra entity khớp SQL, không tự tạo/thay đổi bảng. SQL/script được đặt ở thư mục `database` của project, bên ngoài thư mục giao diện công khai. Không commit mật khẩu vào application.properties.

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
python tools/verify_spring_mysql.py --mysql-bin 'C:\Program Files\MySQL\MySQL Server 9.0\bin' --java-home 'C:\Program Files\Java\jdk-25.0.2'
```

Kết quả nằm trong `build/reports/tests/test/index.html` và `build/reports/mysql-integration.txt`. File chạy nằm ở `build/libs/comicworm-0.0.1-SNAPSHOT.war`:

```powershell
& "$env:JAVA_HOME\bin\java.exe" -jar build/libs/comicworm-0.0.1-SNAPSHOT.war --spring.profiles.active=preview
```
