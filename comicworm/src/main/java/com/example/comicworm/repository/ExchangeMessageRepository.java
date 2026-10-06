package com.example.comicworm.repository;

import com.example.comicworm.model.ExchangeMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeMessageRepository extends JpaRepository<ExchangeMessage, Long> {
}
