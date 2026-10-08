package com.example.comicworm.repository;

import com.example.comicworm.model.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    /** Ảnh của một sản phẩm theo thứ tự hiển thị (ảnh đầu tiên là ảnh bìa). */
    List<ProductImage> findByProductIdOrderByDisplayOrderAsc(Long productId);

    /** Ảnh của nhiều sản phẩm trong một truy vấn (tránh N+1 khi dựng danh sách). */
    List<ProductImage> findByProductIdInOrderByProductIdAscDisplayOrderAsc(Collection<Long> productIds);
}
