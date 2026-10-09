package com.example.comicworm.utils;

import java.util.Locale;
import java.util.Optional;

/**
 * Nhóm tình trạng sách, suy ra từ products.condition_percent (0-100).
 * Dùng chung cho bộ lọc (khoảng %) và nhãn hiển thị.
 */
public enum ConditionGrade {
    NEW("Mới", 100, 100),
    LIKE_NEW("Like New", 96, 99),
    GOOD("Đã đọc", 90, 95),
    USED("Cũ", 0, 89);

    private final String label;
    private final int min;
    private final int max;

    ConditionGrade(String label, int min, int max) {
        this.label = label;
        this.min = min;
        this.max = max;
    }

    public int getMin() {
        return min;
    }

    public int getMax() {
        return max;
    }

    /** Nhãn hiển thị, ví dụ "Mới 100%", "Like New 99%". */
    public String labelFor(int percent) {
        return label + " " + percent + "%";
    }

    public static ConditionGrade fromPercent(int percent) {
        if (percent >= NEW.min) return NEW;
        if (percent >= LIKE_NEW.min) return LIKE_NEW;
        if (percent >= GOOD.min) return GOOD;
        return USED;
    }

    /** Nhận code từ query string: new | likenew | like_new | good | used (không phân biệt hoa thường). */
    public static Optional<ConditionGrade> parse(String code) {
        if (code == null) return Optional.empty();
        String c = code.trim().toUpperCase(Locale.ROOT).replace("-", "_");
        return switch (c) {
            case "NEW" -> Optional.of(NEW);
            case "LIKENEW", "LIKE_NEW" -> Optional.of(LIKE_NEW);
            case "GOOD" -> Optional.of(GOOD);
            case "USED" -> Optional.of(USED);
            default -> Optional.empty();
        };
    }
}
