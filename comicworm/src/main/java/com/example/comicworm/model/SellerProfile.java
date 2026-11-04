package com.example.comicworm.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "seller_profiles")
@Getter
@Setter
@NoArgsConstructor
public class SellerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @NotNull
    @Size(max = 150)
    @Column(name = "shop_name", nullable = false, length = 150)
    private String shopName;

    @Column(name = "shop_description", columnDefinition = "text")
    private String shopDescription;

    @NotNull
    @Column(name = "level", nullable = false)
    private Integer level = 1;

    @NotNull
    @Column(name = "total_completed_orders", nullable = false)
    private Integer totalCompletedOrders = 0;

    @NotNull
    @Column(name = "total_revenue", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalRevenue = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

