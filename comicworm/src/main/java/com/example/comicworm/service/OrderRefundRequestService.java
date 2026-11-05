package com.example.comicworm.service;

import com.example.comicworm.dto.response.RefundRequestResultDTO;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.Refund;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.RefundRequestStatus;
import com.example.comicworm.model.enums.RefundStatus;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.OrderStatusHistoryRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.RefundRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * T04 - Yêu cầu hoàn tiền sau khi giao hàng (bản demo).
 * Người mua gửi một yêu cầu trong hạn N ngày (mặc định 7) kể từ lúc đơn được giao.
 * Người bán đồng ý thì đơn chuyển "Đã hoàn tiền" ngay, không chờ cổng thanh toán;
 * từ chối thì phải ghi lý do. Trạng thái giao hàng của đơn không đổi.
 */
@Service
public class OrderRefundRequestService {

    /** Các trạng thái đánh dấu hàng đã tới tay người mua. */
    public static final Set<OrderStatus> DELIVERED_STATUSES = Set.of(OrderStatus.DELIVERED, OrderStatus.COMPLETED);

    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository historyRepository;
    private final ExchangeOrderLinkRepository exchangeLinks;
    private final PaymentAllocationRepository allocationRepository;
    private final RefundRepository refundRepository;
    private final LoyaltyService loyaltyService;
    private final NotificationService notificationService;
    private final int refundDays;

    public OrderRefundRequestService(OrderRepository orderRepository,
                                     OrderStatusHistoryRepository historyRepository,
                                     ExchangeOrderLinkRepository exchangeLinks,
                                     PaymentAllocationRepository allocationRepository,
                                     RefundRepository refundRepository,
                                     LoyaltyService loyaltyService,
                                     NotificationService notificationService,
                                     @Value("${app.order.refund-request-days:7}") int refundDays) {
        this.orderRepository = orderRepository;
        this.historyRepository = historyRepository;
        this.exchangeLinks = exchangeLinks;
        this.allocationRepository = allocationRepository;
        this.refundRepository = refundRepository;
        this.loyaltyService = loyaltyService;
        this.notificationService = notificationService;
        this.refundDays = refundDays;
    }

    /**
     * Hạn cuối người mua được gửi yêu cầu hoàn tiền, hoặc null nếu đơn hiện không thể yêu cầu
     * (chưa giao, đơn trao đổi, đã có yêu cầu, đã hoàn tiền, hoặc đã quá hạn).
     */
    public static LocalDateTime eligibleUntil(Order order, LocalDateTime deliveredAt, boolean exchangeOrder,
                                              int refundDays, LocalDateTime now) {
        if (deliveredAt == null || exchangeOrder
                || !DELIVERED_STATUSES.contains(order.getStatus())
                || order.getRefundRequestStatus() != null
                || order.getPaymentStatus() == OrderPaymentStatus.REFUNDED
                || order.getPaymentStatus() == OrderPaymentStatus.PARTIALLY_REFUNDED) {
            return null;
        }
        LocalDateTime deadline = deliveredAt.plusDays(refundDays);
        return now.isAfter(deadline) ? null : deadline;
    }

    @Transactional
    public RefundRequestResultDTO request(String orderCode, Long buyerId, String reason) {
        Order order = lock(orderCode);
        if (!order.getBuyerId().equals(buyerId)) {
            throw notFound();
        }
        String cleanReason = cleanReason(reason, "Vui lòng nhập lý do yêu cầu hoàn tiền");
        if (order.getRefundRequestStatus() != null) {
            throw conflict("Đơn hàng này đã có yêu cầu hoàn tiền");
        }
        if (!DELIVERED_STATUSES.contains(order.getStatus())) {
            throw conflict("Chỉ yêu cầu hoàn tiền được khi đơn hàng đã giao thành công");
        }
        boolean exchangeOrder = exchangeLinks.existsByOrderId(order.getId());
        if (exchangeOrder) {
            throw conflict("Đơn hàng trao đổi không hỗ trợ yêu cầu hoàn tiền");
        }
        LocalDateTime deliveredAt = historyRepository.findFirstReachedAt(order.getId(), DELIVERED_STATUSES);
        if (eligibleUntil(order, deliveredAt, false, refundDays, LocalDateTime.now()) == null) {
            throw conflict("Đã quá hạn " + refundDays + " ngày kể từ khi giao hàng hoặc đơn đã được hoàn tiền");
        }

        order.setRefundRequestStatus(RefundRequestStatus.PENDING);
        order.setRefundRequestReason(cleanReason);
        order.setRefundRequestedAt(LocalDateTime.now());
        orderRepository.save(order);
        notificationService.notify(order.getSellerId(), order.getId(), "Yêu cầu hoàn tiền mới",
                "Người mua yêu cầu hoàn tiền đơn hàng " + order.getOrderCode() + ". Lý do: " + cleanReason,
                "REFUND_REQUESTED:" + order.getId() + ":" + order.getSellerId());
        return result(order);
    }

