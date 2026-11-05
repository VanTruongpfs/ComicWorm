package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.enums.ExchangeOfferStatus;
import com.example.comicworm.model.enums.ExchangeReviewStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExchangeOfferRepository extends JpaRepository<ExchangeOffer, Long> {

    List<ExchangeOffer> findByRoomIdOrderByCreatedAtDesc(Long roomId);

    Optional<ExchangeOffer> findByIdAndRoomId(Long id, Long roomId);

    List<ExchangeOffer> findByRoomIdAndBuyerId(Long roomId, Long buyerId);

    List<ExchangeOffer> findByRoomIdAndStatus(Long roomId, ExchangeOfferStatus status);

    long countByRoomId(Long roomId);

    List<ExchangeOffer> findByAdminReviewStatusOrderByIdDesc(ExchangeReviewStatus adminReviewStatus);

    /** Room of an offer without loading the offer, so callers can lock the room before reading offer state. */
    @Query("SELECT o.roomId FROM ExchangeOffer o WHERE o.id = :id")
    Optional<Long> findRoomIdById(@Param("id") Long id);
}
