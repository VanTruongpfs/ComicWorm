package com.example.comicworm.dto.request.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of POST /api/admin/moderation/products/{id}/reject. The reason is mandatory. */
public record RejectProductRequest(
        @NotBlank(message = "Vui lòng nhập lý do từ chối.")
        @Size(min = 5, max = 1000, message = "Lý do từ chối phải từ 5 đến 1000 ký tự.")
        String reason) {
}
