package com.example.comicworm.service.imagesearch;

import java.util.concurrent.atomic.AtomicBoolean;
import com.example.comicworm.repository.ProductImageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImageFeatureIndexer {
    private final ProductImageRepository images;
    private final ImageSearchProperties properties;
    private final ImageEmbeddingClient embeddings;
    private final ProductImageDownloader downloader;
    private final ImageFeatureStore store;
    private final AtomicBoolean running = new AtomicBoolean();
    private long cursor;
    private volatile BatchResult lastBatch = new BatchResult(0, 0, 0, false);

    @Scheduled(scheduler = "imageSearchScheduler", initialDelayString = "${app.image-search.index-initial-delay-ms:10000}",
            fixedDelayString = "${app.image-search.index-delay-ms:15000}")
    public void scheduledIndex() {
        if (properties.isEnabled()) indexNextBatch();
    }

    public BatchResult indexNextBatch() {
        embeddings.requireEnabled();
        if (!running.compareAndSet(false, true)) return new BatchResult(0, 0, 0, true);
        int indexed = 0;
        int failed = 0;
        int processed = 0;
        try {
            var batch = images.findMissingFeatures(properties.getModelName(), cursor,
                    PageRequest.of(0, Math.clamp(properties.getBatchSize(), 1, 50)));
            for (var image : batch) {
                long previousCursor = cursor;
                cursor = image.getId();
                processed++;
                try {
                    var vector = embeddings.embed(downloader.download(image.getImageUrl()));
                    if (store.save(image, properties.getModelName(), vector)) indexed++;
                } catch (Exception error) {
                    failed++;
                    log.warn("Could not index product image {} ({})", image.getId(), error.getClass().getSimpleName());
                    if (error instanceof InterruptedException) {
                        cursor = previousCursor;
                        Thread.currentThread().interrupt();
                        break;
                    }
                    // Back off the whole service on an outage instead of waiting once for every image.
                    if (error instanceof ResponseStatusException status && status.getStatusCode().value() == 503) {
                        cursor = previousCursor;
                        break;
                    }
                }
            }
            if (batch.isEmpty()) cursor = 0; // Retry failed rows on the next full pass.
            lastBatch = new BatchResult(processed, indexed, failed, false);
            return lastBatch;
        } catch (RuntimeException error) {
            log.warn("Image index batch failed ({})", error.getClass().getSimpleName());
            lastBatch = new BatchResult(processed, indexed, failed + 1, false);
            return lastBatch;
        } finally {
            running.set(false);
        }
    }

    public BatchResult lastBatch() { return lastBatch; }
    public boolean isRunning() { return running.get(); }
    public record BatchResult(int processed, int indexed, int failed, boolean busy) { }
}
