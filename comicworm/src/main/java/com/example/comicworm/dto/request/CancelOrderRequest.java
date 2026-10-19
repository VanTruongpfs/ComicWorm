package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CancelOrderRequest(
        @NotBlank(message = "Vui lòng nhập lý do hủy đơn")
        @Size(max = 500, message = "Lý do hủy đơn không được vượt quá 500 ký tự")
        String reason) {
}
