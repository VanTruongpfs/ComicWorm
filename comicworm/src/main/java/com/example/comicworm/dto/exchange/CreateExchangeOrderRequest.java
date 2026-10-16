package com.example.comicworm.dto.exchange;

import jakarta.validation.constraints.*;

public record CreateExchangeOrderRequest(@NotNull Long addressId,
        @NotBlank String shippingMethod, @NotBlank String paymentMethod, @Size(max = 1000) String note) {}
