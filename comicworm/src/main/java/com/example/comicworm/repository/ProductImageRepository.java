package com.example.comicworm.repository;

import com.example.comicworm.model.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    List<ProductImage> findByProductIdOrderByDisplayOrderAscIdAsc(Long productId);
    List<ProductImage> findByProductIdInOrderByDisplayOrderAscIdAsc(List<Long> productIds);
    Optional<ProductImage> findByIdAndProductId(Long id, Long productId);

    /** Ảnh của một sản phẩm theo thứ tự hiển thị (ảnh đầu tiên là ảnh bìa). */
    List<ProductImage> findByProductIdOrderByDisplayOrderAsc(Long productId);

    /** Ảnh của nhiều sản phẩm trong một truy vấn (tránh N+1 khi dựng danh sách). */
    List<ProductImage> findByProductIdInOrderByProductIdAscDisplayOrderAsc(Collection<Long> productIds);
}
