package com.example.comicworm.service.admin.impl;

import com.example.comicworm.dto.request.AdminCreateUserRequest;
import com.example.comicworm.dto.response.AdminUserRecord;
import com.example.comicworm.dto.response.AdminUserStatsRecord;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.admin.IAdminUserService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Profile("!preview")
@Transactional(readOnly = true)
public class AdminUserServiceImpl implements IAdminUserService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminUserServiceImpl(UserRepository userRepository,
                                OrderRepository orderRepository,
                                ProductRepository productRepository,
                                PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public Map<String, Object> listUsers(String role, String status, String keyword, int page, int size) {
        if (size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kích thước trang từ 1 đến 100.");
        }
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số trang không được âm.");
        }

        String cleanKeyword = (keyword == null) ? "" : keyword.trim().toLowerCase(Locale.ROOT);

        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isNull(root.get("deletedAt")));

            // Filter Role
            if (role != null && !role.isBlank() && !"ALL".equalsIgnoreCase(role.trim())) {
                String roleUpper = role.trim().toUpperCase(Locale.ROOT);
                if ("SELLER".equals(roleUpper)) {
                    predicates.add(cb.isTrue(root.get("isSeller")));
                } else if ("BUYER".equals(roleUpper) || "USER".equals(roleUpper)) {
                    predicates.add(cb.and(
                            cb.equal(root.get("role"), UserRole.USER),
                            cb.isFalse(root.get("isSeller"))
                    ));
                } else if ("ADMIN".equals(roleUpper)) {
                    predicates.add(cb.equal(root.get("role"), UserRole.ADMIN));
                }
            }

            // Filter Status
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
                String statusUpper = status.trim().toUpperCase(Locale.ROOT);
                if ("BANNED".equals(statusUpper) || "LOCKED".equals(statusUpper)) {
                    predicates.add(cb.equal(root.get("accountStatus"), AccountStatus.LOCKED));
                } else if ("ACTIVE".equals(statusUpper)) {
                    predicates.add(cb.equal(root.get("accountStatus"), AccountStatus.ACTIVE));
                } else if ("PENDING_VERIFY".equals(statusUpper) || "PENDING".equals(statusUpper)) {
                    predicates.add(cb.equal(root.get("accountStatus"), AccountStatus.PENDING_VERIFY));
                }
            }

            // Search Keyword
            if (!cleanKeyword.isBlank()) {
                String term = "%" + cleanKeyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                Predicate nameLike = cb.like(cb.lower(root.get("fullName")), term, '\\');
                Predicate emailLike = cb.like(cb.lower(root.get("email")), term, '\\');
                Predicate phoneLike = cb.like(cb.lower(root.get("phone")), term, '\\');

                try {
                    Long idVal = Long.parseLong(cleanKeyword);
                    predicates.add(cb.or(nameLike, emailLike, phoneLike, cb.equal(root.get("id"), idVal)));
                } catch (NumberFormatException ignored) {
                    predicates.add(cb.or(nameLike, emailLike, phoneLike));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<User> pageResult = userRepository.findAll(
                spec,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"))
        );

        List<AdminUserRecord> records = pageResult.getContent().stream()
                .map(u -> {
                    long orders = orderRepository.countByBuyerId(u.getId());
                    long products = Boolean.TRUE.equals(u.getIsSeller())
                            ? productRepository.countBySellerIdAndDeletedAtIsNull(u.getId())
                            : 0L;
                    return AdminUserRecord.from(u, orders, products);
                })
                .toList();

        return Map.of(
                "Result", "OK",
                "Records", records,
                "TotalRecordCount", pageResult.getTotalElements(),
                "TotalPages", pageResult.getTotalPages(),
                "CurrentPage", page,
                "Stats", getStats()
        );
    }

    @Override
    public AdminUserStatsRecord getStats() {
        long totalUsers = userRepository.countByDeletedAtIsNull();
        long activeSellers = userRepository.countByDeletedAtIsNullAndIsSellerTrue();
        long lockedUsers = userRepository.countByDeletedAtIsNullAndAccountStatus(AccountStatus.LOCKED);
        long newUsersToday = userRepository.countByDeletedAtIsNullAndCreatedAtAfter(LocalDate.now().atStartOfDay());

        return new AdminUserStatsRecord(totalUsers, activeSellers, lockedUsers, newUsersToday);
    }

    @Override
    public AdminUserRecord getUserDetail(Long userId) {
        User user = findActiveUser(userId);
        long orders = orderRepository.countByBuyerId(user.getId());
        long products = Boolean.TRUE.equals(user.getIsSeller())
                ? productRepository.countBySellerIdAndDeletedAtIsNull(user.getId())
                : 0L;
        return AdminUserRecord.from(user, orders, products);
    }

    @Override
    @Transactional
    public AdminUserRecord updateUserStatus(Long userId, String statusStr, String reason, Long currentAdminId) {
        User user = findActiveUser(userId);

        if (currentAdminId != null && user.getId().equals(currentAdminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể tự khóa tài khoản của chính mình.");
        }

        AccountStatus targetStatus;
        try {
            String norm = statusStr.trim().toUpperCase(Locale.ROOT);
            if ("BANNED".equals(norm)) {
                targetStatus = AccountStatus.LOCKED;
            } else {
                targetStatus = AccountStatus.valueOf(norm);
            }
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái tài khoản không hợp lệ (ACTIVE, LOCKED, PENDING_VERIFY).");
        }

        user.setAccountStatus(targetStatus);
        userRepository.save(user);

        long orders = orderRepository.countByBuyerId(user.getId());
        long products = Boolean.TRUE.equals(user.getIsSeller())
                ? productRepository.countBySellerIdAndDeletedAtIsNull(user.getId())
                : 0L;

        return AdminUserRecord.from(user, orders, products);
    }

    @Override
    @Transactional
    public AdminUserRecord toggleSellerRole(Long userId, Boolean isSeller) {
        User user = findActiveUser(userId);
        user.setIsSeller(Boolean.TRUE.equals(isSeller));
        userRepository.save(user);

        long orders = orderRepository.countByBuyerId(user.getId());
        long products = productRepository.countBySellerIdAndDeletedAtIsNull(user.getId());

        return AdminUserRecord.from(user, orders, products);
    }

    @Override
    @Transactional
    public AdminUserRecord createUser(AdminCreateUserRequest request) {
        String cleanEmail = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã tồn tại trên hệ thống: " + cleanEmail);
        }

        UserRole role = UserRole.USER;
        boolean isSeller = false;

        if (request.role() != null) {
            String roleUpper = request.role().trim().toUpperCase(Locale.ROOT);
            if ("ADMIN".equals(roleUpper)) {
                role = UserRole.ADMIN;
            } else if ("SELLER".equals(roleUpper)) {
                isSeller = true;
            }
        }

        String rawPassword = (request.password() != null && !request.password().isBlank())
                ? request.password().trim()
                : "ComicWorm@2026";

        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(cleanEmail);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setIsSeller(isSeller);
        user.setAccountStatus(AccountStatus.ACTIVE);

        userRepository.save(user);

        return AdminUserRecord.from(user, 0L, 0L);
    }

    @Override
    @Transactional
    public void softDeleteUser(Long userId, Long currentAdminId) {
        User user = findActiveUser(userId);

        if (currentAdminId != null && user.getId().equals(currentAdminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể tự xóa tài khoản của chính mình.");
        }

        user.setDeletedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    private User findActiveUser(Long userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng với mã ID: " + userId));
    }
}

