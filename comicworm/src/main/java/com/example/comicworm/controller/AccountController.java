package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AccountController {
    public record Account(Long id, String fullName, String email, String role, boolean isSeller) {}

    @GetMapping("/api/account/me")
    public Account currentAccount(@AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return new Account(user.getId(), user.getFullName(), user.getUsername(), user.getRole(), user.isSeller());
    }
}
