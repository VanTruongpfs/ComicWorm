package com.example.comicworm.dto.response;

import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ProductImageType;

public record SellerProductImageRecord(Long id, String imageUrl, Integer displayOrder, ProductImageType imageType) {
    public static SellerProductImageRecord from(ProductImage image) {
        return new SellerProductImageRecord(image.getId(), image.getImageUrl(), image.getDisplayOrder(), image.getImageType());
    }
}
