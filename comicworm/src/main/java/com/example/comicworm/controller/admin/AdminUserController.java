package com.example.comicworm.controller.admin;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.AdminCreateUserRequest;
import com.example.comicworm.dto.request.AdminUpdateUserStatusRequest;
import com.example.comicworm.dto.response.AdminUserRecord;
import com.example.comicworm.dto.response.AdminUserStatsRecord;
import com.example.comicworm.service.admin.IAdminUserService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@Profile("!preview")
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final IAdminUserService adminUserService;

    public AdminUserController(IAdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    /**
     * Danh sách tài khoản người dùng có phân trang, tìm kiếm, lọc.
     */
    @GetMapping
    public Map<String, Object> list(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false, defaultValue = "ALL") String role,
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        requireAdmin(user);
        return adminUserService.listUsers(role, status, keyword, page, size);
    }

    /**
     * Thống kê số lượng người dùng cho 4 thẻ KPI.
     */
    @GetMapping("/stats")
    public AdminUserStatsRecord stats(@AuthenticationPrincipal CustomUserDetails user) {
        requireAdmin(user);
        return adminUserService.getStats();
    }

    /**
     * Chi tiết một tài khoản người dùng kèm số đơn mua / số truyện đăng bán.
     */
    @GetMapping("/{id:[0-9]+}")
    public AdminUserRecord getDetail(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        requireAdmin(user);
        return adminUserService.getUserDetail(id);
    }

    /**
     * Tạo tài khoản mới thủ công từ giao diện Quản trị.
     */
    @PostMapping
    public ResponseEntity<AdminUserRecord> create(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody AdminCreateUserRequest request
    ) {
        requireAdmin(user);
        AdminUserRecord created = adminUserService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Khóa hoặc Mở khóa tài khoản (chuyển đổi ACTIVE <-> LOCKED).
     */
    @PatchMapping("/{id:[0-9]+}/status")
    public AdminUserRecord updateStatus(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateUserStatusRequest request
    ) {
        requireAdmin(user);
        Long currentAdminId = (user != null) ? user.getId() : null;
        return adminUserService.updateUserStatus(id, request.status(), request.reason(), currentAdminId);
    }

    /**
     * Cấp hoặc thu hồi quyền Người bán (is_seller = true/false).
     */
    @PatchMapping("/{id:[0-9]+}/seller-role")
    public AdminUserRecord toggleSellerRole(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestParam boolean isSeller
    ) {
        requireAdmin(user);
        return adminUserService.toggleSellerRole(id, isSeller);
    }

    /**
     * Xóa mềm tài khoản người dùng (deleted_at = now()).
     */
    @DeleteMapping("/{id:[0-9]+}")
    public Map<String, Object> softDelete(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        requireAdmin(user);
        Long currentAdminId = (user != null) ? user.getId() : null;
        adminUserService.softDeleteUser(id, currentAdminId);
        return Map.of("Result", "OK", "Message", "Đã xóa mềm tài khoản ID: " + id);
    }

    private void requireAdmin(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập tài khoản quản trị.");
        }
        boolean isAdmin = user.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Yêu cầu quyền Quản trị viên (ROLE_ADMIN).");
        }
    }
}

