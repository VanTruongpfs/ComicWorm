package com.example.comicworm;

import com.example.comicworm.dto.request.ProcessPaymentRequest;
import com.example.comicworm.model.CheckoutBatch;
import com.example.comicworm.model.LoyaltyAccount;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.Payment;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.PaymentMethod;
import com.example.comicworm.repository.CheckoutBatchRepository;
import com.example.comicworm.repository.LoyaltyAccountRepository;
import com.example.comicworm.repository.LoyaltyTransactionRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.service.LoyaltyService;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.OrderStatusService;
import com.example.comicworm.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PaymentPointsRedemptionTests {

    private CheckoutBatchRepository batchRepository;
    private OrderRepository orderRepository;
    private PaymentRepository paymentRepository;
    private PaymentAllocationRepository allocationRepository;
    private LoyaltyAccountRepository accountRepository;
    private LoyaltyTransactionRepository transactionRepository;
    private PaymentServiceImpl service;
    private CheckoutBatch batch;
    private Order order;
    private LoyaltyAccount account;
    private final List<PaymentAllocation> allocations = new ArrayList<>();

    @BeforeEach
    void setUp() {
        batchRepository = mock(CheckoutBatchRepository.class);
        orderRepository = mock(OrderRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        allocationRepository = mock(PaymentAllocationRepository.class);
        accountRepository = mock(LoyaltyAccountRepository.class);
        transactionRepository = mock(LoyaltyTransactionRepository.class);

        LoyaltyService loyaltyService = new LoyaltyService(
                accountRepository, transactionRepository, mock(NotificationService.class));
        ReflectionTestUtils.setField(loyaltyService, "earnRate", new BigDecimal("0.02"));
        ReflectionTestUtils.setField(loyaltyService, "redeemVndPerPoint", BigDecimal.ONE);

        service = new PaymentServiceImpl(batchRepository, orderRepository, paymentRepository, allocationRepository);
        service.setOrderStatusService(mock(OrderStatusService.class));
        service.setLoyaltyService(loyaltyService);

        batch = new CheckoutBatch();
        batch.setId(10L);
        batch.setCheckoutCode("CHK-10");
        batch.setBuyerId(7L);
        batch.setExpiresAt(LocalDateTime.now().plusHours(1));
        batch.setTotalAmount(new BigDecimal("130000"));
        when(batchRepository.findByCheckoutCode("CHK-10")).thenReturn(Optional.of(batch));

        order = new Order();
        order.setId(15L);
        order.setCheckoutId(10L);
        order.setBuyerId(7L);
        order.setOrderCode("ORD-15");
        order.setStatus(OrderStatus.WAITING_PAYMENT);
        order.setSubtotalAmount(new BigDecimal("100000"));
        order.setShippingFee(new BigDecimal("30000"));
        order.setTotalAmount(new BigDecimal("130000"));
        when(orderRepository.findByCheckoutIdForUpdate(10L)).thenReturn(List.of(order));
        when(orderRepository.findByCheckoutId(10L)).thenReturn(List.of(order));

        account = new LoyaltyAccount();
        account.setUserId(7L);
        account.setPointsBalance(5000L);
        when(accountRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(account));

        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            payment.setId(20L);
            return payment;
        });
        when(allocationRepository.save(any(PaymentAllocation.class))).thenAnswer(invocation -> {
            allocations.add(invocation.getArgument(0));
            return invocation.getArgument(0);
        });
    }

    @Test
    void paymentAndAllocationUseTotalAfterPointsDiscount() {
        pay(PaymentMethod.COD, 1000L);

        assertEquals(4000L, account.getPointsBalance());
        assertEquals(0, new BigDecimal("1000").compareTo(order.getPointsDiscount()));
        assertEquals(0, new BigDecimal("129000").compareTo(order.getTotalAmount()));
        assertEquals(0, new BigDecimal("129000").compareTo(batch.getTotalAmount()));
        verify(paymentRepository).save(argThat(payment -> payment.getAmount().compareTo(new BigDecimal("129000")) == 0));
        assertEquals(1, allocations.size());
        assertEquals(0, new BigDecimal("129000").compareTo(allocations.get(0).getAmount()));
        verify(batchRepository).save(batch);
    }

    @Test
    void payingWithoutPointsLeavesTotalsUnchanged() {
        pay(PaymentMethod.COD, null);

        assertEquals(5000L, account.getPointsBalance());
        assertEquals(0, new BigDecimal("130000").compareTo(order.getTotalAmount()));
        verifyNoInteractions(accountRepository, transactionRepository);
    }

    @Test
    void rejectsMorePointsThanBalanceBeforeCreatingPayment() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> pay(PaymentMethod.COD, 5001L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verifyNoInteractions(paymentRepository, allocationRepository);
    }

    private void pay(PaymentMethod method, Long points) {
        ProcessPaymentRequest request = new ProcessPaymentRequest(method);
        request.setPointsToUse(points);
        service.processCheckoutPayment("CHK-10", 7L, request);
    }
}
