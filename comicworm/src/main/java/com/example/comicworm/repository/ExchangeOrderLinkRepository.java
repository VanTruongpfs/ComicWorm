package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeOrderLink;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeOrderLinkRepository extends JpaRepository<ExchangeOrderLink, Long> {
    List<ExchangeOrderLink> findByRoomIdOrderByIdAsc(Long roomId);
    Optional<ExchangeOrderLink> findByRoomIdAndRecipientId(Long roomId, Long recipientId);
    Optional<ExchangeOrderLink> findByOrderId(Long orderId);
    boolean existsByOrderId(Long orderId);
    List<ExchangeOrderLink> findByOrderIdIn(Collection<Long> orderIds);
}
