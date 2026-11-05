package com.example.comicworm.dto.response;

import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.RefundRequestStatus;

public record RefundRequestResultDTO(
        String orderCode,
        RefundRequestStatus refundRequestStatus,
        OrderPaymentStatus paymentStatus) {
}
