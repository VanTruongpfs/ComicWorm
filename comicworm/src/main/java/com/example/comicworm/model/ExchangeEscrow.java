package com.example.comicworm.model;

import com.example.comicworm.model.enums.EscrowStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Cash compensation of one exchange deal, held by the platform until an admin releases or refunds it. */
@Entity
@Table(name = "exchange_escrows")
@Getter
@Setter
@NoArgsConstructor
public class ExchangeEscrow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @NotNull
    @Column(name = "offer_id", nullable = false, unique = true)
    private Long offerId;

    @NotNull
    @Column(name = "payer_id", nullable = false)
    private Long payerId;

    @NotNull
    @Column(name = "payee_id", nullable = false)
    private Long payeeId;

    @NotNull
    @Column(name = "source_order_id", nullable = false)
    private Long sourceOrderId;

    @NotNull
    @DecimalMin(value = "0", inclusive = false)
    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private EscrowStatus status = EscrowStatus.HELD;

    @NotNull
    @Column(name = "held_at", nullable = false, columnDefinition = "datetime")
    private LocalDateTime heldAt;

    @Column(name = "ready_at", columnDefinition = "datetime")
    private LocalDateTime readyAt;

    @Column(name = "resolved_at", columnDefinition = "datetime")
    private LocalDateTime resolvedAt;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;
}
