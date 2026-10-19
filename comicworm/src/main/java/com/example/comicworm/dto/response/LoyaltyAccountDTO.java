package com.example.comicworm.dto.response;

import java.time.LocalDateTime;

public record LoyaltyAccountDTO(Long pointsBalance, LocalDateTime updatedAt) {
}
