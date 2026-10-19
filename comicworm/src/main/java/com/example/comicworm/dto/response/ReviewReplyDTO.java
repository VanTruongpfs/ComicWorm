package com.example.comicworm.dto.response;

import java.time.LocalDateTime;

public record ReviewReplyDTO(Long id, String content, LocalDateTime createdAt, LocalDateTime updatedAt) {
}
