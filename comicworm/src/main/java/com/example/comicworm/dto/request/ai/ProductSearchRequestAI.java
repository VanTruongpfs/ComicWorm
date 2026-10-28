package com.example.comicworm.dto.request.ai;

 import com.fasterxml.jackson.annotation.JsonPropertyDescription;


public record ProductSearchRequestAI(
        @JsonPropertyDescription("Từ khóa ngắn để tìm truyện theo tên truyện, tác giả, thể loại hoặc tập truyện...")
        String keyword,

        @JsonPropertyDescription("Mức giá tối đa (VNĐ) mà khách hàng muốn chi trả...")
        Double maxPrice, // Đổi BigDecimal -> Double để Gemini sinh schema OpenAPI chuẩn xác

        @JsonPropertyDescription("Tình trạng độ mới tối thiểu của truyện theo phần trăm...")
        Integer minConditionPercent,

        @JsonPropertyDescription("Phương thức bài đăng: 'SELL' hoặc 'EXCHANGE'...")
        String listingType
) {
    @Override
    public String toString() {
        return keyword + " " + maxPrice + " " + minConditionPercent + " " + listingType ;
    }
}