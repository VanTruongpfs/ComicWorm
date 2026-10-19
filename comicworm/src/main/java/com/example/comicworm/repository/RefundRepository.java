package com.example.comicworm.repository;

import com.example.comicworm.model.Refund;
import com.example.comicworm.model.enums.RefundStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface RefundRepository extends JpaRepository<Refund, Long> {
    Optional<Refund> findByIdempotencyKey(String idempotencyKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Refund r where r.status = :status order by r.id asc")
    List<Refund> findByStatusForUpdate(@Param("status") RefundStatus status, Pageable pageable);

    List<Refund> findByStatusOrderByIdAsc(RefundStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Refund r where r.id = :id")
    Optional<Refund> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select coalesce(sum(r.amount), 0) from Refund r
            where r.orderId = :orderId and r.paymentId = :paymentId
              and r.status in :statuses
            """)
    BigDecimal sumReservedAmount(
            @Param("orderId") Long orderId,
            @Param("paymentId") Long paymentId,
            @Param("statuses") List<RefundStatus> statuses);

    @Query("""
            select coalesce(sum(r.amount), 0) from Refund r
            where r.orderId = :orderId and r.status = :status
            """)
    BigDecimal sumAmountByOrderAndStatus(
            @Param("orderId") Long orderId,
            @Param("status") RefundStatus status);

    List<Refund> findByOrderId(Long orderId);
}
