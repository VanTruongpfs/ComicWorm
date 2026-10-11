package com.example.comicworm.service.account;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SellerUpgradeService {
    private final UserRepository users;

    public SellerUpgradeService(UserRepository users) {
        this.users = users;
    }

    @Transactional
    public void upgrade(CustomUserDetails principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        var user = users.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (user.getDeletedAt() != null || user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (!Boolean.TRUE.equals(user.getIsSeller())) {
            user.setIsSeller(true);
            users.save(user);
        }
    }
}
