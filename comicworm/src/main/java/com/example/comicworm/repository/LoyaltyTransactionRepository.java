package com.example.comicworm.repository;

import com.example.comicworm.model.LoyaltyTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Long> {
}
