package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.service.account.SellerUpgradeService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

@Controller
public class SellerAccountController {
    private final SellerUpgradeService upgrades;

    public SellerAccountController(SellerUpgradeService upgrades) {
        this.upgrades = upgrades;
    }

    @GetMapping("/user/seller-upgrade")
    public String upgradePage(@AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(defaultValue = "false") boolean csrfExpired, Model model) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (user.isSeller()) return "redirect:/seller/html/index.html";
        model.addAttribute("fullName", user.getFullName());
        model.addAttribute("csrfExpired", csrfExpired);
        return "view/user/html/seller-upgrade";
    }

    @PostMapping("/user/seller-upgrade")
    public String upgrade(@AuthenticationPrincipal CustomUserDetails user) {
        upgrades.upgrade(user);
        return "redirect:/seller/html/index.html";
    }
}
