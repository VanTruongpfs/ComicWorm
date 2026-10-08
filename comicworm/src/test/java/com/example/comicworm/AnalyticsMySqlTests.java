package com.example.comicworm;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;

/** Uses a disposable MySQL instance initialized by the test runner, never the user's data. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "spring.jpa.hibernate.ddl-auto=validate")
@EnabledIfEnvironmentVariable(named = "ANALYTICS_MYSQL_TEST", matches = "true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AnalyticsMySqlTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @LocalServerPort int port;
    final String password = "AnalyticsTest2026!";
    @BeforeAll void seedIsolatedFixtures() {
        String expectedData = System.getenv("ANALYTICS_MYSQL_DATADIR");
        assertNotNull(expectedData, "Provide the data directory of a disposable MySQL instance.");
        Path expected = Path.of(expectedData).toAbsolutePath().normalize();
        Path actual = Path.of(jdbc.queryForObject("SELECT @@datadir", String.class)).toAbsolutePath().normalize();
        assertEquals(expected, actual, "Refusing to seed a different MySQL instance.");
        assertTrue(expected.getParent().getFileName().toString().startsWith("comicworm-analytics-mysql-"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class), "Fixtures require an empty test database.");
        assertEquals("bookmooch_db_v3",jdbc.queryForObject("SELECT DATABASE()",String.class));
        String hash=passwords.encode(password);
        jdbc.update("INSERT INTO users(id,email,password_hash,full_name,role,is_seller) VALUES(91001,'analytics-admin@example.invalid',?,'Test Admin','ADMIN',false),(91002,'analytics-seller@example.invalid',?,'Test Seller','USER',true),(91003,'analytics-other@example.invalid',?,'Other Seller','USER',true),(91004,'analytics-buyer@example.invalid',?,'Test Buyer','USER',false)",hash,hash,hash,hash);
        Integer category=jdbc.queryForObject("SELECT MIN(id) FROM categories",Integer.class);
        jdbc.update("INSERT INTO products(id,seller_id,title,slug,description,category_id,condition_percent,price,stock_quantity) VALUES(91001,91002,'Truyện thử A','analytics-a','Test',?,98,999999,10),(91002,91002,'Truyện thử B','analytics-b','Test',?,98,888888,20),(91003,91003,'Truyện khác','analytics-c','Test',?,98,10000,5)",category,category,category);
        jdbc.update("INSERT INTO checkout_batches(id,checkout_code,buyer_id,idempotency_key,total_amount,expires_at) VALUES(91001,'ANALYTICS-TEST',91004,'analytics-test',1000000,'2026-10-31 00:00:00')");
        jdbc.update("""
            INSERT INTO orders(id,order_code,checkout_id,buyer_id,seller_id,subtotal_amount,shipping_fee,total_amount,recipient_name,recipient_phone,shipping_address,status,completed_at,created_at) VALUES
            (91001,'AT1',91001,91004,91002,130000,30000,160000,'Test','0900000000','Test','COMPLETED','2026-09-30 17:00:00','2026-09-29 00:00:00'),
            (91002,'AT2',91001,91004,91002,40000,30000,70000,'Test','0900000000','Test','COMPLETED','2026-10-03 16:59:59','2026-10-01 01:00:00'),
            (91003,'AT3',91001,91004,91003,50000,0,50000,'Test','0900000000','Test','COMPLETED','2026-10-02 00:00:00','2026-10-01 01:00:00'),
            (91004,'AT4',91001,91004,91002,1000000,0,1000000,'Test','0900000000','Test','CANCELLED',NULL,'2026-10-01 01:00:00'),
            (91005,'AT5',91001,91004,91002,80000,0,80000,'Test','0900000000','Test','COMPLETED','2026-10-03 17:00:00','2026-10-01 01:00:00'),
            (91006,'AT6',91001,91004,91002,100000,0,100000,'Test','0900000000','Test','SHIPPING',NULL,'2026-10-01 01:00:00')
            """);
        jdbc.update("""
            INSERT INTO order_items(id,order_id,product_id,product_title,condition_percent,unit_price,quantity) VALUES
            (91001,91001,91001,'Tên tại thời điểm mua A',98,65000,2),(91002,91002,91002,'Tên tại thời điểm mua B',98,40000,1),
            (91003,91003,91003,'Truyện khác',98,10000,5),(91004,91004,91001,'Truyện hủy',98,50000,20),
            (91005,91005,91001,'Sau khoảng chọn',98,80000,1),(91006,91006,91001,'Đang giao',98,100000,1)
            """);
        jdbc.update("INSERT INTO reviews(id,order_item_id,buyer_id,rating,content,created_at) VALUES(91001,91002,91004,5,'Test review','2026-10-02 00:00:00')");
    }
    HttpClient login(String email) throws Exception {
        HttpClient client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
        String body="email="+URLEncoder.encode(email,StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(password,StandardCharsets.UTF_8);
        var response=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/auth/login")).header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(302,response.statusCode(),response.body());
        return client;
    }
    HttpResponse<String> get(HttpClient client,String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).GET().build(),HttpResponse.BodyHandlers.ofString());
    }
    final String query="?from=2026-10-01&to=2026-10-03";
    @Test void actualSqlUsesVietnamDatesPaidPricesAndSellerIdentity() throws Exception {
        var response=get(login("analytics-seller@example.invalid"),"/api/analytics/seller"+query+"&sellerId=91003");
        assertEquals(200,response.statusCode(),response.body());
        assertTrue(response.body().contains("\"revenue\":170000"),response.body());
        assertTrue(response.body().contains("\"orders\":2"),response.body());
        assertTrue(response.body().contains("\"units\":3"),response.body());
        assertTrue(response.body().contains("\"sellerId\":\"91002\""),response.body());
        assertTrue(response.body().contains("Tên tại thời điểm mua A"));
        assertFalse(response.body().contains("Truyện khác"));
        assertTrue(response.body().contains("\"averageRating\":5"),response.body());
    }
    @Test void adminCanReadAllShopsAndRoles() throws Exception {
        var response=get(login("analytics-admin@example.invalid"),"/api/analytics/admin"+query);
        assertEquals(200,response.statusCode(),response.body());
        assertTrue(response.body().contains("\"revenue\":220000"),response.body());
        assertTrue(response.body().contains("\"units\":8"),response.body());
        assertTrue(response.body().contains("Quản trị viên"));
    }
    @Test void authenticationAndRolesAreEnforcedAtHttpBoundary() throws Exception {
        assertEquals(401,get(HttpClient.newHttpClient(),"/api/analytics/seller"+query).statusCode());
        assertEquals(403,get(login("analytics-buyer@example.invalid"),"/api/analytics/seller"+query).statusCode());
        assertEquals(403,get(login("analytics-seller@example.invalid"),"/api/analytics/admin"+query).statusCode());
    }
    @Test void invalidFiltersReturn400AndEmptyRangeRemainsZero() throws Exception {
        var seller=login("analytics-seller@example.invalid");
        assertEquals(400,get(seller,"/api/analytics/seller?from=2026-10-03&to=2026-10-01").statusCode());
        assertEquals(400,get(seller,"/api/analytics/seller"+query+"&grouping=unknown").statusCode());
        var empty=get(seller,"/api/analytics/seller?from=2030-01-01&to=2030-01-07");
        assertEquals(200,empty.statusCode()); assertTrue(empty.body().contains("\"revenue\":0")); assertTrue(empty.body().contains("\"products\":[]"));
    }
}
