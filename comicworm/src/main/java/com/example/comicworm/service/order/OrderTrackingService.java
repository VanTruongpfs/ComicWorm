package com.example.comicworm.service.order;

import com.example.comicworm.dto.response.OrderDTOs;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.OrderStatusHistoryRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.OrderCompletionService;
import com.example.comicworm.service.OrderStatusService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * T03 - Cập nhật trạng thái đơn hàng (ghi order_status_history).
 * B08 - Xem lịch sử mua hàng.
 * Quyền lấy từ người đăng nhập ở server: người mua chỉ XEM đơn của mình,
 * người bán xử lý đơn của mình đến bước đã giao; ADMIN quản lý toàn bộ đơn.
 */
@Service
public class OrderTrackingService {

    /** Nhóm trạng thái theo tab của giao diện. */
    private static final Map<String, Set<OrderStatus>> GROUPS = new LinkedHashMap<>();
    static {
        GROUPS.put("all", Set.of(OrderStatus.values()));
        GROUPS.put("pending", Set.of(OrderStatus.WAITING_PAYMENT));
        GROUPS.put("processing", Set.of(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING));
        GROUPS.put("shipping", Set.of(OrderStatus.SHIPPING, OrderStatus.DELIVERED));
        GROUPS.put("completed", Set.of(OrderStatus.COMPLETED));
        GROUPS.put("cancelled", Set.of(OrderStatus.CANCELLED));
    }

    /** Chỉ cho đi tiến từng bước. Hủy đơn/hoàn tiền thuộc chức năng T04. */
    private static final Map<OrderStatus, OrderStatus> NEXT = new EnumMap<>(OrderStatus.class);
    static {
        NEXT.put(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING);
        NEXT.put(OrderStatus.PACKING, OrderStatus.SHIPPING);
        NEXT.put(OrderStatus.SHIPPING, OrderStatus.DELIVERED);
        NEXT.put(OrderStatus.DELIVERED, OrderStatus.COMPLETED);
    }

    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final OrderStatusHistoryRepository histories;
    private final UserRepository users;
    private final OrderStatusService statusService;
    private final OrderCompletionService completionService;
    private final ExchangeOrderLinkRepository exchangeLinks;

    public OrderTrackingService(OrderRepository orders, OrderItemRepository items,
                                OrderStatusHistoryRepository histories, UserRepository users,
                                OrderStatusService statusService, OrderCompletionService completionService,
                                ExchangeOrderLinkRepository exchangeLinks) {
        this.orders = orders;
        this.items = items;
        this.histories = histories;
        this.users = users;
        this.statusService = statusService;
        this.completionService = completionService;
        this.exchangeLinks = exchangeLinks;
    }

    // ---------------------------------------------------------------- B08

    @Transactional(readOnly = true)
    public OrderDTOs.PageOf buyerHistory(Long buyerId, String group, String q, int page, int size) {
        Pageable pageable = pageable(page, size);
        Page<Order> result = orders.searchForBuyer(buyerId, statuses(group), pattern(q), pageable);
        Map<String, Long> counts = counts(orders.countByStatusForBuyer(buyerId));
        return toPage(result, counts, buyerId, false);
    }

    @Transactional(readOnly = true)
    public OrderDTOs.PageOf sellerOrders(Long sellerId, String group, String q, int page, int size, String sort) {
        Pageable pageable = sellerPageable(page, size, sort);
        Page<Order> result = orders.searchForSeller(sellerId, statuses(group), pattern(q), pageable);
        Map<String, Long> counts = counts(orders.countByStatusForSeller(sellerId));
        return toPage(result, counts, sellerId, false);
    }

    /** ADMIN: xem toàn bộ đơn của sàn. */
    @Transactional(readOnly = true)
    public OrderDTOs.PageOf adminOrders(String group, String q, int page, int size) {
        Page<Order> result = orders.searchForAdmin(statuses(group), pattern(q), pageable(page, size));
        return toPage(result, counts(orders.countByStatusAll()), null, true);
    }

