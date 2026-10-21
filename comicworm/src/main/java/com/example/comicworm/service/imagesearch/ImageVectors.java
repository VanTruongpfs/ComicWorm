package com.example.comicworm.service.imagesearch;

import java.util.List;

/** Both indexing and querying must use the same model, dimensions and normalization. */
public final class ImageVectors {
    private ImageVectors() { }

    public static List<Double> normalize(List<Double> vector, int dimensions) {
        if (vector == null || dimensions < 1 || vector.size() != dimensions) {
            throw new IllegalArgumentException("Vector ảnh không đúng số chiều.");
        }
        double norm = 0;
        for (Double value : vector) {
            if (value == null || !Double.isFinite(value)) {
                throw new IllegalArgumentException("Vector ảnh chứa giá trị không hợp lệ.");
            }
            norm = Math.hypot(norm, value);
        }
        if (!Double.isFinite(norm) || norm == 0) {
            throw new IllegalArgumentException("Vector ảnh rỗng hoặc không hợp lệ.");
        }
        double length = norm;
        return vector.stream().map(value -> value / length).toList();
    }

    public static double cosine(List<Double> normalizedQuery, List<Double> stored) {
        List<Double> normalized = normalize(stored, normalizedQuery.size());
        double score = 0;
        for (int i = 0; i < normalized.size(); i++) score += normalizedQuery.get(i) * normalized.get(i);
        return Math.max(-1, Math.min(1, score));
    }
}
