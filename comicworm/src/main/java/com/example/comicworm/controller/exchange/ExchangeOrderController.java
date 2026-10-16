package com.example.comicworm.controller.exchange;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.service.exchange.ExchangeOrderService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/exchange") @Profile("!preview") @RequiredArgsConstructor
public class ExchangeOrderController {
    private final ExchangeOrderService service;
    private Long id(CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        return user.getId();
    }
    @GetMapping("/rooms/{roomId}/checkout") public ExchangeCheckoutDTO checkout(@PathVariable Long roomId, @AuthenticationPrincipal CustomUserDetails user) { return service.checkout(roomId, id(user)); }
    @GetMapping("/orders") public List<ExchangeCheckoutDTO> list(@AuthenticationPrincipal CustomUserDetails user) { return service.myDeals(id(user)); }
    @PostMapping("/rooms/{roomId}/orders") public ExchangeOrderDTO create(@PathVariable Long roomId, @AuthenticationPrincipal CustomUserDetails user, @Valid @RequestBody CreateExchangeOrderRequest request) { return service.create(roomId, id(user), request); }
    @PostMapping("/rooms/{roomId}/cancel-deal") public void cancel(@PathVariable Long roomId, @AuthenticationPrincipal CustomUserDetails user) { service.cancelDeal(roomId, id(user)); }
    public record ActionRequest(String action) {}
    @PostMapping("/orders/{orderId}/status") public ExchangeOrderDTO update(@PathVariable Long orderId, @AuthenticationPrincipal CustomUserDetails user, @RequestBody ActionRequest request) { return service.updateStatus(orderId, id(user), request.action()); }
}
