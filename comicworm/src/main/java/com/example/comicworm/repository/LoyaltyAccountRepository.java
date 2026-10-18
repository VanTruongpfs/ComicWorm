package com.example.comicworm.repository;

import com.example.comicworm.model.LoyaltyAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface LoyaltyAccountRepository extends JpaRepository<LoyaltyAccount, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LoyaltyAccount a where a.userId = :userId")
    Optional<LoyaltyAccount> findByIdForUpdate(@Param("userId") Long userId);

    @Modifying
    @Query(value = "INSERT INTO loyalty_accounts (user_id, points_balance, updated_at) " +
            "VALUES (:userId, 0, NOW()) ON DUPLICATE KEY UPDATE user_id = user_id", nativeQuery = true)
    int insertIgnore(@Param("userId") Long userId);
}
