package com.example.comicworm.dto.response;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.model.enums.ProductImageType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record AdminProductRecord(
        Long id,
        Long sellerId,
        String sellerName,
        String sellerEmail,
        String title,
        String slug,
        String description,
        String coverImageUrl,
        List<String> detailImageUrls,
        Integer categoryId,
        String categoryName,
        Integer authorId,
        String authorName,
        Integer publisherId,
        String publisherName,
        String volumeNumbers,
        String editionType,
        Integer publicationYear,
        Integer conditionPercent,
        BigDecimal price,
        Integer stockQuantity,
        ListingType listingType,
        String tradeWishNote,
        Boolean isActive,
        ModerationStatus moderationStatus,
        String moderationReason,
        Long moderatedBy,
        String moderatedByName,
        LocalDateTime moderatedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AdminProductRecord from(Product product, List<ProductImage> images) {
        List<String> details = images.stream()
                .filter(img -> img.getImageType() == ProductImageType.DETAIL)
                .map(ProductImage::getImageUrl)
                .toList();
        // Sản phẩm cũ có thể chưa đồng bộ cột cover_image_url: lấy ảnh COVER, rồi ảnh chi tiết đầu tiên.
        String cover = product.getCoverImageUrl();
        if (cover == null || cover.isBlank()) {
            cover = images.stream()
                    .filter(img -> img.getImageType() == ProductImageType.COVER)
                    .map(ProductImage::getImageUrl)
                    .findFirst()
                    .orElse(details.isEmpty() ? null : details.get(0));
        }

        return new AdminProductRecord(
                product.getId(),
                product.getSellerId(),
                product.getSeller() != null ? product.getSeller().getFullName() : null,
                product.getSeller() != null ? product.getSeller().getEmail() : null,
                product.getTitle(),
                product.getSlug(),
                product.getDescription(),
                cover,
                details,
                product.getCategoryId(),
                product.getCategory() != null ? product.getCategory().getName() : null,
                product.getAuthorId(),
                product.getAuthor() != null ? product.getAuthor().getName() : null,
                product.getPublisherId(),
                product.getPublisher() != null ? product.getPublisher().getName() : null,
                product.getVolumeNumbers(),
                product.getEditionType(),
                product.getPublicationYear(),
                product.getConditionPercent(),
                product.getPrice(),
                product.getStockQuantity(),
                product.getListingType(),
                product.getTradeWishNote(),
                product.getIsActive(),
                product.getModerationStatus(),
                product.getModerationReason(),
                product.getModeratedBy(),
                product.getModerator() != null ? product.getModerator().getFullName() : null,
                product.getModeratedAt(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}
