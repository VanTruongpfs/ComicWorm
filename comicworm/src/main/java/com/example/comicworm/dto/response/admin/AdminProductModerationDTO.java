package com.example.comicworm.dto.response.admin;

import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** One product as shown on the admin moderation screen. */
public record AdminProductModerationDTO(
        Long id,
        String title,
        String description,
        BigDecimal price,
        Integer conditionPercent,
        Integer stockQuantity,
        ListingType listingType,
        String tradeWishNote,
        String categoryName,
        String authorName,
        String publisherName,
        String volumeNumbers,
        String editionType,
        Integer publicationYear,
        Boolean isActive,
        String coverImageUrl,
        List<String> imageUrls,
        Long sellerId,
        String sellerName,
        String sellerEmail,
        ModerationStatus moderationStatus,
        String moderationReason,
        String moderatedByName,
        LocalDateTime moderatedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
