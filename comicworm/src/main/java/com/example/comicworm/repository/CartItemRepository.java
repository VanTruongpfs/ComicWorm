package com.example.comicworm.repository;

import com.example.comicworm.model.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCartId(Long cartId);
    List<CartItem> findByCartIdAndIsSelectedTrue(Long cartId);
    Optional<CartItem> findByCartIdAndProductId(Long cartId, Long productId);
    void deleteByCartId(Long cartId);
    void deleteAllByCartId(Long cartId);
}
