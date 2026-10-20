package com.example.comicworm.config;

import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates (or promotes) the first ADMIN account on startup. Does nothing unless BOTH
 * app.admin.email and app.admin.password are set (use env vars ADMIN_EMAIL / ADMIN_PASSWORD or
 * application-local.properties) so no default credentials ever ship with the project.
 */
@Component
public class AdminAccountInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminAccountInitializer.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;
    private final String fullName;

    public AdminAccountInitializer(UserRepository users, PasswordEncoder passwordEncoder,
                                   @Value("${app.admin.email:}") String email,
                                   @Value("${app.admin.password:}") String password,
                                   @Value("${app.admin.full-name:Quản trị viên}") String fullName) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email == null ? "" : email.trim().toLowerCase();
        this.password = password == null ? "" : password;
        this.fullName = fullName;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isEmpty() || password.isEmpty()) return;
        if (password.length() < 8) {
            log.warn("app.admin.password must have at least 8 characters - admin account was not created.");
            return;
        }
        User user = users.findByEmail(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setFullName(fullName);
            user.setPasswordHash(passwordEncoder.encode(password));
            log.info("Created ADMIN account {}", email);
        } else if (user.getRole() == UserRole.ADMIN && user.getAccountStatus() == AccountStatus.ACTIVE
                && user.getDeletedAt() == null && user.getPasswordHash() != null) {
            return; // already a working admin: never overwrite its password
        } else {
            if (user.getPasswordHash() == null) user.setPasswordHash(passwordEncoder.encode(password));
            log.info("Promoted {} to ADMIN", email);
        }
        user.setRole(UserRole.ADMIN);
        user.setAccountStatus(AccountStatus.ACTIVE);
        user.setDeletedAt(null);
        users.save(user);
    }
}
