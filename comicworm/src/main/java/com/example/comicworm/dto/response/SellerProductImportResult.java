package com.example.comicworm.dto.response;

import java.util.List;

public record SellerProductImportResult(
        int totalRows,
        int successCount,
        int errorCount,
        List<String> errors,
        String message
) {}
