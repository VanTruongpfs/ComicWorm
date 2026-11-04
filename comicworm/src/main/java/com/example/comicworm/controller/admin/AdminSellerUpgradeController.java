package com.example.comicworm.controller.admin;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.RejectUpgradeRequestDTO;
import com.example.comicworm.dto.response.SellerUpgradeRequestDTO;
import com.example.comicworm.service.ISellerTierService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/seller-upgrades")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSellerUpgradeController {

    private final ISellerTierService tierService;

    @GetMapping
    public ResponseEntity<Page<SellerUpgradeRequestDTO>> getRequests(
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(tierService.getAdminRequests(status, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SellerUpgradeRequestDTO> getRequestDetail(@PathVariable Long id) {
        return ResponseEntity.ok(tierService.getAdminRequestDetail(id));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<SellerUpgradeRequestDTO> approve(
            @AuthenticationPrincipal CustomUserDetails admin,
            @PathVariable Long id
    ) {
        Long adminId = requireAdminId(admin);
        return ResponseEntity.ok(tierService.approveRequest(adminId, id));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<SellerUpgradeRequestDTO> reject(
            @AuthenticationPrincipal CustomUserDetails admin,
            @PathVariable Long id,
            @Valid @RequestBody RejectUpgradeRequestDTO body
    ) {
        Long adminId = requireAdminId(admin);
        return ResponseEntity.ok(tierService.rejectRequest(adminId, id, body.getReason()));
    }

    private Long requireAdminId(CustomUserDetails admin) {
        if (admin == null || admin.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập với tài khoản Quản trị viên");
        }
        return admin.getId();
    }
}

