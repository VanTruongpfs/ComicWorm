package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** An exchange deal (the selected offer of a room) as an admin reviews it. */
public record AdminExchangeDealDTO(Long offerId, Long roomId, String roomCode, String roomStatus,
        String reviewStatus, String reviewNote, LocalDateTime reviewedAt,
        Long hostId, String hostName, Long partnerId, String partnerName,
        String targetProductTitle, String targetProductCover, List<Item> partnerItems,
        BigDecimal cashCompensation, String compensationPayerName,
        List<ExchangeOrderDTO> orders, EscrowDTO escrow) {
    public record Item(String title, int quantity, int conditionPercent) {}
}
