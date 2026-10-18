package com.example.comicworm.repository;

import com.example.comicworm.model.Order;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    List<Order> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);
    long countByBuyerId(Long buyerId);
    long countBySellerId(Long sellerId);
}
