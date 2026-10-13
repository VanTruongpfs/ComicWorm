package com.example.comicworm.controller.admin;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.RejectProductRequest;
import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.service.admin.IProductModerationService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

@RestController
@Profile("!preview")
@RequestMapping("/api/admin/products")
public class ProductModerationController {

    private final IProductModerationService moderationService;

    public ProductModerationController(IProductModerationService moderationService) {
        this.moderationService = moderationService;
    }

    /**
     * Danh sách sản phẩm kiểm duyệt (mặc định lấy PENDING - Chờ duyệt).
     */
    @GetMapping
    public Map<String, Object> list(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false, defaultValue = "PENDING") String status,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        requireAdmin(user);

        ModerationStatus modStatus = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
            try {
                modStatus = ModerationStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái kiểm duyệt không hợp lệ (PENDING, APPROVED, REJECTED, ALL).");
            }
        }

        return moderationService.list(modStatus, keyword, page, size);
    }

    /**
     * Thống kê số lượng sản phẩm theo trạng thái kiểm duyệt.
     */
    @GetMapping("/stats")
    public Map<String, Object> stats(@AuthenticationPrincipal CustomUserDetails user) {
        requireAdmin(user);
        return Map.of("Result", "OK", "Stats", moderationService.countStats());
    }

    /**
     * Chi tiết sản phẩm cần kiểm duyệt.
     */
    @GetMapping("/{id:\\d+}")
    public Map<String, Object> detail(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        requireAdmin(user);
        return Map.of("Result", "OK", "Record", moderationService.get(id));
    }

    /**
     * Duyệt sản phẩm -> chuyển sang trạng thái APPROVED (Đã duyệt).
     */
    @PostMapping("/{id:\\d+}/approve")
    public Map<String, Object> approve(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        Long adminId = requireAdmin(user);
        AdminProductRecord record = moderationService.approve(id, adminId);
        return Map.of(
                "Result", "OK",
                "Message", "Đã phê duyệt sản phẩm thành công.",
                "Record", record
        );
    }

    /**
     * Từ chối sản phẩm -> chuyển sang trạng thái REJECTED (Từ chối) và lưu lý do từ chối.
     */
    @PostMapping("/{id:\\d+}/reject")
    public Map<String, Object> reject(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody RejectProductRequest request
    ) {
        Long adminId = requireAdmin(user);
        AdminProductRecord record = moderationService.reject(id, adminId, request.reason());
        return Map.of(
                "Result", "OK",
                "Message", "Đã từ chối kiểm duyệt sản phẩm.",
                "Record", record
        );
    }

    private Long requireAdmin(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập với tài khoản Quản trị viên.");
        }
        boolean isAdmin = user.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền Quản trị viên.");
        }
        return user.getId();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatusException(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of(
                "Result", "ERROR",
                "Message", error.getReason() != null ? error.getReason() : "Thao tác không thành công."
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationException(MethodArgumentNotValidException error) {
        String message = error.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getDefaultMessage())
                .findFirst()
                .orElse("Dữ liệu yêu cầu không hợp lệ.");
        return ResponseEntity.badRequest().body(Map.of(
                "Result", "ERROR",
                "Message", message
        ));
    }
}
