package com.example.comicworm.dto.response;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ProductImageType;
import java.util.Comparator;

public record SellerProductRecord(Long id, String title, String description, Integer categoryId,
        Integer authorId, Integer publisherId, String volumeNumbers, String editionType,
        Integer publicationYear, Integer conditionPercent, BigDecimal price, Integer stockQuantity,
        ListingType listingType, String tradeWishNote, Boolean isActive, ModerationStatus moderationStatus,
        LocalDateTime createdAt, LocalDateTime updatedAt, String coverImageUrl,
        List<SellerProductImageRecord> detailImages, List<SellerProductImageRecord> images) {
    public static SellerProductRecord from(Product product) {
        return from(product, List.of());
    }
    public static SellerProductRecord from(Product product, List<ProductImage> images) {
        var records = images.stream().sorted(Comparator.comparing((ProductImage image) -> image.getImageType() != ProductImageType.COVER)
                .thenComparing(ProductImage::getDisplayOrder).thenComparing(ProductImage::getId))
                .map(SellerProductImageRecord::from).toList();
        return new SellerProductRecord(product.getId(), product.getTitle(), product.getDescription(),
                product.getCategoryId(), product.getAuthorId(), product.getPublisherId(),
                product.getVolumeNumbers(), product.getEditionType(), product.getPublicationYear(),
                product.getConditionPercent(), product.getPrice(), product.getStockQuantity(),
                product.getListingType(), product.getTradeWishNote(), product.getIsActive(),
                product.getModerationStatus(), product.getCreatedAt(), product.getUpdatedAt(),
                product.getCoverImageUrl(), records.stream().filter(image -> image.imageType() == ProductImageType.DETAIL).toList(), records);
    }
}
