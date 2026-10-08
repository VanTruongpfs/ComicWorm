package com.example.comicworm.repository;

import com.example.comicworm.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

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
}
