package com.example.comicworm.utils;
import com.example.comicworm.dto.response.ai.ProductChatSummaryDTO;

import java.util.List;

public class TempChatContext {
    private static final ThreadLocal<List<
            ProductChatSummaryDTO>> context = new ThreadLocal<>();

    public static void setProducts(List<ProductChatSummaryDTO> products) {
        context.set(products);
    }

    public static List<ProductChatSummaryDTO> getProducts() {
        return context.get();
    }

    public static void clear() {
        context.remove();
    }
}