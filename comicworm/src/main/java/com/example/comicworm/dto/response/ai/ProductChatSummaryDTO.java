package com.example.comicworm.dto.response.ai;


import java.math.BigDecimal;
import com.example.comicworm.model.enums.ListingType;

public record ProductChatSummaryDTO(
        Long id,                    // Khóa chính Product (Long)
        String title,               // Tên truyện tranh
        String slug,                // Đường dẫn URL chi tiết
        BigDecimal price,           // Giá bán
        String coverImageUrl,       // Ảnh bìa sách
        Integer conditionPercent,   // Độ mới (% tình trạng sách)
        String volumeNumbers,       // Tập số mấy (ví dụ: "Tập 1", "Full 1-14")
        String editionType,         // Phiên bản (ví dụ: "Bản đặc biệt", "Bìa rời")
        Integer stockQuantity,      // Số lượng còn trong kho
        ListingType listingType,    // Hình thức: SELL hoặc EXCHANGE
        String authorName,
        String categoryName
) {}