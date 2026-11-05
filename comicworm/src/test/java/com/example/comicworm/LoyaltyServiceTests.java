package com.example.comicworm;

import com.example.comicworm.model.CheckoutBatch;
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
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

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
        ReflectionTestUtils.setField(service, "earnRate", new BigDecimal("0.02"));
        ReflectionTestUtils.setField(service, "redeemVndPerPoint", BigDecimal.ONE);
    }

    @Test
    void earnsTwoPercentOfPaidTotalRoundedDown() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setTotalAmount(new BigDecimal("149.99"));
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
    void skipsEarningWhenTotalIsLessThanOnePoint() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setTotalAmount(new BigDecimal("49.99"));

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
    void earningUsesTotalAfterPointsDiscount() {
        Order order = order(OrderStatus.COMPLETED, OrderPaymentStatus.PAID);
        order.setSubtotalAmount(new BigDecimal("100000.00"));
        order.setShippingFee(new BigDecimal("30000.00"));
        order.setPointsDiscount(new BigDecimal("20000.00"));
        order.setTotalAmount(new BigDecimal("110000.00"));
        LoyaltyAccount account = account(4L, 0L);
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account));

        service.earnForOrder(order);

        assertEquals(2200L, account.getPointsBalance());
    }

    @Test
    void redeemsPointsAcrossOrdersProportionallyToSubtotal() {
        Order first = checkoutOrder(21L, "60000", "30000");
        Order second = checkoutOrder(22L, "40000", "30000");
        CheckoutBatch batch = new CheckoutBatch();
        batch.setTotalAmount(new BigDecimal("160000"));
        LoyaltyAccount account = account(4L, 50000L);
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account));

        long used = service.redeemForCheckout(4L, batch, List.of(second, first), 10001L);

        assertEquals(10001L, used);
        assertEquals(39999L, account.getPointsBalance());
        assertEquals(0, new BigDecimal("6001").compareTo(first.getPointsDiscount()));
        assertEquals(0, new BigDecimal("83999").compareTo(first.getTotalAmount()));
        assertEquals(0, new BigDecimal("4000").compareTo(second.getPointsDiscount()));
        assertEquals(0, new BigDecimal("66000").compareTo(second.getTotalAmount()));
        assertEquals(0, new BigDecimal("149999").compareTo(batch.getTotalAmount()));
        verify(transactionRepository).save(argThat(transaction ->
                transaction.getTransactionType() == LoyaltyTransactionType.REDEEM
                        && transaction.getOrderId() == 21L
                        && transaction.getPointsDelta() == -6001L
                        && transaction.getIdempotencyKey().equals("REDEEM:ORDER:21")));
        verify(transactionRepository).save(argThat(transaction ->
                transaction.getTransactionType() == LoyaltyTransactionType.REDEEM
                        && transaction.getOrderId() == 22L
                        && transaction.getPointsDelta() == -4000L
                        && transaction.getBalanceAfter() == 39999L));
    }

    @Test
    void redeemingCanCoverWholeSubtotalButNotShipping() {
        Order order = checkoutOrder(21L, "60000", "30000");
        CheckoutBatch batch = new CheckoutBatch();
        batch.setTotalAmount(new BigDecimal("90000"));
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account(4L, 100000L)));

        service.redeemForCheckout(4L, batch, List.of(order), 60000L);
        assertEquals(0, new BigDecimal("30000").compareTo(order.getTotalAmount()));

        Order other = checkoutOrder(22L, "60000", "30000");
        var error = assertThrows(ResponseStatusException.class, () ->
                service.redeemForCheckout(4L, new CheckoutBatch(), List.of(other), 60001L));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void rejectsRedeemingMorePointsThanBalance() {
        Order order = checkoutOrder(21L, "60000", "30000");
        CheckoutBatch batch = new CheckoutBatch();
        batch.setTotalAmount(new BigDecimal("90000"));
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account(4L, 500L)));

        var error = assertThrows(ResponseStatusException.class, () ->
                service.redeemForCheckout(4L, batch, List.of(order), 501L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals(0, BigDecimal.ZERO.compareTo(order.getPointsDiscount()));
        verify(transactionRepository, never()).save(any(LoyaltyTransaction.class));
    }

    @Test
    void redeemingTwiceForSameCheckoutDoesNothing() {
        Order order = checkoutOrder(21L, "60000", "30000");
        order.setPointsDiscount(new BigDecimal("1000"));
        order.setTotalAmount(new BigDecimal("89000"));

        long used = service.redeemForCheckout(4L, new CheckoutBatch(), List.of(order), 500L);

        assertEquals(0L, used);
        assertEquals(0, new BigDecimal("89000").compareTo(order.getTotalAmount()));
        verifyNoInteractions(accountRepository, transactionRepository);
    }

    @Test
    void returnsRedeemedPointsOnceWithNotification() {
        Order order = order(OrderStatus.CANCELLED, OrderPaymentStatus.PENDING);
        order.setPointsDiscount(new BigDecimal("700"));
        LoyaltyAccount account = account(4L, 300L);
        when(transactionRepository.existsByIdempotencyKey("REDEEM_RETURN:ORDER:12")).thenReturn(false);
        when(transactionRepository.findByOrderId(12L)).thenReturn(List.of(
                transaction(LoyaltyTransactionType.REDEEM, -700L)));
        when(accountRepository.findByIdForUpdate(4L)).thenReturn(Optional.of(account));

        long returned = service.returnRedeemedPoints(order);

        assertEquals(700L, returned);
        assertEquals(1000L, account.getPointsBalance());
        verify(transactionRepository).save(argThat(transaction ->
                transaction.getTransactionType() == LoyaltyTransactionType.REDEEM_RETURN
                        && transaction.getPointsDelta() == 700L
                        && transaction.getBalanceAfter() == 1000L
                        && transaction.getIdempotencyKey().equals("REDEEM_RETURN:ORDER:12")));
        verify(notificationService).notify(
                4L, 12L, "Bạn được hoàn điểm thưởng",
                "Bạn được hoàn 700 điểm đã dùng cho đơn hàng ORD-12.", "POINTS_RETURNED:12:4");
    }

    @Test
    void skipsReturnWhenOrderUsedNoPointsOrAlreadyReturned() {
        service.returnRedeemedPoints(order(OrderStatus.CANCELLED, OrderPaymentStatus.PENDING));
        verifyNoInteractions(accountRepository, transactionRepository, notificationService);

        Order order = order(OrderStatus.CANCELLED, OrderPaymentStatus.PENDING);
        order.setPointsDiscount(new BigDecimal("700"));
        when(transactionRepository.existsByIdempotencyKey("REDEEM_RETURN:ORDER:12")).thenReturn(true);

        assertEquals(0L, service.returnRedeemedPoints(order));
        verify(transactionRepository, never()).save(any(LoyaltyTransaction.class));
        verifyNoInteractions(accountRepository, notificationService);
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

    private Order checkoutOrder(Long id, String subtotal, String shipping) {
        Order order = new Order();
        order.setId(id);
        order.setBuyerId(4L);
        order.setOrderCode("ORD-" + id);
        order.setSubtotalAmount(new BigDecimal(subtotal));
        order.setShippingFee(new BigDecimal(shipping));
        order.setTotalAmount(new BigDecimal(subtotal).add(new BigDecimal(shipping)));
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