    @Transactional
    public RefundRequestResultDTO approve(String orderCode, Long sellerId) {
        Order order = lockPendingForSeller(orderCode, sellerId);
        LocalDateTime now = LocalDateTime.now();

        // Demo: ghi nhận hoàn tiền thành công ngay trên từng khoản thanh toán của đơn.
        List<PaymentAllocation> allocations = allocationRepository.findByOrderId(order.getId()).stream()
                .sorted(Comparator.comparing(PaymentAllocation::getPaymentId))
                .toList();
        for (PaymentAllocation allocation : allocations) {
            String idempotencyKey = "REFUND:RETURN:ORDER:" + order.getId() + ":PAYMENT:" + allocation.getPaymentId();
            if (allocation.getAmount() == null || allocation.getAmount().signum() <= 0
                    || refundRepository.findByIdempotencyKey(idempotencyKey).isPresent()) {
                continue;
            }
            Refund refund = new Refund();
            refund.setRefundCode("RF-" + UUID.randomUUID().toString().replace("-", ""));
            refund.setPaymentId(allocation.getPaymentId());
            refund.setOrderId(order.getId());
            refund.setAmount(allocation.getAmount());
            refund.setStatus(RefundStatus.SUCCEEDED);
            refund.setIdempotencyKey(idempotencyKey);
            refund.setProviderRefundId("DEMO-" + refund.getRefundCode());
            refund.setCompletedAt(now);
            Refund saved = refundRepository.save(refund);
            loyaltyService.reverseForRefund(order, saved.getId(), saved.getAmount());
        }
        // Hoàn toàn bộ tiền nên trả lại cả điểm người mua đã dùng cho đơn.
        loyaltyService.returnRedeemedPoints(order);

        order.setRefundRequestStatus(RefundRequestStatus.APPROVED);
        order.setRefundDecidedAt(now);
        order.setPaymentStatus(OrderPaymentStatus.REFUNDED);
        orderRepository.save(order);
        notificationService.notify(order.getBuyerId(), order.getId(), "Hoàn tiền thành công",
                "Người bán đã đồng ý hoàn tiền đơn hàng " + order.getOrderCode() + ".",
                "REFUND_REQUEST_APPROVED:" + order.getId() + ":" + order.getBuyerId());
        return result(order);
    }

    @Transactional
    public RefundRequestResultDTO reject(String orderCode, Long sellerId, String reason) {
        Order order = lockPendingForSeller(orderCode, sellerId);
        String cleanReason = cleanReason(reason, "Vui lòng nhập lý do từ chối hoàn tiền");

        order.setRefundRequestStatus(RefundRequestStatus.REJECTED);
        order.setRefundRejectReason(cleanReason);
        order.setRefundDecidedAt(LocalDateTime.now());
        orderRepository.save(order);
        notificationService.notify(order.getBuyerId(), order.getId(), "Yêu cầu hoàn tiền bị từ chối",
                "Người bán đã từ chối hoàn tiền đơn hàng " + order.getOrderCode() + ". Lý do: " + cleanReason,
                "REFUND_REQUEST_REJECTED:" + order.getId() + ":" + order.getBuyerId());
        return result(order);
    }

    private Order lockPendingForSeller(String orderCode, Long sellerId) {
        Order order = lock(orderCode);
        if (!order.getSellerId().equals(sellerId)) {
            throw notFound();
        }
        if (order.getRefundRequestStatus() != RefundRequestStatus.PENDING) {
            throw conflict("Đơn hàng không có yêu cầu hoàn tiền đang chờ xử lý");
        }
        return order;
    }

    private Order lock(String orderCode) {
        String code = orderCode == null ? "" : orderCode.trim();
        return orderRepository.findByOrderCodeForUpdate(code).orElseThrow(OrderRefundRequestService::notFound);
    }

    private static String cleanReason(String reason, String missingMessage) {
        String clean = reason == null ? "" : reason.trim();
        if (clean.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, missingMessage);
        }
        if (clean.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lý do không được vượt quá 500 ký tự");
        }
        return clean;
    }

    private static RefundRequestResultDTO result(Order order) {
        return new RefundRequestResultDTO(order.getOrderCode(), order.getRefundRequestStatus(), order.getPaymentStatus());
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng");
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
