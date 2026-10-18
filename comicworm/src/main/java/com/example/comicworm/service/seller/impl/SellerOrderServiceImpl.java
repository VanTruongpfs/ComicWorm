package com.example.comicworm.service.seller.impl;

import com.example.comicworm.dto.response.*;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.OrderStatusHistoryRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.service.seller.ISellerOrderService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Profile("!preview")
@Transactional(readOnly = true)
public class SellerOrderServiceImpl implements ISellerOrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final ProductRepository productRepository;

    public SellerOrderServiceImpl(OrderRepository orderRepository,
                                  OrderItemRepository orderItemRepository,
                                  OrderStatusHistoryRepository orderStatusHistoryRepository,
                                  ProductRepository productRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.productRepository = productRepository;
    }

    @Override
    public Map<String, Object> listOrders(Long sellerId, String filter, String keyword, String sortStr, int page, int size) {
        if (size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kích thước trang từ 1 đến 100.");
        }
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số trang không được âm.");
        }

        String cleanKeyword = (keyword == null) ? "" : keyword.trim().toLowerCase(Locale.ROOT);

        Specification<Order> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("sellerId"), sellerId));

            // Xử lý bộ lọc filter
            if (filter != null && !filter.isBlank() && !"ALL".equalsIgnoreCase(filter.trim())) {
                String f = filter.trim().toLowerCase(Locale.ROOT);
                if ("processing".equals(f)) {
                    predicates.add(root.get("status").in(List.of(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING)));
                } else if ("shipping".equals(f)) {
                    predicates.add(cb.equal(root.get("status"), OrderStatus.SHIPPING));
                } else if ("completed".equals(f)) {
                    predicates.add(root.get("status").in(List.of(OrderStatus.DELIVERED, OrderStatus.COMPLETED)));
                } else if ("cancelled".equals(f)) {
                    predicates.add(cb.equal(root.get("status"), OrderStatus.CANCELLED));
                } else {
                    try {
                        OrderStatus target = OrderStatus.valueOf(filter.trim().toUpperCase(Locale.ROOT));
                        predicates.add(cb.equal(root.get("status"), target));
                    } catch (IllegalArgumentException ignored) {}
                }
            }

            // Xử lý từ khóa tìm kiếm
            if (!cleanKeyword.isBlank()) {
                String term = "%" + cleanKeyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                Predicate codeLike = cb.like(cb.lower(root.get("orderCode")), term, '\\');
                Predicate nameLike = cb.like(cb.lower(root.get("recipientName")), term, '\\');
                Predicate phoneLike = cb.like(cb.lower(root.get("recipientPhone")), term, '\\');

                try {
                    Long idVal = Long.parseLong(cleanKeyword);
                    predicates.add(cb.or(codeLike, nameLike, phoneLike, cb.equal(root.get("id"), idVal)));
                } catch (NumberFormatException ignored) {
                    predicates.add(cb.or(codeLike, nameLike, phoneLike));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        // Sắp xếp
        Sort sort;
        if ("oldest".equalsIgnoreCase(sortStr)) {
            sort = Sort.by(Sort.Direction.ASC, "createdAt", "id");
        } else if ("price-desc".equalsIgnoreCase(sortStr)) {
            sort = Sort.by(Sort.Direction.DESC, "totalAmount", "id");
        } else {
            sort = Sort.by(Sort.Direction.DESC, "createdAt", "id");
        }

        Page<Order> pageResult = orderRepository.findAll(spec, PageRequest.of(page, size, sort));

        List<Order> orders = pageResult.getContent();
        Map<Long, List<SellerOrderItemRecord>> itemsByOrderId;

        if (orders.isEmpty()) {
            itemsByOrderId = Collections.emptyMap();
        } else {
            List<Long> orderIds = orders.stream().map(Order::getId).toList();
            List<OrderItem> allItems = orderItemRepository.findByOrderIdIn(orderIds);
            itemsByOrderId = allItems.stream()
                    .collect(Collectors.groupingBy(
                            OrderItem::getOrderId,
                            Collectors.mapping(SellerOrderItemRecord::from, Collectors.toList())
                    ));
        }

        List<SellerOrderRecord> records = orders.stream()
                .map(o -> SellerOrderRecord.from(o, itemsByOrderId.getOrDefault(o.getId(), Collections.emptyList())))
                .toList();

        return Map.of(
                "Result", "OK",
                "Records", records,
                "TotalRecordCount", pageResult.getTotalElements(),
                "TotalPages", pageResult.getTotalPages(),
                "CurrentPage", page,
                "Stats", getStats(sellerId)
        );
    }

    @Override
    public SellerOrderStatsRecord getStats(Long sellerId) {
        BigDecimal pendingPayout = orderRepository.sumTotalAmountBySellerIdAndStatusIn(
                sellerId,
                List.of(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING, OrderStatus.SHIPPING)
        );
        if (pendingPayout == null) pendingPayout = BigDecimal.ZERO;

        long packingCount = orderRepository.countBySellerIdAndStatusIn(
                sellerId,
                List.of(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING)
        );
        long shippingCount = orderRepository.countBySellerIdAndStatus(sellerId, OrderStatus.SHIPPING);
        long completedCount = orderRepository.countBySellerIdAndStatusIn(
                sellerId,
                List.of(OrderStatus.DELIVERED, OrderStatus.COMPLETED)
        );
        long cancelledCount = orderRepository.countBySellerIdAndStatus(sellerId, OrderStatus.CANCELLED);
        long totalOrders = orderRepository.countBySellerId(sellerId);

        String rateStr = "100.0%";
        long decided = completedCount + cancelledCount;
        if (decided > 0) {
            double rate = ((double) completedCount / decided) * 100.0;
            rateStr = String.format(Locale.US, "%.1f%%", rate);
        }

        return new SellerOrderStatsRecord(pendingPayout, packingCount, shippingCount, rateStr, totalOrders);
    }

    @Override
    public SellerOrderDetailRecord getOrderDetail(Long sellerId, Long orderId) {
        Order order = findOwnedOrder(sellerId, orderId);
        List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
        List<SellerOrderItemRecord> itemRecords = items.stream().map(SellerOrderItemRecord::from).toList();

        List<OrderStatusHistory> histories = orderStatusHistoryRepository.findByOrderIdOrderByCreatedAtAsc(order.getId());
        List<SellerOrderStatusHistoryRecord> timeline = histories.stream().map(SellerOrderStatusHistoryRecord::from).toList();

        return new SellerOrderDetailRecord(SellerOrderRecord.from(order, itemRecords), timeline);
    }

    @Override
    @Transactional
    public SellerOrderDetailRecord updateStatus(Long sellerId, Long orderId, String newStatusStr, String note) {
        Order order = findOwnedOrder(sellerId, orderId);

        OrderStatus targetStatus;
        try {
            targetStatus = OrderStatus.valueOf(newStatusStr.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái đơn hàng không hợp lệ.");
        }

        OrderStatus currentStatus = order.getStatus();
        if (currentStatus == targetStatus) {
            return getOrderDetail(sellerId, orderId);
        }

        // Kiểm tra chuyển đổi hợp lệ
        if (currentStatus == OrderStatus.CANCELLED || currentStatus == OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn hàng đã kết thúc, không thể thay đổi trạng thái.");
        }

        order.setStatus(targetStatus);
        if (targetStatus == OrderStatus.COMPLETED) {
            order.setCompletedAt(LocalDateTime.now());
        }
        orderRepository.save(order);

        // Ghi log lịch sử
        OrderStatusHistory history = new OrderStatusHistory();
        history.setOrderId(order.getId());
        history.setPreviousStatus(currentStatus);
        history.setNewStatus(targetStatus);
        history.setChangedBy(sellerId);
        history.setNote(note != null && !note.isBlank() ? note.trim() : "Người bán chuyển trạng thái sang " + targetStatus);
        orderStatusHistoryRepository.save(history);

        return getOrderDetail(sellerId, orderId);
    }

    @Override
    @Transactional
    public SellerOrderDetailRecord cancelOrder(Long sellerId, Long orderId, String reason) {
        Order order = findOwnedOrder(sellerId, orderId);

        OrderStatus currentStatus = order.getStatus();
        if (currentStatus == OrderStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn hàng này đã bị hủy trước đó.");
        }
        if (currentStatus == OrderStatus.SHIPPING || currentStatus == OrderStatus.DELIVERED || currentStatus == OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể hủy đơn hàng đang giao hoặc đã hoàn tất.");
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledBy(sellerId);
        order.setCancelReason(reason != null ? reason.trim() : "Người bán hủy đơn");
        order.setCancelledAt(LocalDateTime.now());

        // Hoàn lại số lượng tồn kho (Idempotency check qua stockReleasedAt)
        if (order.getStockReleasedAt() == null) {
            List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
            for (OrderItem item : items) {
                if (item.getProductId() != null) {
                    productRepository.findById(item.getProductId()).ifPresent(p -> {
                        int restoredStock = (p.getStockQuantity() != null ? p.getStockQuantity() : 0) + item.getQuantity();
                        p.setStockQuantity(restoredStock);
                        productRepository.save(p);
                    });
                }
            }
            order.setStockReleasedAt(LocalDateTime.now());
        }

        orderRepository.save(order);

        // Ghi log lịch sử
        OrderStatusHistory history = new OrderStatusHistory();
        history.setOrderId(order.getId());
        history.setPreviousStatus(currentStatus);
        history.setNewStatus(OrderStatus.CANCELLED);
        history.setChangedBy(sellerId);
        history.setNote("Người bán hủy đơn. Lý do: " + order.getCancelReason());
        orderStatusHistoryRepository.save(history);

        return getOrderDetail(sellerId, orderId);
    }

    private Order findOwnedOrder(Long sellerId, Long orderId) {
        return orderRepository.findByIdAndSellerId(orderId, sellerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng #" + orderId + " thuộc quyền quản lý của bạn."));
    }
}

