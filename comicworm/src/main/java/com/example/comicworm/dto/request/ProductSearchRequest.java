package com.example.comicworm.dto.request;

import com.example.comicworm.model.enums.ListingType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/** Tham số query string của GET /api/products (danh sách + lọc + sắp xếp + phân trang). */
@Getter
@Setter
@NoArgsConstructor
public class ProductSearchRequest {

    /** Tìm theo tên truyện hoặc tên tác giả. */
    @Size(max = 100)
    private String keyword;

    /** Lọc theo thể loại; tự gồm cả thể loại con. Nhiều giá trị: categoryIds=1,2 */
    private List<Integer> categoryIds;

    /** Lọc theo slug thể loại (dùng cho link từ trang chủ). */
    @Size(max = 120)
    private String categorySlug;

    private Integer publisherId;

    private Integer authorId;

    /** Tủ sách của một người bán. */
    private Long sellerId;

    @DecimalMin("0")
    private BigDecimal minPrice;

    @DecimalMin("0")
    private BigDecimal maxPrice;

    /** Nhóm tình trạng: new, likenew, good, used. Nhiều giá trị cách nhau dấu phẩy = OR. */
    private List<String> conditions;

    /**
     * SELL  -> tin có thể mua (SELL + SELL_AND_TRADE)
     * TRADE -> tin có thể trao đổi (TRADE + SELL_AND_TRADE)
     * SELL_AND_TRADE -> đúng loại vừa bán vừa đổi
     */
    private ListingType listingType;

    /** newest | price_asc | price_desc | popular */
    private String sort = "newest";

    @Min(0)
    private int page = 0;

    @Min(1)
    @Max(48)
    private int size = 12;
}
