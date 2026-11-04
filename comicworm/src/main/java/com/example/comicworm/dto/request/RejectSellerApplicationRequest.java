package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of POST /api/admin/seller-applications/{id}/reject. The service trims and re-checks the reason. */
public record RejectSellerApplicationRequest(
        @NotBlank(message = "Vui lòng nhập lý do từ chối.")
        @Size(max = 500, message = "Lý do từ chối tối đa 500 ký tự.")
        String reason) {
}
