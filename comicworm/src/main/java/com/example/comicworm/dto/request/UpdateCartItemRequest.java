package com.example.comicworm.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateCartItemRequest {

    @Min(value = 1, message = "Số lượng tối thiểu là 1")
    private Integer quantity;

    private Boolean isSelected;
}