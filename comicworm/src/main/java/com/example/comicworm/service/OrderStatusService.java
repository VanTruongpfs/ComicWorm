package com.example.comicworm.service;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class OrderStatusService {

    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = transitions();

    private final OrderStatusHistoryRepository historyRepository;

    public void transition(Order order, OrderStatus target, Long actorId, String note) {
        OrderStatus previous = order.getStatus();
        if (!TRANSITIONS.getOrDefault(previous, Set.of()).contains(target)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể chuyển trạng thái đơn hàng từ " + previous + " sang " + target);
        }

        order.setStatus(target);
        if (target == OrderStatus.COMPLETED) {
            order.setCompletedAt(LocalDateTime.now());
        }
        recordHistory(order, previous, actorId, note);
    }

    public void recordHistory(Order order, OrderStatus previous, Long actorId, String note) {
        OrderStatusHistory history = new OrderStatusHistory();
        history.setOrderId(order.getId());
        history.setPreviousStatus(previous);
        history.setNewStatus(order.getStatus());
        history.setChangedBy(actorId);
        history.setNote(note);
        historyRepository.save(history);
    }

    private static Map<OrderStatus, Set<OrderStatus>> transitions() {
        EnumMap<OrderStatus, Set<OrderStatus>> transitions = new EnumMap<>(OrderStatus.class);
        transitions.put(OrderStatus.WAITING_PAYMENT, Set.of(OrderStatus.WAITING_CONFIRM, OrderStatus.CANCELLED));
        transitions.put(OrderStatus.WAITING_CONFIRM, Set.of(OrderStatus.PACKING, OrderStatus.CANCELLED));
        transitions.put(OrderStatus.PACKING, Set.of(OrderStatus.SHIPPING, OrderStatus.CANCELLED));
        transitions.put(OrderStatus.SHIPPING, Set.of(OrderStatus.DELIVERED, OrderStatus.COMPLETED));
        transitions.put(OrderStatus.DELIVERED, Set.of(OrderStatus.COMPLETED));
        transitions.put(OrderStatus.COMPLETED, Set.of());
        transitions.put(OrderStatus.CANCELLED, Set.of());
        return Collections.unmodifiableMap(transitions);
    }
}
