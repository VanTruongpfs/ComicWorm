package com.example.comicworm;

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
import com.example.comicworm.service.LoyaltyService;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.OrderRefundRequestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OrderRefundRequestServiceTests {

    private static final Long BUYER = 1L;
    private static final Long SELLER = 2L;

    private OrderRepository orderRepository;
    private OrderStatusHistoryRepository historyRepository;
    private ExchangeOrderLinkRepository exchangeLinks;
    private PaymentAllocationRepository allocationRepository;
    private RefundRepository refundRepository;
    private LoyaltyService loyaltyService;
    private NotificationService notificationService;
    private OrderRefundRequestService service;
    private Order order;
    private final List<Refund> savedRefunds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        savedRefunds.clear();
        orderRepository = mock(OrderRepository.class);
        historyRepository = mock(OrderStatusHistoryRepository.class);
        exchangeLinks = mock(ExchangeOrderLinkRepository.class);
        allocationRepository = mock(PaymentAllocationRepository.class);
        refundRepository = mock(RefundRepository.class);
        loyaltyService = mock(LoyaltyService.class);
        notificationService = mock(NotificationService.class);
        service = new OrderRefundRequestService(orderRepository, historyRepository, exchangeLinks,
                allocationRepository, refundRepository, loyaltyService, notificationService, 7);

        order = new Order();
        order.setId(10L);
        order.setOrderCode("ORD-10");
        order.setBuyerId(BUYER);
        order.setSellerId(SELLER);
        order.setSubtotalAmount(new BigDecimal("100000"));
        order.setShippingFee(new BigDecimal("10000"));
        order.setTotalAmount(new BigDecimal("110000"));
        order.setStatus(OrderStatus.DELIVERED);
        order.setPaymentStatus(OrderPaymentStatus.PAID);

        when(orderRepository.findByOrderCodeForUpdate("ORD-10")).thenReturn(Optional.of(order));
        when(exchangeLinks.existsByOrderId(10L)).thenReturn(false);
        deliveredDaysAgo(2);
        PaymentAllocation allocation = new PaymentAllocation();
        allocation.setPaymentId(50L);
        allocation.setOrderId(10L);
        allocation.setAmount(new BigDecimal("110000"));
        when(allocationRepository.findByOrderId(10L)).thenReturn(List.of(allocation));
        when(refundRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(refundRepository.save(any(Refund.class))).thenAnswer(invocation -> {
            Refund refund = invocation.getArgument(0);
            refund.setId(900L + savedRefunds.size());
            savedRefunds.add(refund);
            return refund;
        });
    }

    private void deliveredDaysAgo(int days) {
        when(historyRepository.findFirstReachedAt(eq(10L), anyCollection()))
                .thenReturn(LocalDateTime.now().minusDays(days));
    }

    @Test
    void buyerRequestsRefundWithinSevenDaysAndSellerIsNotified() {
        var result = service.request("ORD-10", BUYER, "  Truyện bị rách bìa  ");

        assertEquals(RefundRequestStatus.PENDING, result.refundRequestStatus());
        assertEquals(RefundRequestStatus.PENDING, order.getRefundRequestStatus());
        assertEquals("Truyện bị rách bìa", order.getRefundRequestReason());
        assertNotNull(order.getRefundRequestedAt());
        verify(notificationService).notify(eq(SELLER), eq(10L), eq("Yêu cầu hoàn tiền mới"),
                contains("ORD-10"), eq("REFUND_REQUESTED:10:2"));
    }

    @Test
    void completedOrderCanAlsoRequestRefund() {
        order.setStatus(OrderStatus.COMPLETED);

        assertEquals(RefundRequestStatus.PENDING, service.request("ORD-10", BUYER, "Sai tập").refundRequestStatus());
    }

    @Test
    void rejectsRequestAfterSevenDays() {
        deliveredDaysAgo(8);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", BUYER, "Muộn"));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertNull(order.getRefundRequestStatus());
        verifyNoInteractions(notificationService);
    }

    @Test
    void rejectsRequestBeforeDelivery() {
        for (OrderStatus status : List.of(OrderStatus.WAITING_PAYMENT, OrderStatus.WAITING_CONFIRM,
                OrderStatus.PACKING, OrderStatus.SHIPPING, OrderStatus.CANCELLED)) {
            order.setStatus(status);
            ResponseStatusException error = assertThrows(ResponseStatusException.class,
                    () -> service.request("ORD-10", BUYER, "Lý do"), status.name());
            assertEquals(HttpStatus.CONFLICT, error.getStatusCode(), status.name());
        }
    }

    @Test
    void rejectsRequestWithoutDeliveryHistory() {
        when(historyRepository.findFirstReachedAt(eq(10L), anyCollection())).thenReturn(null);

        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", BUYER, "Lý do")).getStatusCode());
    }

    @Test
    void hidesOrderFromOtherBuyers() {
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", 99L, "Lý do")).getStatusCode());
    }

    @Test
    void allowsOnlyOneRequestPerOrder() {
        service.request("ORD-10", BUYER, "Lần một");

        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", BUYER, "Lần hai")).getStatusCode());
        assertEquals("Lần một", order.getRefundRequestReason());
    }

    @Test
    void rejectsExchangeOrdersAndInvalidReasons() {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", BUYER, "   ")).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", BUYER, "x".repeat(501))).getStatusCode());

        when(exchangeLinks.existsByOrderId(10L)).thenReturn(true);
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.request("ORD-10", BUYER, "Lý do")).getStatusCode());
    }

    @Test
    void sellerApprovalMarksOrderRefundedRecordsRefundAndReversesPoints() {
        service.request("ORD-10", BUYER, "Truyện bị rách");

        var result = service.approve("ORD-10", SELLER);

        assertEquals(RefundRequestStatus.APPROVED, result.refundRequestStatus());
        assertEquals(OrderPaymentStatus.REFUNDED, result.paymentStatus());
        assertEquals(OrderPaymentStatus.REFUNDED, order.getPaymentStatus());
        assertEquals(OrderStatus.DELIVERED, order.getStatus());
        assertNotNull(order.getRefundDecidedAt());
        assertEquals(1, savedRefunds.size());
        Refund refund = savedRefunds.get(0);
        assertEquals(RefundStatus.SUCCEEDED, refund.getStatus());
        assertEquals(0, new BigDecimal("110000").compareTo(refund.getAmount()));
        assertEquals(50L, refund.getPaymentId());
        assertEquals(10L, refund.getOrderId());
        assertEquals("REFUND:RETURN:ORDER:10:PAYMENT:50", refund.getIdempotencyKey());
        assertNotNull(refund.getCompletedAt());
        assertTrue(refund.getProviderRefundId().startsWith("DEMO-"));
        verify(loyaltyService).reverseForRefund(order, 900L, refund.getAmount());
        verify(loyaltyService).returnRedeemedPoints(order);
        verify(notificationService).notify(eq(BUYER), eq(10L), eq("Hoàn tiền thành công"),
                contains("ORD-10"), eq("REFUND_REQUEST_APPROVED:10:1"));
    }

    @Test
    void sellerRejectionNeedsReasonAndNotifiesBuyer() {
        service.request("ORD-10", BUYER, "Không thích");

        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> service.reject("ORD-10", SELLER, " ")).getStatusCode());

        var result = service.reject("ORD-10", SELLER, "Truyện đúng mô tả");

        assertEquals(RefundRequestStatus.REJECTED, result.refundRequestStatus());
        assertEquals(OrderPaymentStatus.PAID, order.getPaymentStatus());
        assertEquals("Truyện đúng mô tả", order.getRefundRejectReason());
        assertNotNull(order.getRefundDecidedAt());
        verify(notificationService).notify(eq(BUYER), eq(10L), eq("Yêu cầu hoàn tiền bị từ chối"),
                contains("Truyện đúng mô tả"), eq("REFUND_REQUEST_REJECTED:10:1"));
        verifyNoInteractions(loyaltyService);
        verify(refundRepository, never()).save(any());
    }

    @Test
    void sellerDecisionsNeedOwnPendingRequest() {
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.approve("ORD-10", SELLER)).getStatusCode());

        service.request("ORD-10", BUYER, "Lý do");
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> service.approve("ORD-10", 99L)).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> service.reject("ORD-10", 99L, "Không")).getStatusCode());

        service.approve("ORD-10", SELLER);
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> service.reject("ORD-10", SELLER, "Đổi ý")).getStatusCode());
    }

    @Test
    void eligibleUntilIsSevenDaysAfterDeliveryOnlyWhileRequestable() {
        LocalDateTime deliveredAt = LocalDateTime.now().minusDays(2);
        LocalDateTime now = LocalDateTime.now();

        assertEquals(deliveredAt.plusDays(7),
                OrderRefundRequestService.eligibleUntil(order, deliveredAt, false, 7, now));
        assertNull(OrderRefundRequestService.eligibleUntil(order, deliveredAt, true, 7, now));
        assertNull(OrderRefundRequestService.eligibleUntil(order, null, false, 7, now));
        assertNull(OrderRefundRequestService.eligibleUntil(order, now.minusDays(8), false, 7, now));

        order.setRefundRequestStatus(RefundRequestStatus.PENDING);
        assertNull(OrderRefundRequestService.eligibleUntil(order, deliveredAt, false, 7, now));
        order.setRefundRequestStatus(null);
        order.setPaymentStatus(OrderPaymentStatus.REFUNDED);
        assertNull(OrderRefundRequestService.eligibleUntil(order, deliveredAt, false, 7, now));
        order.setPaymentStatus(OrderPaymentStatus.PAID);
        order.setStatus(OrderStatus.SHIPPING);
        assertNull(OrderRefundRequestService.eligibleUntil(order, deliveredAt, false, 7, now));
    }
}
