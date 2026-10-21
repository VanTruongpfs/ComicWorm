package com.example.comicworm.dto.response;

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
public class VNPayCallbackResultDTO {
    private boolean success;
    private String message;
    private String checkoutCode;
    private String paymentCode;
    private String responseCode;
    private String transactionNo;
}
