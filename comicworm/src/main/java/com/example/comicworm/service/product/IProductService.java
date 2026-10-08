package com.example.comicworm.service.product;

import com.example.comicworm.dto.request.ProductSearchRequest;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.dto.response.ProductCardDTO;
import com.example.comicworm.dto.response.ProductDetailDTO;
import com.example.comicworm.dto.response.ProductFilterOptionsDTO;
import com.example.comicworm.dto.response.ReviewDTO;

import java.util.List;

public interface IProductService {

    /** T06: danh sách có lọc / tìm kiếm / sắp xếp / phân trang. */
    PageResponseDTO<ProductCardDTO> search(ProductSearchRequest request);

    /** T10: sản phẩm mới nhất cho trang chủ. */
    List<ProductCardDTO> getLatest(int limit);

    /** T09: sản phẩm bán chạy cho trang chủ. */
    List<ProductCardDTO> getBestSellers(int limit);

    /** Dữ liệu thanh lọc: thể loại / NXB kèm số lượng. */
    ProductFilterOptionsDTO getFilterOptions();

    /**
     * B04: chi tiết sản phẩm.
     *
     * @param viewerId null nếu chưa đăng nhập
     * @param admin    true nếu người xem là ADMIN
     * @throws org.springframework.web.server.ResponseStatusException 404 nếu không tồn tại hoặc không được phép xem
     */
    ProductDetailDTO getDetail(Long productId, Long viewerId, boolean admin);

    /** Sản phẩm liên quan (cùng thể loại, chỉ tin đang hiển thị). */
    List<ProductCardDTO> getRelated(Long productId, int limit);

    /** Đánh giá của sản phẩm, có phản hồi của người bán. */
    PageResponseDTO<ReviewDTO> getReviews(Long productId, int page, int size);
}
