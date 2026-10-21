package com.example.comicworm.controller.product;

import java.util.Map;
import com.example.comicworm.dto.response.ImageSearchResponse;
import com.example.comicworm.service.imagesearch.ProductImageSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/products/image-search")
@RequiredArgsConstructor
public class ProductImageSearchController {
    private final ProductImageSearchService service;

    @PostMapping(consumes = "multipart/form-data")
    public ImageSearchResponse search(@RequestParam("image") MultipartFile image,
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(defaultValue = "0.5") double minSimilarity) {
        return service.search(image, limit, minSimilarity);
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> statusError(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> tooLarge() {
        return ResponseEntity.status(413).body(Map.of("message", "Ảnh vượt quá giới hạn 5 MB."));
    }
}
