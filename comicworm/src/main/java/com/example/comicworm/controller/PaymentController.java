package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.dto.response.CheckoutSummaryDTO;
import com.example.comicworm.service.IOrderService;
import com.example.comicworm.service.IPaymentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/checkout")
public class PaymentController {

    private final IOrderService orderService;
    private final IPaymentService paymentService;

    public PaymentController(IOrderService orderService, IPaymentService paymentService) {
        this.orderService = orderService;
        this.paymentService = paymentService;
    }

    @GetMapping("/{checkoutCode}")
    public ResponseEntity<CheckoutSummaryDTO> getCheckoutSummary(
            @PathVariable String checkoutCode,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        CheckoutSummaryDTO summary = orderService.getCheckoutSummary(checkoutCode, userDetails.getId());
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/{checkoutCode}/pay")
    public ResponseEntity<Map<String, Object>> processPayment(
            @PathVariable String checkoutCode,
            @Valid @RequestBody ProcessPaymentRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        Map<String, Object> result = paymentService.processCheckoutPayment(checkoutCode, userDetails.getId(), request);
        return ResponseEntity.ok(result);
    }
}
