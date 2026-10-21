package com.example.comicworm.controller.admin;

import java.util.Map;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.service.imagesearch.ImageFeatureIndexer;
import com.example.comicworm.service.imagesearch.ImageSearchProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/image-search")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminImageSearchController {
    private final ImageFeatureIndexer indexer;
    private final ImageSearchProperties properties;
    private final ProductImageFeatureRepository features;

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("enabled", properties.isEnabled(), "modelName", properties.getModelName(),
                "indexedImages", features.countByModelName(properties.getModelName()),
                "running", indexer.isRunning(), "lastBatch", indexer.lastBatch());
    }

    @PostMapping("/index")
    public ImageFeatureIndexer.BatchResult index() { return indexer.indexNextBatch(); }
}
