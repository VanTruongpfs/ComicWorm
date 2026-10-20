package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import java.util.List;

public record ExchangeCheckoutDTO(ExchangeRoomDTO room, List<ExchangeOrderDTO> orders,
        List<ShippingOption> shippingOptions, List<String> paymentMethods,
        boolean receivesBooks, int requiredOrderCount, BigDecimal cashToPay) {
    public record ShippingOption(String code, String name, BigDecimal fee) {}
}
