package com.example.comicworm.repository;

import com.example.comicworm.model.SellerApplication;
import com.example.comicworm.model.enums.SellerApplicationStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SellerApplicationRepository extends JpaRepository<SellerApplication, Long> {

    Optional<SellerApplication> findFirstByUserIdOrderBySubmittedAtDescIdDesc(Long userId);

    boolean existsByUserIdAndStatus(Long userId, SellerApplicationStatus status);

    List<SellerApplication> findByStatusOrderBySubmittedAtDesc(SellerApplicationStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from SellerApplication a where a.id = :id")
    Optional<SellerApplication> lockById(@Param("id") Long id);
}
