package com.example.comicworm.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "product_image_features")
@Getter
@Setter
@NoArgsConstructor
public class ProductImageFeature {

    @Id
    @Column(name = "image_id", nullable = false)
    private Long imageId;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "embedding", nullable = false, columnDefinition = "json")
    private List<Double> embedding;

    @NotNull
    @Size(max = 100)
    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp")
    private LocalDateTime updatedAt;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "image_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ProductImage image;
}
