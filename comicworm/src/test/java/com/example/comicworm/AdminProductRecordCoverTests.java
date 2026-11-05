package com.example.comicworm;

import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.ProductImageType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdminProductRecordCoverTests {

    @Test
    void keepsStoredCoverUrl() {
        Product product = product("https://img/stored.jpg");
        var record = AdminProductRecord.from(product, List.of(image("https://img/cover.jpg", ProductImageType.COVER)));
        assertThat(record.coverImageUrl()).isEqualTo("https://img/stored.jpg");
    }

    @Test
    void fallsBackToCoverImageRow() {
        var record = AdminProductRecord.from(product(null), List.of(
                image("https://img/detail.jpg", ProductImageType.DETAIL),
                image("https://img/cover.jpg", ProductImageType.COVER)));
        assertThat(record.coverImageUrl()).isEqualTo("https://img/cover.jpg");
    }

    @Test
    void fallsBackToFirstDetailImage() {
        var record = AdminProductRecord.from(product(" "), List.of(
                image("https://img/d1.jpg", ProductImageType.DETAIL),
                image("https://img/d2.jpg", ProductImageType.DETAIL)));
        assertThat(record.coverImageUrl()).isEqualTo("https://img/d1.jpg");
    }

    @Test
    void staysNullWithoutAnyImage() {
        assertThat(AdminProductRecord.from(product(null), List.of()).coverImageUrl()).isNull();
    }

    private static Product product(String cover) {
        Product product = new Product();
        product.setId(1L);
        product.setCoverImageUrl(cover);
        return product;
    }

    private static ProductImage image(String url, ProductImageType type) {
        ProductImage image = new ProductImage();
        image.setImageUrl(url);
        image.setImageType(type);
        return image;
    }
}
