package com.example.comicworm.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "payment_events",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_payment_event", columnNames = {"payment_id", "provider_event_id"})
    })
@Getter
@Setter
@NoArgsConstructor
public class PaymentEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "payment_id", nullable = false)
    private Long paymentId;

    @NotNull
    @Size(max = 150)
    @Column(name = "provider_event_id", nullable = false, length = 150)
    private String providerEventId;

    @NotNull
    @Size(max = 50)
    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @NotNull
    @Column(name = "signature_verified", nullable = false)
    private Boolean signatureVerified = false;

    @Column(name = "processed_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime processedAt;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime receivedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "payment_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Payment payment;
}
