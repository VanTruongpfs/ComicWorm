package com.example.comicworm.dto.request;

import com.example.comicworm.model.enums.PaymentMethod;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProcessPaymentRequest {
    @NotNull(message = "Phương thức thanh toán không được để trống")
    private PaymentMethod method;

    /** Số điểm thưởng muốn dùng để giảm tiền hàng; bỏ trống hoặc 0 nếu không dùng. */
    @Min(value = 0, message = "Số điểm sử dụng không được âm")
    private Long pointsToUse;

    public ProcessPaymentRequest(PaymentMethod method) {
        this.method = method;
    }
}
