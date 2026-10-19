package com.example.comicworm;

import com.example.comicworm.model.LoyaltyAccount;
import com.example.comicworm.model.LoyaltyTransaction;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.LoyaltyTransactionType;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.LoyaltyAccountRepository;
import com.example.comicworm.repository.LoyaltyTransactionRepository;
import com.example.comicworm.service.LoyaltyService;
import com.example.comicworm.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LoyaltyServiceTests {

    private LoyaltyAccountRepository accountRepository;
    private LoyaltyTransactionRepository transactionRepository;
    private NotificationService notificationService;
    private LoyaltyService service;

    @BeforeEach
    void setUp() {
        accountRepository = mock(LoyaltyAccountRepository.class);
        transactionRepository = mock(LoyaltyTransactionRepository.class);
        notificationService = mock(NotificationService.class);
        service = new LoyaltyService(accountRepository, transactionRepository, notificationService);
        ReflectionTestUtils.setField(service, "vndPerPoint", new BigDecimal("10000"));
    }

    @Test
    void earnsFloorOfEligiblePaidCompletedSubtotalIntoNewAccount() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setSubtotalAmount(new BigDecimal("25999.99"));
        LoyaltyAccount account = account(4L, 3L);
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account));
        when(transactionRepository.existsByIdempotencyKey("EARN:ORDER:12")).thenReturn(false);

        service.earnForOrder(order);

        assertEquals(5L, account.getPointsBalance());
        verify(accountRepository).insertIgnore(4L);
        verify(transactionRepository).save(argThat(transaction ->
                transaction.getTransactionType() == LoyaltyTransactionType.EARN
                        && transaction.getPointsDelta() == 2L
                        && transaction.getBalanceAfter() == 5L
                        && transaction.getIdempotencyKey().equals("EARN:ORDER:12")));
        verify(notificationService).notify(
                4L, 12L, "Bạn nhận được điểm thưởng",
                "Bạn được cộng 2 điểm từ đơn hàng ORD-12.", "POINTS_EARNED:12:4");
    }

    @Test
    void skipsEarningForWrongOrderStatusOrUnpaidOrder() {
        service.earnForOrder(order(OrderStatus.SHIPPING, OrderPaymentStatus.PAID));
        service.earnForOrder(order(OrderStatus.COMPLETED, OrderPaymentStatus.PENDING));

        verifyNoInteractions(accountRepository, transactionRepository, notificationService);
    }

    @Test
    void skipsEarningWhenSubtotalIsLessThanOnePoint() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setSubtotalAmount(new BigDecimal("9999.99"));

        service.earnForOrder(order);

        verifyNoInteractions(accountRepository, transactionRepository, notificationService);
    }

    @Test
    void earningIsIdempotent() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        LoyaltyAccount account = account(4L, 8L);
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account));
        when(transactionRepository.existsByIdempotencyKey("EARN:ORDER:12")).thenReturn(true);

        service.earnForOrder(order);

        assertEquals(8L, account.getPointsBalance());
        verify(transactionRepository, never()).save(any(LoyaltyTransaction.class));
        verifyNoInteractions(notificationService);
    }

    @Test
    void reversesOnlyUnreversedRefundPointsAndCapsAtCurrentBalance() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setTotalAmount(new BigDecimal("10000.00"));
        LoyaltyTransaction earn = transaction(LoyaltyTransactionType.EARN, 100L);
        LoyaltyTransaction priorReversal = transaction(LoyaltyTransactionType.REVERSAL, -20L);
        LoyaltyAccount account = account(4L, 10L);
        when(transactionRepository.existsByIdempotencyKey("REVERSAL:REFUND:51")).thenReturn(false);
        when(transactionRepository.findByOrderId(12L)).thenReturn(List.of(earn, priorReversal));
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account));

        service.reverseForRefund(order, 51L, new BigDecimal("5000.00"));

        assertEquals(0L, account.getPointsBalance());
        verify(transactionRepository).save(argThat(transaction ->
                transaction.getTransactionType() == LoyaltyTransactionType.REVERSAL
                        && transaction.getPointsDelta() == -10L
                        && transaction.getBalanceAfter() == 0L
                        && transaction.getIdempotencyKey().equals("REVERSAL:REFUND:51")));
        verifyNoInteractions(notificationService);
    }

    @Test
    void skipsReversalWhenRefundAlreadyRecordedOrFullyReversed() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setTotalAmount(new BigDecimal("10000.00"));
        when(transactionRepository.existsByIdempotencyKey("REVERSAL:REFUND:51")).thenReturn(false);
        when(transactionRepository.findByOrderId(12L)).thenReturn(List.of(
                transaction(LoyaltyTransactionType.EARN, 100L),
                transaction(LoyaltyTransactionType.REVERSAL, -60L)));

        service.reverseForRefund(order, 51L, new BigDecimal("5000.00"));

        verifyNoInteractions(accountRepository, notificationService);
        verify(transactionRepository, never()).save(any(LoyaltyTransaction.class));
    }

    @Test
    void readingMissingAccountReturnsZeroWithoutCreatingIt() {
        when(accountRepository.findById(4L)).thenReturn(Optional.empty());

        var result = service.getMyAccount(4L);

        assertEquals(0L, result.pointsBalance());
        assertNull(result.updatedAt());
        verify(accountRepository, never()).insertIgnore(any());
    }

    private Order order(OrderStatus status, OrderPaymentStatus paymentStatus) {
        Order order = new Order();
        order.setId(12L);
        order.setBuyerId(4L);
        order.setOrderCode("ORD-12");
        order.setStatus(status);
        order.setPaymentStatus(paymentStatus);
        order.setSubtotalAmount(new BigDecimal("25000.00"));
        order.setTotalAmount(new BigDecimal("30000.00"));
        return order;
    }

    private LoyaltyAccount account(Long userId, Long balance) {
        LoyaltyAccount account = new LoyaltyAccount();
        account.setUserId(userId);
        account.setPointsBalance(balance);
        return account;
    }

    private LoyaltyTransaction transaction(LoyaltyTransactionType type, long points) {
        LoyaltyTransaction transaction = new LoyaltyTransaction();
        transaction.setTransactionType(type);
        transaction.setPointsDelta(points);
        return transaction;
    }
}
