package com.example.comicworm.service.moderation;

import com.example.comicworm.model.enums.AiVerdict;

import java.math.BigDecimal;
import java.util.List;

/**
 * Kết quả của {@link ProductClassifier}.
 *
 * @param verdict VALID hoặc INVALID, bắt buộc
 * @param reasons lý do hiển thị cho admin (tiếng Việt); nên có ít nhất một lý do khi INVALID
 * @param score   độ tin cậy trong khoảng [0, 1], hoặc null nếu bộ phân loại không có điểm
 */
public record ClassificationResult(AiVerdict verdict, List<String> reasons, BigDecimal score) {

    public ClassificationResult {
        if (verdict == null) throw new IllegalArgumentException("verdict is required");
        if (score != null && (score.signum() < 0 || score.compareTo(BigDecimal.ONE) > 0)) {
            throw new IllegalArgumentException("score must be between 0 and 1");
        }
        reasons = reasons == null ? List.of() : List.copyOf(reasons);
    }

    public static ClassificationResult valid() {
        return new ClassificationResult(AiVerdict.VALID, List.of(), null);
    }

    public static ClassificationResult invalid(String... reasons) {
        return new ClassificationResult(AiVerdict.INVALID, List.of(reasons), null);
    }
}
