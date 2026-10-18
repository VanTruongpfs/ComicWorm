package com.example.comicworm.dto.response;

import com.example.comicworm.model.OrderItem;

import java.math.BigDecimal;

public record SellerOrderItemRecord(
        Long id,
        Long productId,
        String productTitle,
        String imageUrl,
        Integer conditionPercent,
        BigDecimal unitPrice,
        Integer quantity,
        BigDecimal subtotal
) {
    public static SellerOrderItemRecord from(OrderItem item) {
        BigDecimal unit = item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO;
        int qty = item.getQuantity() != null ? item.getQuantity() : 0;
        BigDecimal subtotal = unit.multiply(BigDecimal.valueOf(qty));
        return new SellerOrderItemRecord(
                item.getId(),
                item.getProductId(),
                item.getProductTitle(),
                item.getImageUrl(),
                item.getConditionPercent(),
                unit,
                qty,
                subtotal
        );
    }
}

