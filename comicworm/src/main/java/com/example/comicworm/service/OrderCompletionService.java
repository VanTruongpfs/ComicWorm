package com.example.comicworm.service;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentMethod;
import com.example.comicworm.model.enums.PaymentStatus;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.OrderCompletionPaymentAllocationRepository;
import com.example.comicworm.repository.OrderCompletionPaymentRepository;
import com.example.comicworm.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderCompletionService {

    private final OrderRepository orderRepository;
    private final OrderCompletionPaymentAllocationRepository allocationRepository;
    private final OrderCompletionPaymentRepository paymentRepository;
    private final ExchangeOrderLinkRepository exchangeOrderLinkRepository;
    private final OrderStatusService orderStatusService;
    private final LoyaltyService loyaltyService;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Order complete(Long orderId, Long actorId) {
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));
        if (exchangeOrderLinkRepository.findByOrderId(orderId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng trao đổi cần được xác nhận theo luồng riêng");
        }
        if (order.getStatus() == OrderStatus.COMPLETED) {
            return order;
        }
        if (order.getStatus() != OrderStatus.SHIPPING && order.getStatus() != OrderStatus.DELIVERED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng chưa ở trạng thái có thể hoàn tất");
        }

        List<PaymentAllocation> orderAllocations = allocationRepository.findByOrderId(orderId).stream()
                .sorted(Comparator.comparing(PaymentAllocation::getPaymentId))
                .toList();
        if (order.getPaymentStatus() == OrderPaymentStatus.PENDING) {
            Long originalPaymentId = orderAllocations.stream()
                    .map(PaymentAllocation::getPaymentId)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT, "Không tìm thấy thanh toán gốc của đơn hàng"));
            Payment originalPayment = lockPayment(originalPaymentId);
            if (originalPayment.getMethod() != PaymentMethod.COD) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng chưa được thanh toán");
            }
            order.setPaymentStatus(OrderPaymentStatus.PAID);
        }

        orderStatusService.transition(order, OrderStatus.COMPLETED, actorId, "Xác nhận đã nhận hàng");
        settleCompletedCodPayments(orderAllocations);
        loyaltyService.earnForOrder(order);
        return order;
    }

    private void settleCompletedCodPayments(List<PaymentAllocation> orderAllocations) {
        for (Long paymentId : orderAllocations.stream()
                .map(PaymentAllocation::getPaymentId)
                .distinct()
                .toList()) {
            Payment payment = lockPayment(paymentId);
            if (payment.getMethod() != PaymentMethod.COD || payment.getStatus() != PaymentStatus.PENDING) {
                continue;
            }
            List<PaymentAllocation> paymentAllocations = allocationRepository.findByPaymentId(payment.getId());
            boolean allAllocatedOrdersPaid = paymentAllocations.stream()
                    .map(PaymentAllocation::getOrder)
                    .filter(allocatedOrder -> allocatedOrder.getStatus() != OrderStatus.CANCELLED)
                    .allMatch(allocatedOrder -> allocatedOrder.getPaymentStatus() == OrderPaymentStatus.PAID);
            if (allAllocatedOrdersPaid) {
                payment.setStatus(PaymentStatus.SUCCEEDED);
                payment.setPaidAt(LocalDateTime.now());
            }
        }
    }

    private Payment lockPayment(Long paymentId) {
        return paymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT, "Không tìm thấy thanh toán của đơn hàng"));
    }
}
