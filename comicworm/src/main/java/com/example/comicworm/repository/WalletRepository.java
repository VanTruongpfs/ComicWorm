package com.example.comicworm.repository;

import com.example.comicworm.model.Wallet;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WalletRepository extends JpaRepository<Wallet, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.userId = :userId")
    Optional<Wallet> findByIdForUpdate(@Param("userId") Long userId);

    @Modifying
    @Query(value = "INSERT INTO wallets (user_id, balance, updated_at) VALUES (:userId, 0, NOW()) "
            + "ON DUPLICATE KEY UPDATE user_id = user_id", nativeQuery = true)
    int insertIgnore(@Param("userId") Long userId);
}
