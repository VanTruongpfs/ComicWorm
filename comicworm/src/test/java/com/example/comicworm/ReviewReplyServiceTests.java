package com.example.comicworm;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.ReviewReply;
import com.example.comicworm.dto.response.SellerReviewDTO;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.ReviewReplyRepository;
import com.example.comicworm.repository.ReviewRepository;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.ReviewReplyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReviewReplyServiceTests {

    private ReviewRepository reviewRepository;
    private ReviewReplyRepository replyRepository;
    private OrderItemRepository orderItemRepository;
    private OrderRepository orderRepository;
    private ProductRepository productRepository;
    private NotificationService notificationService;
    private ReviewReplyService service;

    @BeforeEach
    void setUp() {
        reviewRepository = mock(ReviewRepository.class);
        replyRepository = mock(ReviewReplyRepository.class);
        orderItemRepository = mock(OrderItemRepository.class);
        orderRepository = mock(OrderRepository.class);
        productRepository = mock(ProductRepository.class);
        notificationService = mock(NotificationService.class);
        service = new ReviewReplyService(reviewRepository, replyRepository, orderItemRepository,
                orderRepository, productRepository, notificationService);

        Review review = new Review();
        review.setId(30L);
        review.setOrderItemId(20L);
        review.setBuyerId(7L);
        when(reviewRepository.findById(30L)).thenReturn(Optional.of(review));

        OrderItem item = new OrderItem();
        item.setId(20L);
        item.setOrderId(10L);
        item.setProductId(40L);
        item.setProductTitle("Truyện tranh");
        when(orderItemRepository.findById(20L)).thenReturn(Optional.of(item));

        Order order = new Order();
        order.setId(10L);
        order.setSellerId(5L);
        order.setOrderCode("ORD-10");
        when(orderRepository.findById(10L)).thenReturn(Optional.of(order));

        Product product = new Product();
        product.setId(40L);
        product.setSellerId(5L);
        when(productRepository.findById(40L)).thenReturn(Optional.of(product));

        when(replyRepository.existsByReviewId(30L)).thenReturn(false);
        when(replyRepository.save(any(ReviewReply.class))).thenAnswer(invocation -> {
            ReviewReply reply = invocation.getArgument(0);
            reply.setId(60L);
            return reply;
        });
    }

    @Test
    void createsReplyAndNotifiesReviewBuyer() {
        var created = service.create(5L, 30L, "  Cảm ơn bạn  ");

        assertEquals(60L, created.id());
        assertEquals("Cảm ơn bạn", created.content());
        verify(notificationService).notify(
                7L, 10L, "Người bán đã trả lời đánh giá",
                "Người bán đã phản hồi đánh giá của bạn về sản phẩm Truyện tranh.",
                "REVIEW_REPLIED:30:7");
    }

    @Test
    void rejectsMissingReviewAndWrongOrderOrProductSeller() {
        when(reviewRepository.findById(99L)).thenReturn(Optional.empty());
        assertStatus(HttpStatus.NOT_FOUND, () -> service.create(5L, 99L, "Trả lời"));

        assertStatus(HttpStatus.FORBIDDEN, () -> service.create(9L, 30L, "Trả lời"));

        Product otherSellerProduct = new Product();
        otherSellerProduct.setId(40L);
        otherSellerProduct.setSellerId(9L);
        when(productRepository.findById(40L)).thenReturn(Optional.of(otherSellerProduct));
        assertStatus(HttpStatus.FORBIDDEN, () -> service.create(5L, 30L, "Trả lời"));
    }

    @Test
    void rejectsDuplicateAndInvalidReplyContent() {
        when(replyRepository.existsByReviewId(30L)).thenReturn(true);
        assertStatus(HttpStatus.CONFLICT, () -> service.create(5L, 30L, "Trả lời"));
        when(replyRepository.existsByReviewId(30L)).thenReturn(false);

        assertStatus(HttpStatus.BAD_REQUEST, () -> service.create(5L, 30L, "  "));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.create(5L, 30L, "x".repeat(1001)));
        verify(replyRepository, never()).save(any(ReviewReply.class));
    }

    @Test
    void updatesAndDeletesOnlyOwnedReplyThenAllowsAnotherReply() {
        ReviewReply reply = new ReviewReply();
        reply.setId(60L);
        reply.setReviewId(30L);
        reply.setSellerId(5L);
        reply.setContent("Cũ");
        when(replyRepository.findByReviewId(30L)).thenReturn(Optional.of(reply));

        var updated = service.update(5L, 30L, "  Mới  ");
        assertEquals("Mới", updated.content());
        verifyNoInteractions(notificationService);
        service.delete(5L, 30L);
        verify(replyRepository).delete(reply);

        service.create(5L, 30L, "Có thể trả lời lại");
        verify(notificationService).notify(
                7L, 10L, "Người bán đã trả lời đánh giá",
                "Người bán đã phản hồi đánh giá của bạn về sản phẩm Truyện tranh.",
                "REVIEW_REPLIED:30:7");
    }

    @Test
    void rejectsEditingReplyOwnedByAnotherSeller() {
        ReviewReply reply = new ReviewReply();
        reply.setReviewId(30L);
        reply.setSellerId(8L);
        when(replyRepository.findByReviewId(30L)).thenReturn(Optional.of(reply));

        assertStatus(HttpStatus.FORBIDDEN, () -> service.update(5L, 30L, "Sửa"));
        assertStatus(HttpStatus.FORBIDDEN, () -> service.delete(5L, 30L));
    }

    @Test
    void listsReviewsWithReplyFilterAndDoesNotExposeBuyerContactFields() {
        when(reviewRepository.findSellerReviews(5L, "false", PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(reviewRow(false)), PageRequest.of(0, 10), 1));
        when(reviewRepository.findSellerReviews(5L, "true", PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(reviewRow(true)), PageRequest.of(0, 10), 1));
        when(reviewRepository.findSellerReviews(5L, "all", PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(reviewRow(true), reviewRow(false)), PageRequest.of(0, 10), 2));

        var unreplied = service.getSellerReviews(5L, "false", 0, 10);
        var replied = service.getSellerReviews(5L, "true", 0, 10);
        var all = service.getSellerReviews(5L, "all", 0, 10);

        assertEquals(30L, unreplied.getItems().get(0).reviewId());
        assertNull(unreplied.getItems().get(0).reply());
        assertEquals(60L, replied.getItems().get(0).reply().id());
        assertEquals(2, all.getItems().size());
        assertEquals(replied.getItems().get(0).reviewId(), all.getItems().get(0).reviewId());
        verify(reviewRepository).findSellerReviews(5L, "false", PageRequest.of(0, 10));
        verify(reviewRepository).findSellerReviews(5L, "true", PageRequest.of(0, 10));
        verify(reviewRepository).findSellerReviews(5L, "all", PageRequest.of(0, 10));
        assertTrue(java.util.Arrays.stream(SellerReviewDTO.class.getRecordComponents())
                .noneMatch(component -> component.getName().contains("email")
                        || component.getName().contains("phone")));
    }

    @Test
    void rejectsUnsupportedReplyFilter() {
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.getSellerReviews(5L, "yes", 0, 10));
        verifyNoInteractions(reviewRepository);
    }

    private ReviewRepository.SellerReviewRow reviewRow(boolean withReply) {
        return new ReviewRepository.SellerReviewRow() {
            @Override public Long getReviewId() { return 30L; }
            @Override public Integer getRating() { return 5; }
            @Override public String getContent() { return "Tốt"; }
            @Override public java.time.LocalDateTime getCreatedAt() { return null; }
            @Override public String getBuyerName() { return "Người mua"; }
            @Override public Long getProductId() { return 40L; }
            @Override public String getProductTitle() { return "Truyện tranh"; }
            @Override public Long getOrderId() { return 10L; }
            @Override public String getOrderCode() { return "ORD-10"; }
            @Override public Long getReplyId() { return withReply ? 60L : null; }
            @Override public String getReplyContent() { return withReply ? "Cảm ơn" : null; }
            @Override public java.time.LocalDateTime getReplyCreatedAt() { return null; }
            @Override public java.time.LocalDateTime getReplyUpdatedAt() { return null; }
        };
    }

    private void assertStatus(HttpStatus status, Runnable action) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, action::run);
        assertEquals(status, exception.getStatusCode());
    }
}
