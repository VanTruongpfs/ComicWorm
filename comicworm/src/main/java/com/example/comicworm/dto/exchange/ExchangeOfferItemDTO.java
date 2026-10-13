package com.example.comicworm.dto.exchange;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExchangeOfferItemDTO {
    private Long id;
    private Long productId;
    private Long ownerId;
    private Integer quantity;
    private String titleSnapshot;
    private Integer conditionSnapshot;
    private BigDecimal price;
    private String coverImageUrl;
}
