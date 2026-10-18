package com.example.comicworm.dto.response;

import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.enums.OrderStatus;

import java.time.LocalDateTime;

public record SellerOrderStatusHistoryRecord(
        Long id,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        Long changedBy,
        String note,
        LocalDateTime createdAt
) {
    public static SellerOrderStatusHistoryRecord from(OrderStatusHistory history) {
        return new SellerOrderStatusHistoryRecord(
                history.getId(),
                history.getPreviousStatus(),
                history.getNewStatus(),
                history.getChangedBy(),
                history.getNote(),
                history.getCreatedAt()
        );
    }
}

