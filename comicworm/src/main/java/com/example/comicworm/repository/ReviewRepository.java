package com.example.comicworm.repository;

import com.example.comicworm.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    /** Đánh giá của một sản phẩm (review gắn với order_item, order_item gắn với product), mới nhất trước. */
    @Query(value = """
            SELECT r FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            WHERE oi.productId = :productId
            ORDER BY r.createdAt DESC, r.id DESC
            """,
            countQuery = """
            SELECT COUNT(r) FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            WHERE oi.productId = :productId
            """)
    Page<Review> findPageByProductId(@Param("productId") Long productId, Pageable pageable);

    /** Điểm trung bình của sản phẩm; null nếu chưa có đánh giá. */
    @Query("""
            SELECT AVG(r.rating) FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            WHERE oi.productId = :productId
            """)
    Double averageRatingByProductId(@Param("productId") Long productId);

    @Query("""
            SELECT COUNT(r) FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            WHERE oi.productId = :productId
            """)
    long countByProductId(@Param("productId") Long productId);

    /** Điểm trung bình trên mọi sản phẩm của một người bán; null nếu chưa có. */
    @Query("""
            SELECT AVG(r.rating) FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            JOIN Product p ON p.id = oi.productId
            WHERE p.sellerId = :sellerId
            """)
    Double averageRatingBySellerId(@Param("sellerId") Long sellerId);

    @Query("""
            SELECT COUNT(r) FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            JOIN Product p ON p.id = oi.productId
            WHERE p.sellerId = :sellerId
            """)
    long countBySellerId(@Param("sellerId") Long sellerId);
}
