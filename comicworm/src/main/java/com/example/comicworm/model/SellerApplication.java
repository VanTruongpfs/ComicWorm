package com.example.comicworm.model;

import com.example.comicworm.model.enums.SellerApplicationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** A buyer's request to become a seller; an admin approves or rejects it. CCCD data is demo sample data. */
@Entity
@Table(name = "seller_applications")
@Getter
@Setter
@NoArgsConstructor
public class SellerApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SellerApplicationStatus status = SellerApplicationStatus.PENDING;

    @Column(name = "id_number", nullable = false, length = 12, columnDefinition = "char(12)")
    private String idNumber;

    @Column(name = "id_full_name", nullable = false, length = 100)
    private String idFullName;

    @Column(name = "id_date_of_birth", nullable = false)
    private LocalDate idDateOfBirth;

    @Column(name = "id_issue_date", nullable = false)
    private LocalDate idIssueDate;

    @Column(name = "id_issue_place", nullable = false, length = 200)
    private String idIssuePlace;

    @CreationTimestamp
    @Column(name = "submitted_at", nullable = false, columnDefinition = "timestamp", updatable = false)
    private LocalDateTime submittedAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_note", length = 500)
    private String reviewNote;
}
