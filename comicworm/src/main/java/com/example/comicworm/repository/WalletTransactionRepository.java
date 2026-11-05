package com.example.comicworm.repository;

import com.example.comicworm.model.WalletTransaction;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    boolean existsByEscrowId(Long escrowId);

    List<WalletTransaction> findTop100ByUserIdOrderByIdDesc(Long userId);
}
