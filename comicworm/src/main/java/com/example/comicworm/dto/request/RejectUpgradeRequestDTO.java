package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RejectUpgradeRequestDTO {

    @NotBlank(message = "Vui lòng nhập lý do từ chối")
    private String reason;
}

