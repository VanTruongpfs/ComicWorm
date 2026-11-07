package com.example.comicworm.service.moderation;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Phân loại các sản phẩm chờ duyệt chưa có kết quả ({@code ai_verdict IS NULL}).
 * Người bán tạo/sửa tin hoặc đổi ảnh sẽ xoá kết quả cũ, nên job tự phân loại lại.
 * Bộ phân loại chạy ngoài transaction; kết quả chỉ được ghi nếu sản phẩm chưa đổi trong lúc chờ.
 */
@Component
@Profile("!preview")
public class ProductClassificationJob {

    private static final Logger log = LoggerFactory.getLogger(ProductClassificationJob.class);
    static final int BATCH_SIZE = 50;
    static final int MAX_REASONS_LENGTH = 2000;

    private final ProductRepository products;
    private final ProductImageRepository productImages;
    private final ProductClassifier classifier;

    public ProductClassificationJob(ProductRepository products,
                                    ProductImageRepository productImages,
                                    ProductClassifier classifier) {
        this.products = products;
        this.productImages = productImages;
        this.classifier = classifier;
    }

    @Scheduled(initialDelay = 20_000, fixedDelay = 60_000)
    public void classifyPendingProducts() {
        classifyPendingProductsFor(products.findIdsAwaitingClassification(PageRequest.of(0, BATCH_SIZE)));
    }

    /** Phân loại từng sản phẩm; lỗi ở một sản phẩm không chặn các sản phẩm còn lại. */
    public void classifyPendingProductsFor(List<Long> ids) {
        for (Long id : ids) {
            try {
                classifyOne(id);
            } catch (RuntimeException exception) {
                log.warn("Không phân loại được sản phẩm {}, sẽ thử lại ở lần chạy sau", id, exception);
            }
        }
    }

    /** @return true nếu đã ghi kết quả phân loại cho sản phẩm */
    boolean classifyOne(Long productId) {
        Product product = products.findById(productId).orElse(null);
        if (product == null || product.getDeletedAt() != null
                || product.getModerationStatus() != ModerationStatus.PENDING
                || product.getAiVerdict() != null) {
            return false;
        }
        var images = productImages.findByProductIdOrderByDisplayOrderAscIdAsc(productId);
        ClassificationResult result = classifier.classify(ProductClassificationInput.from(product, images));

        int updated = products.saveClassification(
                productId,
                result.verdict(),
                joinReasons(result.reasons()),
                result.score() == null ? null : result.score().setScale(4, RoundingMode.HALF_UP),
                LocalDateTime.now(ZoneOffset.UTC),
                product.getUpdatedAt());
        return updated == 1;
    }

    private static String joinReasons(List<String> reasons) {
        String joined = String.join("\n", reasons.stream().filter(r -> r != null && !r.isBlank()).map(String::trim).toList());
        if (joined.isEmpty()) return null;
        return joined.length() > MAX_REASONS_LENGTH ? joined.substring(0, MAX_REASONS_LENGTH) : joined;
    }
}
