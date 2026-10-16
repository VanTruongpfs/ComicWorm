package com.example.comicworm.controller.admin;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.admin.RejectProductRequest;
import com.example.comicworm.dto.response.admin.AdminProductModerationDTO;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.service.admin.AdminModerationService;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin-only API for reviewing product listings. URL-level protection lives in SecurityConfig
 * (/api/admin/** requires ROLE_ADMIN); @PreAuthorize is a second line of defence.
 */
@RestController
@RequestMapping("/api/admin/moderation")
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {
    private final AdminModerationService service;

    public AdminModerationController(AdminModerationService service) {
        this.service = service;
    }

    @GetMapping("/csrf")
    public Map<String, Object> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @GetMapping("/products")
    public Map<String, Object> list(@RequestParam(defaultValue = "PENDING") String status,
                                    @RequestParam(defaultValue = "") String search,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "10") int size) {
        return service.list(parseStatus(status), search, page, size);
    }

    @GetMapping("/products/{id}")
    public AdminProductModerationDTO get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/products/{id}/approve")
    public AdminProductModerationDTO approve(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long id) {
        return service.approve(admin.getId(), id);
    }

    @PostMapping("/products/{id}/reject")
    public AdminProductModerationDTO reject(@AuthenticationPrincipal CustomUserDetails admin, @PathVariable Long id,
                                            @Valid @RequestBody RejectProductRequest request) {
        return service.reject(admin.getId(), id, request.reason());
    }

    private ModerationStatus parseStatus(String status) {
        try {
            return ModerationStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái kiểm duyệt không hợp lệ.");
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

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable() {
        return error(HttpStatus.BAD_REQUEST, "Dữ liệu gửi lên không hợp lệ.");
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message == null ? status.getReasonPhrase() : message);
        return ResponseEntity.status(status).body(body);
    }
}
