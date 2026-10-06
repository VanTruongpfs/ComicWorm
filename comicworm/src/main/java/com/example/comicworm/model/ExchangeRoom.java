package com.example.comicworm.model;

import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "exchange_rooms",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_room_selected_offer", columnNames = {"selected_offer_id", "id"})
    })
@Getter
@Setter
@NoArgsConstructor
public class ExchangeRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Size(max = 60)
    @Column(name = "room_code", nullable = false, unique = true, length = 60)
    private String roomCode;

    @NotNull
    @Column(name = "host_id", nullable = false)
    private Long hostId;

    @NotNull
    @Column(name = "target_product_id", nullable = false)
    private Long targetProductId;

    @Column(name = "selected_offer_id", nullable = true, unique = true)
    private Long selectedOfferId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private ExchangeRoomStatus status = ExchangeRoomStatus.OPEN;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "closed_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime closedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "host_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User host;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumns({
        @JoinColumn(name = "target_product_id", referencedColumnName = "id", insertable = false, updatable = false),
        @JoinColumn(name = "host_id", referencedColumnName = "seller_id", insertable = false, updatable = false)
    })
    private Product targetProduct;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumns({
        @JoinColumn(name = "selected_offer_id", referencedColumnName = "id", insertable = false, updatable = false),
        @JoinColumn(name = "id", referencedColumnName = "room_id", insertable = false, updatable = false)
    })
    private ExchangeOffer selectedOffer;
}
