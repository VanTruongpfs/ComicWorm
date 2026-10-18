package com.example.comicworm.service;

import com.example.comicworm.gateway.RefundGateway;
import com.example.comicworm.gateway.RefundGateway.RefundResult;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.PaymentAllocation;
import com.example.comicworm.model.Refund;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.RefundStatus;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentAllocationRepository;
import com.example.comicworm.repository.RefundRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Component
@Profile("!preview")
@RequiredArgsConstructor
public class RefundProcessor {

    private static final Logger log = LoggerFactory.getLogger(RefundProcessor.class);
    private static final int BATCH_SIZE = 20;

    private final RefundRepository refundRepository;
    private final OrderRepository orderRepository;
    private final PaymentAllocationRepository allocationRepository;
    private final RefundGateway refundGateway;
    private final NotificationService notificationService;
    private final PlatformTransactionManager transactionManager;

    @Scheduled(fixedDelay = 30_000)
    public void processPendingRefunds() {
        reportProcessingRefunds();
        List<Refund> refunds = claimPendingRefunds();
        for (Refund refund : refunds) {
            RefundResult result;
            try {
                result = refundGateway.refund(refund);
                if (result == null || (result.succeeded()
                        && (result.providerRefundId() == null || result.providerRefundId().isBlank()))) {
                    result = RefundResult.failure("Cổng hoàn tiền không trả kết quả thành công hợp lệ");
                }
            } catch (RuntimeException exception) {
                log.error("Gọi cổng hoàn tiền thất bại cho refund {}", refund.getId(), exception);
                result = RefundResult.failure("Không thể kết nối cổng hoàn tiền");
            }
            try {
                finalizeRefund(refund, result);
            } catch (RuntimeException exception) {
                log.error("Không thể cập nhật kết quả refund {}; giữ trạng thái để đối soát", refund.getId(), exception);
            }
        }
    }

    private void reportProcessingRefunds() {
        refundRepository.findByStatusOrderByIdAsc(RefundStatus.PROCESSING, PageRequest.of(0, BATCH_SIZE))
                .forEach(refund -> log.warn(
                        "Refund {} đang ở PROCESSING và cần đối soát thủ công; không tự gửi lại",
                        refund.getId()));
    }

    private List<Refund> claimPendingRefunds() {
        TransactionTemplate transaction = transaction(TransactionDefinition.PROPAGATION_REQUIRED);
        return transaction.execute(status -> {
            List<Refund> pending = refundRepository.findByStatusForUpdate(
                    RefundStatus.PENDING, PageRequest.of(0, BATCH_SIZE));
            pending.forEach(refund -> refund.setStatus(RefundStatus.PROCESSING));
            refundRepository.saveAll(pending);
            return pending;
        });
    }

    private void finalizeRefund(Refund claimedRefund, RefundResult result) {
        TransactionTemplate transaction = transaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.executeWithoutResult(status -> {
            Order order = orderRepository.findByIdForUpdate(claimedRefund.getOrderId())
                    .orElseThrow(() -> new IllegalStateException("Không tìm thấy đơn của refund " + claimedRefund.getId()));
            Refund refund = refundRepository.findByIdForUpdate(claimedRefund.getId())
                    .orElseThrow(() -> new IllegalStateException("Không tìm thấy refund " + claimedRefund.getId()));
            if (refund.getStatus() != RefundStatus.PROCESSING) {
                return;
            }

            if (result.succeeded()) {
                refund.setStatus(RefundStatus.SUCCEEDED);
                refund.setProviderRefundId(result.providerRefundId());
                refund.setCompletedAt(LocalDateTime.now());
                updateOrderPaymentStatus(order);
                notificationService.notify(
                        order.getBuyerId(), order.getId(), "Hoàn tiền thành công",
                        "Khoản hoàn tiền " + refund.getRefundCode() + " đã được xử lý thành công.",
                        "REFUND_SUCCEEDED:" + order.getId() + ":" + order.getBuyerId() + ":" + refund.getId());
            } else {
                refund.setStatus(RefundStatus.FAILED);
                refund.setFailureReason(result.failureReason() == null || result.failureReason().isBlank()
                        ? "Cổng hoàn tiền từ chối giao dịch" : result.failureReason());
                notificationService.notify(
                        order.getBuyerId(), order.getId(), "Hoàn tiền thất bại",
                        "Khoản hoàn tiền " + refund.getRefundCode() + " chưa thể xử lý: " + refund.getFailureReason(),
                        "REFUND_FAILED:" + order.getId() + ":" + order.getBuyerId() + ":" + refund.getId());
            }
        });
    }

    private void updateOrderPaymentStatus(Order order) {
        BigDecimal allocatedAmount = allocationRepository.findByOrderId(order.getId()).stream()
                .map(PaymentAllocation::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal succeededAmount = refundRepository.sumAmountByOrderAndStatus(order.getId(), RefundStatus.SUCCEEDED);
        if (succeededAmount.compareTo(allocatedAmount) >= 0) {
            order.setPaymentStatus(OrderPaymentStatus.REFUNDED);
        } else if (succeededAmount.signum() > 0) {
            order.setPaymentStatus(OrderPaymentStatus.PARTIALLY_REFUNDED);
        }
    }

    private TransactionTemplate transaction(int propagation) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(propagation);
        return transaction;
    }
}
