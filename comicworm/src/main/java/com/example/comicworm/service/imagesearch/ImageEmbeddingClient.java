package com.example.comicworm.service.imagesearch;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ImageEmbeddingClient {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private final ImageSearchProperties properties;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    public ImageEmbeddingClient(ImageSearchProperties properties, ObjectMapper json) {
        this.properties = properties;
        this.json = json;
    }

    public List<Double> embed(MultipartFile image) {
        requireEnabled();
        if (image == null || image.isEmpty() || image.getSize() > MAX_BYTES
                || image.getContentType() == null || !TYPES.contains(image.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chọn ảnh JPG, PNG, WebP hoặc GIF, tối đa 5 MB.");
        }
        try {
            return embed(image.getBytes());
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không đọc được ảnh đã chọn.");
        }
    }

    public List<Double> embed(byte[] image) {
        requireEnabled();
        if (image == null || image.length == 0 || image.length > MAX_BYTES) {
            throw new IllegalArgumentException("Ảnh rỗng hoặc lớn hơn 5 MB.");
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(properties.getServiceUrl() + "/embed"))
                .timeout(Duration.ofSeconds(45)).header("Content-Type", "application/octet-stream")
                .POST(HttpRequest.BodyPublishers.ofByteArray(image)).build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 400 || response.statusCode() == 413 || response.statusCode() == 415) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ảnh không hợp lệ. Chọn ảnh JPG, PNG, WebP hoặc GIF tối đa 5 MB.");
            }
            if (response.statusCode() != 200) throw unavailable();
            EmbeddingResponse body = json.readValue(response.body(), EmbeddingResponse.class);
            if (body == null || !properties.getModelName().equals(body.modelName())) throw unavailable();
            return ImageVectors.normalize(body.embedding(), properties.getDimensions());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (IOException | IllegalArgumentException error) {
            throw unavailable();
        }
    }

    public void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tìm kiếm bằng ảnh chưa được bật.");
        }
    }

    private ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ nhận diện ảnh chưa sẵn sàng. Vui lòng thử lại sau.");
    }

    public record EmbeddingResponse(String modelName, List<Double> embedding) { }
}
