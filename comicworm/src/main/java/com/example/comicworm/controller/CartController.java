package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.AddToCartRequest;
import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.request.UpdateCartItemRequest;
import com.example.comicworm.dto.response.CartResponseDTO;
import com.example.comicworm.service.ICartService;
import com.example.comicworm.service.IOrderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final ICartService cartService;
    private final IOrderService orderService;

    public CartController(ICartService cartService, IOrderService orderService) {
        this.cartService = cartService;
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<?> getCart(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }
        return ResponseEntity.ok(cartService.getCart(userDetails.getId()));
    }

    @PostMapping("/add")
    public ResponseEntity<?> addToCart(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody AddToCartRequest request) {
        if (userDetails == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng"));
        }
        cartService.addToCart(userDetails.getId(), request);
        return ResponseEntity.ok(Map.of("message", "Thêm vào giỏ hàng thành công"));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<?> updateItem(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long itemId,
            @Valid @RequestBody UpdateCartItemRequest request) {
        if (userDetails == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }
        cartService.updateCartItem(userDetails.getId(), itemId, request);
        return ResponseEntity.ok(Map.of("message", "Cập nhật giỏ hàng thành công"));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<?> removeItem(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long itemId) {
        if (userDetails == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }
        cartService.removeCartItem(userDetails.getId(), itemId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa sản phẩm khỏi giỏ"));
    }

    @DeleteMapping("/clear")
    public ResponseEntity<?> clearCart(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập"));
        }
        cartService.clearCart(userDetails.getId());
        return ResponseEntity.ok(Map.of("message", "Đã làm trống giỏ hàng"));
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CreateOrderRequest request) {
        if (userDetails == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Vui lòng đăng nhập để thanh toán"));
        }
        String checkoutCode = orderService.createOrderFromCart(userDetails.getId(), request);
        return ResponseEntity.ok(Map.of(
                "message", "Đặt hàng thành công",
                "checkoutCode", checkoutCode
        ));
    }
}