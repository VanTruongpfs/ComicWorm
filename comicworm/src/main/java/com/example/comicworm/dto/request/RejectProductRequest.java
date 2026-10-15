package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectProductRequest(
        @NotBlank(message = "Vui lòng nhập lý do từ chối sản phẩm.")
        @Size(max = 1000, message = "Lý do từ chối tối đa 1000 ký tự.")
        String reason
) {}
