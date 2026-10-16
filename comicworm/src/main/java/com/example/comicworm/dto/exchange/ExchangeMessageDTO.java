package com.example.comicworm.dto.exchange;

import com.fasterxml.jackson.annotation.JsonProperty;
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
public class ExchangeMessageDTO {
    private Long id;
    private Long roomId;
    private Long senderId;
    private String senderName;
    private String senderAvatar;
    @Getter(onMethod_ = @JsonProperty("isHost"))
    private boolean isHost;
    private String content;
    private String imageUrl;
    private String clientMessageKey;
    private LocalDateTime createdAt;
}
