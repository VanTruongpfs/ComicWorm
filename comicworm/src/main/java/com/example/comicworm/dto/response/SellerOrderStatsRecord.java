package com.example.comicworm.dto.response;

import java.math.BigDecimal;

public record SellerOrderStatsRecord(
        BigDecimal pendingPayout,
        long packingCount,
        long shippingCount,
        String completionRate,
        long totalOrders
) {}

