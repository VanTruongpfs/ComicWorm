# Chạy ComicWorm trên máy mới

Các lệnh bên dưới dành cho Windows PowerShell, chạy trong thư mục backend
`ComicWorm/comicworm` có `gradlew.bat` và `build.gradle`.
Dự án hiện dùng Spring Boot 3.5.6 và Java 21 theo `build.gradle`.

## 1. Cài công cụ và lấy mã nguồn

Cài Git, JDK 21, MySQL 8.0.16 trở lên và Python 3.11 64-bit. Python chỉ cần
khi chạy dịch vụ tìm kiếm ảnh. Không cần cài Gradle riêng vì đã có wrapper.

Các thay đổi mã nguồn và file cấu hình mẫu cần được commit/push lên repository
trước khi máy khác clone/pull bản mới. File cấu hình thật và model vẫn được bỏ qua.

```powershell
git clone https://github.com/VanTruongpfs/ComicWorm.git
cd ComicWorm\comicworm
java -version
py -3.11 --version
```

Đặt `JAVA_HOME` trỏ tới JDK 21 và thêm thư mục `bin` của JDK vào `PATH`. Lần chạy đầu cần
Internet để Gradle tải các thư viện Java và Python tải thư viện/mô hình.

## 2. Tạo MySQL và cấu hình riêng

Trên MySQL mới, mở Workbench và chạy `database/schema.sql`, sau đó chạy
`database/seed.sql`. Schema tạo database `bookmooch_db_v3`; seed cung cấp danh
mục, tác giả và nhà xuất bản.

Git không mang theo dữ liệu đang có trên máy của người khác. Nếu muốn có cùng
sản phẩm, tài khoản và vector đã tạo, cần xuất/nhập bản sao database riêng.
Nếu nhập một bản sao DB đã có schema thì không chạy lại `schema.sql` lên nó.
Ảnh sản phẩm vẫn nằm trên Cloudinary/Picsum theo URL lưu trong DB.

Tạo file cấu hình local nếu chưa có:

```powershell
if (-not (Test-Path -LiteralPath application-local.properties)) {
    Copy-Item application-local.example.properties application-local.properties
}
```

Sửa `application-local.properties`:

- Điền `spring.datasource.username` và `spring.datasource.password` của MySQL máy mới.
- Đổi `spring.datasource.url` nếu host, port hoặc tên database khác.
- Đặt `app.jwt.secretkey` thành chuỗi ngẫu nhiên riêng, ít nhất 32 ký tự.
- Có thể điền `app.admin.email` và `app.admin.password` (tối thiểu 8 ký tự)
  để tạo tài khoản quản trị đầu tiên khi khởi động. Bỏ trống cả hai nếu không cần.

Cũng có thể đặt các biến môi trường tương ứng `DB_USERNAME`, `DB_PASSWORD`,
`DB_URL`, `JWT_SECRET_KEY`, `ADMIN_EMAIL` và `ADMIN_PASSWORD` thay cho sửa giá trị.

File local đầy đủ không phụ thuộc `src/main/resources/application.properties`,
vì file đó không được đưa vào Git. Mẫu dùng `ddl-auto=update` cho môi trường
phát triển để đồng bộ các cột bổ sung từ entity sau khi khởi tạo schema.

## 3. Chạy web

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

