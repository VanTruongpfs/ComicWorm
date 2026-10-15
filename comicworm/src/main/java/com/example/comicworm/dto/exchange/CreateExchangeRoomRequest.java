package com.example.comicworm.dto.exchange;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateExchangeRoomRequest {

    @NotNull(message = "ID truyện muốn trao đổi không được để trống")
    private Long targetProductId;

    private String initialMessage;
}
