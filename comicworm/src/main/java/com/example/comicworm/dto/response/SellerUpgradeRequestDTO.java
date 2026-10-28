package com.example.comicworm.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
public class SellerUpgradeRequestDTO {
    private Long id;
    private Long userId;
    private String userFullName;
    private String userEmail;
    private String userPhone;
    private Integer fromLevel;
    private Integer toLevel;
    private String shopName;
    private String shopDescription;
    private BigDecimal feeAmount;
    private String paymentMethod;
    private String paymentProofUrl;
    private String transactionCode;
    private String status;
    private Long adminId;
    private String adminName;
    private String rejectionReason;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
}

