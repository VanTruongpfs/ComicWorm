package com.example.comicworm.dto.response;

import java.time.LocalDateTime;

public record SellerReviewDTO(
        Long reviewId,
        Integer rating,
        String content,
        LocalDateTime createdAt,
        String buyerName,
        Long productId,
        String productTitle,
        Long orderId,
        String orderCode,
        Reply reply) {

    public record Reply(Long id, String content, LocalDateTime createdAt, LocalDateTime updatedAt) {
    }
}
