package com.example.comicworm.model;

import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "products",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_product_owner", columnNames = {"id", "seller_id"})
    },
    indexes = {
        @Index(name = "idx_product_latest", columnList = "moderation_status, is_active, created_at"),
        @Index(name = "idx_product_filter", columnList = "category_id, price"),
        @Index(name = "idx_seller_products", columnList = "seller_id, created_at")
    })
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "seller_id", nullable = false)
    private Long sellerId;

    @NotNull
    @Size(max = 255)
    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @NotNull
    @Size(max = 255)
    @Column(name = "slug", nullable = false, unique = true, length = 255)
    private String slug;

    @NotNull
    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    @Column(name = "cover_image_url", columnDefinition = "text")
    private String coverImageUrl;

    @OneToMany(mappedBy = "product", fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC, id ASC")
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    private List<ProductImage> images = new ArrayList<>();

    @NotNull
    @Column(name = "category_id", nullable = false)
    private Integer categoryId;

    @Column(name = "author_id", nullable = true)
    private Integer authorId;

    @Column(name = "publisher_id", nullable = true)
    private Integer publisherId;

    @Size(max = 100)
    @Column(name = "volume_numbers", nullable = true, length = 100)
    private String volumeNumbers;

    @Size(max = 50)
    @Column(name = "edition_type", nullable = true, length = 50)
    private String editionType;

    @Column(name = "publication_year", nullable = true)
    private Integer publicationYear;

    @NotNull
    @Min(0)
    @Max(100)
    @Column(name = "condition_percent", nullable = false)
    private Integer conditionPercent;

    @NotNull
    @DecimalMin(value = "0")
    @Column(name = "price", nullable = false, precision = 15, scale = 2)
    private BigDecimal price;

    @NotNull
    @Min(0)
    @Column(name = "stock_quantity", nullable = false)
    private Integer stockQuantity = 1;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "listing_type", nullable = false, length = 20)
    private ListingType listingType = ListingType.SELL;

    @Column(name = "trade_wish_note", nullable = true, columnDefinition = "text")
    private String tradeWishNote;

    @NotNull
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "moderation_status", nullable = false, length = 20)
    private ModerationStatus moderationStatus = ModerationStatus.PENDING;

    @Column(name = "moderated_by", nullable = true)
    private Long moderatedBy;

    @Column(name = "moderation_reason", nullable = true, columnDefinition = "text")
    private String moderationReason;

    @Column(name = "moderated_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime moderatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "seller_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "category_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "author_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Author author;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "publisher_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Publisher publisher;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "moderated_by", referencedColumnName = "id", insertable = false, updatable = false)
    private User moderator;
}
