package com.example.comicworm.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record WalletDTO(BigDecimal balance, List<Entry> transactions) {
    public record Entry(Long id, BigDecimal amount, String type, Long escrowId,
            BigDecimal balanceAfter, String note, LocalDateTime createdAt) {}
}
