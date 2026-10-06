package com.example.comicworm.repository;

import com.example.comicworm.model.ConsultationMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultationMessageRepository extends JpaRepository<ConsultationMessage, Long> {
}
