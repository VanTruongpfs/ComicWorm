package com.example.comicworm.repository;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCheckoutId(Long checkoutId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.checkoutId = :checkoutId order by o.id asc")
    List<Order> findByCheckoutIdForUpdate(@Param("checkoutId") Long checkoutId);

    boolean existsByIdAndCheckout_ExpiresAtBefore(Long id, LocalDateTime time);

    @Query("""
            select o.id from Order o
            where o.status = :status
              and o.checkout.expiresAt < :now
              and not exists (select e.id from ExchangeOrderLink e where e.orderId = o.id)
            order by o.id asc
            """)
    List<Long> findExpiredOrderIds(
            @Param("status") OrderStatus status,
            @Param("now") LocalDateTime now,
            Pageable pageable);

    List<Order> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);
    long countByBuyerId(Long buyerId);
    long countBySellerId(Long sellerId);
}
