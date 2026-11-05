package com.example.comicworm.model.enums;

/** Admin review of an exchange deal (the selected offer) before anyone ships. */
public enum ExchangeReviewStatus {
    /** Not every required delivery order exists yet. */
    NOT_SUBMITTED,
    PENDING,
    APPROVED,
    REJECTED
}
