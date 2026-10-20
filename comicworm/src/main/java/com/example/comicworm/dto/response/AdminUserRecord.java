package com.example.comicworm.dto.response;

import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;

import java.time.LocalDateTime;

public record AdminUserRecord(
        Long id,
        String fullName,
        String email,
        String phone,
        String avatarUrl,
        UserRole role,
        Boolean isSeller,
        AccountStatus accountStatus,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String authProvider,
        long totalOrders,
        long totalProducts
) {
    public static AdminUserRecord from(User user, long totalOrders, long totalProducts) {
        String authProvider = (user.getGoogleSub() != null && !user.getGoogleSub().isBlank()) ? "Google" : "Password";
        return new AdminUserRecord(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone() != null ? user.getPhone() : "",
                user.getAvatarUrl(),
                user.getRole(),
                Boolean.TRUE.equals(user.getIsSeller()),
                user.getAccountStatus(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                authProvider,
                totalOrders,
                totalProducts
        );
    }
}

