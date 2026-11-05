package com.example.comicworm.model.enums;

public enum LoyaltyTransactionType {
    EARN,
    REVERSAL,
    /** Trừ điểm để giảm giá khi thanh toán. */
    REDEEM,
    /** Trả lại điểm đã dùng khi đơn bị hủy hoặc được hoàn tiền. */
    REDEEM_RETURN
}
