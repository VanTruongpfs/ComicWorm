package com.example.comicworm.model;

import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "orders",
    indexes = {
        @Index(name = "idx_buyer_history", columnList = "buyer_id, created_at"),
        @Index(name = "idx_seller_orders", columnList = "seller_id, status, created_at"),
        @Index(name = "idx_order_reports", columnList = "status, completed_at")
    })
@Getter
@Setter
@NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Size(max = 60)
    @Column(name = "order_code", nullable = false, unique = true, length = 60)
    private String orderCode;

    @NotNull
    @Column(name = "checkout_id", nullable = false)
    private Long checkoutId;

    @NotNull
    @Column(name = "buyer_id", nullable = false)
    private Long buyerId;

    @NotNull
    @Column(name = "seller_id", nullable = false)
    private Long sellerId;

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "subtotal_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotalAmount;

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "shipping_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal shippingFee = new BigDecimal("0");

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @NotNull
    @Size(max = 100)
    @Column(name = "recipient_name", nullable = false, length = 100)
    private String recipientName;

    @NotNull
    @Size(max = 20)
    @Column(name = "recipient_phone", nullable = false, length = 20)
    private String recipientPhone;

    @NotNull
    @Column(name = "shipping_address", nullable = false, columnDefinition = "text")
    private String shippingAddress;

    @Column(name = "buyer_note", nullable = true, columnDefinition = "text")
    private String buyerNote;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 25)
    private OrderStatus status = OrderStatus.WAITING_PAYMENT;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "payment_status", nullable = false, length = 25)
    private OrderPaymentStatus paymentStatus = OrderPaymentStatus.PENDING;

    @Column(name = "cancelled_by", nullable = true)
    private Long cancelledBy;

    @Column(name = "cancel_reason", nullable = true, columnDefinition = "text")
    private String cancelReason;

    @Column(name = "cancelled_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime cancelledAt;

    @Column(name = "stock_released_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime stockReleasedAt;

    @Column(name = "completed_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "checkout_id", referencedColumnName = "id", insertable = false, updatable = false)
    private CheckoutBatch checkout;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "buyer_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User buyer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "seller_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "cancelled_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User cancelledByUser;
}
