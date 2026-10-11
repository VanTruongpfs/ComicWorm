package com.example.comicworm.repository;

import com.example.comicworm.model.OrderItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    /**
     * T09 - Sản phẩm bán chạy: SUM(quantity) của các đơn COMPLETED, không lưu counter riêng.
     * Chỉ lấy tin đang hiển thị. Truyền Pageable.ofSize(n) để giới hạn số dòng.
     */
    @Query("""
            SELECT p.id FROM OrderItem oi
            JOIN Order o ON o.id = oi.orderId
            JOIN Product p ON p.id = oi.productId
            WHERE o.status = com.example.comicworm.model.enums.OrderStatus.COMPLETED
              AND p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.APPROVED
              AND p.isActive = true
              AND p.deletedAt IS NULL
            GROUP BY p.id
            ORDER BY SUM(oi.quantity) DESC, p.id DESC
            """)
    List<Long> findBestSellerProductIds(Pageable pageable);

    /** Số lượng đã bán (đơn COMPLETED) của từng sản phẩm. Mỗi dòng: [productId, soldQuantity]. */
    @Query("""
            SELECT oi.productId, SUM(oi.quantity) FROM OrderItem oi
            JOIN Order o ON o.id = oi.orderId
            WHERE o.status = com.example.comicworm.model.enums.OrderStatus.COMPLETED
              AND oi.productId IN :productIds
            GROUP BY oi.productId
            """)
    List<Object[]> sumSoldByProductIds(@Param("productIds") Collection<Long> productIds);

    List<OrderItem> findByOrderId(Long orderId);
}
