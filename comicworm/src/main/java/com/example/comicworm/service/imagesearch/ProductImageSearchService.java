package com.example.comicworm.service.imagesearch;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import com.example.comicworm.dto.response.ImageSearchResponse;
import com.example.comicworm.repository.ProductImageFeatureRepository;
import com.example.comicworm.service.product.IProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ProductImageSearchService {
    private final ImageEmbeddingClient embeddings;
    private final ImageSearchProperties properties;
    private final ProductImageFeatureRepository features;
    private final IProductService products;

    @Transactional(readOnly = true)
    public ImageSearchResponse search(MultipartFile image, int limit, double minSimilarity) {
        if (limit < 1 || limit > 48 || !Double.isFinite(minSimilarity) || minSimilarity < -1 || minSimilarity > 1) {
            throw new IllegalArgumentException("limit phải từ 1–48; minSimilarity phải từ -1 đến 1.");
        }
        var query = embeddings.embed(image);
        Map<Long, Candidate> best = new HashMap<>();
        Comparator<Candidate> ranking = Comparator.comparingDouble(Candidate::score).reversed()
                .thenComparingLong(Candidate::productId);
        long cursor = 0;
        int compared = 0;
        while (true) {
            var batch = features.findSearchBatch(properties.getModelName(), cursor, PageRequest.of(0, 256));
            if (batch.isEmpty()) break;
            for (var feature : batch) {
                cursor = feature.getImageId();
                double score;
                try {
                    score = ImageVectors.cosine(query, feature.getEmbedding());
                } catch (IllegalArgumentException invalidStoredVector) {
                    continue;
                }
                compared++;
                if (score < minSimilarity) continue;
                var candidate = new Candidate(feature.getProductId(), score, feature.getImageUrl());
                best.merge(candidate.productId(), candidate, (a, b) -> a.score() >= b.score() ? a : b);
                if (best.size() > limit) {
                    var worst = best.values().stream().max(ranking).orElseThrow();
                    best.remove(worst.productId());
                }
            }
            if (batch.size() < 256) break;
        }
        var ranked = new ArrayList<>(best.values());
        ranked.sort(ranking);
        var cards = products.getPublicCards(ranked.stream().map(Candidate::productId).toList());
        var items = cards.stream().map(card -> {
            var match = best.get(card.getId());
            return new ImageSearchResponse.Match(card, match.score(), match.imageUrl());
        }).toList();
        return new ImageSearchResponse(properties.getModelName(), compared, items);
    }

    private record Candidate(long productId, double score, String imageUrl) { }
}
