package com.example.comicworm.service;

import com.example.comicworm.model.Notification;
import com.example.comicworm.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public void notify(Long userId, Long orderId, String title, String content, String dedupKey) {
        if (notificationRepository.existsByDeduplicationKey(dedupKey)) {
            return;
        }

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setOrderId(orderId);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setDeduplicationKey(dedupKey);
        notificationRepository.save(notification);
    }
}
