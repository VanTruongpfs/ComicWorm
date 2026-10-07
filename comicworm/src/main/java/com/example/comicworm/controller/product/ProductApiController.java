package com.example.comicworm.controller.product;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.ProductSearchRequest;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.dto.response.ProductCardDTO;
import com.example.comicworm.dto.response.ProductDetailDTO;
import com.example.comicworm.dto.response.ProductFilterOptionsDTO;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.service.product.IProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** API công khai (GET) để hiển thị sản phẩm. Trả DTO, không trả entity. */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductApiController {

    private final IProductService productService;

    /** Danh sách + lọc + sắp xếp + phân trang. */
    @GetMapping
    public PageResponseDTO<ProductCardDTO> search(@Valid ProductSearchRequest request) {
        return productService.search(request);
    }

    /** Trang chủ - sản phẩm mới nhất (T10). */
    @GetMapping("/latest")
    public List<ProductCardDTO> latest(@RequestParam(defaultValue = "8") int limit) {
        return productService.getLatest(limit);
    }

    /** Trang chủ - sản phẩm bán chạy (T09). */
    @GetMapping("/bestsellers")
    public List<ProductCardDTO> bestSellers(@RequestParam(defaultValue = "8") int limit) {
        return productService.getBestSellers(limit);
    }

    /** Dữ liệu cho thanh lọc. */
    @GetMapping("/filters")
    public ProductFilterOptionsDTO filters() {
        return productService.getFilterOptions();
    }

    /** Chi tiết sản phẩm (B04). Chủ tin và ADMIN xem được cả tin chưa công khai. */
    @GetMapping("/{id:\\d+}")
    public ProductDetailDTO detail(@PathVariable Long id,
                                   @AuthenticationPrincipal CustomUserDetails principal) {
        Long viewerId = principal != null ? principal.getId() : null;
        boolean admin = principal != null && principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return productService.getDetail(id, viewerId, admin);
    }

    @GetMapping("/{id:\\d+}/related")
    public List<ProductCardDTO> related(@PathVariable Long id,
                                        @RequestParam(defaultValue = "4") int limit) {
        return productService.getRelated(id, limit);
    }

    @GetMapping("/{id:\\d+}/reviews")
    public PageResponseDTO<ReviewDTO> reviews(@PathVariable Long id,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "5") int size) {
        return productService.getReviews(id, page, size);
    }
}
