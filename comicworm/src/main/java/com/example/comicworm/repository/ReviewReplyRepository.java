package com.example.comicworm.repository;

import com.example.comicworm.model.ReviewReply;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReviewReplyRepository extends JpaRepository<ReviewReply, Long> {

    List<ReviewReply> findByReviewIdIn(Collection<Long> reviewIds);

    Optional<ReviewReply> findByReviewId(Long reviewId);

    boolean existsByReviewId(Long reviewId);
}
