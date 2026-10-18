package com.example.comicworm.repository;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.OrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface AutoCompleteOrderRepository extends Repository<Order, Long> {

    @Query("""
            select o.id from Order o
            where o.status in :statuses
              and coalesce(
                  (select max(h.createdAt) from OrderStatusHistory h
                   where h.orderId = o.id and h.newStatus = o.status),
                  o.updatedAt
              ) <= :cutoff
              and not exists (
                  select e.id from ExchangeOrderLink e where e.orderId = o.id
              )
            order by o.id asc
            """)
    List<Long> findAutoCompletableOrderIds(
            @Param("statuses") Collection<OrderStatus> statuses,
            @Param("cutoff") LocalDateTime cutoff,
            Pageable pageable);
}
