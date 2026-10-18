package com.example.comicworm.dto.response;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SellerOrderRecord(
        Long id,
        String orderCode,
        Long buyerId,
        String recipientName,
        String recipientPhone,
        String shippingAddress,
        String buyerNote,
        OrderStatus status,
        OrderPaymentStatus paymentStatus,
        BigDecimal subtotalAmount,
        BigDecimal shippingFee,
        BigDecimal totalAmount,
        String cancelReason,
        LocalDateTime cancelledAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<SellerOrderItemRecord> items
) {
    public static SellerOrderRecord from(Order order, List<SellerOrderItemRecord> items) {
        return new SellerOrderRecord(
                order.getId(),
                order.getOrderCode(),
                order.getBuyerId(),
                order.getRecipientName(),
                order.getRecipientPhone(),
                order.getShippingAddress(),
                order.getBuyerNote(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getSubtotalAmount(),
                order.getShippingFee(),
                order.getTotalAmount(),
                order.getCancelReason(),
                order.getCancelledAt(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                items
        );
    }
}

