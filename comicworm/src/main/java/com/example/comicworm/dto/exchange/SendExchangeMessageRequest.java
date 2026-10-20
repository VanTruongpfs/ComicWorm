package com.example.comicworm.dto.exchange;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SendExchangeMessageRequest {

    private String content;

    private String imageUrl;

    private String clientMessageKey;
}
