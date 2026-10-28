package com.example.comicworm.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateUpgradeRequestDTO {

    @NotNull(message = "Cấp độ mục tiêu không được để trống")
    @Min(value = 1, message = "Cấp độ tối thiểu là 1")
    @Max(value = 5, message = "Cấp độ tối đa là 5")
    private Integer toLevel;

    private String shopName;
    private String shopDescription;
    private String paymentProofUrl;
    private String transactionCode;
}

