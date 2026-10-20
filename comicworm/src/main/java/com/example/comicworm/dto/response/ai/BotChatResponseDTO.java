package com.example.comicworm.dto.response.ai;

import com.example.comicworm.dto.response.ai.ProductChatSummaryDTO;
import java.util.List;

public record BotChatResponseDTO(
        String botReply,
        boolean hasProducts,
        List<ProductChatSummaryDTO> suggestedProducts
) {}