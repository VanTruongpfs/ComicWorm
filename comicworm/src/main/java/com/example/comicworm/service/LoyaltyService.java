package com.example.comicworm.service;

import com.example.comicworm.dto.response.LoyaltyAccountDTO;
import com.example.comicworm.dto.response.LoyaltyTransactionDTO;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.model.CheckoutBatch;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LoyaltyService {

    private final LoyaltyAccountRepository accountRepository;
    private final LoyaltyTransactionRepository transactionRepository;
    private final NotificationService notificationService;

    /** Tỷ lệ điểm tích được trên số tiền thực trả của đơn (0.02 = 2%). */
    @Value("${app.loyalty.earn-rate:0.02}")
    private BigDecimal earnRate;

    /** Số đồng được giảm cho mỗi điểm khi thanh toán. */
    @Value("${app.loyalty.redeem-vnd-per-point:1}")
    private BigDecimal redeemVndPerPoint;

    @Transactional(propagation = Propagation.MANDATORY)
    public void earnForOrder(Order order) {
        if (order.getStatus() != OrderStatus.COMPLETED || order.getPaymentStatus() != OrderPaymentStatus.PAID) {
            return;
        }

        if (earnRate.signum() < 0) {
            throw new IllegalStateException("app.loyalty.earn-rate không được âm");
        }
        // Tính trên số tiền thực trả (đã trừ phần giảm bằng điểm) nên phần trả bằng điểm không sinh thêm điểm.
        long points = order.getTotalAmount().multiply(earnRate)
                .setScale(0, RoundingMode.DOWN).longValueExact();
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

    /** Số điểm tối đa được dùng cho các đơn: mỗi đơn chỉ giảm tối đa bằng tiền hàng còn lại. */
    public long maxRedeemablePoints(Collection<Order> orders) {
        long total = 0;
        for (Order order : orders) {
            total = Math.addExact(total, maxRedeemablePoints(order));
        }
        return total;
    }

    public BigDecimal getRedeemVndPerPoint() {
        if (redeemVndPerPoint == null || redeemVndPerPoint.signum() <= 0) {
            throw new IllegalStateException("app.loyalty.redeem-vnd-per-point phải lớn hơn 0");
        }
        return redeemVndPerPoint;
    }

    /**
     * Trừ điểm của người mua để giảm tiền hàng cho cả đợt checkout. Điểm được chia cho các đơn theo
     * tỷ lệ tiền hàng, mỗi đơn ghi một giao dịch REDEEM. Mức giảm được chốt ở lần gọi đầu tiên:
     * nếu đợt đã dùng điểm (ví dụ thanh toán VNPay lại) thì không trừ thêm.
     *
     * @return số điểm đã trừ ở lần gọi này
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public long redeemForCheckout(Long buyerId, CheckoutBatch batch, List<Order> orders, long requestedPoints) {
        if (requestedPoints <= 0 || orders.isEmpty()) {
            return 0;
        }
        if (orders.stream().anyMatch(order -> order.getPointsDiscount() != null && order.getPointsDiscount().signum() > 0)) {
            return 0;
        }

        BigDecimal vndPerPoint = getRedeemVndPerPoint();
        List<Order> sorted = orders.stream().sorted(Comparator.comparing(Order::getId)).toList();
        long[] caps = new long[sorted.size()];
        long maxPoints = 0;
        for (int i = 0; i < sorted.size(); i++) {
            caps[i] = maxRedeemablePoints(sorted.get(i));
            maxPoints = Math.addExact(maxPoints, caps[i]);
        }
        if (requestedPoints > maxPoints) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ được dùng tối đa " + maxPoints + " điểm cho đợt thanh toán này");
        }

        accountRepository.insertIgnore(buyerId);
        LoyaltyAccount account = accountRepository.findByIdForUpdate(buyerId)
                .orElseThrow(() -> new IllegalStateException("Không thể khởi tạo tài khoản điểm thưởng"));
        if (account.getPointsBalance() < requestedPoints) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bạn chỉ có " + account.getPointsBalance() + " điểm");
        }

        // Chia theo tỷ lệ tiền hàng, phần dư dồn cho các đơn còn chỗ theo thứ tự id.
        long[] shares = new long[sorted.size()];
        long assigned = 0;
        for (int i = 0; i < sorted.size(); i++) {
            shares[i] = BigDecimal.valueOf(requestedPoints)
                    .multiply(BigDecimal.valueOf(caps[i]))
                    .divide(BigDecimal.valueOf(maxPoints), 0, RoundingMode.DOWN)
                    .longValueExact();
            assigned += shares[i];
        }
        for (int i = 0; i < sorted.size() && assigned < requestedPoints; i++) {
            long extra = Math.min(caps[i] - shares[i], requestedPoints - assigned);
            shares[i] += extra;
            assigned += extra;
        }

        BigDecimal totalDiscount = BigDecimal.ZERO;
        for (int i = 0; i < sorted.size(); i++) {
            if (shares[i] <= 0) {
                continue;
            }
            Order order = sorted.get(i);
            BigDecimal discount = vndPerPoint.multiply(BigDecimal.valueOf(shares[i]));
            order.setPointsDiscount(discount);
            order.setTotalAmount(order.getTotalAmount().subtract(discount));
            totalDiscount = totalDiscount.add(discount);

            account.setPointsBalance(account.getPointsBalance() - shares[i]);
            saveTransaction(order, account, LoyaltyTransactionType.REDEEM, -shares[i], "REDEEM:ORDER:" + order.getId());
        }
        batch.setTotalAmount(batch.getTotalAmount().subtract(totalDiscount));
        return requestedPoints;
    }

    /**
     * Trả lại điểm đã dùng cho đơn khi đơn bị hủy hoặc được hoàn tiền. Mỗi đơn chỉ được trả một lần.
     *
     * @return số điểm đã trả lại ở lần gọi này
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public long returnRedeemedPoints(Order order) {
        if (order.getPointsDiscount() == null || order.getPointsDiscount().signum() <= 0) {
            return 0;
        }
        String idempotencyKey = "REDEEM_RETURN:ORDER:" + order.getId();
        if (transactionRepository.existsByIdempotencyKey(idempotencyKey)) {
            return 0;
        }
        long redeemedPoints = redeemedPoints(order);
        if (redeemedPoints <= 0) {
            return 0;
        }

        accountRepository.insertIgnore(order.getBuyerId());
        LoyaltyAccount account = accountRepository.findByIdForUpdate(order.getBuyerId())
                .orElseThrow(() -> new IllegalStateException("Không thể tìm thấy tài khoản điểm thưởng"));
        if (transactionRepository.existsByIdempotencyKey(idempotencyKey)) {
            return 0;
        }

        account.setPointsBalance(Math.addExact(account.getPointsBalance(), redeemedPoints));
        saveTransaction(order, account, LoyaltyTransactionType.REDEEM_RETURN, redeemedPoints, idempotencyKey);
        notificationService.notify(
                order.getBuyerId(),
                order.getId(),
                "Bạn được hoàn điểm thưởng",
                "Bạn được hoàn " + redeemedPoints + " điểm đã dùng cho đơn hàng " + order.getOrderCode() + ".",
                "POINTS_RETURNED:" + order.getId() + ":" + order.getBuyerId());
        return redeemedPoints;
    }

    private long maxRedeemablePoints(Order order) {
        BigDecimal alreadyDiscounted = order.getPointsDiscount() == null ? BigDecimal.ZERO : order.getPointsDiscount();
        BigDecimal remaining = order.getSubtotalAmount().subtract(alreadyDiscounted);
        if (remaining.signum() <= 0) {
            return 0;
        }
        return remaining.divide(getRedeemVndPerPoint(), 0, RoundingMode.DOWN).longValueExact();
    }

    private long redeemedPoints(Order order) {
        return transactionRepository.findByOrderId(order.getId()).stream()
                .filter(transaction -> transaction.getTransactionType() == LoyaltyTransactionType.REDEEM)
                .mapToLong(transaction -> Math.negateExact(transaction.getPointsDelta()))
                .sum();
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
