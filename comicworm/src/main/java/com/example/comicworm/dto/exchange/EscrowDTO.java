package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** One held cash compensation, shown to admins and to both parties of the deal. */
public record EscrowDTO(Long id, Long roomId, String roomCode, Long offerId,
        Long payerId, String payerName, Long payeeId, String payeeName,
        BigDecimal amount, String status, String sourceOrderCode,
        LocalDateTime heldAt, LocalDateTime readyAt, LocalDateTime resolvedAt, String resolutionNote) {
}
