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
    private BigDecimal cashCompensation = BigDecimal.ZERO;

    /**
     * "pay": buyer bù tiền cho host
     * "get": host bù tiền cho buyer
     * "none": không bù tiền
     */
    private String compensationDirection = "none";

    private Long compensationPayerId;

    private String note;

    private List<OfferItemInput> items = new ArrayList<>();
}
