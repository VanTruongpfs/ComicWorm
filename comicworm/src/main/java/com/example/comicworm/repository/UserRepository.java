package com.example.comicworm.repository;

import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.id = :id and u.deletedAt is null")
    Optional<User> lockById(@org.springframework.data.repository.query.Param("id") Long id);
    // Tìm user theo email và đảm bảo chưa bị xóa mềm (deletedAt IS NULL)
    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    // Tìm theo email thông thường (nếu cần kiểm tra cả tài khoản đã xóa)
    Optional<User> findByEmail(String email);

    // Kiểm tra email đã tồn tại hay chưa (phục vụ logic đăng ký)
    boolean existsByEmail(String email);

    // Tìm user theo Google Sub (phục vụ đăng nhập Google ID Token)
    Optional<User> findByGoogleSub(String googleSub);

    Optional<User> findByVerificationToken(String verificationToken);

    Optional<User> findByPhoneAndDeletedAtIsNull(String phone);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE u.deletedAt IS NULL AND (" +
            "LOWER(u.email) = LOWER(:identifier) OR " +
            "(u.phone IS NOT NULL AND u.phone = :identifier) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT(:identifier, '@%')))")
    java.util.List<User> findByIdentifierCandidates(@org.springframework.data.repository.query.Param("identifier") String identifier);

    long countByDeletedAtIsNull();

    long countByDeletedAtIsNullAndIsSellerTrue();

    long countByDeletedAtIsNullAndAccountStatus(AccountStatus accountStatus);

    long countByDeletedAtIsNullAndCreatedAtAfter(LocalDateTime createdAt);
}
