package com.example.comicworm.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "exchange_messages",
    indexes = {
        @Index(name = "idx_exchange_chat", columnList = "room_id, id")
    })
@Getter
@Setter
@NoArgsConstructor
public class ExchangeMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @NotNull
    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(name = "content", nullable = true, columnDefinition = "text")
    private String content;

    @Column(name = "image_url", nullable = true, columnDefinition = "text")
    private String imageUrl;

    @Size(max = 100)
    @Column(name = "client_message_key", nullable = true, unique = true, length = 100)
    private String clientMessageKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumns({
        @JoinColumn(name = "room_id", referencedColumnName = "room_id", insertable = false, updatable = false),
        @JoinColumn(name = "sender_id", referencedColumnName = "user_id", insertable = false, updatable = false)
    })
    private ExchangeRoomMember senderMembership;
}
