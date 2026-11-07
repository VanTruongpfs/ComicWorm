package com.example.comicworm.service.moderation;

import org.springframework.stereotype.Component;

/**
 * Bộ phân loại tạm thời khi chưa gắn model: chỉ xếp INVALID khi sản phẩm không có ảnh,
 * còn lại đều VALID. Model nhận diện ảnh không phải truyện sẽ thay thế lớp này (xem {@link ProductClassifier}).
 */
@Component
public class BasicProductClassifier implements ProductClassifier {

    static final String NO_IMAGE_REASON = "Sản phẩm chưa có ảnh.";

    @Override
    public ClassificationResult classify(ProductClassificationInput product) {
        if (product.imageUrls().isEmpty()) {
            return ClassificationResult.invalid(NO_IMAGE_REASON);
        }
        return ClassificationResult.valid();
    }
}
