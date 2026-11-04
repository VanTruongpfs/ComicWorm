package com.example.comicworm.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record SellerApplicationDTO(
        Long id,
        Long userId,
        String userFullName,
        String userEmail,
        String status,
        String idNumber,
        String idFullName,
        LocalDate idDateOfBirth,
        LocalDate idIssueDate,
        String idIssuePlace,
        LocalDateTime submittedAt,
        LocalDateTime reviewedAt,
        String reviewNote) {
}
