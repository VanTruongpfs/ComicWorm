package com.example.comicworm.repository;

import com.example.comicworm.model.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    List<ProductImage> findByProductIdOrderByDisplayOrderAscIdAsc(Long productId);
    List<ProductImage> findByProductIdInOrderByDisplayOrderAscIdAsc(List<Long> productIds);
    Optional<ProductImage> findByIdAndProductId(Long id, Long productId);
}
