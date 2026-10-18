package com.example.comicworm;

import com.example.comicworm.model.Notification;
import com.example.comicworm.repository.NotificationRepository;
import com.example.comicworm.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class NotificationServiceTests {

    private NotificationRepository notificationRepository;
    private NotificationService service;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        service = new NotificationService(notificationRepository);
    }

    @Test
    void skipsNotificationWhenDeduplicationKeyAlreadyExists() {
        when(notificationRepository.existsByDeduplicationKey("ORDER_CANCELLED:15:7")).thenReturn(true);

        service.notify(7L, 15L, "Đơn đã hủy", "Đơn hàng đã được hủy.", "ORDER_CANCELLED:15:7");

        verify(notificationRepository).existsByDeduplicationKey("ORDER_CANCELLED:15:7");
        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void savesNotificationWhenDeduplicationKeyIsNew() {
        when(notificationRepository.existsByDeduplicationKey("ORDER_CANCELLED:15:7")).thenReturn(false);

        service.notify(7L, 15L, "Đơn đã hủy", "Đơn hàng đã được hủy.", "ORDER_CANCELLED:15:7");

        verify(notificationRepository).save(argThat(notification ->
                notification.getUserId().equals(7L)
                        && notification.getOrderId().equals(15L)
                        && notification.getDeduplicationKey().equals("ORDER_CANCELLED:15:7")));
    }
}
