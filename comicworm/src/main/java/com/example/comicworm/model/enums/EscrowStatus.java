package com.example.comicworm.model.enums;

public enum EscrowStatus {
    /** The payer paid the cash compensation by COD; the platform holds it. */
    HELD,
    /** Every order of the deal is completed; an admin can release it. */
    READY,
    /** Credited to the payee's wallet. */
    RELEASED,
    /** Credited back to the payer's wallet. */
    REFUNDED
}
