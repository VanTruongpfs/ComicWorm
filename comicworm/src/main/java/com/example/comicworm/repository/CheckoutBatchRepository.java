package com.example.comicworm.repository;

import com.example.comicworm.model.CheckoutBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CheckoutBatchRepository extends JpaRepository<CheckoutBatch, Long> {
    Optional<CheckoutBatch> findByCheckoutCode(String checkoutCode);
}
