package com.example.comicworm;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.model.enums.AiVerdict;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.repository.ProductImageRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.service.moderation.BasicProductClassifier;
import com.example.comicworm.service.moderation.ClassificationResult;
import com.example.comicworm.service.moderation.ProductClassificationInput;
import com.example.comicworm.service.moderation.ProductClassificationJob;
import com.example.comicworm.service.moderation.ProductClassifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class ProductClassificationJobTests {

    private static final LocalDateTime SEEN = LocalDateTime.of(2026, 11, 7, 3, 0, 0);

    private ProductRepository products;
    private ProductImageRepository images;
    private ProductClassifier classifier;
    private ProductClassificationJob job;

    @BeforeEach
    void setUp() {
        products = mock(ProductRepository.class);
        images = mock(ProductImageRepository.class);
        classifier = mock(ProductClassifier.class);
        job = new ProductClassificationJob(products, images, classifier);
    }

    private Product pending(long id) {
        Product product = new Product();
        product.setId(id);
        product.setTitle("Conan tập 1");
        product.setModerationStatus(ModerationStatus.PENDING);
        product.setUpdatedAt(SEEN);
        when(products.findById(id)).thenReturn(Optional.of(product));
        return product;
    }

    private static ProductImage image(String url) {
        ProductImage image = new ProductImage();
        image.setImageUrl(url);
        return image;
    }

    @Test
    void basicClassifierMarksProductsWithoutImagesInvalid() {
        BasicProductClassifier basic = new BasicProductClassifier();

        ClassificationResult noImage = basic.classify(
                new ProductClassificationInput(1L, "Conan", "", null, BigDecimal.TEN, 90, List.of()));
        assertEquals(AiVerdict.INVALID, noImage.verdict());
        assertEquals(List.of("Sản phẩm chưa có ảnh."), noImage.reasons());

        ClassificationResult withImage = basic.classify(
                new ProductClassificationInput(1L, "Conan", "", null, BigDecimal.TEN, 90, List.of("https://img/1.jpg")));
        assertEquals(AiVerdict.VALID, withImage.verdict());
    }

    @Test
    void inputCollectsCoverThenDetailImagesWithoutDuplicates() {
        Product product = new Product();
        product.setCoverImageUrl("https://img/cover.jpg");

        ProductClassificationInput input = ProductClassificationInput.from(product,
                List.of(image("https://img/cover.jpg"), image("https://img/2.jpg"), image(" ")));

        assertEquals(List.of("https://img/cover.jpg", "https://img/2.jpg"), input.imageUrls());
    }

    @Test
    void classificationResultRejectsMissingVerdictOrOutOfRangeScore() {
        assertThrows(IllegalArgumentException.class, () -> new ClassificationResult(null, List.of(), null));
        assertThrows(IllegalArgumentException.class,
                () -> new ClassificationResult(AiVerdict.VALID, List.of(), new BigDecimal("1.2")));
        assertThrows(IllegalArgumentException.class,
                () -> new ClassificationResult(AiVerdict.VALID, List.of(), new BigDecimal("-0.1")));
    }

    @Test
    void savesVerdictReasonsAndScoreGuardedByTheSeenUpdateTime() {
        pending(1L);
        when(images.findByProductIdOrderByDisplayOrderAscIdAsc(1L)).thenReturn(List.of(image("https://img/pen.jpg")));
        when(classifier.classify(any())).thenReturn(new ClassificationResult(
                AiVerdict.INVALID, List.of("Ảnh là cây viết, không phải truyện", " "), new BigDecimal("0.87654")));
        when(products.saveClassification(anyLong(), any(), any(), any(), any(), any())).thenReturn(1);

        job.classifyPendingProductsFor(List.of(1L));

        ArgumentCaptor<ProductClassificationInput> input = ArgumentCaptor.forClass(ProductClassificationInput.class);
        verify(classifier).classify(input.capture());
        assertEquals(List.of("https://img/pen.jpg"), input.getValue().imageUrls());
        verify(products).saveClassification(eq(1L), eq(AiVerdict.INVALID), eq("Ảnh là cây viết, không phải truyện"),
                eq(new BigDecimal("0.8765")), any(LocalDateTime.class), eq(SEEN));
    }

    @Test
    void skipsProductsThatAreNoLongerWaitingForClassification() {
        pending(1L).setAiVerdict(AiVerdict.VALID);
        pending(2L).setModerationStatus(ModerationStatus.APPROVED);
        pending(3L).setDeletedAt(SEEN);
        when(products.findById(4L)).thenReturn(Optional.empty());

        job.classifyPendingProductsFor(List.of(1L, 2L, 3L, 4L));

        verifyNoInteractions(classifier);
        verify(products, never()).saveClassification(anyLong(), any(), any(), any(), any(), any());
    }

    @Test
    void classifierFailureLeavesProductUnclassifiedAndContinuesWithTheRest() {
        pending(1L);
        pending(2L);
        when(classifier.classify(any()))
                .thenThrow(new IllegalStateException("model offline"))
                .thenReturn(ClassificationResult.valid());
        when(products.saveClassification(anyLong(), any(), any(), any(), any(), any())).thenReturn(1);

        job.classifyPendingProductsFor(List.of(1L, 2L));

        verify(products, never()).saveClassification(eq(1L), any(), any(), any(), any(), any());
        verify(products).saveClassification(eq(2L), eq(AiVerdict.VALID), isNull(), isNull(), any(LocalDateTime.class), eq(SEEN));
    }

    @Test
    void scheduledRunClassifiesTheNextBatchOfPendingIds() {
        pending(9L);
        when(products.findIdsAwaitingClassification(any(Pageable.class))).thenReturn(List.of(9L));
        when(classifier.classify(any())).thenReturn(ClassificationResult.valid());

        job.classifyPendingProducts();

        verify(products).saveClassification(eq(9L), eq(AiVerdict.VALID), isNull(), isNull(), any(LocalDateTime.class), eq(SEEN));
    }

    @Test
    void sellerEditClearsThePreviousVerdict() {
        Product product = new Product();
        product.setAiVerdict(AiVerdict.INVALID);
        product.setAiReasons("Sản phẩm chưa có ảnh.");
        product.setAiScore(BigDecimal.ONE);
        product.setAiClassifiedAt(SEEN);

        product.resetAiClassification();

        assertNull(product.getAiVerdict());
        assertNull(product.getAiReasons());
        assertNull(product.getAiScore());
        assertNull(product.getAiClassifiedAt());
    }
}
