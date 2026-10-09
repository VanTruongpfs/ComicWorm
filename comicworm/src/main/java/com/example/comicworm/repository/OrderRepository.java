package com.example.comicworm.repository;

import com.example.comicworm.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCheckoutId(Long checkoutId);
    List<Order> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);
}
