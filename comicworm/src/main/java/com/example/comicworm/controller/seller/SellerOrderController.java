package com.example.comicworm.controller.seller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.SellerCancelOrderRequest;
import com.example.comicworm.dto.request.SellerUpdateOrderStatusRequest;
import com.example.comicworm.dto.response.SellerOrderDetailRecord;
import com.example.comicworm.dto.response.SellerOrderStatsRecord;
import com.example.comicworm.service.seller.ISellerOrderService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@Profile("!preview")
@RequestMapping("/api/seller/orders")
public class SellerOrderController {

    private final ISellerOrderService sellerOrderService;

    public SellerOrderController(ISellerOrderService sellerOrderService) {
        this.sellerOrderService = sellerOrderService;
    }

    /**
     * Danh sách đơn hàng của người bán (phân trang, tìm kiếm, lọc theo tab).
     */
    @GetMapping
    public Map<String, Object> list(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false, defaultValue = "all") String filter,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(required = false, defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Long sellerId = seller(user);
        return sellerOrderService.listOrders(sellerId, filter, keyword, sort, page, size);
    }

    /**
     * Lấy các chỉ số KPI thống kê đơn hàng của người bán.
     */
    @GetMapping("/stats")
    public SellerOrderStatsRecord stats(@AuthenticationPrincipal CustomUserDetails user) {
        Long sellerId = seller(user);
        return sellerOrderService.getStats(sellerId);
    }

    /**
     * Lấy CSRF token cho các thao tác POST/PATCH/DELETE của Seller.
     */
    @GetMapping("/csrf")
    public Map<String, Object> csrf(@AuthenticationPrincipal CustomUserDetails user, CsrfToken token) {
        seller(user);
        return Map.of("Result", "OK", "headerName", token.getHeaderName(), "token", token.getToken());
    }

    /**
     * Chi tiết một đơn hàng (kèm danh sách sản phẩm và lịch sử lộ trình).
     */
    @GetMapping("/{id:[0-9]+}")
    public SellerOrderDetailRecord getDetail(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        Long sellerId = seller(user);
        return sellerOrderService.getOrderDetail(sellerId, id);
    }

    /**
     * Cập nhật trạng thái đơn hàng (Xác nhận đơn, Bàn giao vận chuyển, Hoàn tất).
     */
    @PatchMapping("/{id:[0-9]+}/status")
    public SellerOrderDetailRecord updateStatus(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody SellerUpdateOrderStatusRequest request
    ) {
        Long sellerId = seller(user);
        return sellerOrderService.updateStatus(sellerId, id, request.status(), request.note());
    }

    /**
     * Hủy đơn hàng và tự động hoàn trả tồn kho.
     */
    @PostMapping("/{id:[0-9]+}/cancel")
    public SellerOrderDetailRecord cancel(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody SellerCancelOrderRequest request
    ) {
        Long sellerId = seller(user);
        return sellerOrderService.cancelOrder(sellerId, id, request.reason());
    }

    private Long seller(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        if (!user.isSeller()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Yêu cầu quyền Người bán (ROLE_SELLER).");
        }
        return user.getId();
    }
}

