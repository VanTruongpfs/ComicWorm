package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import java.util.List;

/**
 * @param reviewStatus admin review of the deal: NOT_SUBMITTED, PENDING, APPROVED or REJECTED
 * @param reviewNote   admin's reason when rejected
 * @param escrow       held cash compensation, or null when nothing is held
 */
public record ExchangeCheckoutDTO(ExchangeRoomDTO room, List<ExchangeOrderDTO> orders,
        List<ShippingOption> shippingOptions, List<String> paymentMethods,
        boolean receivesBooks, int requiredOrderCount, BigDecimal cashToPay,
        String reviewStatus, String reviewNote, EscrowDTO escrow) {
    public record ShippingOption(String code, String name, BigDecimal fee) {}
}
