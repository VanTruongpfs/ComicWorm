package com.example.comicworm;

import com.example.comicworm.service.imagesearch.ImageEmbeddingClient;
import com.example.comicworm.service.imagesearch.ImageSearchProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ImageEmbeddingClientTests {
    private HttpServer server;
    private ImageEmbeddingClient client;
    private int responseStatus = 200;
    private String responseBody;
    private final AtomicReference<byte[]> received = new AtomicReference<>();
    private final AtomicReference<String> receivedType = new AtomicReference<>();

    @BeforeEach void start() throws Exception {
        var properties = new ImageSearchProperties(); properties.setEnabled(true); properties.setDimensions(2);
        responseBody = "{\"modelName\":\"" + properties.getModelName() + "\",\"embedding\":[3,4]}";
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/embed", exchange -> {
            receivedType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            received.set(exchange.getRequestBody().readAllBytes());
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(responseStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        properties.setServiceUrl("http://127.0.0.1:" + server.getAddress().getPort());
        client = new ImageEmbeddingClient(properties, new ObjectMapper());
    }

    @AfterEach void stop() { server.stop(0); }

    @Test void sendsRawBytesAndNormalizesTheResponse() {
        byte[] image = {1, 2, 3};
        assertEquals(List.of(.6, .8), client.embed(image));
        assertArrayEquals(image, received.get());
        assertEquals("application/octet-stream", receivedType.get());
    }

    @Test void rejectsDifferentModelsAndInvalidVectorsRatherThanComparingThem() {
        for (String body : List.of("null", "{}", "not json",
                "{\"modelName\":\"other-model\",\"embedding\":[3,4]}",
                "{\"modelName\":\"clip-vit-b32-f41c383-rgb-v1\",\"embedding\":[1]}",
                "{\"modelName\":\"clip-vit-b32-f41c383-rgb-v1\",\"embedding\":[0,0]}")) {
            responseBody = body;
            assertEquals(503, assertThrows(ResponseStatusException.class, () -> client.embed(new byte[]{1})).getStatusCode().value());
        }
    }

    @Test void mapsImageValidationAndServiceFailuresToUsefulStatuses() {
        for (int remoteStatus : List.of(400, 413, 415, 500, 503)) {
            responseStatus = remoteStatus;
            int expected = remoteStatus < 500 ? 400 : 503;
            assertEquals(expected, assertThrows(ResponseStatusException.class, () -> client.embed(new byte[]{1})).getStatusCode().value());
        }
    }
}
