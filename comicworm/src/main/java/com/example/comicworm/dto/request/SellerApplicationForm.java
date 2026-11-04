package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

/** Seller registration form. CCCD values are demo data for now; see {@link #sample()}. */
public record SellerApplicationForm(
        @NotBlank(message = "Vui lòng nhập số CCCD.")
        @Pattern(regexp = "\\s*\\d{12}\\s*", message = "Số CCCD phải gồm đúng 12 chữ số.")
        String idNumber,

        @NotBlank(message = "Vui lòng nhập họ tên trên CCCD.")
        @Size(max = 100, message = "Họ tên tối đa 100 ký tự.")
        String idFullName,

        @NotNull(message = "Vui lòng nhập ngày sinh.")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate idDateOfBirth,

        @NotNull(message = "Vui lòng nhập ngày cấp.")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate idIssueDate,

        @NotBlank(message = "Vui lòng nhập nơi cấp.")
        @Size(max = 200, message = "Nơi cấp tối đa 200 ký tự.")
        String idIssuePlace) {

    public static SellerApplicationForm sample() {
        return new SellerApplicationForm("001099012345", "NGUYỄN VĂN MẪU", LocalDate.of(1999, 1, 1),
                LocalDate.of(2021, 6, 15), "Cục Cảnh sát quản lý hành chính về trật tự xã hội");
    }
}
