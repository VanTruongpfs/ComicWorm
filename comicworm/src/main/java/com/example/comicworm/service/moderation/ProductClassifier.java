package com.example.comicworm.service.moderation;

/**
 * Phân loại sản phẩm chờ duyệt thành Hợp lệ / Không hợp lệ trước khi admin kiểm duyệt.
 * Admin chỉ duyệt được sản phẩm VALID; sản phẩm INVALID chỉ có thể bị từ chối hoặc
 * được admin chuyển sang hợp lệ.
 *
 * <p><b>Gắn model:</b> tạo một {@code @Component @Primary} cài interface này (ví dụ
 * {@code ModelProductClassifier}) để thay {@link BasicProductClassifier}. Job, API và giao diện
 * không cần sửa. Ghi chú khi cài đặt:
 * <ul>
 *   <li>Hàm được gọi từ {@link ProductClassificationJob} trên luồng nền, ngoài transaction,
 *       nên có thể gọi HTTP sang dịch vụ model. Ảnh nằm trên Cloudinary, URL ở
 *       {@link ProductClassificationInput#imageUrls()}.</li>
 *   <li>Ném exception khi model lỗi hoặc không truy cập được: sản phẩm giữ trạng thái chưa phân
 *       loại và job thử lại ở lần chạy sau. Không trả INVALID chỉ vì model lỗi.</li>
 *   <li>Sản phẩm không có ảnh nên vẫn trả INVALID (xem {@link BasicProductClassifier}).</li>
 * </ul>
 */
public interface ProductClassifier {

    ClassificationResult classify(ProductClassificationInput product);
}
