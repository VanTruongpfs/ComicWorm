package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;

public record SellerUpdateOrderStatusRequest(
        @NotBlank(message = "Trạng thái mới không được để trống")
        String status,

        String note
) {}

