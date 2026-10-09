package com.example.comicworm;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.example.comicworm.service.upload.UploadService;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UploadServiceTests {
    static final byte[] PNG = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=");
    Cloudinary cloudinary;
    Uploader uploader;
    UploadService service;

    @BeforeEach void setup() {
        cloudinary = spy(new Cloudinary(Map.of("cloud_name", "test", "api_key", "test", "api_secret", "test")));
        uploader = mock(Uploader.class); doReturn(uploader).when(cloudinary).uploader();
        service = new UploadService(cloudinary);
    }
    MockMultipartFile image() { return new MockMultipartFile("files", "test.png", "image/png", PNG); }

    @Test void validatesTheWholeBatchBeforeCallingCloudinary() {
        var fake = new MockMultipartFile("files", "fake.png", "image/png", "not an image at all".getBytes());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.uploadMultiple(List.of(image(), fake), "test")).getStatusCode().value());
        verifyNoInteractions(uploader);
    }

    @Test void rejectsEmptyMissingTypeSvgAndOversizedImages() {
        for (var file : List.of(new MockMultipartFile("files", new byte[0]),
                new MockMultipartFile("files", "test.png", null, PNG),
                new MockMultipartFile("files", "test.svg", "image/svg+xml", "<svg></svg>".getBytes()),
                new MockMultipartFile("files", "big.png", "image/png", new byte[(int)UploadService.MAX_FILE_BYTES + 1]))) {
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.upload(file, "test")).getStatusCode().value());
        }
        verifyNoInteractions(uploader);
    }

    @Test void returnsHttpsUrlAndPublicIdFromTheUploadResponse() throws Exception {
        when(uploader.upload(any(), anyMap())).thenReturn(Map.of("secure_url", "https://res.cloudinary.com/test/image/upload/test.png", "public_id", "test"));
        var result = service.upload(image(), "comicworm/products/1/2");
        assertEquals("https://res.cloudinary.com/test/image/upload/test.png", result.url());
        assertEquals("test", result.publicId());
        verify(uploader).upload(eq(PNG), argThat(options -> "image".equals(options.get("resource_type"))
                && "comicworm/products/1/2".equals(options.get("folder"))));
    }

    @Test void rejectsAnInsecureUrlAndCleansUpItsUploadedAsset() throws Exception {
        when(uploader.upload(any(), anyMap())).thenReturn(Map.of("secure_url", "http://res.cloudinary.com/test/test.png", "public_id", "test"));
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> service.upload(image(), "test")).getStatusCode().value());
        verify(uploader).destroy(eq("test"), anyMap());
    }

    @Test void missingConfigurationProducesReadableErrorWithoutCallingTheCloud() {
        cloudinary.config.apiSecret = "";
        assertFalse(service.isConfigured());
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> service.upload(image(), "test")).getStatusCode().value());
        verifyNoInteractions(uploader);
    }
}
