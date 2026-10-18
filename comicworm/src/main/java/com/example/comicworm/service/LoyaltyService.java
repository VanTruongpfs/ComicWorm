package com.example.comicworm.service;

import com.example.comicworm.dto.response.LoyaltyAccountDTO;
import com.example.comicworm.dto.response.LoyaltyTransactionDTO;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.model.LoyaltyAccount;
import com.example.comicworm.model.LoyaltyTransaction;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.LoyaltyTransactionType;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.LoyaltyAccountRepository;
import com.example.comicworm.repository.LoyaltyTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LoyaltyService {

    private final LoyaltyAccountRepository accountRepository;
    private final LoyaltyTransactionRepository transactionRepository;
    private final NotificationService notificationService;

    @Value("${app.loyalty.vnd-per-point:10000}")
    private BigDecimal vndPerPoint;

    @Transactional(propagation = Propagation.MANDATORY)
    public void earnForOrder(Order order) {
        if (order.getStatus() != OrderStatus.COMPLETED || order.getPaymentStatus() != OrderPaymentStatus.PAID) {
            return;
        }

        if (vndPerPoint.signum() <= 0) {
            throw new IllegalStateException("app.loyalty.vnd-per-point phải lớn hơn 0");
        }
        long points = order.getSubtotalAmount().divide(vndPerPoint, 0, RoundingMode.DOWN).longValueExact();
        if (points <= 0) {
            return;
        }

        String idempotencyKey = "EARN:ORDER:" + order.getId();
        accountRepository.insertIgnore(order.getBuyerId());
        LoyaltyAccount account = accountRepository.findByIdForUpdate(order.getBuyerId())
                .orElseThrow(() -> new IllegalStateException("Không thể khởi tạo tài khoản điểm thưởng"));
        if (transactionRepository.existsByIdempotencyKey(idempotencyKey)) {
            return;
        }

        account.setPointsBalance(Math.addExact(account.getPointsBalance(), points));
        saveTransaction(order, account, LoyaltyTransactionType.EARN, points, idempotencyKey);
        notificationService.notify(
                order.getBuyerId(),
                order.getId(),
                "Bạn nhận được điểm thưởng",
                "Bạn được cộng " + points + " điểm từ đơn hàng " + order.getOrderCode() + ".",
                "POINTS_EARNED:" + order.getId() + ":" + order.getBuyerId());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void reverseForRefund(Order order, Long refundId, BigDecimal refundedAmount) {
        if (refundedAmount == null || refundedAmount.signum() <= 0
                || order.getTotalAmount() == null || order.getTotalAmount().signum() <= 0) {
            return;
        }

        String idempotencyKey = "REVERSAL:REFUND:" + refundId;
        if (transactionRepository.existsByIdempotencyKey(idempotencyKey)) {
            return;
        }

        long remainingPoints = remainingReversalPoints(order, refundedAmount);
        if (remainingPoints <= 0) {
            return;
        }

        accountRepository.insertIgnore(order.getBuyerId());
        LoyaltyAccount account = accountRepository.findByIdForUpdate(order.getBuyerId())
                .orElseThrow(() -> new IllegalStateException("Không thể tìm thấy tài khoản điểm thưởng"));
        if (transactionRepository.existsByIdempotencyKey(idempotencyKey)) {
            return;
        }

        remainingPoints = remainingReversalPoints(order, refundedAmount);
        if (remainingPoints <= 0) {
            return;
        }

        long pointsToSubtract = Math.min(remainingPoints, account.getPointsBalance());
        if (pointsToSubtract <= 0) {
            return;
        }
        account.setPointsBalance(account.getPointsBalance() - pointsToSubtract);
        saveTransaction(order, account, LoyaltyTransactionType.REVERSAL, -pointsToSubtract, idempotencyKey);
    }

    private long remainingReversalPoints(Order order, BigDecimal refundedAmount) {
        List<LoyaltyTransaction> orderTransactions = transactionRepository.findByOrderId(order.getId());
        long earnedPoints = orderTransactions.stream()
                .filter(transaction -> transaction.getTransactionType() == LoyaltyTransactionType.EARN)
                .mapToLong(LoyaltyTransaction::getPointsDelta)
                .sum();
        if (earnedPoints <= 0) {
            return 0;
        }

        BigDecimal cappedRefund = refundedAmount.min(order.getTotalAmount());
        long pointsToReverseForRefund = BigDecimal.valueOf(earnedPoints)
                .multiply(cappedRefund)
                .divide(order.getTotalAmount(), 0, RoundingMode.DOWN)
                .longValueExact();
        long reversedPoints = orderTransactions.stream()
                .filter(transaction -> transaction.getTransactionType() == LoyaltyTransactionType.REVERSAL)
                .mapToLong(transaction -> Math.negateExact(transaction.getPointsDelta()))
                .sum();
        return Math.max(0, pointsToReverseForRefund - reversedPoints);
    }

    @Transactional(readOnly = true)
    public LoyaltyAccountDTO getMyAccount(Long userId) {
        return accountRepository.findById(userId)
                .map(account -> new LoyaltyAccountDTO(account.getPointsBalance(), account.getUpdatedAt()))
                .orElseGet(() -> new LoyaltyAccountDTO(0L, null));
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<LoyaltyTransactionDTO> getMyTransactions(Long userId, Pageable pageable) {
        Page<LoyaltyTransaction> transactions = transactionRepository
                .findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return PageResponseDTO.of(transactions, transactions.getContent().stream()
                .map(LoyaltyTransactionDTO::from)
                .toList());
    }

    private void saveTransaction(
            Order order,
            LoyaltyAccount account,
            LoyaltyTransactionType type,
            long pointsDelta,
            String idempotencyKey) {
        LoyaltyTransaction transaction = new LoyaltyTransaction();
        transaction.setUserId(order.getBuyerId());
        transaction.setOrderId(order.getId());
        transaction.setTransactionType(type);
        transaction.setPointsDelta(pointsDelta);
        transaction.setBalanceAfter(account.getPointsBalance());
        transaction.setIdempotencyKey(idempotencyKey);
        transactionRepository.save(transaction);
    }
}
