package com.example.comicworm.mapper;


import com.example.comicworm.dto.general.auth.GoogleLoginDTO;
import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    // Chuyển DTO đăng ký thành Entity User (chưa gán passwordHash)
    public User toEntity(UserRegisterDTO dto) {
        if (dto == null) return null;

        User user = new User();
        user.setEmail(dto.getEmail().trim().toLowerCase());
        user.setFullName(dto.getFullName().trim());
        user.setPhone(dto.getPhone());
        user.setRole(UserRole.USER);
        user.setIsSeller(false);
        user.setAccountStatus(AccountStatus.ACTIVE);
        return user;
    }

    // Tạo User mới từ thông tin Google Login (passwordHash = null)
    public User toEntity(GoogleLoginDTO dto) {
        if (dto == null) return null;

        User user = new User();
        user.setEmail(dto.getEmail().trim().toLowerCase());
        user.setGoogleSub(dto.getGoogleSub());
        user.setFullName(dto.getFullName());
        user.setAvatarUrl(dto.getAvatarUrl());
        user.setPasswordHash(null); // Không có mật khẩu khi tạo bằng Google
        user.setRole(UserRole.USER);
        user.setIsSeller(false);
        user.setAccountStatus(AccountStatus.ACTIVE);
        return user;
    }

    // Đóng gói thông tin trả về kèm App JWT Tokens
    public AuthResponseDTO toAuthResponseDTO(User user, String accessToken, String refreshToken) {
        return AuthResponseDTO.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .isSeller(user.getIsSeller())
                .build();
    }
}