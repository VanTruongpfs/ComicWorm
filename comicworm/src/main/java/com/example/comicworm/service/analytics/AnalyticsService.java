package com.example.comicworm.service.analytics;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
@Profile("!preview")
public class AnalyticsService {
    private final NamedParameterJdbcTemplate jdbc;
    public AnalyticsService(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> report(LocalDate from, LocalDate to, String grouping, Long sellerId, String sellerName) {
        // Validate before running any database queries.
        AnalyticsReportBuilder.build(List.of(), from, to, grouping);
        ZoneId vietnam = ZoneId.of("Asia/Ho_Chi_Minh");
        Map<String, Object> params = new HashMap<>();
        params.put("from", Timestamp.from(from.atStartOfDay(vietnam).toInstant()));
        params.put("until", Timestamp.from(to.plusDays(1).atStartOfDay(vietnam).toInstant()));
        params.put("sellerId", sellerId);
        String scope = sellerId == null ? "" : " AND o.seller_id = :sellerId ";
        var lines = jdbc.query("""
            SELECT o.id AS order_id, o.seller_id, u.full_name AS seller_name,
              DATE_FORMAT(CONVERT_TZ(o.completed_at, '+00:00', '+07:00'), '%Y-%m-%d') AS completed_day,
              oi.product_id, oi.product_title, oi.unit_price, oi.quantity,
              COALESCE(c.name, 'Chưa phân loại') AS category, p.stock_quantity
            FROM orders o JOIN order_items oi ON oi.order_id = o.id
            JOIN users u ON u.id = o.seller_id
            LEFT JOIN products p ON p.id = oi.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE o.status = 'COMPLETED' AND o.completed_at >= :from AND o.completed_at < :until
            """ + scope + " ORDER BY o.completed_at, o.id, oi.id", params, (rs, rowNum) ->
            new AnalyticsReportBuilder.Line(rs.getLong("order_id"), rs.getLong("seller_id"), rs.getString("seller_name"),
                LocalDate.parse(rs.getString("completed_day")), rs.getLong("product_id"), rs.getString("product_title"),
                rs.getString("category"), rs.getBigDecimal("unit_price"), rs.getLong("quantity"), (Integer) rs.getObject("stock_quantity")));
        Map<String, Object> result = AnalyticsReportBuilder.build(lines, from, to, grouping);
        var states = jdbc.query("""
            SELECT o.status, COUNT(*) AS amount FROM orders o
            WHERE o.created_at >= :from AND o.created_at < :until
            """ + scope + " GROUP BY o.status ORDER BY o.status", params, (rs, i) -> {
                String status = rs.getString("status");
                String label = switch (status) {
                    case "WAITING_PAYMENT" -> "Chờ thanh toán"; case "WAITING_CONFIRM" -> "Chờ xác nhận";
                    case "PACKING" -> "Đang đóng gói"; case "SHIPPING" -> "Đang giao"; case "DELIVERED" -> "Đã giao";
                    case "COMPLETED" -> "Hoàn tất"; case "CANCELLED" -> "Đã hủy"; default -> status;
                };
                return Map.<String, Object>of("status", status, "label", label, "value", rs.getLong("amount"));
            });
        result.put("states", states);
        result.put("roles", sellerId == null ? jdbc.query("""
            SELECT role, COUNT(*) AS amount FROM users WHERE deleted_at IS NULL GROUP BY role ORDER BY role
            """, params, (rs, i) -> Map.of("label", "ADMIN".equals(rs.getString("role")) ? "Quản trị viên" : "Người dùng", "value", rs.getLong("amount"))) : List.of());
        result.put("sellerId", sellerId == null ? null : sellerId.toString());
        result.put("sellerName", sellerName == null ? "Tất cả người bán" : sellerName);
        if (sellerId != null) {
            var rating = jdbc.queryForMap("""
                SELECT COUNT(*) AS reviews, AVG(r.rating) AS averageRating
                FROM reviews r JOIN order_items oi ON oi.id = r.order_item_id JOIN orders o ON o.id = oi.order_id
                WHERE r.created_at >= :from AND r.created_at < :until
                """ + scope, params);
            result.put("rating", rating);
        }
        result.put("warnings", List.of("Chưa có dữ liệu chiến dịch và vùng giao hàng để phân bổ chi tiết.", "Phân khúc giá hiện tính theo giá thực bán."));
        return result;
    }
}
