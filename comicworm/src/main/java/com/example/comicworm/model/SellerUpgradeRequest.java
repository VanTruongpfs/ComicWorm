package com.example.comicworm.model;

import com.example.comicworm.model.enums.UpgradeRequestStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "seller_upgrade_requests")
@Getter
@Setter
@NoArgsConstructor
public class SellerUpgradeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @NotNull
    @Column(name = "from_level", nullable = false)
    private Integer fromLevel = 0;

    @NotNull
    @Column(name = "to_level", nullable = false)
    private Integer toLevel;

    @Size(max = 150)
    @Column(name = "shop_name", length = 150)
    private String shopName;

    @Column(name = "shop_description", columnDefinition = "text")
    private String shopDescription;

    @NotNull
    @Column(name = "fee_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal feeAmount;

    @NotNull
    @Size(max = 50)
    @Column(name = "payment_method", nullable = false, length = 50)
    private String paymentMethod = "MANUAL_TRANSFER";

    @Column(name = "payment_proof_url", columnDefinition = "text")
    private String paymentProofUrl;

    @Size(max = 100)
    @Column(name = "transaction_code", length = 100)
    private String transactionCode;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private UpgradeRequestStatus status = UpgradeRequestStatus.PENDING;

    @Column(name = "admin_id")
    private Long adminId;

    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;
}

