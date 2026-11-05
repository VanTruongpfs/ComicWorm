package com.example.comicworm.dto.request;

/** Reason for rejecting a deal, or the note an admin records when releasing or refunding an escrow. */
public record ExchangeAdminActionRequest(String note) {
}
