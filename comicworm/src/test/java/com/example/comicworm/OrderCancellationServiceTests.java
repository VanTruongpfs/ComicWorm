package com.example.comicworm;

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
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.OrderCancellationService;
import com.example.comicworm.service.OrderStatusService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OrderCancellationServiceTests {

    private OrderRepository orderRepository;
    private OrderItemRepository orderItemRepository;
    private ProductRepository productRepository;
    private ExchangeOrderLinkRepository exchangeOrderLinkRepository;
    private OrderStatusService orderStatusService;
    private PaymentAllocationRepository allocationRepository;
    private PaymentRepository paymentRepository;
    private RefundRepository refundRepository;
    private NotificationService notificationService;
    private OrderCancellationService service;
    private Order order;
    private Product product;
    private final List<Refund> savedRefunds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        savedRefunds.clear();
        orderRepository = mock(OrderRepository.class);
        orderItemRepository = mock(OrderItemRepository.class);
        productRepository = mock(ProductRepository.class);
        exchangeOrderLinkRepository = mock(ExchangeOrderLinkRepository.class);
        orderStatusService = mock(OrderStatusService.class);
        allocationRepository = mock(PaymentAllocationRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        refundRepository = mock(RefundRepository.class);
        notificationService = mock(NotificationService.class);
        service = new OrderCancellationService(orderRepository, orderItemRepository, productRepository,
                exchangeOrderLinkRepository, orderStatusService, allocationRepository,
                paymentRepository, refundRepository, notificationService);

        order = order(OrderStatus.WAITING_PAYMENT, OrderPaymentStatus.PENDING);
        product = new Product();
        product.setId(20L);
        product.setStockQuantity(4);
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        when(exchangeOrderLinkRepository.existsByOrderId(10L)).thenReturn(false);
        when(orderItemRepository.findByOrderId(10L)).thenReturn(List.of(item(20L, 2)));
        when(productRepository.findAllByIdInForUpdate(anyCollection())).thenReturn(List.of(product));
        doAnswer(invocation -> {
            Order current = invocation.getArgument(0);
            current.setStatus(invocation.getArgument(1));
            return null;
        }).when(orderStatusService).transition(any(Order.class), any(OrderStatus.class), any(), any());
        when(refundRepository.findByOrderId(10L)).thenAnswer(invocation -> List.copyOf(savedRefunds));
        when(refundRepository.save(any(Refund.class))).thenAnswer(invocation -> {
            Refund refund = invocation.getArgument(0);
            savedRefunds.add(refund);
            return refund;
        });
        when(allocationRepository.findByOrderId(10L)).thenReturn(List.of());
    }

    @Test
    void cancelsByBuyerAndReleasesStockOnlyOnceOnRepeatedCall() {
        var first = service.cancel(10L, 1L, CancelActor.BUYER, "Đặt nhầm");
        var second = service.cancel(10L, 1L, CancelActor.BUYER, "Đặt nhầm");

        assertEquals(OrderStatus.CANCELLED, first.status());
        assertEquals(first, second);
        assertEquals(6, product.getStockQuantity());
        assertNotNull(order.getStockReleasedAt());
        assertEquals(1L, order.getCancelledBy());
        verify(productRepository, times(1)).findAllByIdInForUpdate(anyCollection());
        verify(orderStatusService, times(1)).transition(order, OrderStatus.CANCELLED, 1L, "Đặt nhầm");
        verify(notificationService, times(1)).notify(
                2L, 10L, "Đơn hàng đã bị hủy", "Người mua đã hủy đơn hàng ORD-10.",
                "ORDER_CANCELLED:10:2");
    }

    @Test
    void rejectsWrongOwnerAndDisallowedStatuses() {
        ResponseStatusException wrongBuyer = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, 99L, CancelActor.BUYER, "Hủy"));
        assertEquals(HttpStatus.FORBIDDEN, wrongBuyer.getStatusCode());

        order.setStatus(OrderStatus.PACKING);
        ResponseStatusException buyerStatus = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, 1L, CancelActor.BUYER, "Hủy"));
        assertEquals(HttpStatus.CONFLICT, buyerStatus.getStatusCode());

        order.setStatus(OrderStatus.SHIPPING);
        ResponseStatusException shipped = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, 2L, CancelActor.SELLER, "Hủy"));
        assertEquals(HttpStatus.CONFLICT, shipped.getStatusCode());
        verifyNoInteractions(orderStatusService, notificationService);
    }

    @Test
    void checksCancellationPermissionsAcrossRolesAndStatuses() {
        for (OrderStatus status : List.of(
                OrderStatus.WAITING_PAYMENT, OrderStatus.WAITING_CONFIRM,
                OrderStatus.PACKING, OrderStatus.SHIPPING,
                OrderStatus.DELIVERED, OrderStatus.COMPLETED)) {
            for (CancelActor actor : List.of(CancelActor.BUYER, CancelActor.SELLER, CancelActor.ADMIN)) {
                setUp();
                order.setStatus(status);
                Long actorId = switch (actor) {
                    case BUYER -> 1L;
                    case SELLER -> 2L;
                    case ADMIN -> 700L;
                    case SYSTEM -> null;
                };
                boolean allowed = switch (actor) {
                    case BUYER -> status == OrderStatus.WAITING_PAYMENT || status == OrderStatus.WAITING_CONFIRM;
                    case SELLER -> status == OrderStatus.WAITING_CONFIRM || status == OrderStatus.PACKING;
                    case ADMIN -> status == OrderStatus.WAITING_PAYMENT
                            || status == OrderStatus.WAITING_CONFIRM || status == OrderStatus.PACKING;
                    case SYSTEM -> false;
                };

                if (allowed) {
                    assertEquals(OrderStatus.CANCELLED,
                            service.cancel(10L, actorId, actor, "Được phép").status(),
                            actor + " should cancel " + status);
                } else {
                    ResponseStatusException error = assertThrows(ResponseStatusException.class,
                            () -> service.cancel(10L, actorId, actor, "Không được phép"),
                            actor + " should not cancel " + status);
                    assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
                }
            }
        }

        for (OrderStatus status : OrderStatus.values()) {
            setUp();
            order.setStatus(status);
            when(orderRepository.existsByIdAndCheckout_ExpiresAtBefore(eq(10L), any(LocalDateTime.class)))
                    .thenReturn(true);
            boolean allowed = status == OrderStatus.WAITING_PAYMENT;
            if (allowed) {
                assertEquals(OrderStatus.CANCELLED,
                        service.cancel(10L, null, CancelActor.SYSTEM, null).status());
                assertEquals("Hết hạn thanh toán", order.getCancelReason());
            } else if (status == OrderStatus.CANCELLED) {
                assertEquals(OrderStatus.CANCELLED,
                        service.cancel(10L, null, CancelActor.SYSTEM, null).status());
            } else {
                ResponseStatusException error = assertThrows(ResponseStatusException.class,
                        () -> service.cancel(10L, null, CancelActor.SYSTEM, null));
                assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
            }
        }
    }

    @Test
    void authorizesSellerAndAdminForTheirAllowedStatusRange() {
        order.setStatus(OrderStatus.WAITING_CONFIRM);
        service.cancel(10L, 2L, CancelActor.SELLER, "Không thể giao");
        assertEquals(2L, order.getCancelledBy());

        order = order(OrderStatus.PACKING, OrderPaymentStatus.PENDING);
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        service.cancel(10L, 700L, CancelActor.ADMIN, "Vi phạm chính sách");
        assertEquals(700L, order.getCancelledBy());
    }

    @Test
    void createsRefundOnlyForUnreservedAllocationAmount() {
        order.setPaymentStatus(OrderPaymentStatus.PAID);
        PaymentAllocation allocation = allocation(30L, 10L, "100.00");
        when(allocationRepository.findByOrderId(10L)).thenReturn(List.of(allocation));
        when(refundRepository.findByIdempotencyKey("REFUND:ORDER:10:PAYMENT:30")).thenReturn(Optional.empty());
        when(refundRepository.sumReservedAmount(10L, 30L,
                List.of(RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.SUCCEEDED)))
                .thenReturn(new BigDecimal("75.00"));
        when(paymentRepository.findByIdForUpdate(30L)).thenReturn(Optional.of(payment(PaymentMethod.VIETQR, PaymentStatus.SUCCEEDED)));
        when(allocationRepository.existsNonCancelledOrderByPaymentId(30L, OrderStatus.CANCELLED)).thenReturn(true);

        var result = service.cancel(10L, 1L, CancelActor.BUYER, "Đặt nhầm");

        assertEquals(RefundStatus.PENDING, result.refundStatus());
        verify(refundRepository).save(argThat(refund ->
                refund.getAmount().compareTo(new BigDecimal("25.00")) == 0
                        && refund.getStatus() == RefundStatus.PENDING
                        && refund.getIdempotencyKey().equals("REFUND:ORDER:10:PAYMENT:30")));
    }

    @Test
    void doesNotCreateRefundForCodAndCancelsPaymentWhenEveryAllocatedOrderIsCancelled() {
        order.setPaymentStatus(OrderPaymentStatus.PAID);
        Payment payment = payment(PaymentMethod.COD, PaymentStatus.PENDING);
        PaymentAllocation allocation = allocation(30L, 10L, "100.00");
        when(allocationRepository.findByOrderId(10L)).thenReturn(List.of(allocation));
        when(paymentRepository.findByIdForUpdate(30L)).thenReturn(Optional.of(payment));
        when(allocationRepository.existsNonCancelledOrderByPaymentId(30L, OrderStatus.CANCELLED)).thenReturn(false);
        when(refundRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(refundRepository.sumReservedAmount(anyLong(), anyLong(), anyList())).thenReturn(BigDecimal.ZERO);

        service.cancel(10L, 1L, CancelActor.BUYER, "Đổi ý");

        verify(refundRepository, never()).save(any(Refund.class));
        assertEquals(PaymentStatus.CANCELLED, payment.getStatus());
    }

    @Test
    void rejectsExchangeOrderAndInvalidReason() {
        when(exchangeOrderLinkRepository.existsByOrderId(10L)).thenReturn(true);
        ResponseStatusException exchange = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, 1L, CancelActor.BUYER, "Hủy"));
        assertEquals(HttpStatus.CONFLICT, exchange.getStatusCode());

        when(exchangeOrderLinkRepository.existsByOrderId(10L)).thenReturn(false);
        ResponseStatusException missingReason = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, 1L, CancelActor.BUYER, " "));
        assertEquals(HttpStatus.BAD_REQUEST, missingReason.getStatusCode());
        ResponseStatusException longReason = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, 1L, CancelActor.BUYER, "x".repeat(501)));
        assertEquals(HttpStatus.BAD_REQUEST, longReason.getStatusCode());
    }

    @Test
    void systemCanCancelOnlyAnExpiredWaitingPaymentOrder() {
        when(orderRepository.existsByIdAndCheckout_ExpiresAtBefore(eq(10L), any(LocalDateTime.class)))
                .thenReturn(false, true);
        ResponseStatusException notExpired = assertThrows(ResponseStatusException.class,
                () -> service.cancel(10L, null, CancelActor.SYSTEM, "Hết hạn thanh toán"));
        assertEquals(HttpStatus.CONFLICT, notExpired.getStatusCode());

        var result = service.cancel(10L, null, CancelActor.SYSTEM, "Hết hạn thanh toán");
        assertEquals(OrderStatus.CANCELLED, result.status());
        assertNull(order.getCancelledBy());
    }

    private Order order(OrderStatus status, OrderPaymentStatus paymentStatus) {
        Order value = new Order();
        value.setId(10L);
        value.setOrderCode("ORD-10");
        value.setBuyerId(1L);
        value.setSellerId(2L);
        value.setCheckoutId(40L);
        value.setStatus(status);
        value.setPaymentStatus(paymentStatus);
        return value;
    }

    private OrderItem item(Long productId, int quantity) {
        OrderItem item = new OrderItem();
        item.setOrderId(10L);
        item.setProductId(productId);
        item.setQuantity(quantity);
        return item;
    }

    private PaymentAllocation allocation(Long paymentId, Long orderId, String amount) {
        PaymentAllocation allocation = new PaymentAllocation();
        allocation.setPaymentId(paymentId);
        allocation.setOrderId(orderId);
        allocation.setAmount(new BigDecimal(amount));
        return allocation;
    }

    private Payment payment(PaymentMethod method, PaymentStatus status) {
        Payment payment = new Payment();
        payment.setId(30L);
        payment.setMethod(method);
        payment.setStatus(status);
        return payment;
    }
}
