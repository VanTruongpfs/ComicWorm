package com.example.comicworm.repository;

import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, Long> {
    List<OrderStatusHistory> findByOrderIdOrderByCreatedAtAscIdAsc(Long orderId);

    /** Thời điểm đầu tiên đơn đạt một trong các trạng thái (vd. mốc giao hàng); null nếu chưa từng đạt. */
    @Query("""
            select min(h.createdAt) from OrderStatusHistory h
            where h.orderId = :orderId and h.newStatus in :statuses
            """)
    LocalDateTime findFirstReachedAt(
            @Param("orderId") Long orderId,
            @Param("statuses") Collection<OrderStatus> statuses);

    /** Như {@link #findFirstReachedAt} cho nhiều đơn: mỗi dòng là [orderId, min(createdAt)]. */
    @Query("""
            select h.orderId, min(h.createdAt) from OrderStatusHistory h
            where h.orderId in :orderIds and h.newStatus in :statuses
            group by h.orderId
            """)
    List<Object[]> findFirstReachedAtByOrderIds(
            @Param("orderIds") Collection<Long> orderIds,
            @Param("statuses") Collection<OrderStatus> statuses);
}
