package com.example.comicworm.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateOrderRequest {

    @NotBlank(message = "Tên người nhận không được để trống")
    private String recipientName;

    @NotBlank(message = "Số điện thoại không được để trống")
    private String recipientPhone;

    @NotBlank(message = "Địa chỉ nhận hàng không được để trống")
    private String shippingAddress;

    private String buyerNote;
}