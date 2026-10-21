package com.example.comicworm.repository;

import com.example.comicworm.model.ProductImageFeature;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductImageFeatureRepository extends JpaRepository<ProductImageFeature, Long> {
    long countByModelName(String modelName);

    @Query("""
            select f.imageId as imageId, i.productId as productId,
                   i.imageUrl as imageUrl, f.embedding as embedding
            from ProductImageFeature f join f.image i join i.product p
            where f.modelName = :model and f.imageId > :afterId
              and p.moderationStatus = com.example.comicworm.model.enums.ModerationStatus.APPROVED
              and p.isActive = true and p.deletedAt is null
            order by f.imageId
            """)
    List<SearchFeature> findSearchBatch(@Param("model") String model, @Param("afterId") long afterId, Pageable page);

    interface SearchFeature {
        Long getImageId();
        Long getProductId();
        String getImageUrl();
        List<Double> getEmbedding();
    }
}
