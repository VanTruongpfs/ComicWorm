package com.example.comicworm.dto.request;

import com.example.comicworm.model.enums.ListingType;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Seller ownership, moderation and deletion fields cannot be submitted by the client. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SellerProductRequest(
        @NotBlank(message = "Vui lòng nhập tên sản phẩm.")
        @Size(max = 255, message = "Tên sản phẩm tối đa 255 ký tự.") String title,
        @NotBlank(message = "Vui lòng nhập mô tả sản phẩm.")
        @Size(max = 10000, message = "Mô tả tối đa 10.000 ký tự.") String description,
        @NotNull(message = "Vui lòng chọn thể loại.") @Positive Integer categoryId,
        @Positive Integer authorId,
        @Positive Integer publisherId,
        @Size(max = 100) String volumeNumbers,
        @Size(max = 50) String editionType,
        @Min(1000) @Max(9999) Integer publicationYear,
        @NotNull(message = "Vui lòng nhập độ mới của truyện.")
        @Min(value = 0, message = "Độ mới phải từ 0 đến 100%.")
        @Max(value = 100, message = "Độ mới phải từ 0 đến 100%.") Integer conditionPercent,
        @NotNull(message = "Vui lòng nhập giá bán.")
        @DecimalMin(value = "0", message = "Giá bán không được âm.")
        @Digits(integer = 13, fraction = 2, message = "Giá bán tối đa 13 chữ số và 2 chữ số thập phân.") BigDecimal price,
        @NotNull(message = "Vui lòng nhập số lượng tồn kho.")
        @Min(value = 0, message = "Tồn kho không được âm.") Integer stockQuantity,
        @NotNull(message = "Vui lòng chọn hình thức giao dịch.") ListingType listingType,
        @Size(max = 10000) String tradeWishNote,
        @NotNull(message = "Vui lòng chọn trạng thái hiển thị.") Boolean isActive
) {}
