package com.example.comicworm.service;

import com.example.comicworm.dto.response.CancelResultDTO;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.Refund;
import com.example.comicworm.model.enums.CancelActor;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentMethod;
import com.example.comicworm.model.enums.PaymentStatus;
import com.example.comicworm.model.enums.RefundStatus;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.RefundRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

@Service
@Profile("!preview")
@RequiredArgsConstructor
public class OrderCancellationService {

    private static final List<RefundStatus> RESERVED_REFUND_STATUSES =
            List.of(RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.SUCCEEDED);

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final ExchangeOrderLinkRepository exchangeOrderLinkRepository;
    private final OrderStatusService orderStatusService;
    private final PaymentAllocationRepository allocationRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final NotificationService notificationService;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public CancelResultDTO cancel(Long orderId, Long actorId, CancelActor actor, String reason) {
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));
        if (exchangeOrderLinkRepository.existsByOrderId(orderId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng trao đổi cần được hủy theo luồng riêng");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            validateCancelledOrderAccess(order, actor, actorId);
            return result(order);
        }
        if (order.getStatus() == OrderStatus.SHIPPING
                || order.getStatus() == OrderStatus.DELIVERED
                || order.getStatus() == OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể hủy đơn hàng đã giao hoặc hoàn tất");
        }

        validateActor(order, orderId, actorId, actor);
        String cleanReason = validateReason(reason, actor);
        orderStatusService.transition(order, OrderStatus.CANCELLED, actorId, cleanReason);
        order.setCancelledAt(LocalDateTime.now());
        order.setCancelledBy(actor == CancelActor.SYSTEM ? null : actorId);
        order.setCancelReason(cleanReason);
        orderRepository.save(order);

        releaseStock(order);
        if (order.getPaymentStatus() == OrderPaymentStatus.PAID) {
            createRefunds(order);
        }
        cancelPendingCodPayments(order);
        notifyCancellation(order, actor, cleanReason);
        return result(order);
    }

    private void validateActor(Order order, Long orderId, Long actorId, CancelActor actor) {
        if (actor == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền hủy đơn hàng");
        }
        switch (actor) {
            case BUYER -> {
                if (!order.getBuyerId().equals(actorId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không phải người mua của đơn hàng");
                }
                if (order.getStatus() != OrderStatus.WAITING_PAYMENT
                        && order.getStatus() != OrderStatus.WAITING_CONFIRM) {
                    throw conflictCancellation();
                }
            }
            case SELLER -> {
                if (!order.getSellerId().equals(actorId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không phải người bán của đơn hàng");
                }
                if (order.getStatus() != OrderStatus.WAITING_CONFIRM && order.getStatus() != OrderStatus.PACKING) {
                    throw conflictCancellation();
                }
            }
            case ADMIN -> {
                if (order.getStatus() != OrderStatus.WAITING_PAYMENT
                        && order.getStatus() != OrderStatus.WAITING_CONFIRM
                        && order.getStatus() != OrderStatus.PACKING) {
                    throw conflictCancellation();
                }
            }
            case SYSTEM -> {
                if (order.getStatus() != OrderStatus.WAITING_PAYMENT
                        || !orderRepository.existsByIdAndCheckout_ExpiresAtBefore(orderId, LocalDateTime.now())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ được tự hủy đơn thanh toán đã hết hạn");
                }
            }
        }
    }

    private void validateCancelledOrderAccess(Order order, CancelActor actor, Long actorId) {
        if ((actor == CancelActor.BUYER && order.getBuyerId().equals(actorId))
                || (actor == CancelActor.SELLER && order.getSellerId().equals(actorId))
                || actor == CancelActor.ADMIN
                || actor == CancelActor.SYSTEM) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem trạng thái hủy đơn này");
    }

    private String validateReason(String reason, CancelActor actor) {
        if (actor == CancelActor.SYSTEM) {
            return reason == null || reason.isBlank() ? "Hết hạn thanh toán" : reason.trim();
        }
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do hủy đơn");
        }
        String cleanReason = reason.trim();
        if (cleanReason.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lý do hủy đơn không được vượt quá 500 ký tự");
        }
        return cleanReason;
    }

    private void releaseStock(Order order) {
        if (order.getStockReleasedAt() != null) {
            return;
        }

        Map<Long, Integer> quantitiesByProduct = new TreeMap<>();
        for (OrderItem item : orderItemRepository.findByOrderId(order.getId())) {
            quantitiesByProduct.merge(item.getProductId(), item.getQuantity(), Math::addExact);
        }
        if (!quantitiesByProduct.isEmpty()) {
            List<Product> lockedProducts = productRepository.findAllByIdInForUpdate(quantitiesByProduct.keySet());
            if (lockedProducts.size() != quantitiesByProduct.size()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Không tìm thấy đầy đủ sản phẩm để hoàn kho");
            }
            for (Product product : lockedProducts) {
                product.setStockQuantity(Math.addExact(
                        product.getStockQuantity(), quantitiesByProduct.get(product.getId())));
            }
        }
        order.setStockReleasedAt(LocalDateTime.now());
    }

    private void createRefunds(Order order) {
        List<PaymentAllocation> allocations = allocationRepository.findByOrderId(order.getId()).stream()
                .sorted((left, right) -> left.getPaymentId().compareTo(right.getPaymentId()))
                .toList();
        for (PaymentAllocation allocation : allocations) {
            Payment payment = paymentRepository.findByIdForUpdate(allocation.getPaymentId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Không tìm thấy thanh toán"));
            if (payment.getMethod() == PaymentMethod.COD) {
                continue;
            }
            String idempotencyKey = "REFUND:ORDER:" + order.getId() + ":PAYMENT:" + allocation.getPaymentId();
            if (refundRepository.findByIdempotencyKey(idempotencyKey).isPresent()) {
                continue;
            }
            BigDecimal reservedAmount = refundRepository.sumReservedAmount(
                    order.getId(), allocation.getPaymentId(), RESERVED_REFUND_STATUSES);
            BigDecimal refundable = allocation.getAmount().subtract(reservedAmount);
            if (refundable.signum() <= 0) {
                continue;
            }

            Refund refund = new Refund();
            refund.setRefundCode("RF-" + UUID.randomUUID().toString().replace("-", ""));
            refund.setPaymentId(allocation.getPaymentId());
            refund.setOrderId(order.getId());
            refund.setAmount(refundable);
            refund.setStatus(RefundStatus.PENDING);
            refund.setIdempotencyKey(idempotencyKey);
            refundRepository.save(refund);
        }
    }

    private void cancelPendingCodPayments(Order order) {
        List<PaymentAllocation> allocations = allocationRepository.findByOrderId(order.getId()).stream()
                .sorted((left, right) -> left.getPaymentId().compareTo(right.getPaymentId()))
                .toList();
        for (Long paymentId : allocations.stream().map(PaymentAllocation::getPaymentId).distinct().toList()) {
            Payment payment = paymentRepository.findByIdForUpdate(paymentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Không tìm thấy thanh toán"));
            if (payment.getMethod() == PaymentMethod.COD
                    && payment.getStatus() == PaymentStatus.PENDING
                    && !allocationRepository.existsNonCancelledOrderByPaymentId(paymentId, OrderStatus.CANCELLED)) {
                payment.setStatus(PaymentStatus.CANCELLED);
            }
        }
    }

    private void notifyCancellation(Order order, CancelActor actor, String reason) {
        if (actor == CancelActor.BUYER) {
            notificationService.notify(
                    order.getSellerId(), order.getId(), "Đơn hàng đã bị hủy",
                    "Người mua đã hủy đơn hàng " + order.getOrderCode() + ".",
                    "ORDER_CANCELLED:" + order.getId() + ":" + order.getSellerId());
            return;
        }
        notificationService.notify(
                order.getBuyerId(), order.getId(), "Đơn hàng đã bị hủy",
                "Đơn hàng " + order.getOrderCode() + " đã bị hủy. Lý do: " + reason,
                "ORDER_CANCELLED:" + order.getId() + ":" + order.getBuyerId());
    }

    private CancelResultDTO result(Order order) {
        List<Refund> refunds = refundRepository.findByOrderId(order.getId());
        RefundStatus status = refunds.stream()
                .map(Refund::getStatus)
                .filter(refundStatus -> refundStatus == RefundStatus.PROCESSING)
                .findFirst()
                .orElseGet(() -> refunds.stream()
                        .map(Refund::getStatus)
                        .filter(refundStatus -> refundStatus == RefundStatus.PENDING)
                        .findFirst()
                        .orElseGet(() -> refunds.stream()
                                .map(Refund::getStatus)
                                .filter(refundStatus -> refundStatus == RefundStatus.SUCCEEDED)
                                .findFirst()
                                .orElseGet(() -> refunds.stream().findFirst().map(Refund::getStatus).orElse(null))));
        return new CancelResultDTO(order.getId(), order.getStatus(), order.getPaymentStatus(), status);
    }

    private ResponseStatusException conflictCancellation() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng không ở trạng thái được phép hủy");
    }
}
