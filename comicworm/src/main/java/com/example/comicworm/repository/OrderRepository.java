package com.example.comicworm.repository;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {
    List<Order> findByCheckoutId(Long checkoutId);
    List<Order> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);
    long countByBuyerId(Long buyerId);
    long countBySellerId(Long sellerId);

    Optional<Order> findByIdAndSellerId(Long id, Long sellerId);
    Optional<Order> findByOrderCodeAndSellerId(String orderCode, Long sellerId);

    long countBySellerIdAndStatus(Long sellerId, OrderStatus status);
    long countBySellerIdAndStatusIn(Long sellerId, Collection<OrderStatus> statuses);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o WHERE o.sellerId = :sellerId AND o.status IN :statuses")
    BigDecimal sumTotalAmountBySellerIdAndStatusIn(@Param("sellerId") Long sellerId, @Param("statuses") Collection<OrderStatus> statuses);

    @Query("SELECT o.status, COUNT(o) FROM Order o WHERE o.sellerId = :sellerId GROUP BY o.status")
    List<Object[]> countOrdersByStatusForSeller(@Param("sellerId") Long sellerId);
}
