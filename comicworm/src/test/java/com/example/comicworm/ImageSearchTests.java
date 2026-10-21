package com.example.comicworm;

import com.example.comicworm.dto.response.ProductCardDTO;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.service.imagesearch.*;
import com.example.comicworm.service.product.IProductService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ImageSearchTests {
    private final ImageSearchProperties properties = new ImageSearchProperties();
    private final ImageEmbeddingClient embeddings = mock(ImageEmbeddingClient.class);
    private final ProductImageFeatureRepository features = mock(ProductImageFeatureRepository.class);
    private final IProductService products = mock(IProductService.class);
    private final ProductImageSearchService service = new ProductImageSearchService(embeddings, properties, features, products);
    private final MockMultipartFile query = new MockMultipartFile("image", "query.png", "image/png", new byte[]{1});

    @Test void cosineHandlesMagnitudeAndRejectsInvalidVectors() {
        var query = ImageVectors.normalize(List.of(3d, 4d), 2);
        assertEquals(1, ImageVectors.cosine(query, List.of(6d, 8d)), 1e-12);
        assertEquals(-1, ImageVectors.cosine(query, List.of(-6d, -8d)), 1e-12);
        assertEquals(0, ImageVectors.cosine(query, List.of(4d, -3d)), 1e-12);
        for (var invalid : List.of(List.of(0d, 0d), List.of(Double.NaN, 1d), List.of(Double.POSITIVE_INFINITY, 1d), List.of(1d))) {
            assertThrows(IllegalArgumentException.class, () -> ImageVectors.normalize(invalid, 2));
        }
    }

    @Test void ranksBestImagePerProductAndKeepsTopKDistinctProducts() {
        when(embeddings.embed(query)).thenReturn(List.of(1d, 0d));
        when(features.findSearchBatch(eq(properties.getModelName()), eq(0L), any())).thenReturn(List.of(
                feature(1, 10, List.of(.6, .8)), feature(2, 20, List.of(.8, .6)),
                feature(3, 10, List.of(1d, 0d)), feature(4, 30, List.of(.9, .1))));
        when(products.getPublicCards(List.of(10L, 30L))).thenReturn(List.of(card(10), card(30)));
        var response = service.search(query, 2, .5);
        assertEquals(4, response.comparedImages());
        assertEquals(List.of(10L, 30L), response.items().stream().map(item -> item.product().getId()).toList());
        assertEquals(1, response.items().getFirst().similarity(), 1e-12);
        assertEquals("https://res.cloudinary.com/test/3.png", response.items().getFirst().matchedImageUrl());
    }

    @Test void filtersBelowThresholdAndSkipsCorruptStoredVectors() {
        when(embeddings.embed(query)).thenReturn(List.of(1d, 0d));
        when(features.findSearchBatch(anyString(), eq(0L), any())).thenReturn(List.of(
                feature(1, 10, List.of(0d, 1d)), feature(2, 20, List.of(Double.NaN, 0d)),
                feature(3, 30, List.of(1d))));
        when(products.getPublicCards(List.of())).thenReturn(List.of());
        var response = service.search(query, 24, .5);
        assertTrue(response.items().isEmpty());
        assertEquals(1, response.comparedImages());
    }

    @Test void readsEveryBatchInsteadOfOnlyTheFirstPage() {
        when(embeddings.embed(query)).thenReturn(List.of(1d, 0d));
        var first = java.util.stream.LongStream.rangeClosed(1, 256)
                .mapToObj(id -> feature(id, id, List.of(0d, 1d))).toList();
        when(features.findSearchBatch(anyString(), eq(0L), any())).thenReturn(first);
        when(features.findSearchBatch(anyString(), eq(256L), any())).thenReturn(List.of(feature(257, 999, List.of(1d, 0d))));
        when(products.getPublicCards(List.of(999L))).thenReturn(List.of(card(999)));
        var response = service.search(query, 1, .5);
        assertEquals(257, response.comparedImages());
        assertEquals(999L, response.items().getFirst().product().getId());
    }

    @Test void usesStableProductIdOrderForTiesAndRechecksVisibility() {
        when(embeddings.embed(query)).thenReturn(List.of(1d, 0d));
        when(features.findSearchBatch(anyString(), eq(0L), any())).thenReturn(List.of(
                feature(1, 30, List.of(1d, 0d)), feature(2, 10, List.of(1d, 0d)), feature(3, 20, List.of(1d, 0d))));
        when(products.getPublicCards(List.of(10L, 20L))).thenReturn(List.of(card(20)));
        var response = service.search(query, 2, .5);
        assertEquals(List.of(20L), response.items().stream().map(item -> item.product().getId()).toList());
    }

    @Test void validatesParametersBeforeCallingTheModel() {
        assertThrows(IllegalArgumentException.class, () -> service.search(query, 0, .5));
        assertThrows(IllegalArgumentException.class, () -> service.search(query, 49, .5));
        assertThrows(IllegalArgumentException.class, () -> service.search(query, 1, Double.NaN));
        assertThrows(IllegalArgumentException.class, () -> service.search(query, 1, 1.1));
        verifyNoInteractions(embeddings, features);
    }

    @Test void validatesUploadAndReportsDisabledService() {
        var client = new ImageEmbeddingClient(properties, new ObjectMapper());
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> client.embed(query)).getStatusCode().value());
        properties.setEnabled(true);
        for (var image : List.of(new MockMultipartFile("image", new byte[0]),
                new MockMultipartFile("image", "query.svg", "image/svg+xml", new byte[]{1}),
                new MockMultipartFile("image", "big.png", "image/png", new byte[ImageEmbeddingClient.MAX_BYTES + 1]))) {
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.embed(image)).getStatusCode().value());
        }
    }

    private ProductImageFeatureRepository.SearchFeature feature(long id, long productId, List<Double> vector) {
        return new ProductImageFeatureRepository.SearchFeature() {
            public Long getImageId() { return id; }
            public Long getProductId() { return productId; }
            public String getImageUrl() { return "https://res.cloudinary.com/test/" + id + ".png"; }
            public List<Double> getEmbedding() { return vector; }
        };
    }

    private ProductCardDTO card(long id) { return ProductCardDTO.builder().id(id).title("Comic " + id).build(); }
}
