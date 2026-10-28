package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.CreateUpgradeRequestDTO;
import com.example.comicworm.dto.response.SellerTierInfoDTO;
import com.example.comicworm.dto.response.SellerUpgradeRequestDTO;
import com.example.comicworm.service.ISellerTierService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/seller/tier")
@RequiredArgsConstructor
public class SellerTierController {

    private final ISellerTierService tierService;

    @GetMapping("/info")
    public ResponseEntity<SellerTierInfoDTO> getTierInfo(@AuthenticationPrincipal CustomUserDetails user) {
        Long userId = requireUserId(user);
        return ResponseEntity.ok(tierService.getTierInfo(userId));
    }

    @PostMapping("/request")
    public ResponseEntity<SellerUpgradeRequestDTO> requestUpgrade(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody CreateUpgradeRequestDTO request
    ) {
        Long userId = requireUserId(user);
        SellerUpgradeRequestDTO created = tierService.requestUpgrade(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/upload-proof")
    public ResponseEntity<Map<String, String>> uploadProof(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam("file") MultipartFile file
    ) {
        requireUserId(user);
        String url = tierService.uploadProof(file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    private Long requireUserId(CustomUserDetails user) {
        if (user == null || user.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để thực hiện chức năng này");
        }
        return user.getId();
    }
}

