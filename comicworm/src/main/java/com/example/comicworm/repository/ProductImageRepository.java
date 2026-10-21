package com.example.comicworm.repository;

import com.example.comicworm.model.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    @Query("""
            select i from ProductImage i join i.product p
            where p.deletedAt is null and i.id > :afterId
              and not exists (select f.imageId from ProductImageFeature f
                              where f.imageId = i.id and f.modelName = :model)
            order by i.id
            """)
    List<ProductImage> findMissingFeatures(@Param("model") String model, @Param("afterId") long afterId, Pageable page);

    List<ProductImage> findByProductIdOrderByDisplayOrderAscIdAsc(Long productId);
    List<ProductImage> findByProductIdInOrderByDisplayOrderAscIdAsc(List<Long> productIds);
    Optional<ProductImage> findByIdAndProductId(Long id, Long productId);

    /** Ảnh của một sản phẩm theo thứ tự hiển thị (ảnh đầu tiên là ảnh bìa). */
    List<ProductImage> findByProductIdOrderByDisplayOrderAsc(Long productId);
    Optional<ProductImage> findFirstByProductIdOrderByDisplayOrderAsc(Long productId);

    /** Ảnh của nhiều sản phẩm trong một truy vấn (tránh N+1 khi dựng danh sách). */
    List<ProductImage> findByProductIdInOrderByProductIdAscDisplayOrderAsc(Collection<Long> productIds);
}
