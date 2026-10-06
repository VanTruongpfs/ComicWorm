package com.example.comicworm.model;

import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @NotNull
    @Size(max = 150)
    @Column(name = "email", nullable = false, unique = true, length = 150)
    private String email;

    @Size(max = 255)
    @JsonIgnore
    @Column(name = "password_hash", nullable = true, length = 255)
    private String passwordHash;

    @Size(max = 255)
    @Column(name = "google_sub", nullable = true, unique = true, length = 255)
    private String googleSub;

    @NotNull
    @Size(max = 100)
    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Size(max = 20)
    @Column(name = "phone", nullable = true, length = 20)
    private String phone;

    @Column(name = "avatar_url", nullable = true, columnDefinition = "text")
    private String avatarUrl;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role = UserRole.USER;

    @NotNull
    @Column(name = "is_seller", nullable = false)
    private Boolean isSeller = false;

    @NotNull
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "account_status", nullable = false, length = 20)
    private AccountStatus accountStatus = AccountStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at", nullable = true, columnDefinition = "datetime")
    private LocalDateTime deletedAt;
}
