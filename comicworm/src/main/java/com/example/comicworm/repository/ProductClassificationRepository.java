package com.example.comicworm.repository;

import com.example.comicworm.model.ProductClassification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductClassificationRepository extends JpaRepository<ProductClassification, Long> {
}
