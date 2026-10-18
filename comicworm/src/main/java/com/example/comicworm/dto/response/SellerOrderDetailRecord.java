package com.example.comicworm.dto.response;

import java.util.List;

public record SellerOrderDetailRecord(
        SellerOrderRecord order,
        List<SellerOrderStatusHistoryRecord> timeline
) {}

