package com.example.comicworm.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class ReviewableItemDTO {
    private final Long orderItemId;
    private final Long orderId;
    private final String orderCode;
    private final Long productId;
    private final String productTitle;
    private final String imageUrl;
    private final Integer conditionPercent;
    private final BigDecimal unitPrice;
    private final Integer quantity;
    private final String orderStatus;
    private final Long sellerId;
    private final String sellerName;
    private final boolean reviewed;
    private final Integer existingRating;
    private final Integer existingProductQualityRating;
    private final Integer existingSellerAttitudeRating;
    private final String existingContent;
    private final LocalDateTime existingCreatedAt;
}

