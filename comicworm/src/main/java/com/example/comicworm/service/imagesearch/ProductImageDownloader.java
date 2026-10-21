package com.example.comicworm.service.imagesearch;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Only URLs already stored in product_images, on explicitly configured image hosts. */
@Component
public class ProductImageDownloader {
    private static final Set<Integer> REDIRECTS = Set.of(301, 302, 303, 307, 308);
    private final ImageSearchProperties properties;
    private final HttpClient http;

    @Autowired
    public ProductImageDownloader(ImageSearchProperties properties) {
        this(properties, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    ProductImageDownloader(ImageSearchProperties properties, HttpClient http) {
        this.properties = properties;
        this.http = http;
    }

    public byte[] download(String url) throws IOException, InterruptedException {
        URI uri = URI.create(url);
        for (int hop = 0; hop <= 3; hop++) {
            validate(uri);
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20)).GET().build();
            HttpResponse<java.io.InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var body = response.body()) {
                if (REDIRECTS.contains(response.statusCode())) {
                    if (hop == 3) throw new IOException("Ảnh chuyển hướng quá nhiều lần.");
                    String location = response.headers().firstValue("Location")
                            .orElseThrow(() -> new IOException("Chuyển hướng ảnh thiếu địa chỉ đích."));
                    uri = uri.resolve(location);
                    continue; // Validate the destination before issuing another request.
                }
                if (response.statusCode() != 200) throw new IOException("Không tải được ảnh sản phẩm.");
                byte[] bytes = body.readNBytes(ImageEmbeddingClient.MAX_BYTES + 1);
                if (bytes.length == 0 || bytes.length > ImageEmbeddingClient.MAX_BYTES) {
                    throw new IOException("Ảnh sản phẩm rỗng hoặc lớn hơn 5 MB.");
                }
                return bytes;
            }
        }
        throw new IOException("Không tải được ảnh sản phẩm.");
    }

    private void validate(URI uri) throws IOException {
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443)
                || properties.getAllowedImageHosts().stream().noneMatch(host -> host.equalsIgnoreCase(uri.getHost()))) {
            throw new IOException("URL ảnh không thuộc máy chủ ảnh được cho phép.");
        }
    }
}
