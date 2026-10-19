package com.example.comicworm.repository;

import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.id.PaymentAllocationId;
import com.example.comicworm.model.enums.OrderStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PaymentAllocationRepository extends JpaRepository<PaymentAllocation, PaymentAllocationId> {
    List<PaymentAllocation> findByOrderId(Long orderId);
    List<PaymentAllocation> findByPaymentId(Long paymentId);

    @Query("""
            select case when count(a) > 0 then true else false end
            from PaymentAllocation a
            where a.paymentId = :paymentId and a.order.status <> :cancelled
            """)
    boolean existsNonCancelledOrderByPaymentId(
            @Param("paymentId") Long paymentId,
            @Param("cancelled") OrderStatus cancelled);
}
