package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeOfferItem;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeOfferItemRepository extends JpaRepository<ExchangeOfferItem, Long> {

    List<ExchangeOfferItem> findByOfferId(Long offerId);

    List<ExchangeOfferItem> findByOfferIdIn(Collection<Long> offerIds);
}
