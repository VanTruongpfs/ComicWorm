package com.example.comicworm.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateReviewRequest {

    @NotNull(message = "Mã sản phẩm trong đơn không được để trống")
    private Long orderItemId;

    @NotNull(message = "Vui lòng chọn số sao đánh giá tổng thể")
    @Min(value = 1, message = "Số sao tối thiểu là 1")
    @Max(value = 5, message = "Số sao tối đa là 5")
    private Integer rating;

    @Min(value = 1, message = "Số sao chất lượng sản phẩm tối thiểu là 1")
    @Max(value = 5, message = "Số sao chất lượng sản phẩm tối đa là 5")
    private Integer productQualityRating;

    @Min(value = 1, message = "Số sao thái độ người bán tối thiểu là 1")
    @Max(value = 5, message = "Số sao thái độ người bán tối đa là 5")
    private Integer sellerAttitudeRating;

    @Size(max = 1000, message = "Nội dung nhận xét tối đa 1000 ký tự")
    private String content;
}

