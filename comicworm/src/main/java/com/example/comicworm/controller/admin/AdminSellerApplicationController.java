package com.example.comicworm.controller.admin;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.RejectSellerApplicationRequest;
import com.example.comicworm.dto.response.SellerApplicationDTO;
import com.example.comicworm.model.enums.SellerApplicationStatus;
import com.example.comicworm.service.account.SellerApplicationService;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin review of seller applications ("Đăng ký Người bán"). /api/admin/** already requires ROLE_ADMIN
 * and CSRF on writes (SecurityConfig); @PreAuthorize is a second line of defence.
 */
@RestController
@RequestMapping("/api/admin/seller-applications")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSellerApplicationController {
    private final SellerApplicationService service;

    public AdminSellerApplicationController(SellerApplicationService service) {
        this.service = service;
    }

    @GetMapping("/csrf")
    public Map<String, Object> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @GetMapping
    public List<SellerApplicationDTO> list(@RequestParam(defaultValue = "PENDING") String status) {
        return service.list(parseStatus(status));
    }

    @GetMapping("/{id}")
    public SellerApplicationDTO get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/{id}/approve")
    public SellerApplicationDTO approve(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long id) {
        return service.approve(admin.getId(), id);
    }

    @PostMapping("/{id}/reject")
    public SellerApplicationDTO reject(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long id,
                                       @Valid @RequestBody RejectSellerApplicationRequest request) {
        return service.reject(admin.getId(), id, request.reason());
    }

    private SellerApplicationStatus parseStatus(String status) {
        try {
            return SellerApplicationStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái hồ sơ không hợp lệ.");
        }
    }

    // JSON errors in one shape ({message}) so the admin page can display them.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return error(HttpStatus.valueOf(e.getStatusCode().value()), e.getReason());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleInvalid(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getDefaultMessage()).findFirst().orElse("Dữ liệu gửi lên không hợp lệ.");
        return error(HttpStatus.BAD_REQUEST, message);
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
