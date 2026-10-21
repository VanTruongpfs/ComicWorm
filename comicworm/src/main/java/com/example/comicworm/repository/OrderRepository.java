package com.example.comicworm.repository;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
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
    java.util.Optional<Order> findByOrderCode(String orderCode);
    long countByBuyerId(Long buyerId);
    long countBySellerId(Long sellerId);

    // ===== Xem lịch sử mua / quản lý trạng thái đơn (OrderTrackingService) =====

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.orderCode = :code")
    Optional<Order> findByOrderCodeForUpdate(@Param("code") String code);

    @Query("""
            SELECT o FROM Order o
            WHERE o.buyerId = :buyerId
              AND o.status IN :statuses
              AND (LOWER(o.orderCode) LIKE :pattern ESCAPE '!'
                   OR EXISTS (SELECT 1 FROM OrderItem oi
                              WHERE oi.orderId = o.id AND LOWER(oi.productTitle) LIKE :pattern ESCAPE '!'))
            """)
    Page<Order> searchForBuyer(@Param("buyerId") Long buyerId, @Param("statuses") Collection<OrderStatus> statuses,
                               @Param("pattern") String pattern, Pageable pageable);

    @Query("""
            SELECT o FROM Order o
            WHERE o.sellerId = :sellerId
              AND o.status IN :statuses
              AND (LOWER(o.orderCode) LIKE :pattern ESCAPE '!'
                   OR LOWER(o.recipientName) LIKE :pattern ESCAPE '!'
                   OR EXISTS (SELECT 1 FROM OrderItem oi
                              WHERE oi.orderId = o.id AND LOWER(oi.productTitle) LIKE :pattern ESCAPE '!'))
            """)
    Page<Order> searchForSeller(@Param("sellerId") Long sellerId, @Param("statuses") Collection<OrderStatus> statuses,
                                @Param("pattern") String pattern, Pageable pageable);

    @Query("""
            SELECT o FROM Order o
            WHERE o.status IN :statuses
              AND (LOWER(o.orderCode) LIKE :pattern ESCAPE '!'
                   OR LOWER(o.recipientName) LIKE :pattern ESCAPE '!'
                   OR EXISTS (SELECT 1 FROM OrderItem oi
                              WHERE oi.orderId = o.id AND LOWER(oi.productTitle) LIKE :pattern ESCAPE '!')
                   OR EXISTS (SELECT 1 FROM User u
                              WHERE (u.id = o.buyerId OR u.id = o.sellerId)
                                AND LOWER(u.fullName) LIKE :pattern ESCAPE '!'))
            """)
    Page<Order> searchForAdmin(@Param("statuses") Collection<OrderStatus> statuses,
                               @Param("pattern") String pattern, Pageable pageable);

    /** Mỗi dòng: [OrderStatus, count] - số đếm trên các tab. */
    @Query("SELECT o.status, COUNT(o) FROM Order o WHERE o.buyerId = :buyerId GROUP BY o.status")
    List<Object[]> countByStatusForBuyer(@Param("buyerId") Long buyerId);

    @Query("SELECT o.status, COUNT(o) FROM Order o WHERE o.sellerId = :sellerId GROUP BY o.status")
    List<Object[]> countByStatusForSeller(@Param("sellerId") Long sellerId);

    @Query("SELECT o.status, COUNT(o) FROM Order o GROUP BY o.status")
    List<Object[]> countByStatusAll();
}
