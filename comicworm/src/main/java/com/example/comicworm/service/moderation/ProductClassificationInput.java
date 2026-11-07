package com.example.comicworm.service.moderation;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ListingType;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Dữ liệu một sản phẩm gửi cho {@link ProductClassifier}. Là bản sao thuần (không phải entity JPA)
 * nên bộ phân loại có thể chạy chậm, ngoài transaction, mà không gặp LazyInitializationException.
 *
 * @param imageUrls ảnh bìa trước, sau đó là ảnh chi tiết theo thứ tự hiển thị; không trùng lặp
 */
public record ProductClassificationInput(
        Long productId,
        String title,
        String description,
        ListingType listingType,
        BigDecimal price,
        Integer conditionPercent,
        List<String> imageUrls
) {
    public ProductClassificationInput {
        imageUrls = imageUrls == null ? List.of() : List.copyOf(imageUrls);
    }

    public static ProductClassificationInput from(Product product, List<ProductImage> images) {
        List<String> urls = new ArrayList<>();
        addIfPresent(urls, product.getCoverImageUrl());
        images.forEach(image -> addIfPresent(urls, image.getImageUrl()));
        return new ProductClassificationInput(
                product.getId(),
                product.getTitle(),
                product.getDescription(),
                product.getListingType(),
                product.getPrice(),
                product.getConditionPercent(),
                urls);
    }

    private static void addIfPresent(List<String> urls, String url) {
        if (url != null && !url.isBlank() && !urls.contains(url.trim())) urls.add(url.trim());
    }
}
