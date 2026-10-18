package com.example.comicworm.repository;

import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.id.PaymentAllocationId;
import org.springframework.data.repository.Repository;

import java.util.List;

public interface OrderCompletionPaymentAllocationRepository extends Repository<PaymentAllocation, PaymentAllocationId> {
    List<PaymentAllocation> findByOrderId(Long orderId);
    List<PaymentAllocation> findByPaymentId(Long paymentId);
}
