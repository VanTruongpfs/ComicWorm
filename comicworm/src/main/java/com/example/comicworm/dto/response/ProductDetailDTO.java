package com.example.comicworm.dto.response;

import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Dữ liệu trang chi tiết sản phẩm (B04). Không chứa thông tin riêng tư của người bán. */
@Getter
@Builder
public class ProductDetailDTO {

    private final Long id;
    private final String slug;
    private final String title;
    private final String description;
    private final BigDecimal price;
    private final Integer stockQuantity;
    private final boolean inStock;
    private final ListingType listingType;
    private final boolean purchasable;
    private final boolean tradable;
    private final String tradeWishNote;

    private final Integer conditionPercent;
    private final String conditionLabel;
    private final String volumeNumbers;
    private final String editionType;
    private final Integer publicationYear;

    private final List<Image> images;
    /** Từ thể loại cha đến thể loại của sản phẩm. */
    private final List<CategoryRef> categoryPath;
    private final NamedRef author;
    private final NamedRef publisher;
    private final Seller seller;

    private final Double ratingAverage;
    private final long ratingCount;
    private final long soldCount;

    /** false khi chỉ chủ tin/admin xem được (chờ duyệt, bị từ chối hoặc đã ẩn). */
    private final boolean publiclyVisible;
    private final ModerationStatus moderationStatus;

    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    @Getter
    @Builder
    public static class Image {
        private final Long id;
        private final String url;
        private final Integer displayOrder;
    }

    @Getter
    @Builder
    public static class CategoryRef {
        private final Integer id;
        private final String name;
        private final String slug;
    }

    @Getter
    @Builder
    public static class NamedRef {
        private final Integer id;
        private final String name;
    }

    @Getter
    @Builder
    public static class Seller {
        private final Long id;
        private final String fullName;
        private final String avatarUrl;
        private final LocalDateTime memberSince;
        private final long activeProductCount;
        private final Double ratingAverage;
        private final long ratingCount;
    }
}
