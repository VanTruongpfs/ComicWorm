package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeMessageRepository extends JpaRepository<ExchangeMessage, Long> {

    List<ExchangeMessage> findByRoomIdOrderByCreatedAtAsc(Long roomId);

    List<ExchangeMessage> findByRoomIdAndIdGreaterThanOrderByCreatedAtAsc(Long roomId, Long afterId);
}
