package com.example.comicworm.repository;

import com.example.comicworm.model.LoyaltyTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Long> {
    boolean existsByIdempotencyKey(String idempotencyKey);
    Page<LoyaltyTransaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    List<LoyaltyTransaction> findByOrderId(Long orderId);
}
