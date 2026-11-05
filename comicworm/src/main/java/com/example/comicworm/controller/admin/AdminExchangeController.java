package com.example.comicworm.controller.admin;

import com.example.comicworm.dto.exchange.AdminExchangeDealDTO;
import com.example.comicworm.dto.exchange.EscrowDTO;
import com.example.comicworm.dto.exchange.EscrowListDTO;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.ExchangeAdminActionRequest;
import com.example.comicworm.service.exchange.AdminExchangeDealService;
import com.example.comicworm.service.exchange.ExchangeEscrowService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin review of exchange deals and the escrow of their cash compensation.
 * /api/admin/** already requires ROLE_ADMIN and CSRF on writes (SecurityConfig).
 */
@RestController
@Profile("!preview")
@RequiredArgsConstructor
@RequestMapping("/api/admin/exchange")
@PreAuthorize("hasRole('ADMIN')")
public class AdminExchangeController {

    private final AdminExchangeDealService deals;
    private final ExchangeEscrowService escrows;

    @GetMapping("/csrf")
    public Map<String, Object> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @GetMapping("/deals")
    public List<AdminExchangeDealDTO> deals(@RequestParam(defaultValue = "PENDING") String status) {
        return deals.list(status);
    }

    @PostMapping("/deals/{offerId}/approve")
    public AdminExchangeDealDTO approve(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long offerId) {
        return deals.approve(admin.getId(), offerId);
    }

    @PostMapping("/deals/{offerId}/reject")
    public AdminExchangeDealDTO reject(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long offerId,
                                       @RequestBody(required = false) ExchangeAdminActionRequest request) {
        return deals.reject(admin.getId(), offerId, note(request));
    }

    @GetMapping("/escrows")
    public EscrowListDTO escrows(@RequestParam(defaultValue = "ALL") String status) {
        return escrows.list(status);
    }

    @PostMapping("/escrows/{escrowId}/release")
    public EscrowDTO release(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long escrowId,
                             @RequestBody(required = false) ExchangeAdminActionRequest request) {
        return escrows.release(admin.getId(), escrowId, note(request));
    }

    @PostMapping("/escrows/{escrowId}/refund")
    public EscrowDTO refund(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long escrowId,
                            @RequestBody(required = false) ExchangeAdminActionRequest request) {
        return escrows.refund(admin.getId(), escrowId, note(request));
    }

    private static String note(ExchangeAdminActionRequest request) {
        return request == null ? null : request.note();
    }

    // JSON errors in one shape ({message}) so the admin page can display them.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return error(HttpStatus.valueOf(e.getStatusCode().value()), e.getReason());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable() {
        return error(HttpStatus.BAD_REQUEST, "Dữ liệu gửi lên không hợp lệ.");
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message == null ? status.getReasonPhrase() : message);
        return ResponseEntity.status(status).body(body);
    }
}
