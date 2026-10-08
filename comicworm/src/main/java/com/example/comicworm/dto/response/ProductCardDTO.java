package com.example.comicworm.dto.response;

import com.example.comicworm.model.enums.ListingType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Dữ liệu một thẻ sản phẩm trong danh sách (trang chủ, danh mục, sản phẩm liên quan). */
@Getter
@Builder
public class ProductCardDTO {

    private final Long id;
    private final String slug;
    private final String title;
    private final String coverImageUrl;
    private final BigDecimal price;
    private final Integer conditionPercent;
    private final String conditionLabel;
    private final ListingType listingType;
    /** Có thể mua (SELL hoặc SELL_AND_TRADE). */
    private final boolean purchasable;
    /** Có nhận trao đổi (TRADE hoặc SELL_AND_TRADE). */
    private final boolean tradable;
    private final Integer stockQuantity;
    private final boolean inStock;
    private final String volumeNumbers;
    private final String editionType;
    private final Integer publicationYear;
    private final Integer categoryId;
    private final String categoryName;
    private final String authorName;
    private final String publisherName;
    private final Long sellerId;
    private final String sellerName;
    /** Tổng số lượng đã bán (đơn COMPLETED). */
    private final long soldCount;
    /** Lưu theo UTC. */
    private final LocalDateTime createdAt;
}