Giữ terminal chạy. Spring đọc `application-local.properties` ở thư mục hiện
tại khi profile `local` được kích hoạt. Xem [quy tắc cấu hình Spring Boot](https://docs.spring.io/spring-boot/reference/features/external-config.html).

Truy cập:

- Trang chủ: <http://localhost:8080/buyer/html/home.html>
- Đăng nhập: <http://localhost:8080/auth/login>
- Tìm bằng ảnh: <http://localhost:8080/buyer/html/image-search.html>

Chạy từ IntelliJ: chọn JDK 21, working directory là thư mục backend và active
profile `local`. Thay đổi file cấu hình rồi khởi động lại ứng dụng để áp dụng.
Không dùng profile `preview` để chạy lập chỉ mục ảnh: profile đó tắt scheduling.
Mẫu local đã bật tìm kiếm ảnh và tự mở CLIP. Nếu chưa cài Python ở bước 4,
web vẫn chạy; tìm kiếm ảnh dùng được sau khi cài xong và khởi động lại web.

## 4. Cài Python một lần để web tự mở CLIP

Tại thư mục backend, chỉ cài một lần trên mỗi máy:

```powershell
py -3.11 -m venv services/image-embedding/.venv
& services/image-embedding/.venv/Scripts/python.exe -m pip install --upgrade pip
& services/image-embedding/.venv/Scripts/python.exe -m pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cpu
& services/image-embedding/.venv/Scripts/python.exe -m pip install -r services/image-embedding/requirements.txt
```

Lệnh PyTorch chọn bản CPU, không cần GPU hoặc CUDA. Tham khảo [bản cài chính
thức PyTorch](https://pytorch.org/get-started/previous-versions/#v291).

Sau khi cài, khởi động lại web bằng đúng lệnh ở bước 3:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

**Không cần mở terminal Python riêng.** Trong mẫu local, hai thuộc tính sau
đã được bật. Nếu dùng file cấu hình cũ, bổ sung:

```properties
app.image-search.enabled=true
app.image-search.auto-start=true
```

Spring Boot tự chạy CLIP ở `127.0.0.1:8091` sau khi web khởi động, dùng Python
trong `services/image-embedding/.venv`. Chờ log web báo `Local image model is ready`,
hoặc kiểm tra <http://127.0.0.1:8091/health> trả `status=ready` và `dimensions=512`.
Tiến trình tải/nạp model được ghi vào `build/logs/image-embedding.log`.
Web vẫn phục vụ trong lúc model nạp; tìm kiếm ảnh có thể trả 503 cho đến khi sẵn sàng.

Lần đầu, dịch vụ tự tải CLIP gốc từ Hugging Face vào cache trên máy mới. Không
cần copy model từ máy cũ. `.venv`, cache và trọng số model không nằm trong Git.
Model fine-tune riêng phải được chuyển bằng thư mục/ZIP riêng và cấu hình
đường dẫn nạp tương ứng; mã hiện tại mặc định dùng CLIP gốc đã cố định revision.

Từ các lần sau chỉ cần chạy web; không chạy lại các lệnh cài thư viện.
Khi dừng web bình thường bằng Ctrl+C hoặc Stop trong IDE, web dừng tiến trình
Python do nó tự mở. Nếu CLIP đã chạy sẵn đúng model/cổng thì web dùng lại và
không dừng tiến trình có sẵn đó. Không khởi động thêm nếu cổng đang bị ứng dụng khác chiếm.

Nếu chạy WAR từ thư mục khác, đặt `app.image-search.working-directory` bằng
đường dẫn tuyệt đối tới thư mục backend có `services/image-embedding/app.py`.
Có thể chỉ định Python riêng qua `app.image-search.python-executable`.
Muốn tự quản lý dịch vụ Python, đặt `app.image-search.auto-start=false` và xem
lệnh chạy tay trong [hướng dẫn tìm kiếm ảnh](image-search.md).

Nếu DB mới chưa có sản phẩm/ảnh thì tìm kiếm chưa có kết quả. Sau khi thêm ảnh,
Spring tự tạo vector theo lô. Chỉ sản phẩm đã duyệt, đang bật và chưa xóa mới
được trả về. Ảnh mẫu Picsum giúp kiểm tra luồng; tìm theo bìa truyện thật cần
dữ liệu ảnh bìa thật. Chi tiết ở [hướng dẫn tìm kiếm ảnh](image-search.md).

## 5. Cấu hình các dịch vụ khác khi cần

| Chức năng | Giá trị cần cung cấp |
| --- | --- |
| Upload ảnh | `cloudinary.cloud-name`, `cloudinary.api-key`, `cloudinary.api-secret` |
| Email đăng ký/quên mật khẩu | `spring.mail.username`, `spring.mail.password` và SMTP tương ứng |
| Chatbot Gemini | `spring.ai.model.chat=google-genai` và `spring.ai.google.genai.api-key` |
| Đăng nhập Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callback `/login/oauth2/code/google` |
| VNPay | `vnpay.tmn-code`, `vnpay.hash-secret` và URL callback phù hợp |

Mẫu mặc định đặt `spring.ai.model.chat=none` để web chạy được khi chưa có key
Gemini. Đây là [cấu hình tắt chatbot được Spring AI hỗ trợ](https://docs.spring.io/spring-ai/reference/1.1/api/chat/google-genai-chat.html).
Tìm ảnh CLIP local không sử dụng key Gemini.

Các khóa riêng được điền trong file local đã gitignore hoặc biến môi trường.
Thông tin dịch vụ cần dùng chung giữa các thành viên phải được chuyển riêng.

## Kiểm tra hướng dẫn

Đã thử khởi động bản ứng dụng với riêng mẫu local này, bỏ qua cấu hình đóng
gói trong ứng dụng và dùng MySQL tạm khởi tạo từ schema/seed. Trang chủ,
đăng nhập, trang tìm ảnh và API danh mục đều trả HTTP 200; chatbot xử lý đúng
trạng thái chưa cấu hình key. Kết quả local: `build/reports/new-machine-setup.txt`.
