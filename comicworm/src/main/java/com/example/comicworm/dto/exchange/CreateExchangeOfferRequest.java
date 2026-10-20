package com.example.comicworm.dto.exchange;

import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateExchangeOfferRequest {

    @DecimalMin(value = "0", message = "Số tiền bù không được âm")
    @jakarta.validation.constraints.Digits(integer = 9, fraction = 2)
    private BigDecimal cashCompensation = BigDecimal.ZERO;

    /**
     * "pay": buyer bù tiền cho host
     * "get": host bù tiền cho buyer
     * "none": không bù tiền
     */
    private String compensationDirection = "none";

    private Long compensationPayerId;

    @jakarta.validation.constraints.Size(max = 1000)
    private String note;

    @jakarta.validation.Valid
    @jakarta.validation.constraints.Size(max = 50)
    private List<OfferItemInput> items = new ArrayList<>();
}
