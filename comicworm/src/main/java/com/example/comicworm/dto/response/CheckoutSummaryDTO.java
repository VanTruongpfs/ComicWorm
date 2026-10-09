package com.example.comicworm.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutSummaryDTO {
    private String checkoutCode;
    private Long buyerId;
    private BigDecimal totalAmount;
    private LocalDateTime expiresAt;
    private String recipientName;
    private String recipientPhone;
    private String shippingAddress;
    private String buyerNote;
    private List<CheckoutOrderDTO> orders;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckoutOrderDTO {
        private String orderCode;
        private Long sellerId;
        private String sellerName;
        private BigDecimal subtotalAmount;
        private BigDecimal shippingFee;
        private BigDecimal totalAmount;
        private String status;
        private List<CheckoutOrderItemDTO> items;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckoutOrderItemDTO {
        private Long productId;
        private String productTitle;
        private BigDecimal unitPrice;
        private Integer quantity;
        private Integer conditionPercent;
        private String imageUrl;
    }
}
