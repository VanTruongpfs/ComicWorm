package com.example.comicworm.dto.response.ai;

import java.util.List;

public record ProductSearchResponseAI (
        List<ProductChatSummaryDTO> products
) {}