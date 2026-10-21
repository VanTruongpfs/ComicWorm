package com.example.comicworm.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** DTO cho xem lịch sử mua hàng (B08) và cập nhật trạng thái đơn hàng (T03). */
public final class OrderDTOs {
    private OrderDTOs() {}

    public record Item(Long productId, String title, String imageUrl, int conditionPercent,
                       BigDecimal unitPrice, int quantity, BigDecimal lineTotal) {}

    public record HistoryEntry(String previousStatus, String newStatus, String changedByName,
                               String note, LocalDateTime createdAt) {}

    /**
     * nextStatus: bước kế tiếp mà NGƯỜI ĐANG XEM được phép thực hiện. Chỉ ADMIN có giá trị,
     * người mua / người bán luôn là null (chỉ xem). Do server quyết định.
     */
    public record Summary(String orderCode, String status, String paymentStatus, Long sellerId,
                          String sellerName, String buyerName, String recipientName, BigDecimal subtotalAmount,
                          BigDecimal shippingFee, BigDecimal totalAmount, int itemCount,
                          List<Item> items, LocalDateTime createdAt, LocalDateTime completedAt,
                          String nextStatus) {}

    public record Detail(Summary summary, String buyerName, String recipientPhone, String shippingAddress,
                         String buyerNote, String cancelReason, List<HistoryEntry> history) {}

    public record PageOf(List<Summary> content, int page, int size, long totalElements, int totalPages,
                         Map<String, Long> counts) {}

    public record UpdateStatusRequest(String status, String note) {}
}
