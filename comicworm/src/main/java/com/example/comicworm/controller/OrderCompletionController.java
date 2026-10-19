package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.Order;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.service.OrderCompletionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
public class OrderCompletionController {

    private final OrderRepository orderRepository;
    private final OrderCompletionService completionService;

    @PostMapping("/{orderId}/confirm-received")
    public Map<String, Object> confirmReceived(
            @PathVariable Long orderId,
            @AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));
        if (!user.getId().equals(order.getBuyerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xác nhận đơn hàng này");
        }

        Order completedOrder = completionService.complete(orderId, user.getId());
        return Map.of("orderId", completedOrder.getId(), "status", completedOrder.getStatus());
    }
}
