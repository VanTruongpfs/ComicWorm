package com.example.comicworm;

import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.model.CheckoutBatch;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentMethod;
import com.example.comicworm.repository.CheckoutBatchRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.service.OrderStatusService;
import com.example.comicworm.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PaymentExpiryTests {

    private CheckoutBatchRepository batchRepository;
    private OrderRepository orderRepository;
    private PaymentRepository paymentRepository;
    private PaymentAllocationRepository allocationRepository;
    private OrderStatusService orderStatusService;
    private PaymentServiceImpl service;

    @BeforeEach
    void setUp() {
        batchRepository = mock(CheckoutBatchRepository.class);
        orderRepository = mock(OrderRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        allocationRepository = mock(PaymentAllocationRepository.class);
        orderStatusService = mock(OrderStatusService.class);
        service = new PaymentServiceImpl(batchRepository, orderRepository, paymentRepository, allocationRepository);
        service.setOrderStatusService(orderStatusService);
    }

    @Test
    void rejectsExpiredCheckoutBatch() {
        configureBatch(LocalDateTime.now().minusSeconds(1));
        when(orderRepository.findByCheckoutIdForUpdate(10L)).thenReturn(List.of(order(OrderStatus.WAITING_PAYMENT)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class, this::pay);

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("Đơn hàng đã hết hạn hoặc đã bị hủy", error.getReason());
        verifyNoInteractions(paymentRepository, allocationRepository, orderStatusService);
    }

    @Test
    void rejectsOrderThatIsAlreadyCancelled() {
        configureBatch(LocalDateTime.now().plusHours(1));
        when(orderRepository.findByCheckoutIdForUpdate(10L)).thenReturn(List.of(order(OrderStatus.CANCELLED)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class, this::pay);

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("Đơn hàng đã hết hạn hoặc đã bị hủy", error.getReason());
        verifyNoInteractions(paymentRepository, allocationRepository, orderStatusService);
    }

    @Test
    void paysWaitingOrderAndRecordsStatusHistory() {
        configureBatch(LocalDateTime.now().plusHours(1));
        Order order = order(OrderStatus.WAITING_PAYMENT);
        when(orderRepository.findByCheckoutIdForUpdate(10L)).thenReturn(List.of(order));
        when(orderRepository.findByCheckoutId(10L)).thenReturn(List.of(order));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            payment.setId(20L);
            return payment;
        });

        assertDoesNotThrow(this::pay);

        assertEquals(OrderStatus.WAITING_CONFIRM, order.getStatus());
        assertEquals(OrderPaymentStatus.PENDING, order.getPaymentStatus());
        verify(orderStatusService).recordHistory(order, OrderStatus.WAITING_PAYMENT, 7L, "Thanh toán COD");
        verify(allocationRepository).save(any());
    }

    private void configureBatch(LocalDateTime expiresAt) {
        CheckoutBatch batch = new CheckoutBatch();
        batch.setId(10L);
        batch.setCheckoutCode("CHK-10");
        batch.setBuyerId(7L);
        batch.setExpiresAt(expiresAt);
        batch.setTotalAmount(new BigDecimal("1000.00"));
        when(batchRepository.findByCheckoutCode("CHK-10")).thenReturn(java.util.Optional.of(batch));
    }

    private Order order(OrderStatus status) {
        Order order = new Order();
        order.setId(15L);
        order.setCheckoutId(10L);
        order.setBuyerId(7L);
        order.setStatus(status);
        order.setTotalAmount(new BigDecimal("1000.00"));
        return order;
    }

    private void pay() {
        ProcessPaymentRequest request = new ProcessPaymentRequest();
        request.setMethod(PaymentMethod.COD);
        service.processCheckoutPayment("CHK-10", 7L, request);
    }
}
