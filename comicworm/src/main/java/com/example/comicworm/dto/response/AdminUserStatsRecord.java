package com.example.comicworm.dto.response;

public record AdminUserStatsRecord(
        long totalUsers,
        long activeSellers,
        long lockedUsers,
        long newUsersToday
) {}

