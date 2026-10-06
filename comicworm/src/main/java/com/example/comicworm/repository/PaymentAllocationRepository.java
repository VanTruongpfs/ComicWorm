package com.example.comicworm.repository;

import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.id.PaymentAllocationId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentAllocationRepository extends JpaRepository<PaymentAllocation, PaymentAllocationId> {
}
