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
public class ExchangeMemberDTO {
    private Long userId;
    private String fullName;
    private String avatarUrl;
    @Getter(onMethod_ = @JsonProperty("isHost"))
    private boolean isHost;
    private LocalDateTime joinedAt;
}