    @Transactional(readOnly = true)
    public OrderDTOs.Detail detail(String orderCode, Long viewerId, boolean admin) {
        Order order = orders.findByOrderCode(orderCode).orElseThrow(OrderTrackingService::notFound);
        if (!canView(order, viewerId, admin)) {
            throw notFound(); // 404 thay vì 403 để không lộ việc đơn có tồn tại
        }
        OrderDTOs.Summary s = summaries(List.of(order), viewerId, admin).get(0);
        List<OrderStatusHistory> rows = histories.findByOrderIdOrderByCreatedAtAscIdAsc(order.getId());
        Map<Long, String> names = userNames(rows.stream().map(OrderStatusHistory::getChangedBy).toList());

        List<OrderDTOs.HistoryEntry> entries = new ArrayList<>();
        // Đơn tạo trước khi có ghi lịch sử: bổ sung dòng "Đặt hàng" từ createdAt.
        boolean hasCreation = rows.stream().anyMatch(r -> r.getPreviousStatus() == null);
        if (!hasCreation) {
            entries.add(new OrderDTOs.HistoryEntry(null, OrderStatus.WAITING_PAYMENT.name(),
                    names.get(order.getBuyerId()), "Đặt hàng", order.getCreatedAt()));
        }
        for (OrderStatusHistory r : rows) {
            entries.add(new OrderDTOs.HistoryEntry(
                    r.getPreviousStatus() == null ? null : r.getPreviousStatus().name(),
                    r.getNewStatus().name(),
                    r.getChangedBy() == null ? "Hệ thống" : names.getOrDefault(r.getChangedBy(), "Hệ thống"),
                    r.getNote(), r.getCreatedAt()));
        }
        String buyerName = users.findById(order.getBuyerId()).map(User::getFullName).orElse("");
        return new OrderDTOs.Detail(s, buyerName, order.getRecipientPhone(), order.getShippingAddress(),
                order.getBuyerNote(), order.getCancelReason(), entries);
    }

    // ---------------------------------------------------------------- T03

    @Transactional
    public OrderDTOs.Detail updateSellerStatus(String orderCode, Long sellerId, String target, String note) {
        Order order = orders.findByOrderCodeForUpdate(orderCode).orElseThrow(OrderTrackingService::notFound);
        if (!order.getSellerId().equals(sellerId)) throw notFound();
        if (exchangeLinks.existsByOrderId(order.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Vui lòng xử lý đơn trao đổi tại trang đơn hàng trao đổi.");
        }
        OrderStatus to = parse(target);
        if (to == OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Đơn hàng được hoàn tất khi người mua xác nhận đã nhận hàng.");
        }
        advance(order, sellerId, to, note);
        return detail(orderCode, sellerId, false);
    }

    @Transactional
    public OrderDTOs.Detail updateStatus(String orderCode, Long actorId, boolean admin, String target, String note) {
        if (!admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ quản trị viên mới được cập nhật trạng thái đơn hàng.");
        }
        OrderStatus to = parse(target);
        Order order = orders.findByOrderCodeForUpdate(orderCode).orElseThrow(OrderTrackingService::notFound);
        if (!canView(order, actorId, admin)) {
            throw notFound();
        }

        advance(order, actorId, to, note);
        return detail(orderCode, actorId, admin);
    }

    private void advance(Order order, Long actorId, OrderStatus to, String note) {
        OrderStatus from = order.getStatus();
        if (NEXT.get(from) != to) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể chuyển đơn từ \"" + label(from) + "\" sang \"" + label(to) + "\".");
        }

        String cleanNote = note == null ? null : note.trim();
        if (cleanNote != null && cleanNote.isEmpty()) cleanNote = null;
        if (cleanNote != null && cleanNote.length() > 500) cleanNote = cleanNote.substring(0, 500);

