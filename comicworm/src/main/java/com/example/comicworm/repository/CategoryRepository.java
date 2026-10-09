package com.example.comicworm.repository;

import com.example.comicworm.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Integer> {

    Optional<Category> findBySlug(String slug);

    List<Category> findByParentId(Integer parentId);
}
