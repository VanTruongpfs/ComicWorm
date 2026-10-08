package com.example.comicworm.dto.request;

import org.springframework.data.domain.Sort;

import java.util.Locale;

public enum ProductSort {
    NEWEST,
    PRICE_ASC,
    PRICE_DESC,
    /** Bán chạy: tổng số lượng trong các đơn COMPLETED (xử lý riêng ở ProductSpecifications). */
    POPULAR;

    /** Mặc định NEWEST nếu giá trị rỗng hoặc không hợp lệ. */
    public static ProductSort from(String value) {
        if (value == null || value.isBlank()) return NEWEST;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "price_asc" -> PRICE_ASC;
            case "price_desc" -> PRICE_DESC;
            case "popular", "bestseller", "best_seller" -> POPULAR;
            default -> NEWEST;
        };
    }

    /** Sort theo cột. POPULAR trả về unsorted vì đã ORDER BY trong Specification. */
    public Sort toSort() {
        return switch (this) {
            case PRICE_ASC -> Sort.by(Sort.Direction.ASC, "price").and(Sort.by(Sort.Direction.DESC, "id"));
            case PRICE_DESC -> Sort.by(Sort.Direction.DESC, "price").and(Sort.by(Sort.Direction.DESC, "id"));
            case NEWEST -> Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
            case POPULAR -> Sort.unsorted();
        };
    }
}
