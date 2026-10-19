package com.example.comicworm.repository;

import com.example.comicworm.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

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

    boolean existsByOrderItemId(Long orderItemId);

    Optional<Review> findByOrderItemId(Long orderItemId);

    List<Review> findByOrderItemIdIn(Collection<Long> orderItemIds);
    @Query(value = """
            SELECT r.id AS reviewId,
                   r.rating AS rating,
                   r.content AS content,
                   r.createdAt AS createdAt,
                   buyer.fullName AS buyerName,
                   oi.productId AS productId,
                   oi.productTitle AS productTitle,
                   o.id AS orderId,
                   o.orderCode AS orderCode,
                   reply.id AS replyId,
                   reply.content AS replyContent,
                   reply.createdAt AS replyCreatedAt,
                   reply.updatedAt AS replyUpdatedAt
            FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            JOIN Order o ON o.id = oi.orderId
            JOIN Product p ON p.id = oi.productId
            JOIN User buyer ON buyer.id = r.buyerId
            LEFT JOIN ReviewReply reply ON reply.reviewId = r.id
            WHERE o.sellerId = :sellerId
              AND p.sellerId = :sellerId
              AND (:replied = 'all'
                   OR (:replied = 'true' AND reply.id IS NOT NULL)
                   OR (:replied = 'false' AND reply.id IS NULL))
            ORDER BY r.createdAt DESC, r.id DESC
            """,
            countQuery = """
            SELECT COUNT(r)
            FROM Review r
            JOIN OrderItem oi ON oi.id = r.orderItemId
            JOIN Order o ON o.id = oi.orderId
            JOIN Product p ON p.id = oi.productId
            LEFT JOIN ReviewReply reply ON reply.reviewId = r.id
            WHERE o.sellerId = :sellerId
              AND p.sellerId = :sellerId
              AND (:replied = 'all'
                   OR (:replied = 'true' AND reply.id IS NOT NULL)
                   OR (:replied = 'false' AND reply.id IS NULL))
            """)
    Page<SellerReviewRow> findSellerReviews(
            @Param("sellerId") Long sellerId,
            @Param("replied") String replied,
            Pageable pageable);

    interface SellerReviewRow {
        Long getReviewId();

        Integer getRating();

        String getContent();

        java.time.LocalDateTime getCreatedAt();

        String getBuyerName();

        Long getProductId();

        String getProductTitle();

        Long getOrderId();

        String getOrderCode();

        Long getReplyId();

        String getReplyContent();

        java.time.LocalDateTime getReplyCreatedAt();

        java.time.LocalDateTime getReplyUpdatedAt();
    }
}
