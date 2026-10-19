package com.example.comicworm;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderStatusHistoryRepository;
import com.example.comicworm.service.OrderStatusService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OrderStatusServiceTests {

    private OrderStatusHistoryRepository historyRepository;
    private OrderStatusService service;

    @BeforeEach
    void setUp() {
        historyRepository = mock(OrderStatusHistoryRepository.class);
        service = new OrderStatusService(historyRepository);
    }

    @Test
    void acceptsEveryAllowedTransitionAndRecordsHistory() {
        Map<OrderStatus, Set<OrderStatus>> allowed = Map.of(
                OrderStatus.WAITING_PAYMENT, Set.of(OrderStatus.WAITING_CONFIRM, OrderStatus.CANCELLED),
                OrderStatus.WAITING_CONFIRM, Set.of(OrderStatus.PACKING, OrderStatus.CANCELLED),
                OrderStatus.PACKING, Set.of(OrderStatus.SHIPPING, OrderStatus.CANCELLED),
                OrderStatus.SHIPPING, Set.of(OrderStatus.DELIVERED, OrderStatus.COMPLETED),
                OrderStatus.DELIVERED, Set.of(OrderStatus.COMPLETED));

        for (Map.Entry<OrderStatus, Set<OrderStatus>> entry : allowed.entrySet()) {
            for (OrderStatus target : entry.getValue()) {
                Order order = order(entry.getKey());
                service.transition(order, target, 7L, "ghi chú");

                assertEquals(target, order.getStatus());
                if (target == OrderStatus.COMPLETED) {
                    assertNotNull(order.getCompletedAt());
                }
            }
        }

        verify(historyRepository, times(allowed.values().stream().mapToInt(Set::size).sum())).save(any(OrderStatusHistory.class));
        verify(historyRepository, atLeastOnce()).save(argThat(history ->
                history.getPreviousStatus() == OrderStatus.SHIPPING
                        && history.getNewStatus() == OrderStatus.COMPLETED
                        && history.getChangedBy().equals(7L)
                        && history.getNote().equals("ghi chú")));
    }

    @Test
    void rejectsInvalidTransitionsWithoutChangingOrderOrRecordingHistory() {
        List<OrderStatus[]> invalid = List.of(
                new OrderStatus[]{OrderStatus.WAITING_PAYMENT, OrderStatus.PACKING},
                new OrderStatus[]{OrderStatus.DELIVERED, OrderStatus.SHIPPING},
                new OrderStatus[]{OrderStatus.COMPLETED, OrderStatus.CANCELLED},
                new OrderStatus[]{OrderStatus.CANCELLED, OrderStatus.WAITING_PAYMENT});

        for (OrderStatus[] pair : invalid) {
            Order order = order(pair[0]);
            ResponseStatusException error = assertThrows(ResponseStatusException.class,
                    () -> service.transition(order, pair[1], null, "hệ thống"));
            assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
            assertEquals(pair[0], order.getStatus());
        }

        verifyNoInteractions(historyRepository);
    }

    private Order order(OrderStatus status) {
        Order order = new Order();
        order.setId(11L);
        order.setStatus(status);
        return order;
    }
}
