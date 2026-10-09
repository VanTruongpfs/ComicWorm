package com.example.comicworm.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@Builder
public class CartResponseDTO {

    private Long cartId;
    private List<CartItemDTO> items;
    private BigDecimal totalAmount;

    @Getter
    @Setter
    @Builder
    public static class CartItemDTO {
        private Long cartItemId;
        private Long productId;
        private String productTitle;
        private BigDecimal price;
        private Integer quantity;
        private Integer conditionPercent;
        private Boolean isSelected;
        private Long sellerId;
        private String sellerName;
        private String imageUrl;
    }
}