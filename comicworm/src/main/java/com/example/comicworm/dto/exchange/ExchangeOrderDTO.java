package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ExchangeOrderDTO(Long id, String orderCode, Long roomId, Long offerId,
        Long buyerId, Long sellerId, String buyerName, String sellerName, String status,
        String paymentStatus, String paymentMethod, String shippingMethod,
        BigDecimal subtotalAmount, BigDecimal shippingFee, BigDecimal totalAmount,
        String recipientName, String recipientPhone, String shippingAddress, String note,
        LocalDateTime createdAt, List<Item> items) {
    public record Item(Long productId, String title, String cover, int conditionPercent, int quantity) {}
}
