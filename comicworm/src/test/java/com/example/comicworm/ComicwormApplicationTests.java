package com.example.comicworm;

import jakarta.persistence.EntityManagerFactory;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("preview")
class ComicwormApplicationTests {
    @LocalServerPort
    private int port;
    @Autowired
    private ApplicationContext context;
    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void servesEveryStaticAssetUnchanged() throws Exception {
        Path root = Path.of("src/main/resources/static");
        try (var paths = Files.walk(root)) {
            for (Path path : paths.filter(Files::isRegularFile).toList()) {
                String relative = root.relativize(path).toString().replace('\\', '/');
                var response = client.send(request("/" + relative), HttpResponse.BodyHandlers.ofByteArray());
                assertEquals(200, response.statusCode(), relative);
                assertArrayEquals(Files.readAllBytes(path), response.body(), relative);
            }
        }
    }

    @Test
    void rendersEveryViewAtItsOriginalUrl() throws Exception {
        Path root = Path.of("src/main/resources/templates/view");
        Pattern title = Pattern.compile("<title>(.*?)</title>", Pattern.DOTALL);
        try (var paths = Files.walk(root)) {
            for (Path path : paths.filter(Files::isRegularFile).toList()) {
                String relative = root.relativize(path).toString().replace('\\', '/');
                var response = client.send(request("/" + relative), HttpResponse.BodyHandlers.ofString());
                assertEquals(200, response.statusCode(), relative);
                assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("text/html"), relative);
                assertFalse(response.body().isBlank(), relative);
                var expectedTitle = title.matcher(Files.readString(path));
                if (expectedTitle.find()) {
                    assertTrue(response.body().contains("<title>" + expectedTitle.group(1) + "</title>"), relative);
                }
            }
        }
    }

    @Test
    void opensHomeAndProtectsFutureApi() throws Exception {
        assertEquals(200, status("/"));
        assertEquals(401, status("/api/products"));
        assertEquals(401, status("/database/schema.sql"));
        assertEquals(401, status("/templates/view/index.html"));
        assertTrue(context.getBeansOfType(EntityManagerFactory.class).isEmpty());
    }

    @Test
    void returns404ForMissingViews() throws Exception {
        assertEquals(404, status("/buyer/html/unknown-view.html"));
        assertEquals(404, status("/shared/header/unknown-view.html"));
    }

    private HttpRequest request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
    }

    private int status(String path) throws Exception {
        return client.send(request(path), HttpResponse.BodyHandlers.discarding()).statusCode();
    }
}
