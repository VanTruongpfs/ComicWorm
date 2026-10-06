package com.example.comicworm.model;

import com.example.comicworm.model.id.ExchangeRoomMemberId;
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
@Table(name = "exchange_room_members")
@Getter
@Setter
@NoArgsConstructor
@IdClass(ExchangeRoomMemberId.class)
public class ExchangeRoomMember {

    @Id
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime joinedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "room_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ExchangeRoom room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @JoinColumn(name = "user_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User user;
}
