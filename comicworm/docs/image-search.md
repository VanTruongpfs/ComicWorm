# Tìm sản phẩm bằng hình ảnh

Chức năng dùng CLIP để trích xuất vector ảnh 512 chiều, lưu JSON vào bảng
`product_image_features` hiện có, sau đó so sánh cosine để tìm ảnh tương tự.
Không cần thêm bảng hoặc thay MySQL bằng cơ sở dữ liệu vector.

Máy vừa clone project cần chuẩn bị database và cấu hình theo
[hướng dẫn máy mới](new-machine-setup.md) trước khi thực hiện các lệnh dưới đây.

## Cách chạy

Cần Java 21, MySQL với schema hiện tại, Python 3.11 và dung lượng để tải
PyTorch cùng mô hình CLIP. CPU chạy được; lần khởi động đầu cần Internet để tải
mô hình. Các lần sau dùng cache Hugging Face trên máy.

Mở terminal tại thư mục backend, cài môi trường Python một lần:

```powershell
py -3.11 -m venv services/image-embedding/.venv
& services/image-embedding/.venv/Scripts/python.exe -m pip install --upgrade pip
& services/image-embedding/.venv/Scripts/python.exe -m pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cpu
& services/image-embedding/.venv/Scripts/python.exe -m pip install -r services/image-embedding/requirements.txt
```

Sau khi tạo `application-local.properties` từ mẫu và cấu hình MySQL theo
hướng dẫn máy mới, chỉ cần chạy web:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

Mẫu local bật sẵn `app.image-search.enabled=true` và
`app.image-search.auto-start=true`. Nếu dùng cấu hình cũ, bổ sung hai dòng này
rồi khởi động lại web. Spring tự mở CLIP local trong nền bằng môi trường
`.venv` của dự án; không cần terminal Python thứ hai. Không cần khóa Gemini
hoặc API AI trả phí cho chức năng này.

Chờ log web báo `Local image model is ready`. `GET http://127.0.0.1:8091/health`
trả `status=ready`, mã mô hình và số chiều. Tiến trình tải/nạp model được ghi
vào `build/logs/image-embedding.log`. Trong lúc model nạp, web vẫn chạy và tìm
kiếm ảnh có thể trả 503. Thiếu môi trường Python thì web ghi hướng dẫn vào log;
cài môi trường xong và khởi động lại web để thử lại.

Web dùng lại dịch vụ đang chạy nếu đúng model/số chiều; không mở thêm khi
cổng đã bị chiếm. Khi dừng web bình thường, chỉ tiến trình Python do web tự
mở mới bị dừng. Tự khởi động chỉ áp dụng cho URL HTTP local `127.0.0.1` hoặc
`localhost` có cổng rõ ràng, và không chạy trong profile `preview`.

Nếu muốn chạy Python riêng, đặt `app.image-search.auto-start=false` rồi chạy
lệnh sau trong terminal khác:

```powershell
& services/image-embedding/.venv/Scripts/python.exe -m uvicorn app:app --app-dir services/image-embedding --host 127.0.0.1 --port 8091
```

Mở `/buyer/html/home.html`, bấm **Tìm bằng bìa**, hoặc truy cập trực tiếp
`/buyer/html/image-search.html`. Trang danh mục cũng có nút máy ảnh ở thanh
tìm kiếm. Chọn JPG/PNG/WebP/GIF tối đa 5 MB, rồi bấm **Tìm truyện tương tự**.
Ảnh động được lấy khung hình đầu tiên, nhất quán khi lập chỉ mục và tìm kiếm.

## Lập chỉ mục ảnh sản phẩm

Spring tự chạy từng lô sau 10 giây khởi động, rồi nghỉ 15 giây giữa các lô.
Mặc định một lô tối đa 10 ảnh. Tác vụ duyệt `product_images` theo ID tăng dần:

1. Lấy ảnh chưa có vector hoặc có `model_name` khác phiên bản đang chạy.
2. Tải ảnh từ URL Cloudinary đã lưu trong DB.
3. Gửi nội dung ảnh đến dịch vụ CLIP, chuẩn hóa L2 vector nhận được.
4. Kiểm tra ảnh vẫn tồn tại, URL chưa bị thay và sản phẩm chưa xóa; lưu vector.

Lập chỉ mục chạy trên scheduler riêng để không trì hoãn tác vụ hết hạn
thanh toán và các tác vụ nghiệp vụ theo lịch khác.

