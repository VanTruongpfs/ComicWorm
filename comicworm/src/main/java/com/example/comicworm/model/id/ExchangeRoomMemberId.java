package com.example.comicworm.model.id;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ExchangeRoomMemberId implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long roomId;

    private Long userId;
}
