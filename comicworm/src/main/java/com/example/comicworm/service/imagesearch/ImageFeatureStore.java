package com.example.comicworm.service.imagesearch;

import java.util.List;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.ProductImageFeature;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ImageFeatureStore {
    private final ProductRepository products;
    private final ProductImageRepository images;
    private final ProductImageFeatureRepository features;

    @Transactional
    public boolean save(ProductImage source, String modelName, List<Double> embedding) {
        // Same product lock as seller edits: never recreate features after an image has been removed.
        var product = products.lockForExchange(source.getProductId());
        if (product.isEmpty() || product.get().getDeletedAt() != null) return false;
        var current = images.findById(source.getId());
        if (current.isEmpty() || !source.getImageUrl().equals(current.get().getImageUrl())) return false;
        var feature = new ProductImageFeature();
        feature.setImageId(source.getId());
        feature.setModelName(modelName);
        feature.setEmbedding(embedding);
        features.save(feature);
        return true;
    }
}
