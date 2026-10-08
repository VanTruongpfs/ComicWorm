package com.example.comicworm.service.analytics;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.time.DayOfWeek;
import java.util.*;

/** Builds reports from immutable prices/quantities in completed order items. */
public final class AnalyticsReportBuilder {
    private AnalyticsReportBuilder() {}
    public record Line(long orderId, long sellerId, String sellerName, LocalDate day,
                       long productId, String title, String category, BigDecimal price, long quantity,
                       Integer stockQuantity) {}
    private static final class Totals {
        BigDecimal revenue = BigDecimal.ZERO;
        long units;
        final Set<Long> orders = new HashSet<>();
        void add(Line line) {
            revenue = revenue.add(line.price().multiply(BigDecimal.valueOf(line.quantity())));
            units += line.quantity(); orders.add(line.orderId());
        }
    }
    private static LocalDate bucketKey(LocalDate date, String grouping) {
        return switch (grouping) {
            case "week" -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "month" -> date.withDayOfMonth(1);
            default -> date;
        };
    }
    private static String tier(BigDecimal price) {
        if (price.compareTo(BigDecimal.valueOf(50000)) < 0) return "Phổ thông (< 50.000 ₫)";
        if (price.compareTo(BigDecimal.valueOf(100000)) < 0) return "Tiêu chuẩn (50.000 – dưới 100.000 ₫)";
        if (price.compareTo(BigDecimal.valueOf(200000)) <= 0) return "Cao cấp (100.000 – 200.000 ₫)";
        return "Boxset (> 200.000 ₫)";
    }
    private static Map<String, Object> breakdown(String label, Totals total) {
        return Map.of("label", label, "value", total.revenue, "units", total.units, "orders", total.orders.size());
    }
    public static Map<String, Object> build(List<Line> lines, LocalDate from, LocalDate to, String grouping) {
        if (from == null || to == null || to.isBefore(from) || from.plusDays(3659).isBefore(to))
            throw new IllegalArgumentException("Vui lòng chọn khoảng ngày hợp lệ, tối đa 3.660 ngày.");
        if (!Set.of("day", "week", "month").contains(grouping))
            throw new IllegalArgumentException("Cách nhóm thời gian không hợp lệ.");
        Map<LocalDate, Totals> buckets = new LinkedHashMap<>();
        Map<LocalDate, LocalDate[]> bounds = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            LocalDate key = bucketKey(day, grouping);
            buckets.computeIfAbsent(key, ignored -> new Totals());
            if (!bounds.containsKey(key)) bounds.put(key, new LocalDate[]{day, day});
            else bounds.get(key)[1] = day;
        }
        Totals all = new Totals();
        Map<String, Totals> categories = new LinkedHashMap<>(), tiers = new LinkedHashMap<>(), products = new LinkedHashMap<>();
        Map<Long, Totals> sellers = new LinkedHashMap<>();
        Map<String, Line> productInfo = new HashMap<>();
        Map<Long, String> sellerNames = new HashMap<>();
        for (Line line : lines) {
            if (line.day().isBefore(from) || line.day().isAfter(to)) continue;
            all.add(line); buckets.get(bucketKey(line.day(), grouping)).add(line);
            categories.computeIfAbsent(line.category(), ignored -> new Totals()).add(line);
            tiers.computeIfAbsent(tier(line.price()), ignored -> new Totals()).add(line);
            sellers.computeIfAbsent(line.sellerId(), ignored -> new Totals()).add(line);
            sellerNames.put(line.sellerId(), line.sellerName());
            String key = line.sellerId() + ":" + line.productId();
            products.computeIfAbsent(key, ignored -> new Totals()).add(line); productInfo.put(key, line);
        }
        List<Map<String, Object>> series = new ArrayList<>(), productRows = new ArrayList<>();
        buckets.forEach((key, value) -> series.add(Map.of("key", key.toString(), "from", bounds.get(key)[0].toString(),
                "to", bounds.get(key)[1].toString(), "revenue", value.revenue, "units", value.units, "orders", value.orders.size())));
        products.forEach((key, value) -> {
            Line line = productInfo.get(key);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(line.productId())); row.put("title", line.title()); row.put("category", line.category());
            row.put("sellerId", String.valueOf(line.sellerId())); row.put("sellerName", line.sellerName());
            row.put("units", value.units); row.put("revenue", value.revenue); row.put("orders", value.orders.size());
            row.put("stockQuantity", line.stockQuantity()); productRows.add(row);
        });
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("revenue", all.revenue); report.put("units", all.units); report.put("orders", all.orders.size());
        report.put("average", all.orders.isEmpty() ? BigDecimal.ZERO : all.revenue.divide(BigDecimal.valueOf(all.orders.size()), 2, RoundingMode.HALF_UP));
        report.put("series", series); report.put("products", productRows);
        report.put("categories", categories.entrySet().stream().map(entry -> breakdown(entry.getKey(), entry.getValue())).toList());
        report.put("priceTiers", tiers.entrySet().stream().map(entry -> breakdown(entry.getKey(), entry.getValue())).toList());
        report.put("sellers", sellers.entrySet().stream().map(entry -> {
            Map<String, Object> row = new LinkedHashMap<>(breakdown(sellerNames.get(entry.getKey()), entry.getValue()));
            row.put("id", String.valueOf(entry.getKey())); return row;
        }).toList());
        // The existing schema has no campaign, cover-price, or normalized shipping-region snapshots.
        report.put("campaigns", all.orders.isEmpty() ? List.of() : List.of(breakdown("Không gắn chiến dịch", all)));
        report.put("regions", all.orders.isEmpty() ? List.of() : List.of(breakdown("Chưa xác định khu vực", all)));
        report.put("cities", all.orders.isEmpty() ? List.of() : List.of(breakdown("Chưa xác định tỉnh/thành", all)));
        report.put("unitsWithoutCoverPrice", all.units);
        report.put("source", "DATABASE"); report.put("from", from.toString()); report.put("to", to.toString()); report.put("grouping", grouping);
        return report;
    }
}
