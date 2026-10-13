package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.enums.ExchangeOfferStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeOfferRepository extends JpaRepository<ExchangeOffer, Long> {

    List<ExchangeOffer> findByRoomIdOrderByCreatedAtDesc(Long roomId);

    Optional<ExchangeOffer> findByIdAndRoomId(Long id, Long roomId);

    List<ExchangeOffer> findByRoomIdAndBuyerId(Long roomId, Long buyerId);

    List<ExchangeOffer> findByRoomIdAndStatus(Long roomId, ExchangeOfferStatus status);

    long countByRoomId(Long roomId);
}
