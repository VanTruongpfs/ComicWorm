package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AdminUpdateUserStatusRequest(
        @NotBlank(message = "Trạng thái không được để trống")
        String status, // "ACTIVE" hoặc "LOCKED"

        String reason
) {}

