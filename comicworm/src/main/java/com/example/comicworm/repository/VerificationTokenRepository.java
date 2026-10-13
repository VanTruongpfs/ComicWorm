package com.example.comicworm.repository;

import com.example.comicworm.model.User;
import com.example.comicworm.model.VerificationToken;
import com.example.comicworm.model.enums.TokenType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {

    // Tìm token theo chuỗi token gửi lên từ link
    Optional<VerificationToken> findByToken(String token);

    // Tìm token gần nhất của User theo thể loại
    Optional<VerificationToken> findTopByUserAndTokenTypeOrderByCreatedAtDesc(User user, TokenType tokenType);

    // Query phục vụ Cron Job: Xóa các token đã hết hạn hoặc đã sử dụng
    @Modifying
    @Query("DELETE FROM VerificationToken vt WHERE vt.expiryDate <= :now OR vt.isUsed = true")
    int deleteAllExpiredOrUsedTokens(@Param("now") LocalDateTime now);
}