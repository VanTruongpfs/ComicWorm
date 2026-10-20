package com.example.comicworm.controller;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.request.CreateReviewRequest;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.dto.response.ReviewableItemDTO;
import com.example.comicworm.service.IReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewApiController {

    private final IReviewService reviewService;

    /**
     * Gửi đánh giá cho sản phẩm đã mua thành công.
     */
    @PostMapping
    public ResponseEntity<ReviewDTO> createReview(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody CreateReviewRequest request
    ) {
        Long buyerId = requireUserId(user);
        ReviewDTO created = reviewService.createReview(buyerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Lấy thông tin và trạng thái đánh giá của 1 sản phẩm trong đơn.
     */
    @GetMapping("/item/{orderItemId}")
    public ResponseEntity<ReviewableItemDTO> getReviewableItem(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long orderItemId
    ) {
        Long buyerId = requireUserId(user);
        return ResponseEntity.ok(reviewService.getReviewableItem(buyerId, orderItemId));
    }

    /**
     * Lấy danh sách sản phẩm và trạng thái đánh giá của tất cả các sản phẩm trong đơn hàng theo orderId.
     */
    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<ReviewableItemDTO>> getReviewableItemsByOrder(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long orderId
    ) {
        Long buyerId = requireUserId(user);
        return ResponseEntity.ok(reviewService.getReviewableItemsByOrder(buyerId, orderId));
    }

    /**
     * Lấy danh sách sản phẩm và trạng thái đánh giá của đơn hàng theo orderCode.
     */
    @GetMapping("/order-code/{orderCode}")
    public ResponseEntity<List<ReviewableItemDTO>> getReviewableItemsByOrderCode(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable String orderCode
    ) {
        Long buyerId = requireUserId(user);
        return ResponseEntity.ok(reviewService.getReviewableItemsByOrderCode(buyerId, orderCode));
    }

    /**
     * Lấy toàn bộ các sản phẩm đã mua của người dùng hiện tại để đánh giá (ưu tiên đơn COMPLETED).
     */
    @GetMapping("/my-items")
    public ResponseEntity<List<ReviewableItemDTO>> getMyReviewableItems(
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        Long buyerId = requireUserId(user);
        return ResponseEntity.ok(reviewService.getMyReviewableItems(buyerId));
    }

    private Long requireUserId(CustomUserDetails user) {
        if (user == null || user.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để thực hiện chức năng này");
        }
        return user.getId();
    }
}

