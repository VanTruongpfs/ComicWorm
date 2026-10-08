package com.example.comicworm;

import java.math.BigDecimal;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** Real HTTP/JWT/JPA checks on a disposable MySQL instance; never runs against the configured database. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.hibernate.ddl-auto=validate", "cloudinary.cloud-name=test", "cloudinary.api-key=test", "cloudinary.api-secret=test"})
@EnabledIfEnvironmentVariable(named = "PRODUCTS_MYSQL_TEST", matches = "true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SellerProductMySqlTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired com.example.comicworm.repository.ProductRepository products;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @MockitoSpyBean Cloudinary cloudinary;
    Uploader uploader;
    @LocalServerPort int port;
    final JsonMapper json = JsonMapper.builder().build();
    final String password = "ProductsTest2026!";
    Integer category, secondCategory;

    @BeforeAll void fixtures() {
        String expectedData = System.getenv("PRODUCTS_MYSQL_DATADIR");
        assertNotNull(expectedData);
        Path expected = Path.of(expectedData).toAbsolutePath().normalize();
        Path actual = Path.of(jdbc.queryForObject("SELECT @@datadir", String.class)).toAbsolutePath().normalize();
        assertEquals(expected, actual, "Refusing to modify another MySQL instance.");
        assertTrue(expected.getParent().getFileName().toString().startsWith("comicworm-products-mysql-"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
        assertEquals("bookmooch_db_v3", jdbc.queryForObject("SELECT DATABASE()", String.class));
        String hash = passwords.encode(password);
        jdbc.update("""
            INSERT INTO users(id,email,password_hash,full_name,role,is_seller) VALUES
            (92001,'products-seller@example.invalid',?,'Test Seller','USER',true),
            (92002,'products-other@example.invalid',?,'Other Seller','USER',true),
            (92003,'products-buyer@example.invalid',?,'Test Buyer','USER',false)
            """, hash, hash, hash);
        var ids = jdbc.queryForList("SELECT id FROM categories ORDER BY id LIMIT 2", Integer.class);
        assertEquals(2, ids.size()); category = ids.get(0); secondCategory = ids.get(1);
    }

    @BeforeEach void clearDisposableProducts() throws Exception {
        uploader = mock(Uploader.class); doReturn(uploader).when(cloudinary).uploader();
        var counter = new java.util.concurrent.atomic.AtomicInteger();
        when(uploader.upload(any(), anyMap())).thenAnswer(call -> {
            String publicId = call.<Map<String, Object>>getArgument(1).get("folder") + "/image-" + counter.incrementAndGet();
            return Map.of("public_id", publicId, "secure_url", "https://res.cloudinary.com/test/image/upload/v1/" + publicId + ".png");
        });
        when(uploader.destroy(anyString(), anyMap())).thenReturn(Map.of("result", "ok"));
        jdbc.update("UPDATE users SET is_seller=false WHERE id=92003");
        jdbc.update("DELETE FROM order_items"); jdbc.update("DELETE FROM orders");
        jdbc.update("DELETE FROM checkout_batches"); jdbc.update("DELETE FROM product_image_features");
        jdbc.update("DELETE FROM product_images"); jdbc.update("DELETE FROM products");
    }

    HttpClient login(String email) throws Exception {
        HttpClient client = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
        String body = "email=" + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8);
        var response = client.send(HttpRequest.newBuilder(uri("/auth/login")).header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(302, response.statusCode(), response.body());
        assertEquals(uri("/buyer/html/home.html"), uri("/").resolve(response.headers().firstValue("Location").orElseThrow()));
        return client;
    }
    URI uri(String path) { return URI.create("http://127.0.0.1:" + port + path); }
    HttpResponse<String> get(HttpClient client, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void browserUpgradeFormWorksWithItsRenderedCsrfTokenAndExistingJwt() throws Exception {
        var buyer = login("products-buyer@example.invalid");
        var page = get(buyer, "/user/seller-upgrade");
        assertEquals(200, page.statusCode(), page.body());
        var token = java.util.regex.Pattern.compile("name=\"_csrf\"[^>]*value=\"([^\"]+)\"").matcher(page.body());
        assertTrue(token.find(), "Upgrade form must render a CSRF token.");
        assertEquals(200, get(buyer, "/buyer/html/home.html").statusCode());
        assertEquals(200, get(buyer, "/api/account/me").statusCode());
        var request = HttpRequest.newBuilder(uri("/user/seller-upgrade"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Origin", "http://127.0.0.1:" + port)
                .header("Referer", uri("/user/seller-upgrade").toString())
                .POST(HttpRequest.BodyPublishers.ofString("_csrf=" + URLEncoder.encode(token.group(1), StandardCharsets.UTF_8)))
                .build();
        var upgraded = buyer.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(302, upgraded.statusCode(), upgraded.body());
        assertEquals(uri("/seller/html/index.html"), uri("/").resolve(upgraded.headers().firstValue("Location").orElseThrow()));
        assertTrue(Boolean.TRUE.equals(jdbc.queryForObject("SELECT is_seller FROM users WHERE id=92003", Boolean.class)));
        assertEquals(200, get(buyer, "/seller/html/index.html").statusCode());
        assertEquals(200, get(buyer, "/api/seller/products/options").statusCode());
    }

    @Test void expiredUpgradeFormDoesNotChangeAccountAndCanBeRefreshedAndConfirmed() throws Exception {
        var original = login("products-buyer@example.invalid");
        var page = get(original, "/user/seller-upgrade");
        var tokenPattern = java.util.regex.Pattern.compile("name=\"_csrf\"[^>]*value=\"([^\"]+)\"");
        var oldToken = tokenPattern.matcher(page.body()); assertTrue(oldToken.find());
        var freshCookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        var oldCookies = (CookieManager) original.cookieHandler().orElseThrow();
        for (var cookie : oldCookies.getCookieStore().getCookies()) {
            if (Set.of("accessToken", "refreshToken").contains(cookie.getName())) {
                freshCookies.getCookieStore().add(uri("/"), (HttpCookie) cookie.clone());
            }
        }
        var expired = HttpClient.newBuilder().cookieHandler(freshCookies).build();
        var rejected = expired.send(HttpRequest.newBuilder(uri("/user/seller-upgrade"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("_csrf=" + URLEncoder.encode(oldToken.group(1), StandardCharsets.UTF_8)))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(302, rejected.statusCode(), rejected.body());
        assertEquals(uri("/user/seller-upgrade?csrfExpired=true"), uri("/").resolve(rejected.headers().firstValue("Location").orElseThrow()));
        assertFalse(Boolean.TRUE.equals(jdbc.queryForObject("SELECT is_seller FROM users WHERE id=92003", Boolean.class)));
        var refreshed = get(expired, "/user/seller-upgrade?csrfExpired=true");
        assertEquals(200, refreshed.statusCode()); assertTrue(refreshed.body().contains("Phiên xác nhận đã hết hạn"));
        var freshToken = tokenPattern.matcher(refreshed.body()); assertTrue(freshToken.find());
        var confirmed = expired.send(HttpRequest.newBuilder(uri("/user/seller-upgrade"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("_csrf=" + URLEncoder.encode(freshToken.group(1), StandardCharsets.UTF_8)))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(302, confirmed.statusCode(), confirmed.body());
        assertEquals(uri("/seller/html/index.html"), uri("/").resolve(confirmed.headers().firstValue("Location").orElseThrow()));
        assertEquals(200, get(expired, "/api/seller/products/options").statusCode());
    }
    HttpResponse<String> mutate(HttpClient client, String method, String path, Object body, boolean csrf) throws Exception {
        var builder = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json");
        if (csrf) {
            var response = get(client, "/api/seller/products/csrf"); assertEquals(200, response.statusCode(), response.body());
            var token = json.readTree(response.body()); builder.header(token.get("headerName").asString(), token.get("token").asString());
        }
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    Map<String, Object> product(String title, String price, int stock) {
        var values = new LinkedHashMap<String, Object>();
        values.put("title", title); values.put("description", "Mô tả truyện kiểm thử"); values.put("categoryId", category);
        values.put("conditionPercent", 95); values.put("price", price); values.put("stockQuantity", stock);
        values.put("listingType", "SELL"); values.put("isActive", true); return values;
    }
    long create(HttpClient client, Map<String, Object> body) throws Exception {
        var response = mutate(client, "POST", "/api/seller/products", body, true);
        assertEquals(200, response.statusCode(), response.body());
        assertEquals("OK", json.readTree(response.body()).get("Result").asString());
        return json.readTree(response.body()).get("Record").get("id").asLong();
    }

    HttpResponse<String> upload(HttpClient client, long id, int count, byte[] bytes, String type, boolean csrf) throws Exception {
        String boundary = "ComicwormImageTest" + UUID.randomUUID();
        var body = new ByteArrayOutputStream();
        for (int index = 0; index < count; index++) {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"files\"; filename=\"test.png\"\r\nContent-Type: "
                    + type + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(bytes); body.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        var builder = HttpRequest.newBuilder(uri("/api/seller/products/" + id + "/images"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary);
        if (csrf) {
            var token = json.readTree(get(client, "/api/seller/products/csrf").body());
            builder.header(token.get("headerName").asString(), token.get("token").asString());
        }
        return client.send(builder.POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build(), HttpResponse.BodyHandlers.ofString());
    }

    record FilePart(String field, String type, byte[] bytes) {}
    HttpResponse<String> productMultipart(HttpClient client, String method, String path, Map<String, Object> product,
            byte[] cover, int details, List<Long> removeIds) throws Exception {
        var parts = new ArrayList<FilePart>();
        parts.add(new FilePart("product", "application/json", json.writeValueAsBytes(product)));
        if (cover != null) parts.add(new FilePart("coverImage", "image/png", cover));
        for (int index = 0; index < details; index++) parts.add(new FilePart("detailImages", "image/png", UploadServiceTests.PNG));
        if (removeIds != null && !removeIds.isEmpty()) parts.add(new FilePart("removeImageIds", "application/json", json.writeValueAsBytes(removeIds)));
        String boundary = "ComicwormCrud" + UUID.randomUUID();
        var body = new ByteArrayOutputStream();
        for (var part : parts) {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + part.field() + "\"; filename=\"part\"\r\nContent-Type: "
                    + part.type() + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(part.bytes()); body.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        var token = json.readTree(get(client, "/api/seller/products/csrf").body());
        return client.send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header(token.get("headerName").asString(), token.get("token").asString())
                .method(method, HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void multipartCrudSavesCoverAndDetailsAndMapsProductImageRelationship() throws Exception {
        var seller = login("products-seller@example.invalid");
        var response = productMultipart(seller, "POST", "/api/seller/products", product("Cover and details", "10", 1), UploadServiceTests.PNG, 2, List.of());
        assertEquals(200, response.statusCode(), response.body());
        var record = json.readTree(response.body()).get("Record"); long id = record.get("id").asLong();
        String originalCover = record.get("coverImageUrl").asString();
        assertEquals(3, record.get("images").size()); assertEquals(2, record.get("detailImages").size());
        assertEquals("COVER", record.get("images").get(0).get("imageType").asString());
        assertEquals(originalCover, jdbc.queryForObject("SELECT cover_image_url FROM products WHERE id=?", String.class, id));
        new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
            var entity = products.findById(id).orElseThrow();
            assertEquals(3, entity.getImages().size());
            assertEquals(1, entity.getImages().stream().filter(image -> image.getImageType() == com.example.comicworm.model.enums.ProductImageType.COVER).count());
            entity.getImages().forEach(image -> assertEquals(id, image.getProduct().getId()));
            return null;
        });
        long removedId = record.get("detailImages").get(0).get("id").asLong();
        jdbc.update("INSERT INTO product_image_features(image_id,embedding,model_name) VALUES(?,'[0.1]','test')", removedId);
        response = productMultipart(seller, "PUT", "/api/seller/products/" + id, product("Edited with images", "20", 2), UploadServiceTests.PNG, 1, List.of(removedId));
        assertEquals(200, response.statusCode(), response.body()); record = json.readTree(response.body()).get("Record");
        assertEquals("Edited with images", record.get("title").asString());
        assertNotEquals(originalCover, record.get("coverImageUrl").asString());
        assertEquals(2, record.get("detailImages").size());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM product_images WHERE product_id=? AND image_type='COVER'", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images WHERE id=?", Integer.class, removedId));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_image_features WHERE image_id=?", Integer.class, removedId));
        String cover = record.get("coverImageUrl").asString();
        response = productMultipart(seller, "PUT", "/api/seller/products/" + id, product("Keep existing photos", "30", 2), null, 0, List.of());
        assertEquals(200, response.statusCode(), response.body());
        assertEquals(cover, json.readTree(response.body()).get("Record").get("coverImageUrl").asString());
        verify(uploader, times(5)).upload(any(), anyMap()); verify(uploader, never()).destroy(anyString(), anyMap());
    }

    @Test void multipartCreateNeedsCoverAndRejectsExcessDetailsWithoutCreatingProduct() throws Exception {
        var seller = login("products-seller@example.invalid");
        for (var response : List.of(
                productMultipart(seller, "POST", "/api/seller/products", product("Missing cover", "10", 1), null, 1, List.of()),
                productMultipart(seller, "POST", "/api/seller/products", product("Too many details", "10", 1), UploadServiceTests.PNG, 8, List.of()),
                productMultipart(seller, "POST", "/api/seller/products", product("Invalid cover", "10", 1), "fake image bytes".getBytes(), 1, List.of()))) {
            assertEquals(400, response.statusCode(), response.body());
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM products", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
        verify(uploader, never()).upload(any(), anyMap());
    }

    @Test void failedMultipartCreateRollsBackProductAndCleansUpSuccessfulUploads() throws Exception {
        var seller = login("products-seller@example.invalid");
        when(uploader.upload(any(), anyMap())).thenReturn(Map.of("public_id", "test/new-cover", "secure_url", "https://res.cloudinary.com/test/new-cover.png"))
                .thenThrow(new IOException("Simulated failure"));
        var response = productMultipart(seller, "POST", "/api/seller/products", product("Failure", "10", 1), UploadServiceTests.PNG, 1, List.of());
        assertEquals(502, response.statusCode(), response.body());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM products", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
        verify(uploader).destroy(eq("test/new-cover"), anyMap());
    }

    @Test void failedMultipartEditPreservesOriginalProductAndPhotos() throws Exception {
        var seller = login("products-seller@example.invalid");
        var created = productMultipart(seller, "POST", "/api/seller/products", product("Original", "10", 1), UploadServiceTests.PNG, 1, List.of());
        var record = json.readTree(created.body()).get("Record"); long id = record.get("id").asLong();
        String cover = record.get("coverImageUrl").asString(); long detailId = record.get("detailImages").get(0).get("id").asLong();
        when(uploader.upload(any(), anyMap())).thenReturn(Map.of("public_id", "test/replacement", "secure_url", "https://res.cloudinary.com/test/replacement.png"))
                .thenThrow(new IOException("Simulated failure"));
        var response = productMultipart(seller, "PUT", "/api/seller/products/" + id, product("Uncommitted edit", "20", 2), UploadServiceTests.PNG, 1, List.of(detailId));
        assertEquals(502, response.statusCode(), response.body());
        assertEquals("Original", jdbc.queryForObject("SELECT title FROM products WHERE id=?", String.class, id));
        assertEquals(cover, jdbc.queryForObject("SELECT cover_image_url FROM products WHERE id=?", String.class, id));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM product_images WHERE product_id=?", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM product_images WHERE id=?", Integer.class, detailId));
        verify(uploader).destroy(eq("test/replacement"), anyMap());
    }

    @Test void multipartEditCannotUseAnotherSellersProductOrAnotherProductsImage() throws Exception {
        var seller = login("products-seller@example.invalid"); var other = login("products-other@example.invalid");
        long ownId = create(seller, product("Owned", "10", 1));
        upload(seller, ownId, 2, UploadServiceTests.PNG, "image/png", true);
        var foreign = productMultipart(other, "PUT", "/api/seller/products/" + ownId, product("Unauthorized", "20", 2), UploadServiceTests.PNG, 0, List.of());
        assertEquals(404, foreign.statusCode());
        long second = create(seller, product("Second", "10", 1)); upload(seller, second, 2, UploadServiceTests.PNG, "image/png", true);
        long foreignDetail = jdbc.queryForObject("SELECT id FROM product_images WHERE product_id=? AND image_type='DETAIL'", Long.class, second);
        var response = productMultipart(seller, "PUT", "/api/seller/products/" + ownId, product("Unauthorized removal", "20", 2), null, 0, List.of(foreignDetail));
        assertEquals(404, response.statusCode(), response.body());
        assertEquals("Owned", jdbc.queryForObject("SELECT title FROM products WHERE id=?", String.class, ownId));
        verify(uploader, times(4)).upload(any(), anyMap());
    }

    @Test void multipartDatabaseFailureRollsBackProductAndRemovesTheNewCloudAsset() throws Exception {
        var seller = login("products-seller@example.invalid");
        jdbc.execute("CREATE TRIGGER test_image_insert_failure BEFORE INSERT ON product_images FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Forced test failure'");
        try {
            var response = productMultipart(seller, "POST", "/api/seller/products", product("DB failure", "10", 1), UploadServiceTests.PNG, 0, List.of());
            assertEquals(500, response.statusCode(), response.body());
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM products", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
            verify(uploader).destroy(contains("comicworm/products/92001/"), anyMap());
        } finally { jdbc.execute("DROP TRIGGER test_image_insert_failure"); }
    }

    @Test void cloudinaryLinksPersistAndCanBeViewedAndRemovedWithTheirFeatureRows() throws Exception {
        var seller = login("products-seller@example.invalid");
        long id = create(seller, product("Ảnh sản phẩm", "10", 1));
        jdbc.update("UPDATE products SET moderation_status='APPROVED' WHERE id=?", id);
        var response = upload(seller, id, 2, UploadServiceTests.PNG, "image/png", true);
        assertEquals(200, response.statusCode(), response.body());
        var records = json.readTree(response.body()).get("Records"); assertEquals(2, records.size());
        var urls = jdbc.queryForList("SELECT image_url FROM product_images WHERE product_id=? ORDER BY display_order", String.class, id);
        assertEquals(records.get(0).get("imageUrl").asString(), urls.get(0));
        assertEquals(records.get(1).get("imageUrl").asString(), urls.get(1));
        assertEquals(List.of(0, 1), jdbc.queryForList("SELECT display_order FROM product_images WHERE product_id=? ORDER BY display_order", Integer.class, id));
        assertEquals("PENDING", jdbc.queryForObject("SELECT moderation_status FROM products WHERE id=?", String.class, id));
        assertEquals(2, json.readTree(get(seller, "/api/seller/products/" + id).body()).get("Record").get("images").size());
        assertEquals(urls.getFirst(), json.readTree(get(seller, "/api/seller/products").body()).get("Records").get(0).get("images").get(0).get("imageUrl").asString());
        long imageId = records.get(0).get("id").asLong();
        jdbc.update("INSERT INTO product_image_features(image_id,embedding,model_name) VALUES(?,'[0.1,0.2]','test')", imageId);
        var removed = mutate(seller, "DELETE", "/api/seller/products/" + id + "/images/" + imageId, null, true);
        assertEquals(200, removed.statusCode(), removed.body());
        assertEquals(urls.get(1), json.readTree(removed.body()).get("Records").get(0).get("imageUrl").asString());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_image_features WHERE image_id=?", Integer.class, imageId));
        verify(uploader, never()).destroy(anyString(), anyMap());
        mutate(seller, "DELETE", "/api/seller/products/" + id, null, true);
        assertEquals(404, get(seller, "/api/seller/products/" + id + "/images").statusCode());
        assertEquals(404, upload(seller, id, 1, UploadServiceTests.PNG, "image/png", true).statusCode());
    }

    @Test void imageEndpointsEnforceSellerOwnershipAndCsrfBeforeUploading() throws Exception {
        var seller = login("products-seller@example.invalid");
        long id = create(seller, product("Owner", "10", 1));
        var other = login("products-other@example.invalid"); var buyer = login("products-buyer@example.invalid");
        assertEquals(401, get(HttpClient.newHttpClient(), "/api/seller/products/" + id + "/images").statusCode());
        assertEquals(403, get(buyer, "/api/seller/products/" + id + "/images").statusCode());
        assertEquals(404, get(other, "/api/seller/products/" + id + "/images").statusCode());
        assertEquals(404, upload(other, id, 1, UploadServiceTests.PNG, "image/png", true).statusCode());
        assertEquals(403, upload(seller, id, 1, UploadServiceTests.PNG, "image/png", false).statusCode());
        upload(seller, id, 1, UploadServiceTests.PNG, "image/png", true);
        long imageId = jdbc.queryForObject("SELECT id FROM product_images WHERE product_id=?", Long.class, id);
        assertEquals(404, mutate(other, "DELETE", "/api/seller/products/" + id + "/images/" + imageId, null, true).statusCode());
        long secondId = create(seller, product("Second", "10", 1));
        assertEquals(404, mutate(seller, "DELETE", "/api/seller/products/" + secondId + "/images/" + imageId, null, true).statusCode());
        verify(uploader, times(1)).upload(any(), anyMap());
    }

    @Test void badFilesAndExcessImagesAreRejectedWithoutSavingLinks() throws Exception {
        var seller = login("products-seller@example.invalid"); long id = create(seller, product("Limits", "10", 1));
        for (var response : List.of(upload(seller, id, 1, "not a real image".getBytes(), "image/png", true),
                upload(seller, id, 1, UploadServiceTests.PNG, "text/plain", true),
                upload(seller, id, 1, new byte[0], "image/png", true),
                upload(seller, id, 9, UploadServiceTests.PNG, "image/png", true))) {
            assertEquals(400, response.statusCode(), response.body());
        }
        assertEquals(413, upload(seller, id, 1, new byte[6 * 1024 * 1024], "image/png", true).statusCode());
        verify(uploader, never()).upload(any(), anyMap());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
        assertEquals(200, upload(seller, id, 8, UploadServiceTests.PNG, "image/png", true).statusCode());
        assertEquals(400, upload(seller, id, 1, UploadServiceTests.PNG, "image/png", true).statusCode());
        assertEquals(8, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
    }

    @Test void partialCloudinaryFailureCleansUpAndDoesNotSaveAnyLinks() throws Exception {
        var seller = login("products-seller@example.invalid"); long id = create(seller, product("Cloud failure", "10", 1));
        when(uploader.upload(any(), anyMap())).thenReturn(Map.of("public_id", "test/first", "secure_url", "https://res.cloudinary.com/test/first.png"))
                .thenThrow(new IOException("Simulated unavailable Cloudinary"));
        var response = upload(seller, id, 2, UploadServiceTests.PNG, "image/png", true);
        assertEquals(502, response.statusCode(), response.body());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
        verify(uploader).destroy(eq("test/first"), anyMap());
    }

    @Test void databaseFailureRollsBackRowsAndCleansUpTheNewCloudinaryAsset() throws Exception {
        var seller = login("products-seller@example.invalid"); long id = create(seller, product("Database failure", "10", 1));
        // fixtures() has verified that this is the disposable MySQL instance.
        jdbc.execute("CREATE TRIGGER test_image_insert_failure BEFORE INSERT ON product_images FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Forced test failure'");
        try {
            var response = upload(seller, id, 1, UploadServiceTests.PNG, "image/png", true);
            assertEquals(500, response.statusCode(), response.body());
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM product_images", Integer.class));
            verify(uploader).destroy(contains("comicworm/products/92001/" + id), anyMap());
        } finally { jdbc.execute("DROP TRIGGER test_image_insert_failure"); }
    }

    @Test void onlyUpgradedSellersCanReadOrWriteAndWritesNeedCsrf() throws Exception {
        assertEquals(401, get(HttpClient.newHttpClient(), "/api/seller/products").statusCode());
        var buyer = login("products-buyer@example.invalid");
        assertEquals(403, get(buyer, "/api/seller/products").statusCode());
        assertEquals(403, get(buyer, "/api/seller/products/options").statusCode());
        assertEquals(403, mutate(buyer, "POST", "/api/seller/products", product("Buyer", "10", 1), false).statusCode());
        var seller = login("products-seller@example.invalid");
        assertEquals(200, get(seller, "/seller/html/quan-ly-san-pham.html").statusCode());
        assertEquals(403, mutate(seller, "POST", "/api/seller/products", product("Missing CSRF", "10", 1), false).statusCode());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM products", Integer.class));
        assertEquals(200, get(seller, "/api/seller/products/options").statusCode());
    }

    @Test void createsReadsUpdatesAndSoftDeletesOnlyCurrentAccountProducts() throws Exception {
        var seller = login("products-seller@example.invalid");
        var body = product(" Truyện tiếng Việt — Tập 1 ", "65000.10", 3);
        body.put("sellerId", 92002); body.put("moderationStatus", "APPROVED"); body.put("deletedAt", "2026-01-01");
        long id = create(seller, body);
        assertEquals(92001L, jdbc.queryForObject("SELECT seller_id FROM products WHERE id=?", Long.class, id));
        assertEquals("PENDING", jdbc.queryForObject("SELECT moderation_status FROM products WHERE id=?", String.class, id));
        assertNull(jdbc.queryForObject("SELECT deleted_at FROM products WHERE id=?", java.sql.Timestamp.class, id));
        assertTrue(jdbc.queryForObject("SELECT LENGTH(slug) FROM products WHERE id=?", Integer.class, id) <= 255);
        var record = json.readTree(get(seller, "/api/seller/products/" + id).body()).get("Record");
        assertEquals("Truyện tiếng Việt — Tập 1", record.get("title").asString());
        assertEquals(new BigDecimal("65000.10"), jdbc.queryForObject("SELECT price FROM products WHERE id=?", BigDecimal.class, id));
        body.put("title", "Đã chỉnh sửa"); body.put("price", "1234.56"); body.put("stockQuantity", 0); body.put("isActive", false);
        assertEquals(200, mutate(seller, "PUT", "/api/seller/products/" + id, body, true).statusCode());
        record = json.readTree(get(seller, "/api/seller/products/" + id).body()).get("Record");
        assertEquals("Đã chỉnh sửa", record.get("title").asString()); assertEquals(0, record.get("stockQuantity").asInt());
        assertFalse(record.get("isActive").asBoolean());
        assertEquals(200, mutate(seller, "DELETE", "/api/seller/products/" + id, null, true).statusCode());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id=? AND deleted_at IS NOT NULL AND is_active=false", Integer.class, id));
        assertEquals(404, get(seller, "/api/seller/products/" + id).statusCode());
        assertEquals(0, json.readTree(get(seller, "/api/seller/products").body()).get("TotalRecordCount").asInt());
        assertEquals(404, mutate(seller, "PUT", "/api/seller/products/" + id, body, true).statusCode());
    }

    @Test void anotherShopCannotReadEditDeleteOrRequestTheOwnerScope() throws Exception {
        var owner = login("products-seller@example.invalid");
        var other = login("products-other@example.invalid");
        long id = create(owner, product("Owned product", "100", 5));
        for (String method : List.of("GET", "PUT", "DELETE")) {
            var response = method.equals("GET") ? get(other, "/api/seller/products/" + id)
                    : mutate(other, method, "/api/seller/products/" + id, method.equals("PUT") ? product("Stolen", "0", 0) : null, true);
            assertEquals(404, response.statusCode(), response.body());
            assertEquals("ERROR", json.readTree(response.body()).get("Result").asString());
        }
        var result = json.readTree(get(other, "/api/seller/products?sellerId=92001").body());
        assertEquals(0, result.get("TotalRecordCount").asInt());
        assertEquals(0, result.get("Summary").get("stockQuantity").asInt());
        assertEquals("Owned product", jdbc.queryForObject("SELECT title FROM products WHERE id=?", String.class, id));
    }

    @Test void invalidValuesAndForeignKeysAreRejectedWithoutPersistingRows() throws Exception {
        var seller = login("products-seller@example.invalid");
        Map<String, Object> invalid = Map.of("title", " ", "description", " ", "price", "-1", "stockQuantity", -1,
                "conditionPercent", 101, "categoryId", 0);
        for (var item : invalid.entrySet()) {
            var body = product("Invalid", "10", 1); body.put(item.getKey(), item.getValue());
            var response = mutate(seller, "POST", "/api/seller/products", body, true);
            assertEquals(400, response.statusCode(), item.getKey() + ": " + response.body());
            assertEquals("ERROR", json.readTree(response.body()).get("Result").asString());
        }
        for (String field : List.of("categoryId", "authorId", "publisherId")) {
            var body = product("Bad reference", "10", 1); body.put(field, 999999);
            assertEquals(400, mutate(seller, "POST", "/api/seller/products", body, true).statusCode());
        }
        var decimal = product("Too precise", "0.001", 1);
        assertEquals(400, mutate(seller, "POST", "/api/seller/products", decimal, true).statusCode());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM products", Integer.class));
    }

    @Test void pagingSortingFiltersLiteralSearchAndSummaryUseTheSameOwner() throws Exception {
        var seller = login("products-seller@example.invalid");
        var other = login("products-other@example.invalid");
        create(seller, product("Alpha 100%", "10.10", 0));
        create(seller, product("Beta_1", "20.20", 1));
        var gamma = product("Gamma", "30.30", 4); gamma.put("categoryId", secondCategory); create(seller, gamma);
        long deleted = create(seller, product("Deleted", "999", 500));
        mutate(seller, "DELETE", "/api/seller/products/" + deleted, null, true);
        create(other, product("Foreign", "999999", 500));
        var first = json.readTree(get(seller, "/api/seller/products?jtPageSize=2&jtSorting=price%20ASC").body());
        assertEquals(3, first.get("TotalRecordCount").asInt()); assertEquals(2, first.get("Records").size());
        assertEquals("Alpha 100%", first.get("Records").get(0).get("title").asString());
        var second = json.readTree(get(seller, "/api/seller/products?jtPageSize=2&jtStartIndex=2&jtSorting=price%20ASC").body());
        assertEquals("Gamma", second.get("Records").get(0).get("title").asString());
        var summary = first.get("Summary"); assertEquals(3, summary.get("productCount").asInt());
        assertEquals(5, summary.get("stockQuantity").asInt()); assertEquals(1, summary.get("lowStockCount").asInt());
        assertEquals(1, summary.get("outOfStockCount").asInt());
        assertEquals(0, new BigDecimal("141.40").compareTo(new BigDecimal(summary.get("inventoryValue").toString())));
        for (String filter : List.of("stock=out_of_stock", "stock=low_stock", "categoryId=" + secondCategory, "search=%25", "search=_")) {
            assertEquals(1, json.readTree(get(seller, "/api/seller/products?" + filter).body()).get("TotalRecordCount").asInt(), filter);
        }
        for (String bad : List.of("jtPageSize=0", "jtStartIndex=-1", "jtPageSize=101", "stock=invalid", "jtSorting=sellerId%20DESC", "jtSorting=price%20DESC%3BDELETE")) {
            assertEquals(400, get(seller, "/api/seller/products?" + bad).statusCode(), bad);
        }
    }

    @Test void deletingAnOrderedProductRetainsOrderSnapshotsAndRevenue() throws Exception {
        var seller = login("products-seller@example.invalid"); long id = create(seller, product("Ordered", "100", 1));
        jdbc.update("INSERT INTO checkout_batches(id,checkout_code,buyer_id,idempotency_key,total_amount,expires_at) VALUES(92001,'PRODUCT-TEST',92003,'product-test',100,'2026-12-31')");
        jdbc.update("""
            INSERT INTO orders(id,order_code,checkout_id,buyer_id,seller_id,subtotal_amount,shipping_fee,total_amount,
            recipient_name,recipient_phone,shipping_address,status,completed_at) VALUES
            (92001,'PRODUCT-ORDER',92001,92003,92001,100,0,100,'Test','0900000000','Test','COMPLETED','2026-10-02 00:00:00')
            """);
        jdbc.update("INSERT INTO order_items(id,order_id,product_id,product_title,condition_percent,unit_price,quantity) VALUES(92001,92001,?,'Snapshot title',95,100,1)", id);
        assertEquals(200, mutate(seller, "DELETE", "/api/seller/products/" + id, null, true).statusCode());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM order_items WHERE product_id=?", Integer.class, id));
        var report = get(seller, "/api/analytics/seller?from=2026-10-01&to=2026-10-03");
        assertEquals(200, report.statusCode(), report.body()); assertEquals(100, json.readTree(report.body()).get("revenue").asInt());
        assertTrue(report.body().contains("Snapshot title"));
    }
}
