# Ảnh sản phẩm trên Cloudinary

Đăng nhập bằng tài khoản seller, mở `/seller/html/quan-ly-san-pham.html`,
bấm **Thêm sản phẩm** hoặc **Sửa sản phẩm**. Form có **Ảnh bìa sản phẩm**
và **Ảnh chi tiết sản phẩm**, kèm xem trước ảnh. Chọn ảnh rồi bấm **Lưu**.
Khi sửa, chọn ảnh bìa mới để thay thế; tích **Gỡ ảnh chi tiết** để bỏ ảnh cũ.
Nếu không chọn ảnh mới, form giữ nguyên ảnh đã lưu.

Server nhận `MultipartFile`, tải nội dung lên Cloudinary bằng Java SDK,
lấy `secure_url`, rồi lưu từng URL vào `product_images.image_url`, kèm
`product_id`, `image_type` (`COVER`/`DETAIL`) và `display_order`.
Ảnh bìa được đồng bộ vào `products.cover_image_url`. Entity `Product`
liên kết `List<ProductImage>` bằng `@OneToMany`; `ProductImage` liên kết
ngược về sản phẩm. Thông tin sản phẩm và thay đổi ảnh cùng một transaction.
Triển khai dựa trên UploadService do người dùng cung cấp; tham khảo
[Java upload của Cloudinary](https://cloudinary.com/documentation/java_image_and_video_upload).

## Cấu hình

SDK `com.cloudinary:cloudinary-http5:2.5.0` được khai báo trong `build.gradle`.
`application.properties` cần các cấu hình sau (đã thêm trên máy này):

```properties
spring.config.import=optional:file:./application-local.properties
cloudinary.cloud-name=${CLOUDINARY_CLOUD_NAME:}
cloudinary.api-key=${CLOUDINARY_API_KEY:}
cloudinary.api-secret=${CLOUDINARY_API_SECRET:}
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=42MB
```

Trên máy này, thông tin kết nối đã được lấy từ file UploadService mẫu vào
`application-local.properties` ở thư mục gốc dự án. File này được Git bỏ
qua. Không đưa khóa API hoặc file này vào frontend/commit.

Máy khác có thể sao chép `application-local.example.properties` thành
`application-local.properties` và điền thông tin kết nối, hoặc đặt ba
biến môi trường `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`. Chạy ứng dụng từ thư mục gốc dự án để đọc file
cấu hình local. Khởi động lại ứng dụng sau khi thay dependency/cấu hình.
Nếu chưa cấu hình Cloudinary, ứng dụng vẫn khởi động; thao tác upload
trả thông báo 503 rõ ràng.

## API và quy tắc lưu ảnh

Database mới import `database/schema.sql`. Database cũ chạy:

```powershell
python tools/migrate_product_images.py
```

Script áp dụng `database/migrations/20261008_product_images.sql` vào
database cấu hình trong `application.properties`. Thêm hai cột ảnh,
giữ các dòng hiện có và lấy ảnh đầu tiên làm ảnh bìa cho dữ liệu cũ.
Script có thể chạy lại. Khởi động lại ứng dụng sau khi cập nhật schema.

| Thao tác | Endpoint |
| --- | --- |
| Thêm sản phẩm kèm ảnh | `POST /api/seller/products`, multipart `product`, `coverImage`, `detailImages` |
| Sửa sản phẩm và ảnh | `PUT /api/seller/products/{id}`, multipart `product`, `coverImage`, `detailImages`, `removeImageIds` |
| Xem ảnh | `GET /api/seller/products/{id}/images` |
| Tải nhiều ảnh | `POST /api/seller/products/{id}/images`, multipart field `files` |
| Gỡ ảnh khỏi sản phẩm | `DELETE /api/seller/products/{id}/images/{imageId}` |

POST/DELETE cần JWT của seller và CSRF token từ
`GET /api/seller/products/csrf`. Chỉ chủ sản phẩm được thay đổi ảnh.
Client không được gửi seller ID, folder hoặc URL để ghi vào database.
Folder được tạo trên server: `comicworm/products/{sellerId}/{productId}`.

- Form tạo cần 1 ảnh bìa; tối đa 7 ảnh chi tiết. Mỗi ảnh tối đa 5 MB; nhận JPG, PNG, WEBP, GIF.
  Server kiểm tra MIME và chữ ký định dạng; Cloudinary xác minh nội dung ảnh.
- Kiểm tra toàn bộ batch trước khi upload. Nếu upload dở dang thất bại,
  dọn các ảnh đã tải trong batch; không lưu một phần URL vào database.
  Khi thêm/sửa bằng form, thông tin sản phẩm cũng rollback nếu ảnh thất bại.
- Nếu transaction database rollback, dọn các ảnh vừa upload.
  Khi Cloudinary không phản hồi việc dọn ảnh, server ghi cảnh báo để kiểm tra.
- Thay đổi ảnh đưa sản phẩm về trạng thái chờ duyệt.
- Gỡ ảnh xóa dòng `product_images` và feature phụ thuộc. Tài nguyên Cloudinary
  vẫn được giữ để URL đã lưu trong lịch sử đơn hàng tiếp tục hiển thị.
- Xóa sản phẩm vẫn dùng soft delete và giữ lịch sử đơn hàng.

## Kiểm tra

```powershell
python tools/verify_products_mysql.py --preview
```

Script chỉ dùng MySQL tạm đã kiểm tra `@@datadir`. Các bài kiểm tra dùng
Cloudinary uploader giả lập để kiểm tra quyền, CSRF, URL trong database,
giới hạn ảnh, batch upload thất bại và rollback khi MySQL từ chối insert.
`UploadServiceTests` kiểm tra định dạng, URL HTTPS và thiếu cấu hình.
Script còn kiểm tra migration với ảnh cũ và chạy migration hai lần.
Server tạm ở cổng 18081 dùng cấu hình Cloudinary thật để kiểm thử trình
duyệt bằng `tools/verify_product_images_browser.cjs`. Kiểm thử trình duyệt
tạo/sửa sản phẩm từ form, thay ảnh bìa, gỡ ảnh chi tiết và tải lại trang;
sau đó dọn ảnh thử trên Cloudinary. Kết quả nằm trong `build/reports`.
