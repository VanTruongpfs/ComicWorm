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
public class UserTradeProductDTO {
    private Long id;
    private String title;
    private String volumeNumbers;
    private Integer conditionPercent;
    private BigDecimal price;
    private String coverImageUrl;
}
