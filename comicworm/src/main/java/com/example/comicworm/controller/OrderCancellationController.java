package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.CancelOrderRequest;
import com.example.comicworm.dto.response.CancelResultDTO;
import com.example.comicworm.model.enums.CancelActor;
import com.example.comicworm.service.OrderCancellationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.comicworm.repository.OrderRepository;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;

@RestController
@Profile("!preview")
@RequiredArgsConstructor
@RequestMapping("/api/orders")
public class OrderCancellationController {

    private final OrderCancellationService cancellationService;
    private final OrderRepository orderRepository;

    @PostMapping("/{orderId}/cancel")
    public CancelResultDTO cancel(
            @PathVariable String orderId,
            @Valid @RequestBody CancelOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        Long numericId;
        if (orderId.matches("\\d+")) {
            numericId = Long.parseLong(orderId);
            if (!orderRepository.existsById(numericId)) {
                numericId = orderRepository.findByOrderCode(orderId)
                        .map(com.example.comicworm.model.Order::getId)
                        .orElse(numericId);
            }
        } else {
            numericId = orderRepository.findByOrderCode(orderId)
                    .map(com.example.comicworm.model.Order::getId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));
        }
        CancelActor actor = user.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()))
                ? CancelActor.ADMIN : CancelActor.BUYER;
        return cancellationService.cancel(numericId, user.getId(), actor, request.reason());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("success", false, "message", ex.getReason() == null ? "Lỗi xử lý đơn hàng" : ex.getReason()));
    }
}
