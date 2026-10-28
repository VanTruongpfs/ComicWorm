package com.example.comicworm.service.account;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Đổi tên hiển thị và đổi mật khẩu cho người dùng đang đăng nhập. */
@Service
public class AccountProfileService {
    public static final int NAME_MAX = 100;
    public static final int PASSWORD_MIN = 8;
    /** BCrypt chỉ dùng 72 byte đầu của mật khẩu. */
    public static final int PASSWORD_MAX_BYTES = 72;

    /** Lỗi nhập liệu gắn với một ô cụ thể trên form. */
    public static class InvalidInputException extends RuntimeException {
        private final String field;

        public InvalidInputException(String field, String message) {
            super(message);
            this.field = field;
        }

        public String getField() {
            return field;
        }
    }

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AccountProfileService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User updateFullName(CustomUserDetails principal, String fullName) {
        User user = activeUser(principal);
        String name = fullName == null ? "" : fullName.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw new InvalidInputException("fullName", "Vui lòng nhập tên hiển thị.");
        if (name.codePointCount(0, name.length()) > NAME_MAX) {
            throw new InvalidInputException("fullName", "Tên hiển thị tối đa " + NAME_MAX + " ký tự.");
        }
        if (name.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidInputException("fullName", "Tên hiển thị chứa ký tự không hợp lệ.");
        }
        user.setFullName(name);
        return users.save(user);
    }

    @Transactional
    public void changePassword(CustomUserDetails principal, String currentPassword,
                               String newPassword, String confirmPassword) {
        User user = activeUser(principal);
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw new InvalidInputException("currentPassword",
                    "Tài khoản này đăng nhập bằng Google và chưa có mật khẩu. Hãy dùng \"Quên mật khẩu\" để tạo mật khẩu.");
        }
        if (currentPassword == null || currentPassword.isEmpty()) {
            throw new InvalidInputException("currentPassword", "Vui lòng nhập mật khẩu hiện tại.");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new InvalidInputException("currentPassword", "Mật khẩu hiện tại không đúng.");
        }
        if (newPassword == null || newPassword.length() < PASSWORD_MIN) {
            throw new InvalidInputException("newPassword", "Mật khẩu mới phải từ " + PASSWORD_MIN + " ký tự trở lên.");
        }
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > PASSWORD_MAX_BYTES) {
            throw new InvalidInputException("newPassword", "Mật khẩu mới quá dài (tối đa " + PASSWORD_MAX_BYTES + " byte).");
        }
        if (newPassword.equals(currentPassword)) {
            throw new InvalidInputException("newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại.");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw new InvalidInputException("confirmPassword", "Mật khẩu xác nhận không khớp.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        users.save(user);
    }

    public User getUser(CustomUserDetails principal) {
        return activeUser(principal);
    }

    private User activeUser(CustomUserDetails principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        User user = users.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (user.getDeletedAt() != null || user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return user;
    }
}