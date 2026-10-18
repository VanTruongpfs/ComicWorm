package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.User;
import com.example.comicworm.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AccountController {

    private final UserRepository userRepository;

    public AccountController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public record Account(Long id, String fullName, String email, String role, boolean isSeller, String avatarUrl) {}

    @GetMapping("/api/account/me")
    public Account currentAccount(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        Object principal = authentication.getPrincipal();

        // 1. Trường hợp xác thực chuẩn qua JWT (CustomUserDetails)
        if (principal instanceof CustomUserDetails user) {
            return new Account(user.getId(), user.getFullName(), user.getUsername(), user.getRole(), user.isSeller(), user.getAvatarUrl());
        }

        // 2. Trường hợp xác thực OAuth2 Google (OAuth2User) hoặc principal khác
        String email = null;
        if (principal instanceof OAuth2User oauth2User) {
            email = oauth2User.getAttribute("email");
        } else if (principal instanceof UserDetails userDetails) {
            email = userDetails.getUsername();
        } else if (principal instanceof String principalString) {
            email = principalString;
        }

        if (email != null && !email.isBlank()) {
            User dbUser = userRepository.findByEmailAndDeletedAtIsNull(email.trim().toLowerCase())
                    .orElse(null);
            if (dbUser != null) {
                return new Account(
                        dbUser.getId(),
                        dbUser.getFullName(),
                        dbUser.getEmail(),
                        dbUser.getRole().name(),
                        Boolean.TRUE.equals(dbUser.getIsSeller()),
                        dbUser.getAvatarUrl()
                );
            }
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
}
