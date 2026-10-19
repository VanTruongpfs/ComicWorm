package com.example.comicworm.service;

import com.example.comicworm.model.enums.CancelActor;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@Profile("!preview")
@RequiredArgsConstructor
public class OrderPaymentExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(OrderPaymentExpiryJob.class);
    private static final int BATCH_SIZE = 50;

    private final OrderRepository orderRepository;
    private final OrderCancellationService cancellationService;

    @Scheduled(fixedDelay = 60_000)
    public void cancelExpiredOrders() {
        List<Long> orderIds = orderRepository.findExpiredOrderIds(
                OrderStatus.WAITING_PAYMENT, LocalDateTime.now(), PageRequest.of(0, BATCH_SIZE));
        for (Long orderId : orderIds) {
            try {
                cancellationService.cancel(orderId, null, CancelActor.SYSTEM, "Hết hạn thanh toán");
            } catch (RuntimeException exception) {
                log.error("Không thể tự hủy đơn hàng hết hạn {}", orderId, exception);
            }
        }
    }
}
