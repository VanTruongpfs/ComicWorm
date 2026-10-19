package com.example.comicworm.gateway;

import com.example.comicworm.model.Refund;

public interface RefundGateway {
    RefundResult refund(Refund refund);

    record RefundResult(boolean succeeded, String providerRefundId, String failureReason) {
        public static RefundResult success(String providerRefundId) {
            return new RefundResult(true, providerRefundId, null);
        }

        public static RefundResult failure(String reason) {
            return new RefundResult(false, null, reason);
        }
    }
}
