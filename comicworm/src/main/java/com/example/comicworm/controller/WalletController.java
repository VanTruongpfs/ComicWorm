package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.WalletDTO;
import com.example.comicworm.service.wallet.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** The signed-in user's wallet: balance and the latest credits from exchange escrows. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/wallet")
public class WalletController {

    private final WalletService wallets;

    @GetMapping("/me")
    public WalletDTO me(@AuthenticationPrincipal CustomUserDetails user) {
        // The security chain ends in permitAll, so the caller is checked here.
        if (user == null || user.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        return wallets.myWallet(user.getId());
    }
}