        if (to == OrderStatus.COMPLETED) {
            // Hoàn tất đi qua luồng sẵn có: tất toán COD, cộng điểm tích lũy, ghi lịch sử.
            completionService.complete(order.getId(), actorId);
        } else {
            // Kiểm tra bảng chuyển trạng thái chung và ghi order_status_history.
            statusService.transition(order, to, actorId, cleanNote);
            orders.save(order);
        }
    }

    /** Người bán được xác nhận, bàn giao và ghi nhận đã giao đơn của mình. */
    private String nextFor(Order order, Long viewerId, boolean admin, Set<Long> exchangeOrderIds) {
        OrderStatus next = NEXT.get(order.getStatus());
        if (next == null) return null;
        if (admin) return next.name();
        return order.getSellerId().equals(viewerId) && next != OrderStatus.COMPLETED
                && !exchangeOrderIds.contains(order.getId()) ? next.name() : null;
    }

    // ---------------------------------------------------------------- helpers

    private boolean canView(Order o, Long viewerId, boolean admin) {
        return admin || o.getBuyerId().equals(viewerId) || o.getSellerId().equals(viewerId);
    }

    private OrderDTOs.PageOf toPage(Page<Order> page, Map<String, Long> counts, Long viewerId, boolean admin) {
        return new OrderDTOs.PageOf(summaries(page.getContent(), viewerId, admin), page.getNumber(),
                page.getSize(), page.getTotalElements(), page.getTotalPages(), counts);
    }

    private List<OrderDTOs.Summary> summaries(List<Order> list, Long viewerId, boolean admin) {
        if (list.isEmpty()) return List.of();
        Set<Long> exchangeOrderIds = exchangeLinks.findByOrderIdIn(list.stream().map(Order::getId).toList())
                .stream().map(com.example.comicworm.model.ExchangeOrderLink::getOrderId).collect(Collectors.toSet());
        Map<Long, List<OrderItem>> byOrder = items.findByOrderIdIn(list.stream().map(Order::getId).toList())
                .stream().collect(Collectors.groupingBy(OrderItem::getOrderId));
        Map<Long, String> sellers = userNames(list.stream()
                .flatMap(o -> java.util.stream.Stream.of(o.getSellerId(), o.getBuyerId())).toList());
        List<OrderDTOs.Summary> out = new ArrayList<>();
        for (Order o : list) {
            List<OrderDTOs.Item> its = byOrder.getOrDefault(o.getId(), List.of()).stream()
                    .map(i -> new OrderDTOs.Item(i.getProductId(), i.getProductTitle(), i.getImageUrl(),
                            i.getConditionPercent(), i.getUnitPrice(), i.getQuantity(),
                            i.getUnitPrice().multiply(java.math.BigDecimal.valueOf(i.getQuantity()))))
                    .toList();
            out.add(new OrderDTOs.Summary(o.getOrderCode(), o.getStatus().name(), o.getPaymentStatus().name(),
                    o.getSellerId(), sellers.getOrDefault(o.getSellerId(), ""),
                    sellers.getOrDefault(o.getBuyerId(), ""), o.getRecipientName(),
                    o.getSubtotalAmount(), o.getShippingFee(), o.getTotalAmount(),
                    its.stream().mapToInt(OrderDTOs.Item::quantity).sum(), its,
                    o.getCreatedAt(), o.getCompletedAt(), nextFor(o, viewerId, admin, exchangeOrderIds)));
        }
        return out;
    }

    private Map<Long, String> userNames(Collection<Long> ids) {
        List<Long> clean = ids.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (clean.isEmpty()) return Map.of();
        return users.findAllById(clean).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getFullName() == null ? "" : u.getFullName(),
                        (a, b) -> a, HashMap::new));
    }

    private Map<String, Long> counts(List<Object[]> rows) {
        Map<OrderStatus, Long> raw = new EnumMap<>(OrderStatus.class);
        for (Object[] r : rows) raw.put((OrderStatus) r[0], ((Number) r[1]).longValue());
        Map<String, Long> out = new LinkedHashMap<>();
        GROUPS.forEach((k, set) -> out.put(k, set.stream().mapToLong(s -> raw.getOrDefault(s, 0L)).sum()));
        return out;
    }

    private Set<OrderStatus> statuses(String group) {
        Set<OrderStatus> s = GROUPS.get(group == null || group.isBlank() ? "all" : group.toLowerCase());
        if (s == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nhóm trạng thái không hợp lệ.");
        return s;
    }

    /** Thoát % _ ! để người dùng gõ ký tự đặc biệt không biến thành wildcard. */
    private String pattern(String q) {
        String t = q == null ? "" : q.trim().toLowerCase();
        if (t.length() > 100) t = t.substring(0, 100);
        t = t.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + t + "%";
    }

    private Pageable pageable(int page, int size) {
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), 50);
        return PageRequest.of(p, s, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    }

    private Pageable sellerPageable(int page, int size, String sort) {
        Sort ordering = switch (sort) {
            case "newest" -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            case "oldest" -> Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
            case "price-desc" -> Sort.by(Sort.Order.desc("totalAmount"), Sort.Order.desc("id"));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cách sắp xếp không hợp lệ.");
        };
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), ordering);
    }

    private OrderStatus parse(String value) {
        try {
            return OrderStatus.valueOf(value == null ? "" : value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ.");
        }
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng.");
    }

    public static String label(OrderStatus s) {
        return switch (s) {
            case WAITING_PAYMENT -> "Chờ thanh toán";
            case WAITING_CONFIRM -> "Chờ xác nhận";
            case PACKING -> "Đang đóng gói";
            case SHIPPING -> "Đang giao";
            case DELIVERED -> "Đã giao";
            case COMPLETED -> "Hoàn tất";
            case CANCELLED -> "Đã hủy";
        };
    }
}
