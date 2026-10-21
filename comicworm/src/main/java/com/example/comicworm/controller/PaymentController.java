package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.CreateOrderRequest;
import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.dto.response.CheckoutSummaryDTO;
import com.example.comicworm.dto.response.VNPayCallbackResultDTO;
import com.example.comicworm.service.IOrderService;
import com.example.comicworm.service.IPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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

    @PutMapping("/{checkoutCode}/address")
    public ResponseEntity<?> updateCheckoutAddress(
            @PathVariable String checkoutCode,
            @Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        orderService.updateCheckoutAddress(checkoutCode, userDetails.getId(), request);
        return ResponseEntity.ok(Map.of("message", "Đã cập nhật địa chỉ giao hàng thành công"));
    }

    @PostMapping("/{checkoutCode}/pay")
    public ResponseEntity<Map<String, Object>> processPayment(
            @PathVariable String checkoutCode,
            @Valid @RequestBody ProcessPaymentRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletRequest httpServletRequest) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        Map<String, Object> result = paymentService.processCheckoutPayment(checkoutCode, userDetails.getId(), request, httpServletRequest);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/vnpay-return")
    public void vnpayReturn(
            @RequestParam Map<String, String> queryParams,
            HttpServletResponse response) throws IOException {
        VNPayCallbackResultDTO result = paymentService.processVNPayCallback(queryParams);
        if (result.isSuccess()) {
            String redirectUrl = "/buyer/html/page3.html?checkoutCode="
                    + (result.getCheckoutCode() != null ? URLEncoder.encode(result.getCheckoutCode(), StandardCharsets.UTF_8) : "")
                    + "&paymentSuccess=true&vnp_TxnRef="
                    + (result.getPaymentCode() != null ? URLEncoder.encode(result.getPaymentCode(), StandardCharsets.UTF_8) : "");
            response.sendRedirect(redirectUrl);
        } else {
            String errorMsg = result.getMessage() != null ? result.getMessage() : "Thanh toán thất bại";
            String redirectUrl = "/buyer/html/payment.html?checkoutCode="
                    + (result.getCheckoutCode() != null ? URLEncoder.encode(result.getCheckoutCode(), StandardCharsets.UTF_8) : "")
                    + "&paymentError=" + URLEncoder.encode(errorMsg, StandardCharsets.UTF_8)
                    + "&vnp_ResponseCode=" + (result.getResponseCode() != null ? URLEncoder.encode(result.getResponseCode(), StandardCharsets.UTF_8) : "");
            response.sendRedirect(redirectUrl);
        }
    }

    @GetMapping("/vnpay-ipn")
    public ResponseEntity<Map<String, String>> vnpayIpn(@RequestParam Map<String, String> queryParams) {
        VNPayCallbackResultDTO result = paymentService.processVNPayCallback(queryParams);
        if (!result.isSuccess() && "Chữ ký bảo mật VNPay không hợp lệ".equals(result.getMessage())) {
            return ResponseEntity.ok(Map.of("RspCode", "97", "Message", "Invalid Checksum"));
        }
        if (result.getCheckoutCode() == null && !result.isSuccess()) {
            return ResponseEntity.ok(Map.of("RspCode", "01", "Message", "Order not found"));
        }
        if (result.isSuccess()) {
            return ResponseEntity.ok(Map.of("RspCode", "00", "Message", "Confirm Success"));
        }
        return ResponseEntity.ok(Map.of("RspCode", "02", "Message", "Order already confirmed"));
    }
}
