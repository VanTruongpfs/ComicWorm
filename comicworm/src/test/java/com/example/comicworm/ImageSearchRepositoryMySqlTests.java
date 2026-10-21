package com.example.comicworm;

import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.repository.ProductImageRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import static org.junit.jupiter.api.Assertions.*;

/** Run with tools/verify_image_search_mysql.py against a disposable server. */
@DataJpaTest(properties = {
        "spring.datasource.url=${IMAGE_SEARCH_TEST_DB_URL}",
        "spring.datasource.username=root", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=update", "spring.jpa.show-sql=false"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "IMAGE_SEARCH_MYSQL_TEST", matches = "true")
class ImageSearchRepositoryMySqlTests {
    @Autowired EntityManager em;
    @Autowired ProductImageRepository images;
    @Autowired ProductImageFeatureRepository features;
    private static final String MODEL = "image-repository-test-v1";

    @Test void searchesOnlyCurrentModelOnPublicProductsAndReadsJsonVectorProjection() {
        var visible = product(ModerationStatus.APPROVED);
        var first = image(visible, 0); var second = image(visible, 1);
        feature(first, MODEL); feature(second, MODEL);
        feature(image(product(ModerationStatus.PENDING), 0), MODEL);
        feature(image(product(ModerationStatus.REJECTED), 0), MODEL);
        var hidden = product(ModerationStatus.APPROVED); hidden.setIsActive(false);
        feature(image(hidden, 0), MODEL);
        var deleted = product(ModerationStatus.APPROVED); deleted.setDeletedAt(LocalDateTime.now());
        feature(image(deleted, 0), MODEL);
        feature(image(product(ModerationStatus.APPROVED), 0), "old-model");
        em.flush(); em.clear();
        var batch = features.findSearchBatch(MODEL, 0, PageRequest.of(0, 1));
        assertEquals(1, batch.size());
        assertEquals(first.getId(), batch.getFirst().getImageId());
        assertEquals(visible.getId(), batch.getFirst().getProductId());
        assertEquals(List.of(.6, .8), batch.getFirst().getEmbedding());
        assertEquals(first.getImageUrl(), batch.getFirst().getImageUrl());
        var next = features.findSearchBatch(MODEL, first.getId(), PageRequest.of(0, 256));
        assertEquals(List.of(second.getId()), next.stream().map(ProductImageFeatureRepository.SearchFeature::getImageId).toList());
    }

    @Test void selectsMissingAndOldModelImagesForIndexingButSkipsDeletedProducts() {
        var p = product(ModerationStatus.PENDING);
        var current = image(p, 0); feature(current, MODEL);
        var missing = image(p, 1);
        var old = image(p, 2); feature(old, "old-model");
        var deleted = product(ModerationStatus.APPROVED); deleted.setDeletedAt(LocalDateTime.now());
        image(deleted, 0);
        em.flush(); em.clear();
        // IDs are monotonic, so start immediately before this test's first image.
        var batch = images.findMissingFeatures(MODEL, current.getId() - 1, PageRequest.of(0, 50));
        assertEquals(List.of(missing.getId(), old.getId()), batch.stream().map(ProductImage::getId).toList());
        assertEquals(List.of(old.getId()), images.findMissingFeatures(MODEL, missing.getId(), PageRequest.of(0, 50))
                .stream().map(ProductImage::getId).toList());
    }

    private Product product(ModerationStatus status) {
        String key = UUID.randomUUID().toString();
        var user = new User(); user.setEmail(key + "@example.invalid"); user.setGoogleSub(key); user.setFullName("Image test seller");
        em.persist(user);
        var category = new Category(); category.setName("Image test"); category.setSlug(key); em.persist(category);
        var p = new Product(); p.setSellerId(user.getId()); p.setCategoryId(category.getId());
        p.setTitle("Image test"); p.setSlug(key); p.setDescription("Image search integration test");
        p.setConditionPercent(95); p.setPrice(BigDecimal.TEN); p.setModerationStatus(status); em.persist(p);
        return p;
    }

    private ProductImage image(Product product, int position) {
        var image = new ProductImage(); image.setProductId(product.getId()); image.setDisplayOrder(position);
        image.setImageUrl("https://res.cloudinary.com/test/" + UUID.randomUUID() + ".png"); em.persist(image);
        return image;
    }

    private void feature(ProductImage image, String model) {
        var feature = new ProductImageFeature(); feature.setImageId(image.getId());
        feature.setModelName(model); feature.setEmbedding(List.of(.6, .8)); em.persist(feature);
    }
}
