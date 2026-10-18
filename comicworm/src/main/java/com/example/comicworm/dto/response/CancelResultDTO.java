package com.example.comicworm.dto.response;

import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.RefundStatus;

public record CancelResultDTO(
        Long orderId,
        OrderStatus status,
        OrderPaymentStatus paymentStatus,
        RefundStatus refundStatus) {
}
