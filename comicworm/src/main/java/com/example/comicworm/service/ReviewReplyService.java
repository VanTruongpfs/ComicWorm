package com.example.comicworm.service;

import com.example.comicworm.dto.response.PageResponseDTO;
import com.example.comicworm.dto.response.ReviewReplyDTO;
import com.example.comicworm.dto.response.SellerReviewDTO;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.ReviewReply;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.ReviewReplyRepository;
import com.example.comicworm.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Profile("!preview")
@RequiredArgsConstructor
@Transactional
public class ReviewReplyService {

    private static final int MAX_PAGE_SIZE = 50;

    private final ReviewRepository reviewRepository;
    private final ReviewReplyRepository reviewReplyRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final NotificationService notificationService;

    public ReviewReplyDTO create(Long sellerId, Long reviewId, String content) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá"));
        OrderItem orderItem = orderItemRepository.findById(review.getOrderItemId())
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm trong đơn hàng"));
        Order order = orderRepository.findById(orderItem.getOrderId())
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng của đánh giá"));
        if (!sellerId.equals(order.getSellerId())) {
            throw error(HttpStatus.FORBIDDEN, "Bạn không có quyền trả lời đánh giá này");
        }

        Product product = productRepository.findById(orderItem.getProductId())
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm của đánh giá"));
        if (!sellerId.equals(product.getSellerId())) {
            throw error(HttpStatus.FORBIDDEN, "Đánh giá không thuộc sản phẩm bạn đang bán");
        }
        if (reviewReplyRepository.existsByReviewId(reviewId)) {
            throw error(HttpStatus.CONFLICT, "Đánh giá này đã có phản hồi");
        }

        ReviewReply reply = new ReviewReply();
        reply.setReviewId(reviewId);
        reply.setSellerId(sellerId);
        reply.setContent(normalizeContent(content));
        ReviewReply saved = reviewReplyRepository.save(reply);

        notificationService.notify(
                review.getBuyerId(),
                order.getId(),
                "Người bán đã trả lời đánh giá",
                "Người bán đã phản hồi đánh giá của bạn về sản phẩm " + orderItem.getProductTitle() + ".",
                "REVIEW_REPLIED:" + reviewId + ":" + review.getBuyerId());
        return toDTO(saved);
    }

    public ReviewReplyDTO update(Long sellerId, Long reviewId, String content) {
        ReviewReply reply = ownedReply(sellerId, reviewId);
        reply.setContent(normalizeContent(content));
        return toDTO(reviewReplyRepository.save(reply));
    }

    public void delete(Long sellerId, Long reviewId) {
        reviewReplyRepository.delete(ownedReply(sellerId, reviewId));
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<SellerReviewDTO> getSellerReviews(
            Long sellerId, String replied, int page, int size) {
        if (!List.of("all", "true", "false").contains(replied)) {
            throw error(HttpStatus.BAD_REQUEST, "replied chỉ nhận all, true hoặc false");
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        Page<ReviewRepository.SellerReviewRow> reviews = reviewRepository.findSellerReviews(
                sellerId, replied, PageRequest.of(safePage, safeSize));
        List<SellerReviewDTO> items = reviews.getContent().stream()
                .map(row -> new SellerReviewDTO(
                        row.getReviewId(),
                        row.getRating(),
                        row.getContent(),
                        row.getCreatedAt(),
                        row.getBuyerName(),
                        row.getProductId(),
                        row.getProductTitle(),
                        row.getOrderId(),
                        row.getOrderCode(),
                        row.getReplyId() == null ? null : new SellerReviewDTO.Reply(
                                row.getReplyId(),
                                row.getReplyContent(),
                                row.getReplyCreatedAt(),
                                row.getReplyUpdatedAt())))
                .toList();
        return PageResponseDTO.of(reviews, items);
    }

    private ReviewReply ownedReply(Long sellerId, Long reviewId) {
        ReviewReply reply = reviewReplyRepository.findByReviewId(reviewId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Không tìm thấy phản hồi đánh giá"));
        if (!sellerId.equals(reply.getSellerId())) {
            throw error(HttpStatus.FORBIDDEN, "Bạn không có quyền sửa hoặc xóa phản hồi này");
        }
        return reply;
    }

    private String normalizeContent(String content) {
        String normalized = content == null ? "" : content.trim();
        if (normalized.isEmpty()) {
            throw error(HttpStatus.BAD_REQUEST, "Nội dung phản hồi không được để trống");
        }
        if (normalized.length() > 1000) {
            throw error(HttpStatus.BAD_REQUEST, "Nội dung phản hồi không được vượt quá 1000 ký tự");
        }
        return normalized;
    }

    private ReviewReplyDTO toDTO(ReviewReply reply) {
        return new ReviewReplyDTO(
                reply.getId(), reply.getContent(), reply.getCreatedAt(), reply.getUpdatedAt());
    }

    private ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
