package com.example.comicworm.repository;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.ModerationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    Optional<Product> findByIdAndSellerIdAndDeletedAtIsNull(Long id, Long sellerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id and p.sellerId = :sellerId and p.deletedAt is null")
    Optional<Product> lockOwnedProduct(@Param("id") Long id, @Param("sellerId") Long sellerId);

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

    /** Số tin đang hiển thị theo thể loại (dùng cho thanh lọc). */
    @Query("""
            SELECT p.categoryId, COUNT(p) FROM Product p
            WHERE p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.APPROVED
              AND p.isActive = true
              AND p.deletedAt IS NULL
            GROUP BY p.categoryId
            """)
    List<Object[]> countVisibleByCategory();

    /** Số tin đang hiển thị theo nhà xuất bản (bỏ qua tin không có NXB). */
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
}

