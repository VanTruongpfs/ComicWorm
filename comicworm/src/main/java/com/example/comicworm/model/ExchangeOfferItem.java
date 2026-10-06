package com.example.comicworm.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exchange_offer_items",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_offer_product", columnNames = {"offer_id", "product_id"})
    })
@Getter
@Setter
@NoArgsConstructor
public class ExchangeOfferItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "offer_id", nullable = false)
    private Long offerId;

    @NotNull
    @Column(name = "product_id", nullable = false)
    private Long productId;

    @NotNull
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @NotNull
    @Min(1)
    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @NotNull
    @Size(max = 255)
    @Column(name = "title_snapshot", nullable = false, length = 255)
    private String titleSnapshot;

    @NotNull
    @Min(0)
    @Max(100)
    @Column(name = "condition_snapshot", nullable = false)
    private Integer conditionSnapshot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "offer_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ExchangeOffer offer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumns({
        @JoinColumn(name = "product_id", referencedColumnName = "id", insertable = false, updatable = false),
        @JoinColumn(name = "owner_id", referencedColumnName = "seller_id", insertable = false, updatable = false)
    })
    private Product product;
}
