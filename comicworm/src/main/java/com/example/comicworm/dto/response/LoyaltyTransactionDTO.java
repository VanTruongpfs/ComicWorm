package com.example.comicworm.dto.response;

import com.example.comicworm.model.LoyaltyTransaction;
import com.example.comicworm.model.enums.LoyaltyTransactionType;

import java.time.LocalDateTime;

public record LoyaltyTransactionDTO(
        LoyaltyTransactionType type,
        Long pointsDelta,
        Long balanceAfter,
        Long orderId,
        String orderCode,
        LocalDateTime createdAt) {

    public static LoyaltyTransactionDTO from(LoyaltyTransaction transaction) {
        return new LoyaltyTransactionDTO(
                transaction.getTransactionType(),
                transaction.getPointsDelta(),
                transaction.getBalanceAfter(),
                transaction.getOrderId(),
                transaction.getOrder().getOrderCode(),
                transaction.getCreatedAt());
    }
}