Ảnh bìa và ảnh chi tiết đều được lập chỉ mục. Ảnh mới sẽ được xử lý ở các lô
tiếp theo; không làm chậm transaction upload/sửa sản phẩm của seller. Ảnh lỗi
được ghi log theo ID và thử lại ở vòng duyệt sau. Khi dịch vụ AI ngừng hoạt
động, lô dừng sớm và thử lại ở lượt chạy tiếp theo. Trong profile `preview`,
scheduling của dự án đang tắt; hãy dùng profile chạy nghiệp vụ bình thường.

Seller hiện thay ảnh bằng cách xóa bản ghi ảnh cũ rồi tạo ID mới. Luồng xóa ảnh
đã xóa vector liên quan. Nếu chỉnh URL trực tiếp bằng SQL mà vẫn giữ ID,
cần xóa vector của ID đó để tác vụ tạo lại. Nếu chỉ có
`products.cover_image_url` mà chưa có dòng tương ứng trong `product_images`,
cần đồng bộ dữ liệu ảnh trước; tác vụ đọc bảng `product_images`.

API dành cho admin đã đăng nhập:

| API | Công dụng |
| --- | --- |
| `GET /api/admin/image-search/status` | Xem đã bật hay chưa, mô hình, số ảnh có vector, kết quả lô gần nhất |
| `POST /api/admin/image-search/index` | Chạy ngay một lô; cần CSRF token như các API quản trị khác |

`indexedImages` đếm vector của mô hình hiện tại, gồm cả sản phẩm chờ duyệt hoặc
đã ẩn. Số ảnh được xét khi tìm kiếm có thể nhỏ hơn vì chỉ lấy tin công khai.

## Luồng tìm kiếm

```text
Ảnh sản phẩm → CLIP → vector 512 chiều → product_image_features
Ảnh người dùng → cùng CLIP → vector truy vấn
vector truy vấn + vector đã lưu → cosine → lấy ảnh tốt nhất mỗi sản phẩm
→ sắp giảm dần → chỉ trả sản phẩm công khai
```

API công khai:

```http
POST /api/products/image-search?limit=24&minSimilarity=0.5
Content-Type: multipart/form-data

image: <file ảnh>
```

Ví dụ gọi trên Windows:

```powershell
curl.exe -F "image=@C:/images/comic-cover.jpg" "http://localhost:8080/api/products/image-search?limit=24&minSimilarity=0.5"
```

Trả `modelName`, `comparedImages` và `items`. Mỗi phần tử có `product` theo
DTO thẻ sản phẩm đang dùng, `similarity` và `matchedImageUrl`. Chỉ sản phẩm
`APPROVED`, `is_active=true`, `deleted_at IS NULL` được xét. Mỗi sản phẩm xuất
hiện một lần, lấy điểm tốt nhất trong các ảnh của nó. Hết hàng vẫn có thể xuất
hiện và được ghi rõ trên giao diện như danh mục hiện tại.

`limit` từ 1 đến 48. Cosine nằm trong [-1, 1]; đây là điểm tương đồng, không
phải xác suất nhận diện chính xác. Ngưỡng mặc định 0.5 là giá trị khởi đầu cần
hiệu chỉnh bằng ảnh thực tế. Có thể giảm ngưỡng nếu ít kết quả. Ảnh chụp nhiều
cuốn truyện, nền phức tạp, hoặc các tập có bìa gần giống nhau vẫn có thể cho kết
quả chưa đúng. Giao diện hiển thị thứ hạng, không hiển thị phần trăm độ chính xác.

Không lưu ảnh tìm kiếm của người dùng vào Cloudinary hoặc DB. Dịch vụ Python
đọc nội dung ảnh, kiểm tra định dạng thực tế và giới hạn 20 triệu pixel. Sai
định dạng trả 400; ảnh quá lớn trả 413; chưa bật hoặc không kết nối được mô
hình trả 503. Giao diện hiển thị trạng thái chưa có dữ liệu khi chưa lập chỉ mục.

## Cấu hình

| Thuộc tính Spring | Mặc định |
| --- | --- |
| `app.image-search.enabled` | `false` |
| `app.image-search.auto-start` | `true`, có tác dụng khi `enabled=true` |
| `app.image-search.working-directory` | Tự tìm thư mục backend từ working directory của web; có thể đặt đường dẫn tuyệt đối |
| `app.image-search.python-executable` | `services/image-embedding/.venv/Scripts/python.exe` trên Windows, `.venv/bin/python` trên Linux/macOS |
| `app.image-search.startup-timeout-seconds` | `180`; quá thời gian chỉ ngừng chờ health, không tắt tiến trình đang tải model |
| `app.image-search.service-url` | `http://127.0.0.1:8091` |
| `app.image-search.model-name` | `clip-vit-b32-f41c383-rgb-v1` |
| `app.image-search.dimensions` | `512` |
| `app.image-search.batch-size` | `10`, giới hạn 1–50 |
| `app.image-search.index-initial-delay-ms` | `10000` |
| `app.image-search.index-delay-ms` | `15000` |
| `app.image-search.allowed-image-hosts` | `res.cloudinary.com` |

