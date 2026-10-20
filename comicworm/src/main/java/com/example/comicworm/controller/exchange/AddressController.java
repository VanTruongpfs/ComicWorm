package com.example.comicworm.controller.exchange;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.service.exchange.AddressService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/user/addresses") @Profile("!preview") @RequiredArgsConstructor
public class AddressController {
    private final AddressService service;
    private Long id(CustomUserDetails user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        return user.getId();
    }
    @GetMapping public List<AddressDTO> list(@AuthenticationPrincipal CustomUserDetails user) { return service.list(id(user)); }
    @PostMapping public AddressDTO create(@AuthenticationPrincipal CustomUserDetails user, @Valid @RequestBody AddressRequest req) {
        return service.save(id(user), null, req);
    }
    @PutMapping("/{addressId}") public AddressDTO update(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long addressId, @Valid @RequestBody AddressRequest req) {
        return service.save(id(user), addressId, req);
    }
    @DeleteMapping("/{addressId}") public void delete(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long addressId) { service.delete(id(user), addressId); }
}
