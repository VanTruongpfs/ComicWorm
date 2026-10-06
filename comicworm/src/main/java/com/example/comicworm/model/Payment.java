package com.example.comicworm.model;

import com.example.comicworm.model.enums.PaymentMethod;
import com.example.comicworm.model.enums.PaymentStatus;
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
@Table(name = "payments",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_payment_provider", columnNames = {"method", "provider_transaction_id"})
    })
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Size(max = 60)
    @Column(name = "payment_code", nullable = false, unique = true, length = 60)
    private String paymentCode;

    @NotNull
    @Column(name = "checkout_id", nullable = false)
    private Long checkoutId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "method", nullable = false, length = 20)
    private PaymentMethod method;

    @NotNull
    @DecimalMin(value = "0", inclusive = false)
    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private PaymentStatus status = PaymentStatus.PENDING;

    @Size(max = 150)
    @Column(name = "provider_transaction_id", nullable = true, length = 150)
    private String providerTransactionId;

    @NotNull
    @Size(max = 100)
    @Column(name = "idempotency_key", nullable = false, unique = true, length = 100)
    private String idempotencyKey;

    @Column(name = "paid_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime paidAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "checkout_id", referencedColumnName = "id", insertable = false, updatable = false)
    private CheckoutBatch checkout;
}
