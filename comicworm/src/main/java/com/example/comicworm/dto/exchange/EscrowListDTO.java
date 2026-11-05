package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Escrows for the admin page plus count and amount per status (HELD, READY, RELEASED, REFUNDED). */
public record EscrowListDTO(List<EscrowDTO> items, Map<String, Total> totals) {
    public record Total(long count, BigDecimal amount) {}
}
