package com.example.comicworm.dto.exchange;

import com.example.comicworm.model.enums.ExchangeRoomStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
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
public class ExchangeRoomSummaryDTO {
    private Long id;
    private String roomCode;
    private Long hostId;
    private String hostName;
    private String hostAvatar;
    private Long targetProductId;
    private String targetProductTitle;
    private String targetProductCover;
    private BigDecimal targetProductPrice;
    private Integer targetProductCondition;
    private String targetProductWishNote;
    private ExchangeRoomStatus status;
    private int memberCount;
    private int offerCount;
    private Long selectedOfferId;
    private LocalDateTime createdAt;
}
