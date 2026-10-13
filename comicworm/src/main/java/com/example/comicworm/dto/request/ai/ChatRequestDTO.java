package com.example.comicworm.dto.request.ai;

import jakarta.validation.constraints.NotBlank;

public record ChatRequestDTO(
        @NotBlank(message = "Nội dung tin nhắn không được để trống")
        String message
) {}