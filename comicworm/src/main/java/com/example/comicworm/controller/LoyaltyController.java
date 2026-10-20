package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.LoyaltyAccountDTO;
import com.example.comicworm.dto.response.LoyaltyTransactionDTO;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/loyalty")
public class LoyaltyController {

    private final LoyaltyService loyaltyService;

    @GetMapping("/me")
    public LoyaltyAccountDTO getMyAccount(@AuthenticationPrincipal CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        return loyaltyService.getMyAccount(user.getId());
    }

    @GetMapping("/me/transactions")
    public PageResponseDTO<LoyaltyTransactionDTO> getMyTransactions(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trang phải không âm và kích thước từ 1 đến 100");
        }
        Pageable pageable = PageRequest.of(page, size);
        return loyaltyService.getMyTransactions(user.getId(), pageable);
    }
}
