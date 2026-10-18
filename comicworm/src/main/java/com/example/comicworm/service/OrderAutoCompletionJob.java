package com.example.comicworm.service;

import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.AutoCompleteOrderRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class OrderAutoCompletionJob {

    private static final Logger log = LoggerFactory.getLogger(OrderAutoCompletionJob.class);
    private static final int BATCH_SIZE = 50;
    private static final List<OrderStatus> ELIGIBLE_STATUSES = List.of(OrderStatus.SHIPPING, OrderStatus.DELIVERED);

    private final AutoCompleteOrderRepository orderRepository;
    private final OrderCompletionService completionService;

    @Value("${app.order.auto-complete-days:7}")
    private int autoCompleteDays;

    @Scheduled(cron = "0 0 * * * *")
    public void completeExpiredOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(autoCompleteDays);
        List<Long> orderIds = orderRepository.findAutoCompletableOrderIds(
                ELIGIBLE_STATUSES, cutoff, PageRequest.of(0, BATCH_SIZE));
        for (Long orderId : orderIds) {
            try {
                completionService.complete(orderId, null);
            } catch (RuntimeException exception) {
                log.error("Không thể tự động hoàn tất đơn hàng {}", orderId, exception);
            }
        }
    }
}
