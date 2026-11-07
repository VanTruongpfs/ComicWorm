package com.example.comicworm.repository;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.AiVerdict;
import com.example.comicworm.model.enums.ModerationStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import java.util.List;
public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id in :ids order by p.id asc")
    List<Product> findAllByIdInForUpdate(@Param("ids") Collection<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> lockForExchange(@Param("id") Long id);
    Optional<Product> findByIdAndSellerIdAndDeletedAtIsNull(Long id, Long sellerId);


    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id and p.sellerId = :sellerId and p.deletedAt is null")
    Optional<Product> lockOwnedProduct(@Param("id") Long id, @Param("sellerId") Long sellerId);

    // ---- Admin moderation ----
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id and p.deletedAt is null")
    Optional<Product> lockForModeration(@Param("id") Long id);

    long countByModerationStatusAndDeletedAtIsNull(ModerationStatus moderationStatus);

    // ---- Phân loại tự động (ProductClassificationJob) ----
    long countByModerationStatusAndAiVerdictAndDeletedAtIsNull(ModerationStatus moderationStatus, AiVerdict aiVerdict);

    long countByModerationStatusAndAiVerdictIsNullAndDeletedAtIsNull(ModerationStatus moderationStatus);

    @Query("""
            select p.id from Product p
            where p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.PENDING
              and p.aiVerdict is null and p.deletedAt is null
            order by p.id asc
            """)
    List<Long> findIdsAwaitingClassification(Pageable page);

    /**
     * Ghi kết quả phân loại nếu sản phẩm vẫn chờ duyệt, chưa có kết quả và chưa bị người bán sửa
     * kể từ lúc đọc ({@code seenUpdatedAt}). Trả về 0 nếu sản phẩm đã thay đổi, khi đó bỏ qua kết quả cũ.
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("""
            update Product p
               set p.aiVerdict = :verdict, p.aiReasons = :reasons, p.aiScore = :score, p.aiClassifiedAt = :classifiedAt
             where p.id = :id
               and p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.PENDING
               and p.aiVerdict is null and p.deletedAt is null
               and p.updatedAt = :seenUpdatedAt
            """)
    int saveClassification(@Param("id") Long id,
                           @Param("verdict") AiVerdict verdict,
                           @Param("reasons") String reasons,
                           @Param("score") BigDecimal score,
                           @Param("classifiedAt") LocalDateTime classifiedAt,
                           @Param("seenUpdatedAt") LocalDateTime seenUpdatedAt);

    interface InventorySummary {
        Long getProductCount();

        Long getStockQuantity();

        Long getLowStockCount();

        Long getOutOfStockCount();

        BigDecimal getInventoryValue();
    }

    @Query("""

            select count(p) as productCount,
               coalesce(sum(p.stockQuantity), 0) as stockQuantity,
               coalesce(sum(case when p.stockQuantity > 0 and p.stockQuantity < 3 then 1 else 0 end), 0) as lowStockCount,
               coalesce(sum(case when p.stockQuantity = 0 then 1 else 0 end), 0) as outOfStockCount,
               coalesce(sum(p.price * p.stockQuantity), 0) as inventoryValue
        from Product p where p.sellerId = :sellerId and p.deletedAt is null
        """)
    InventorySummary summarizeInventory(@Param("sellerId") Long sellerId);

    /**
         * Số tin đang hiển thị theo thể loại (dùng cho thanh lọc).
         */
    @Query("""
            SELECT p.categoryId, COUNT(p) FROM Product p
            WHERE p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.APPROVED
              AND p.isActive = true
              AND p.deletedAt IS NULL
            GROUP BY p.categoryId
            """)
    List<Object[]> countVisibleByCategory();

    /**
         * Số tin đang hiển thị theo nhà xuất bản (bỏ qua tin không có NXB).
         */
    @Query("""
            SELECT p.publisherId, COUNT(p) FROM Product p
            WHERE p.publisherId IS NOT NULL
              AND p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.APPROVED
              AND p.isActive = true
              AND p.deletedAt IS NULL
            GROUP BY p.publisherId
            """)
    List<Object[]> countVisibleByPublisher();

    List<Product> findByModerationStatusAndIsActiveTrue(ModerationStatus moderationStatus);
    Optional<Product> findFirstByModerationStatusAndIsActiveTrueOrderByIdDesc(ModerationStatus moderationStatus);
    Optional<Product> findBySlug(String slug);
    List<Product> findByCategoryIdAndModerationStatusAndIsActiveTrue(Long categoryId, ModerationStatus moderationStatus);

    List<Product> findBySellerIdAndIsActiveTrueAndDeletedAtIsNullOrderByCreatedAtDesc(Long sellerId);
    long countBySellerIdAndDeletedAtIsNull(Long sellerId);
}

