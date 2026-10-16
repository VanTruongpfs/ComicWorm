package com.example.comicworm.dto.exchange;

import jakarta.validation.constraints.*;

public record AddressRequest(
    @NotBlank @Size(max = 100) String recipientName,
    @NotBlank @Pattern(regexp = "[+0-9 ()-]{8,20}", message = "Số điện thoại không hợp lệ") String phone,
    @NotBlank @Size(max = 100) String province,
    @NotBlank @Size(max = 100) String district,
    @NotBlank @Size(max = 100) String ward,
    @NotBlank @Size(max = 500) String addressDetail,
    boolean isDefault
) {}
