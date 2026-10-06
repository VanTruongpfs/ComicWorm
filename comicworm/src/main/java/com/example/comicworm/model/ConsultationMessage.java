package com.example.comicworm.model;

import com.example.comicworm.model.enums.ConsultationSenderType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "consultation_messages",
    indexes = {
        @Index(name = "idx_consultation_chat", columnList = "session_id, id")
    })
@Getter
@Setter
@NoArgsConstructor
public class ConsultationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "sender_type", nullable = false, length = 20)
    private ConsultationSenderType senderType;

    @NotNull
    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "suggested_product_ids", nullable = true, columnDefinition = "json")
    private List<Long> suggestedProductIds;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "session_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ConsultationSession session;
}
