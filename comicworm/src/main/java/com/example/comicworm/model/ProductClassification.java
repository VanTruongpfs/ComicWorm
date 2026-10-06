package com.example.comicworm.model;

import com.example.comicworm.model.enums.ClassificationStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "product_classifications")
@Getter
@Setter
@NoArgsConstructor
public class ProductClassification {

    @Id
    @Column(name = "product_id", nullable = false)
    private Long productId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private ClassificationStatus status = ClassificationStatus.PENDING;

    @Column(name = "is_comic", nullable = true)
    private Boolean isComic;

    @DecimalMin("0")
    @DecimalMax("1")
    @Column(name = "confidence", nullable = true, precision = 5, scale = 4)
    private BigDecimal confidence;

    @Size(max = 100)
    @Column(name = "model_name", nullable = true, length = 100)
    private String modelName;

    @Column(name = "classified_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime classifiedAt;

    @Column(name = "error_message", nullable = true, columnDefinition = "text")
    private String errorMessage;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "product_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Product product;
}
