package com.example.comicworm;

import com.example.comicworm.gateway.RefundGateway;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.Refund;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.RefundStatus;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.RefundRepository;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.RefundProcessor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RefundProcessorTests {

    private RefundRepository refundRepository;
    private OrderRepository orderRepository;
    private PaymentAllocationRepository allocationRepository;
    private RefundGateway gateway;
    private NotificationService notificationService;
    private RefundProcessor processor;
    private Refund refund;
    private Order order;

    @BeforeEach
    void setUp() {
        refundRepository = mock(RefundRepository.class);
        orderRepository = mock(OrderRepository.class);
        allocationRepository = mock(PaymentAllocationRepository.class);
        gateway = mock(RefundGateway.class);
        notificationService = mock(NotificationService.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenAnswer(invocation -> new SimpleTransactionStatus());
        processor = new RefundProcessor(refundRepository, orderRepository, allocationRepository,
                gateway, notificationService, transactionManager);

        refund = new Refund();
        refund.setId(50L);
        refund.setRefundCode("RF-50");
        refund.setOrderId(10L);
        refund.setPaymentId(30L);
        refund.setAmount(new BigDecimal("25.00"));
        refund.setStatus(RefundStatus.PENDING);

        order = new Order();
        order.setId(10L);
        order.setBuyerId(1L);
        order.setStatus(OrderStatus.CANCELLED);
        order.setPaymentStatus(OrderPaymentStatus.PAID);

        when(refundRepository.findByStatusForUpdate(eq(RefundStatus.PENDING), any(Pageable.class)))
                .thenReturn(List.of(refund));
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        when(refundRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(refund));
        when(allocationRepository.findByOrderId(10L)).thenReturn(List.of(allocation("100.00")));
        when(refundRepository.sumAmountByOrderAndStatus(10L, RefundStatus.SUCCEEDED))
                .thenReturn(new BigDecimal("25.00"));
    }

    @Test
    void marksRefundSucceededOnlyWithGatewayResultAndNotifiesBuyer() {
        when(gateway.refund(refund)).thenReturn(RefundGateway.RefundResult.success("provider-50"));

        processor.processPendingRefunds();

        assertEquals(RefundStatus.SUCCEEDED, refund.getStatus());
        assertEquals("provider-50", refund.getProviderRefundId());
        assertNotNull(refund.getCompletedAt());
        assertEquals(OrderPaymentStatus.PARTIALLY_REFUNDED, order.getPaymentStatus());
        verify(notificationService).notify(
                1L, 10L, "Hoàn tiền thành công",
                "Khoản hoàn tiền RF-50 đã được xử lý thành công.",
                "REFUND_SUCCEEDED:10:1:50");
    }

    @Test
    void marksOrderFullyRefundedWhenSuccessfulRefundsCoverAllAllocations() {
        when(gateway.refund(refund)).thenReturn(RefundGateway.RefundResult.success("provider-50"));
        when(refundRepository.sumAmountByOrderAndStatus(10L, RefundStatus.SUCCEEDED))
                .thenReturn(new BigDecimal("100.00"));

        processor.processPendingRefunds();

        assertEquals(OrderPaymentStatus.REFUNDED, order.getPaymentStatus());
    }

    @Test
    void marksFailedRefundAsFailedAndNotifiesBuyer() {
        when(gateway.refund(refund)).thenReturn(RefundGateway.RefundResult.failure("Provider từ chối"));

        processor.processPendingRefunds();

        assertEquals(RefundStatus.FAILED, refund.getStatus());
        assertEquals("Provider từ chối", refund.getFailureReason());
        assertEquals(OrderPaymentStatus.PAID, order.getPaymentStatus());
        verify(notificationService).notify(
                1L, 10L, "Hoàn tiền thất bại",
                "Khoản hoàn tiền RF-50 chưa thể xử lý: Provider từ chối",
                "REFUND_FAILED:10:1:50");
    }

    private PaymentAllocation allocation(String amount) {
        PaymentAllocation allocation = new PaymentAllocation();
        allocation.setOrderId(10L);
        allocation.setPaymentId(30L);
        allocation.setAmount(new BigDecimal(amount));
        return allocation;
    }
}
