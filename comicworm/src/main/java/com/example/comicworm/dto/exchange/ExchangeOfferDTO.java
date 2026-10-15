package com.example.comicworm.dto.exchange;

import com.example.comicworm.model.enums.ExchangeOfferStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
public class ExchangeOfferDTO {
    private Long id;
    private Long roomId;
    private Long buyerId;
    private String buyerName;
    private String buyerAvatar;
    private BigDecimal cashCompensation;
    private Long compensationPayerId;
    private String compensationDirection;
    private String note;
    private ExchangeOfferStatus status;
    private Boolean buyerConfirmed;
    private Boolean hostConfirmed;
    private LocalDateTime createdAt;
    private LocalDateTime respondedAt;
    @Builder.Default
    private List<ExchangeOfferItemDTO> items = new ArrayList<>();
}
