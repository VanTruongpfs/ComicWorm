package com.example.comicworm.model;

import com.example.comicworm.model.enums.ExchangeOfferStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "exchange_offers",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_offer_room", columnNames = {"id", "room_id"})
    })
@Getter
@Setter
@NoArgsConstructor
public class ExchangeOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @NotNull
    @Column(name = "buyer_id", nullable = false)
    private Long buyerId;

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "cash_compensation", nullable = false, precision = 15, scale = 2)
    private BigDecimal cashCompensation = new BigDecimal("0");

    @Column(name = "compensation_payer_id", nullable = true)
    private Long compensationPayerId;

    @Column(name = "note", nullable = true, columnDefinition = "text")
    private String note;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private ExchangeOfferStatus status = ExchangeOfferStatus.PENDING;

    @NotNull
    @Column(name = "buyer_confirmed", nullable = false)
    private Boolean buyerConfirmed = false;

    @NotNull
    @Column(name = "host_confirmed", nullable = false)
    private Boolean hostConfirmed = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "responded_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime respondedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumns({
        @JoinColumn(name = "room_id", referencedColumnName = "room_id", insertable = false, updatable = false),
        @JoinColumn(name = "buyer_id", referencedColumnName = "user_id", insertable = false, updatable = false)
    })
    private ExchangeRoomMember buyerMembership;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "compensation_payer_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User compensationPayer;
}
