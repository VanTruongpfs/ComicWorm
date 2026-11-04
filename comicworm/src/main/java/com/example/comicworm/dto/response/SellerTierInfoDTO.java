package com.example.comicworm.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@Builder
public class SellerTierInfoDTO {
    private boolean isSeller;
    private int currentLevel;
    private String currentLevelName;
    private String badgeTitle;
    private String badgeColor;
    private String shopName;
    private String shopDescription;
    private int maxPostLimit;
    private long currentPostCount;
    private double commissionRate;
    private int totalCompletedOrders;
    private BigDecimal totalRevenue;

    // Thống kê đánh giá phục vụ điều kiện nâng cấp
    private long totalReviews;
    private double averageRating;

    private List<TierDetail> tiers;
    private SellerUpgradeRequestDTO pendingRequest;
    private SellerUpgradeRequestDTO latestRequest;

    @Getter
    @Setter
    @Builder
    public static class TierDetail {
        private int level;
        private String name;
        private String badgeTitle;
        private String badgeColor;
        private BigDecimal fee;
        private int postLimit;
        private double commissionRate;
        private String dailyWithdrawLimit;
        private String withdrawSpeed;
        private List<String> benefits;

        // Điều kiện nâng cấp
        private int minCompletedOrders;
        private int minReviews;
        private double minRating;
        private boolean eligible;
        private String ineligibilityReason;
    }
}
