package com.example.comicworm.dto.exchange;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
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
public class ExchangeRoomDTO {
    private Long id;
    private String roomCode;
    private Long hostId;
    private String hostName;
    private String hostAvatar;
    private String hostEmail;

    // Target Product info
    private Long targetProductId;
    private String targetProductTitle;
    private String targetProductCover;
    private BigDecimal targetProductPrice;
    private Integer targetProductCondition;
    private String targetProductListingType;
    private String targetProductWishNote;
    private String targetProductVolumeNumbers;
    private String targetProductPublisher;
    private String targetProductAuthor;
    private String targetProductDescription;
    private String targetProductCategory;
    private String targetProductEdition;
    private Integer targetProductPublicationYear;

    private Long selectedOfferId;
    private ExchangeRoomStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime closedAt;

    @Getter(onMethod_ = @JsonProperty("isCurrentUserHost"))
    private boolean isCurrentUserHost;
    @Getter(onMethod_ = @JsonProperty("isCurrentUserMember"))
    private boolean isCurrentUserMember;
    private Long currentUserId;

    @Builder.Default
    private List<ExchangeMemberDTO> members = new ArrayList<>();

    @Builder.Default
    private List<ExchangeOfferDTO> offers = new ArrayList<>();
}
