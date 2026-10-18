package com.example.comicworm;

import com.example.comicworm.model.enums.CancelActor;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.service.OrderCancellationService;
import com.example.comicworm.service.OrderPaymentExpiryJob;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OrderPaymentExpiryJobTests {

    @Test
    void cancelsUpToFiftyExpiredOrdersIndependently() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderCancellationService cancellationService = mock(OrderCancellationService.class);
        OrderPaymentExpiryJob job = new OrderPaymentExpiryJob(orderRepository, cancellationService);
        when(orderRepository.findExpiredOrderIds(
                eq(OrderStatus.WAITING_PAYMENT), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(java.util.stream.LongStream.rangeClosed(1, 50).boxed().toList());
        doThrow(new IllegalStateException("one order failed"))
                .when(cancellationService).cancel(1L, null, CancelActor.SYSTEM, "Hết hạn thanh toán");

        job.cancelExpiredOrders();

        verify(orderRepository).findExpiredOrderIds(
                eq(OrderStatus.WAITING_PAYMENT), any(LocalDateTime.class), any(Pageable.class));
        verify(cancellationService, times(50))
                .cancel(anyLong(), isNull(), eq(CancelActor.SYSTEM), eq("Hết hạn thanh toán"));
        verify(cancellationService, never())
                .cancel(51L, null, CancelActor.SYSTEM, "Hết hạn thanh toán");
    }
}
