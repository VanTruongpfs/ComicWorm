package com.example.comicworm.dto.general.auth;

import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class CustomUserDetails implements UserDetails {
    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public Long getId() {
        return user.getId();
    }

    public String getFullName() {
        return user.getFullName();
    }

    public boolean isSeller() {
        return Boolean.TRUE.equals(user.getIsSeller());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        List<GrantedAuthority> authorities = new ArrayList<>();
        // Gán Role chính (Ví dụ: ROLE_USER, ROLE_ADMIN)
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        // Gán thêm quyền Seller nếu tài khoản có cờ isSeller
        if (Boolean.TRUE.equals(user.getIsSeller())) {
            authorities.add(new SimpleGrantedAuthority("ROLE_SELLER"));
        }
        return authorities;
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        // Tài khoản không bị khóa nếu trạng thái không phải là BANNED
        return user.getAccountStatus() != AccountStatus.LOCKED;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        // Tài khoản khả dụng khi đang ACTIVE và chưa bị xóa mềm (deletedAt == null)
        return user.getAccountStatus() == AccountStatus.ACTIVE && user.getDeletedAt() == null;
    }
}
