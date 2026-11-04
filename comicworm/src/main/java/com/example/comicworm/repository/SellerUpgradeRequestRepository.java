package com.example.comicworm.repository;

import com.example.comicworm.model.SellerUpgradeRequest;
import com.example.comicworm.model.enums.UpgradeRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SellerUpgradeRequestRepository extends JpaRepository<SellerUpgradeRequest, Long> {
    List<SellerUpgradeRequest> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<SellerUpgradeRequest> findFirstByUserIdAndStatus(Long userId, UpgradeRequestStatus status);
    boolean existsByUserIdAndStatus(Long userId, UpgradeRequestStatus status);

    Page<SellerUpgradeRequest> findByStatusOrderByCreatedAtDesc(UpgradeRequestStatus status, Pageable pageable);
    Page<SellerUpgradeRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

