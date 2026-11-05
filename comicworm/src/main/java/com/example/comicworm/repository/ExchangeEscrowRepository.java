package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeEscrow;
import com.example.comicworm.model.enums.EscrowStatus;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExchangeEscrowRepository extends JpaRepository<ExchangeEscrow, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM ExchangeEscrow e WHERE e.id = :id")
    Optional<ExchangeEscrow> findByIdForUpdate(@Param("id") Long id);

    Optional<ExchangeEscrow> findByOfferId(Long offerId);

    List<ExchangeEscrow> findByOfferIdIn(Collection<Long> offerIds);

    List<ExchangeEscrow> findAllByOrderByIdDesc();

    List<ExchangeEscrow> findByStatusOrderByIdDesc(EscrowStatus status);

    @Query("SELECT e.status AS status, COUNT(e) AS count, COALESCE(SUM(e.amount), 0) AS total "
            + "FROM ExchangeEscrow e GROUP BY e.status")
    List<StatusTotal> totalsByStatus();

    interface StatusTotal {
        EscrowStatus getStatus();

        Long getCount();

        BigDecimal getTotal();
    }
}
