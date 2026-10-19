package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.ReviewReplyRequest;
import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.dto.response.ReviewReplyDTO;
import com.example.comicworm.dto.response.SellerReviewDTO;
import com.example.comicworm.service.ReviewReplyService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Profile("!preview")
@RequiredArgsConstructor
@RequestMapping("/api/seller/reviews")
public class SellerReviewController {

    private final ReviewReplyService reviewReplyService;

    @PostMapping("/{reviewId}/reply")
    public ReviewReplyDTO create(
            @PathVariable Long reviewId,
            @RequestBody ReviewReplyRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        try {
                return reviewReplyService.create(user.getId(), reviewId, request == null ? null : request.content());
        } catch (DataIntegrityViolationException exception) {
            throw conflict();
        }
    }

    @PutMapping("/{reviewId}/reply")
    public ReviewReplyDTO update(
            @PathVariable Long reviewId,
            @RequestBody ReviewReplyRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        return reviewReplyService.update(user.getId(), reviewId, request == null ? null : request.content());
    }

    @DeleteMapping("/{reviewId}/reply")
    public ResponseEntity<Void> delete(
            @PathVariable Long reviewId,
            @AuthenticationPrincipal CustomUserDetails user) {
        reviewReplyService.delete(user.getId(), reviewId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public PageResponseDTO<SellerReviewDTO> list(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(defaultValue = "all") String replied,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return reviewReplyService.getSellerReviews(user.getId(), replied, page, size);
    }

    private ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Đánh giá đã có phản hồi");
    }
}
