package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.RefundRequestReasonRequest;
import com.example.comicworm.dto.response.RefundRequestResultDTO;
import com.example.comicworm.service.OrderRefundRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** T04 - Người mua yêu cầu hoàn tiền sau khi giao; người bán đồng ý hoặc từ chối. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class OrderRefundRequestController {

    private final OrderRefundRequestService service;

    @PostMapping("/orders/{code}/refund-request")
    public RefundRequestResultDTO request(@PathVariable String code,
                                          @RequestBody(required = false) RefundRequestReasonRequest body,
                                          @AuthenticationPrincipal CustomUserDetails user) {
        return service.request(code, requireUser(user), body == null ? null : body.reason());
    }

    @PostMapping("/seller/orders/{code}/refund-request/approve")
    public RefundRequestResultDTO approve(@PathVariable String code,
                                          @AuthenticationPrincipal CustomUserDetails user) {
        return service.approve(code, requireUser(user));
    }

    @PostMapping("/seller/orders/{code}/refund-request/reject")
    public RefundRequestResultDTO reject(@PathVariable String code,
                                         @RequestBody(required = false) RefundRequestReasonRequest body,
                                         @AuthenticationPrincipal CustomUserDetails user) {
        return service.reject(code, requireUser(user), body == null ? null : body.reason());
    }

    private static Long requireUser(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        return user.getId();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handle(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("success", false,
                        "message", ex.getReason() == null ? "Không thể xử lý yêu cầu hoàn tiền" : ex.getReason()));
    }
}
