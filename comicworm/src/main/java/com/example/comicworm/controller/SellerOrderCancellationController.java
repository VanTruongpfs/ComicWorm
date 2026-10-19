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

@RestController
@Profile("!preview")
@RequiredArgsConstructor
@RequestMapping("/api/seller/orders")
public class SellerOrderCancellationController {

    private final OrderCancellationService cancellationService;

    @PostMapping("/{orderId}/cancel")
    public CancelResultDTO cancel(
            @PathVariable Long orderId,
            @Valid @RequestBody CancelOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        return cancellationService.cancel(orderId, user.getId(), CancelActor.SELLER, request.reason());
    }
}