Đây là mặc định trong Java. File `application-local.example.properties` bật
sẵn tìm kiếm ảnh và cho phép cả host Cloudinary/Picsum. Giá trị trong cấu hình
Spring đang dùng sẽ ghi đè các mặc định trên.

URL ảnh chỉ chấp nhận HTTPS, cổng chuẩn và đúng host được cấu hình. Cho phép
tối đa 3 lần chuyển hướng; mỗi địa chỉ đích cũng phải thuộc danh sách host
được cho phép. Nếu dùng ảnh mẫu Picsum, thêm cả `picsum.photos` và
`fastly.picsum.photos`. Nếu ảnh cũ dùng CDN khác, bổ sung host tin cậy vào danh sách này.

Mô hình được cố định theo revision
`f41c38369690de9493a1c5e24e750e4adc1ac430` của
[`sentence-transformers/clip-ViT-B-32`](https://huggingface.co/sentence-transformers/clip-ViT-B-32/tree/f41c38369690de9493a1c5e24e750e4adc1ac430).
Tiền xử lý dùng EXIF orientation và RGB cho cả hai luồng. Nếu đổi mô hình,
revision hoặc tiền xử lý, cần đổi mã `MODEL_NAME` trong Python và
`app.image-search.model-name` ở Java cho khớp. Tác vụ sẽ thay vector cũ bằng
vector phiên bản mới; tìm kiếm chỉ so sánh cùng phiên bản và cùng số chiều.
Tham khảo [hướng dẫn image search của Sentence Transformers](https://www.sbert.net/examples/sentence_transformer/applications/image-search/README.html).

Hiện MySQL lưu JSON, Spring duyệt vector theo lô 256 ảnh và giữ tối đa `limit`
ứng viên. Mỗi lượt tìm kiếm vẫn có chi phí O(số ảnh × 512). Khi kho ảnh lớn,
có thể chuyển phần truy vấn vector sang FAISS, Qdrant hoặc một vector index;
không cần thay luồng tạo đặc trưng.

## Kiểm thử

```powershell
.\gradlew.bat test --tests '*ImageSearchTests' --tests '*ImageFeatureIndexerTests' --tests '*ImageSearchControllerTests'
.\gradlew.bat test --tests '*ImageEmbeddingClientTests'
.\gradlew.bat test --tests '*ImageEmbeddingProcessManagerTests'
& services/image-embedding/.venv/Scripts/python.exe -m pip install -r services/image-embedding/requirements-test.txt
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
& services/image-embedding/.venv/Scripts/python.exe -m pytest services/image-embedding -q
python tools/verify_image_search_mysql.py
```

Kiểm thử Python dùng encoder giả để kiểm tra upload/tiền xử lý/hợp đồng API,
không đánh giá độ chính xác CLIP. Script MySQL tạo instance riêng trong
`build/`, nhập schema/seed, kiểm tra lọc trạng thái, model, phân lô và đọc JSON,
rồi dừng instance đó. Không ghi vào database đang cấu hình của ứng dụng.

Đặt `IMAGE_SEARCH_AUTOSTART_LIVE_TEST=true` khi chạy
`ImageEmbeddingProcessManagerTests` để thử khởi động CLIP thật từ `.venv`,
kiểm tra health và xác nhận tiến trình con đã dừng sau khi đóng bộ quản lý.
Bài này cần cài môi trường Python và tải model trước; mặc định được bỏ qua.

`tools/verify_image_search_browser.cjs` kiểm tra giao diện trên desktop/mobile
bằng Playwright và phản hồi API giả lập, lưu ảnh chụp vào `build/reports/`.

Đã kiểm tra mô hình thật trên máy: gọi `/embed` bằng ảnh PNG, xác nhận mã
mô hình, đủ 512 chiều và độ dài vector bằng 1. Đây là kiểm tra mô hình hoạt
động; độ chính xác tìm bìa truyện vẫn cần đánh giá bằng bộ ảnh sản phẩm thực tế.
