package com.example.comicworm;

import com.example.comicworm.model.Product;
import com.example.comicworm.model.ProductImage;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.imagesearch.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ImageFeatureIndexerTests {
    private final ImageSearchProperties properties = new ImageSearchProperties();
    private final ProductImageRepository images = mock(ProductImageRepository.class);
    private final ImageEmbeddingClient client = mock(ImageEmbeddingClient.class);
    private final ProductImageDownloader downloader = mock(ProductImageDownloader.class);
    private final ImageFeatureStore store = mock(ImageFeatureStore.class);
    private final ImageFeatureIndexer indexer = new ImageFeatureIndexer(images, properties, client, downloader, store);

    @Test void skipsBadImageAndIndexesOtherImagesThenRetriesOnTheNextPass() throws Exception {
        var bad = image(1); var good = image(2);
        when(images.findMissingFeatures(anyString(), eq(0L), any())).thenReturn(List.of(bad, good));
        when(images.findMissingFeatures(anyString(), eq(2L), any())).thenReturn(List.of());
        when(downloader.download(bad.getImageUrl())).thenThrow(new java.io.IOException("Bad image"));
        when(downloader.download(good.getImageUrl())).thenReturn(new byte[]{1});
        when(client.embed(any(byte[].class))).thenReturn(List.of(1d, 0d));
        when(store.save(eq(good), anyString(), anyList())).thenReturn(true);
        var result = indexer.indexNextBatch();
        assertEquals(2, result.processed()); assertEquals(1, result.indexed()); assertEquals(1, result.failed());
        indexer.indexNextBatch(); // End of pass resets the keyset cursor.
        indexer.indexNextBatch();
        verify(images, times(2)).findMissingFeatures(anyString(), eq(0L), any());
        assertFalse(indexer.isRunning());
    }

    @Test void backsOffWhenEmbeddingServiceIsUnavailable() throws Exception {
        when(images.findMissingFeatures(anyString(), eq(0L), any())).thenReturn(List.of(image(1), image(2)));
        when(downloader.download(anyString())).thenReturn(new byte[]{1});
        when(client.embed(any(byte[].class))).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE));
        assertEquals(1, indexer.indexNextBatch().failed());
        verify(downloader, times(1)).download(anyString());
        indexer.indexNextBatch();
        verify(images, times(2)).findMissingFeatures(anyString(), eq(0L), any());
        verifyNoInteractions(store);
    }

    @Test void doesNotWriteIfImageWasRemovedReplacedOrProductDeletedDuringEmbedding() {
        var products = mock(ProductRepository.class);
        var features = mock(ProductImageFeatureRepository.class);
        var writer = new ImageFeatureStore(products, images, features);
        var source = image(1);
        var product = new Product();
        when(products.lockForExchange(source.getProductId())).thenReturn(Optional.of(product));
        when(images.findById(source.getId())).thenReturn(Optional.empty());
        assertFalse(writer.save(source, "model", List.of(1d)));
        var replacement = image(1); replacement.setImageUrl("https://res.cloudinary.com/new.png");
        when(images.findById(source.getId())).thenReturn(Optional.of(replacement));
        assertFalse(writer.save(source, "model", List.of(1d)));
        product.setDeletedAt(LocalDateTime.now());
        assertFalse(writer.save(source, "model", List.of(1d)));
        verifyNoInteractions(features);
    }

    @Test void rejectsUntrustedImageUrlsWithoutMakingNetworkRequests() {
        var download = new ProductImageDownloader(properties);
        for (String url : List.of("http://res.cloudinary.com/a", "https://localhost/a", "file:///etc/passwd",
                "https://res.cloudinary.com.evil.example/a", "https://res.cloudinary.com:8443/a", "https://user@res.cloudinary.com/a")) {
            assertThrows(java.io.IOException.class, () -> download.download(url));
        }
    }

    private ProductImage image(long id) {
        var image = new ProductImage(); image.setId(id); image.setProductId(10L);
        image.setImageUrl("https://res.cloudinary.com/" + id + ".png");
        return image;
    }
}
