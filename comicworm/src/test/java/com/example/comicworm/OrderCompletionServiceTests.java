package com.example.comicworm;

import com.example.comicworm.model.ExchangeOrderLink;
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
import com.example.comicworm.service.LoyaltyService;
import com.example.comicworm.service.OrderCompletionService;
import com.example.comicworm.service.OrderStatusService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OrderCompletionServiceTests {

    private OrderRepository orderRepository;
    private OrderCompletionPaymentAllocationRepository allocationRepository;
    private OrderCompletionPaymentRepository paymentRepository;
    private ExchangeOrderLinkRepository exchangeOrderLinkRepository;
    private OrderStatusService orderStatusService;
    private LoyaltyService loyaltyService;
    private OrderCompletionService service;
    private final Map<Long, Order> orders = new ConcurrentHashMap<>();
    private final Map<Long, Payment> payments = new ConcurrentHashMap<>();

    @BeforeEach
    void setUp() {
        orders.clear();
        payments.clear();
        orderRepository = mock(OrderRepository.class);
        allocationRepository = mock(OrderCompletionPaymentAllocationRepository.class);
        paymentRepository = mock(OrderCompletionPaymentRepository.class);
        exchangeOrderLinkRepository = mock(ExchangeOrderLinkRepository.class);
        orderStatusService = mock(OrderStatusService.class);
        loyaltyService = mock(LoyaltyService.class);
        service = new OrderCompletionService(orderRepository, allocationRepository, paymentRepository,
                exchangeOrderLinkRepository, orderStatusService, loyaltyService);

        when(orderRepository.findByIdForUpdate(any())).thenAnswer(invocation ->
                Optional.ofNullable(orders.get(invocation.getArgument(0))));
        when(exchangeOrderLinkRepository.findByOrderId(any())).thenReturn(Optional.empty());
        when(paymentRepository.findByIdForUpdate(any())).thenAnswer(invocation -> Optional.ofNullable(
                payments.get(invocation.getArgument(0))));
        doAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setStatus(invocation.getArgument(1));
            order.setCompletedAt(LocalDateTime.now());
            return null;
        }).when(orderStatusService).transition(any(Order.class), any(OrderStatus.class), any(), any());
    }

    @Test
    void completesSharedCodPaymentOnlyAfterEveryNonCancelledAllocatedOrderIsPaid() {
        Order first = order(1L, OrderStatus.SHIPPING, OrderPaymentStatus.PENDING);
        Order second = order(2L, OrderStatus.DELIVERED, OrderPaymentStatus.PENDING);
        orders.put(first.getId(), first);
        orders.put(second.getId(), second);
        Payment payment = payment(PaymentMethod.COD, PaymentStatus.PENDING);
        payments.put(payment.getId(), payment);
        PaymentAllocation firstAllocation = allocation(payment, first);
        PaymentAllocation secondAllocation = allocation(payment, second);
        when(allocationRepository.findByOrderId(1L)).thenReturn(List.of(firstAllocation));
        when(allocationRepository.findByOrderId(2L)).thenReturn(List.of(secondAllocation));
        when(allocationRepository.findByPaymentId(30L)).thenReturn(List.of(firstAllocation, secondAllocation));

        service.complete(1L, 8L);

        assertEquals(OrderPaymentStatus.PAID, first.getPaymentStatus());
        assertEquals(PaymentStatus.PENDING, payment.getStatus());
        assertEquals(new BigDecimal("40000.00"), payment.getAmount());
        verify(loyaltyService).earnForOrder(first);

        service.complete(2L, 8L);

        assertEquals(OrderPaymentStatus.PAID, second.getPaymentStatus());
        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        assertNotNull(payment.getPaidAt());
        assertEquals(new BigDecimal("40000.00"), payment.getAmount());
        verify(loyaltyService).earnForOrder(second);
    }

    @Test
    void completesPaidOnlineOrderWithoutChangingItsPayment() {
        Order order = order(3L, OrderStatus.DELIVERED, OrderPaymentStatus.PAID);
        orders.put(order.getId(), order);
        Payment payment = payment(PaymentMethod.VIETQR, PaymentStatus.SUCCEEDED);
        payments.put(payment.getId(), payment);
        PaymentAllocation allocation = allocation(payment, order);
        when(allocationRepository.findByOrderId(3L)).thenReturn(List.of(allocation));

        Order result = service.complete(3L, 8L);

        assertSame(order, result);
        assertEquals(OrderStatus.COMPLETED, order.getStatus());
        assertEquals(OrderPaymentStatus.PAID, order.getPaymentStatus());
        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        verify(orderStatusService).transition(order, OrderStatus.COMPLETED, 8L, "Xác nhận đã nhận hàng");
        verify(loyaltyService).earnForOrder(order);
    }

    @Test
    void completedOrderIsIdempotent() {
        Order order = order(4L, OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        orders.put(order.getId(), order);

        assertSame(order, service.complete(4L, 8L));

        verifyNoInteractions(orderStatusService, loyaltyService, allocationRepository);
    }

    @Test
    void rejectsPendingNonCodAndExchangeOrders() {
        Order onlineOrder = order(5L, OrderStatus.SHIPPING, OrderPaymentStatus.PENDING);
        orders.put(onlineOrder.getId(), onlineOrder);
        Payment onlinePayment = payment(PaymentMethod.VIETQR, PaymentStatus.PENDING);
        payments.put(onlinePayment.getId(), onlinePayment);
        when(allocationRepository.findByOrderId(5L)).thenReturn(List.of(allocation(onlinePayment, onlineOrder)));

        ResponseStatusException onlineError = assertThrows(ResponseStatusException.class,
                () -> service.complete(5L, 8L));
        assertEquals(HttpStatus.CONFLICT, onlineError.getStatusCode());
        assertEquals(OrderStatus.SHIPPING, onlineOrder.getStatus());

        Order exchangeOrder = order(6L, OrderStatus.DELIVERED, OrderPaymentStatus.PAID);
        orders.put(exchangeOrder.getId(), exchangeOrder);
        when(exchangeOrderLinkRepository.findByOrderId(6L)).thenReturn(Optional.of(new ExchangeOrderLink()));

        ResponseStatusException exchangeError = assertThrows(ResponseStatusException.class,
                () -> service.complete(6L, 8L));
        assertEquals(HttpStatus.CONFLICT, exchangeError.getStatusCode());
        verifyNoInteractions(loyaltyService);
    }

    private Order order(Long id, OrderStatus status, OrderPaymentStatus paymentStatus) {
        Order order = new Order();
        order.setId(id);
        order.setBuyerId(8L);
        order.setOrderCode("ORD-" + id);
        order.setStatus(status);
        order.setPaymentStatus(paymentStatus);
        order.setSubtotalAmount(new BigDecimal("25000.00"));
        order.setTotalAmount(new BigDecimal("30000.00"));
        return order;
    }

    private Payment payment(PaymentMethod method, PaymentStatus status) {
        Payment payment = new Payment();
        payment.setId(30L);
        payment.setMethod(method);
        payment.setStatus(status);
        payment.setAmount(new BigDecimal("40000.00"));
        return payment;
    }

    private PaymentAllocation allocation(Payment payment, Order order) {
        PaymentAllocation allocation = new PaymentAllocation();
        allocation.setPaymentId(payment.getId());
        allocation.setOrderId(order.getId());
        ReflectionTestUtils.setField(allocation, "payment", payment);
        ReflectionTestUtils.setField(allocation, "order", order);
        allocation.setAmount(order.getTotalAmount());
        return allocation;
    }
}
