package com.example.comicworm.service.imagesearch;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProductImageDownloaderTests {
    private final ImageSearchProperties properties = new ImageSearchProperties();
    private final HttpClient http = mock(HttpClient.class);
    private final ProductImageDownloader downloader = new ProductImageDownloader(properties, http);

    @Test void followsRedirectOnlyAfterValidatingTheApprovedCdn() throws Exception {
        properties.setAllowedImageHosts(List.of("picsum.photos", "fastly.picsum.photos"));
        var redirect = response(302, "https://fastly.picsum.photos/id/1/photo.jpg", new byte[0]);
        var photo = response(200, null, new byte[]{1, 2, 3});
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(redirect, photo);
        assertArrayEquals(new byte[]{1, 2, 3}, downloader.download("https://picsum.photos/seed/comic/600/800"));
        var requests = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http, times(2)).send(requests.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("fastly.picsum.photos", requests.getAllValues().get(1).uri().getHost());
    }

    @Test void rejectsRedirectsToUnapprovedHostsAndInsecureUrls() throws Exception {
        properties.setAllowedImageHosts(List.of("picsum.photos"));
        for (String destination : List.of("https://127.0.0.1/private", "http://picsum.photos/image.jpg",
                "https://picsum.photos.evil.example/image.jpg")) {
            reset(http);
            var redirect = response(302, destination, new byte[0]);
            when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(redirect);
            assertThrows(IOException.class, () -> downloader.download("https://picsum.photos/seed/comic/600/800"));
            verify(http, times(1)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        }
    }

    @Test void limitsRedirectLoops() throws Exception {
        properties.setAllowedImageHosts(List.of("picsum.photos"));
        var redirect = response(302, "/loop", new byte[0]);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(redirect);
        assertThrows(IOException.class, () -> downloader.download("https://picsum.photos/loop"));
        verify(http, times(4)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test void stillRejectsOversizedImagesAfterRedirect() throws Exception {
        properties.setAllowedImageHosts(List.of("picsum.photos"));
        var photo = response(200, null, new byte[ImageEmbeddingClient.MAX_BYTES + 1]);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(photo);
        assertThrows(IOException.class, () -> downloader.download("https://picsum.photos/large"));
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<InputStream> response(int status, String location, byte[] body) {
        HttpResponse<InputStream> result = mock(HttpResponse.class);
        when(result.statusCode()).thenReturn(status);
        when(result.headers()).thenReturn(HttpHeaders.of(location == null ? Map.of() : Map.of("Location", List.of(location)), (a, b) -> true));
        when(result.body()).thenReturn(new ByteArrayInputStream(body));
        return result;
    }
}
