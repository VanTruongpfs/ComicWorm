package com.example.comicworm.dto.response;

import java.util.List;

public record ImageSearchResponse(String modelName, int comparedImages, List<Match> items) {
    public record Match(ProductCardDTO product, double similarity, String matchedImageUrl) { }
}
