package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.User;
import com.example.comicworm.service.account.AccountProfileService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AccountController {
    public record Account(Long id, String fullName, String email, String role, boolean isSeller) {}
    public record UpdateProfileRequest(String fullName) {}
    public record ChangePasswordRequest(String currentPassword, String newPassword, String confirmPassword) {}

    private final AccountProfileService profiles;

    public AccountController(AccountProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/api/account/me")
    public Account currentAccount(@AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        try {
            User fresh = profiles.getUser(user);
            return new Account(fresh.getId(), fresh.getFullName(), fresh.getEmail(),
                    fresh.getRole().name(), Boolean.TRUE.equals(fresh.getIsSeller()));
        } catch (Exception e) {
            return new Account(user.getId(), user.getFullName(), user.getUsername(), user.getRole(), user.isSeller());
        }
    }

    /** CSRF token cho các thao tác ghi (đổi tên, đổi mật khẩu) vì phiên đăng nhập dùng cookie. */
    @GetMapping("/api/account/csrf")
    public Map<String, String> csrf(@AuthenticationPrincipal CustomUserDetails user, CsrfToken token) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @PutMapping("/api/account/profile")
    public Account updateProfile(@AuthenticationPrincipal CustomUserDetails user,
                                 @RequestBody UpdateProfileRequest request) {
        User saved = profiles.updateFullName(user, request == null ? null : request.fullName());
        return new Account(saved.getId(), saved.getFullName(), saved.getEmail(),
                saved.getRole().name(), Boolean.TRUE.equals(saved.getIsSeller()));
    }

    @PostMapping("/api/account/password")
    public Map<String, Object> changePassword(@AuthenticationPrincipal CustomUserDetails user,
                                              @RequestBody ChangePasswordRequest request) {
        if (request == null) request = new ChangePasswordRequest(null, null, null);
        profiles.changePassword(user, request.currentPassword(), request.newPassword(), request.confirmPassword());
        return Map.of("success", true, "message", "Đổi mật khẩu thành công.");
    }

    @ExceptionHandler(AccountProfileService.InvalidInputException.class)
    public ResponseEntity<Map<String, Object>> invalidInput(AccountProfileService.InvalidInputException error) {
        return ResponseEntity.badRequest()
                .body(Map.of("success", false, "field", error.getField(), "message", error.getMessage()));
    }
}