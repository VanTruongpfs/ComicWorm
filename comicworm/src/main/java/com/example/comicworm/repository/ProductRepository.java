package com.example.comicworm.repository;

import com.example.comicworm.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

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
}
