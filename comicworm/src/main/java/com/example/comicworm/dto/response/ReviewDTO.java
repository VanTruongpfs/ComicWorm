package com.example.comicworm.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ReviewDTO {

    private final Long id;
    private final Integer rating;
    private final String content;
    private final String buyerName;
    private final String buyerAvatarUrl;
    private final LocalDateTime createdAt;
    /** null nếu người bán chưa trả lời. */
    private final Reply reply;

    @Getter
    @Builder
    public static class Reply {
        private final String content;
        private final String sellerName;
        private final LocalDateTime createdAt;
    }
}
