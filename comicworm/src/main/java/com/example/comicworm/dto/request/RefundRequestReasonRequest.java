package com.example.comicworm.dto.request;

/**
 * Lý do người mua yêu cầu hoàn tiền, hoặc lý do người bán từ chối.
 * Độ dài/rỗng được kiểm tra trong OrderRefundRequestService.
 */
public record RefundRequestReasonRequest(String reason) {
}
