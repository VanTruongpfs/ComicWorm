package com.example.comicworm.dto.request.ai;

import autovalue.shaded.org.checkerframework.checker.nullness.qual.Nullable;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import org.jetbrains.annotations.NotNull;


public record ProductSearchRequestAI(
        @JsonPropertyDescription("Từ khóa ngắn để tìm truyện theo tên truyện, tác giả, thể loại hoặc tập truyện...")
        @Nullable
        String keyword,

        @JsonPropertyDescription("Mức giá tối đa (VNĐ) mà khách hàng muốn chi trả...")
        @Nullable
        Double maxPrice, // Đổi BigDecimal -> Double để Gemini sinh schema OpenAPI chuẩn xác

        @JsonPropertyDescription("Tình trạng độ mới tối thiểu của truyện theo phần trăm...")
        @Nullable
        Integer minConditionPercent,

        @JsonPropertyDescription("Phương thức bài đăng: 'SELL' hoặc 'EXCHANGE'...")
        @Nullable
        String listingType
) {
    @NotNull
    @Override
    public String toString() {
        return keyword + " " + maxPrice + " " + minConditionPercent + " " + listingType ;
    }
}