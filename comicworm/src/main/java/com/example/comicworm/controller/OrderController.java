package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.OrderDTOs;
import com.example.comicworm.service.order.OrderTrackingService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * B08 - xem lịch sử mua hàng. Người bán xử lý đơn của mình; ADMIN quản lý toàn sàn.
 */
@RestController
@RequestMapping("/api")
public class OrderController {

    private final OrderTrackingService service;

    public OrderController(OrderTrackingService service) {
        this.service = service;
    }

    /** Lịch sử mua hàng của chính người đăng nhập. */
    @GetMapping("/orders/my")
    public OrderDTOs.PageOf myOrders(@AuthenticationPrincipal CustomUserDetails user,
                                     @RequestParam(defaultValue = "all") String status,
                                     @RequestParam(defaultValue = "") String q,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "10") int size) {
        return service.buyerHistory(requireUser(user).getId(), status, q, page, size);
    }

    /** Chi tiết + lịch sử trạng thái: chỉ người mua hoặc người bán của đơn đó (người khác nhận 404). */
    @GetMapping("/orders/{code}")
    public OrderDTOs.Detail detail(@AuthenticationPrincipal CustomUserDetails user, @PathVariable String code) {
        return service.detail(code, requireUser(user).getId(), false);
    }

    /** Đơn nhận được của người bán (/api/seller/** yêu cầu ROLE_SELLER). */
    @GetMapping("/seller/orders")
    public OrderDTOs.PageOf sellerOrders(@AuthenticationPrincipal CustomUserDetails user,
                                         @RequestParam(defaultValue = "all") String status,
                                         @RequestParam(defaultValue = "") String q,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "10") int size,
                                         @RequestParam(defaultValue = "newest") String sort) {
        requireSeller(user);
        return service.sellerOrders(user.getId(), status, q, page, size, sort);
    }

    @PatchMapping("/seller/orders/{code}/status")
    public OrderDTOs.Detail updateSellerStatus(@AuthenticationPrincipal CustomUserDetails user,
                                               @PathVariable String code,
                                               @RequestBody OrderDTOs.UpdateStatusRequest body) {
        requireSeller(user);
        return service.updateSellerStatus(code, user.getId(), body.status(), body.note());
    }

    // ------------------------------------------------------------------ ADMIN

    @GetMapping("/admin/orders")
    public OrderDTOs.PageOf adminOrders(@AuthenticationPrincipal CustomUserDetails user,
                                        @RequestParam(defaultValue = "all") String status,
                                        @RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size) {
        requireAdmin(user);
        return service.adminOrders(status, q, page, size);
    }

    @GetMapping("/admin/orders/{code}")
    public OrderDTOs.Detail adminDetail(@AuthenticationPrincipal CustomUserDetails user, @PathVariable String code) {
        requireAdmin(user);
        return service.detail(code, user.getId(), true);
    }

    @PatchMapping("/admin/orders/{code}/status")
    public OrderDTOs.Detail updateStatus(@AuthenticationPrincipal CustomUserDetails user, @PathVariable String code,
                                         @RequestBody OrderDTOs.UpdateStatusRequest body) {
        requireAdmin(user);
        return service.updateStatus(code, user.getId(), true, body.status(), body.note());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("success", false, "message", ex.getReason() == null ? "Lỗi" : ex.getReason()));
    }

    private CustomUserDetails requireUser(CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        return user;
    }

    private void requireAdmin(CustomUserDetails user) {
        requireUser(user);
        boolean admin = user.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!admin) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ quản trị viên mới có quyền này.");
    }

    private void requireSeller(CustomUserDetails user) {
        requireUser(user);
        if (!user.isSeller()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn cần tài khoản người bán.");
        }
    }
}
