package com.example.comicworm.service.impl;

import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.model.CheckoutBatch;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentStatus;
import com.example.comicworm.repository.CheckoutBatchRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.service.IPaymentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentServiceImpl implements IPaymentService {

    private final CheckoutBatchRepository checkoutBatchRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;

    public PaymentServiceImpl(
            CheckoutBatchRepository checkoutBatchRepository,
            OrderRepository orderRepository,
            PaymentRepository paymentRepository,
            PaymentAllocationRepository paymentAllocationRepository) {
        this.checkoutBatchRepository = checkoutBatchRepository;
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.paymentAllocationRepository = paymentAllocationRepository;
    }

    @Override
    @Transactional
    public Map<String, Object> processCheckoutPayment(String checkoutCode, Long buyerId, ProcessPaymentRequest request) {
        CheckoutBatch batch = checkoutBatchRepository.findByCheckoutCode(checkoutCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đợt checkout: " + checkoutCode));

        if (!batch.getBuyerId().equals(buyerId)) {
            throw new IllegalStateException("Bạn không có quyền thanh toán đợt hàng này");
        }

        List<Order> orders = orderRepository.findByCheckoutId(batch.getId());
        if (orders.isEmpty()) {
            throw new IllegalStateException("Đợt thanh toán không có đơn hàng nào");
        }

        boolean allPaid = orders.stream().allMatch(o -> o.getPaymentStatus() == OrderPaymentStatus.PAID);
        if (allPaid) {
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("message", "Đợt hàng này đã được xác nhận thanh toán trước đó");
            res.put("checkoutCode", checkoutCode);
            return res;
        }

        Payment payment = new Payment();
        payment.setCheckoutId(batch.getId());
        payment.setPaymentCode("PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        payment.setMethod(request != null && request.getMethod() != null ? request.getMethod() : com.example.comicworm.model.enums.PaymentMethod.VIETQR);
        payment.setStatus(PaymentStatus.SUCCEEDED);
        payment.setAmount(batch.getTotalAmount());
        payment.setIdempotencyKey(UUID.randomUUID().toString());
        payment.setPaidAt(LocalDateTime.now());
        Payment savedPayment = paymentRepository.save(payment);

        for (Order order : orders) {
            PaymentAllocation allocation = new PaymentAllocation();
            allocation.setPaymentId(savedPayment.getId());
            allocation.setOrderId(order.getId());
            allocation.setAmount(order.getTotalAmount());
            paymentAllocationRepository.save(allocation);

            order.setStatus(OrderStatus.WAITING_CONFIRM);
            order.setPaymentStatus(OrderPaymentStatus.PAID);
            orderRepository.save(order);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Thanh toán thành công");
        res.put("paymentCode", savedPayment.getPaymentCode());
        res.put("checkoutCode", checkoutCode);
        return res;
    }
}
