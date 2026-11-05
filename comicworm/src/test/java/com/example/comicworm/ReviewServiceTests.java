package com.example.comicworm;

import com.example.comicworm.dto.request.CreateReviewRequest;
import com.example.comicworm.dto.response.ReviewDTO;
import com.example.comicworm.dto.response.ReviewableItemDTO;
import com.example.comicworm.mapper.ProductMapper;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.ReviewReply;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.ReviewReplyRepository;
import com.example.comicworm.repository.ReviewRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.impl.ReviewServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ReviewServiceTests {

    private ReviewRepository reviewRepository = mock(ReviewRepository.class);
    private ReviewReplyRepository reviewReplyRepository = mock(ReviewReplyRepository.class);
    private OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
    private OrderRepository orderRepository = mock(OrderRepository.class);
    private UserRepository userRepository = mock(UserRepository.class);
    private ProductMapper productMapper = new ProductMapper();

    private ReviewServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ReviewServiceImpl(
                reviewRepository,
                reviewReplyRepository,
                orderItemRepository,
                orderRepository,
                userRepository,
                productMapper
        );
    }

    private OrderItem createTestOrderItem(Long orderId, Long buyerId, OrderStatus status) {
        Order order = new Order();
        order.setId(orderId);
        order.setOrderCode("ORD-12345");
        order.setBuyerId(buyerId);
        order.setSellerId(99L);
        order.setStatus(status);

        OrderItem item = new OrderItem();
        item.setId(10L);
        item.setOrderId(orderId);
        item.setProductId(100L);
        item.setProductTitle("One Piece Tập 100");
        item.setImageUrl("https://example.com/onepiece.jpg");
        item.setConditionPercent(95);
        item.setUnitPrice(new BigDecimal("55000"));
        item.setQuantity(1);

        when(orderItemRepository.findById(10L)).thenReturn(Optional.of(item));
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        return item;
    }

    @Test
    void createReview_success_whenOrderCompletedAndBuyerMatches() {
        Long buyerId = 1L;
        createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        when(reviewRepository.existsByOrderItemId(10L)).thenReturn(false);

        User buyer = new User();
        buyer.setId(buyerId);
        buyer.setFullName("Nguyen Van A");
        when(userRepository.findById(buyerId)).thenReturn(Optional.of(buyer));

        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> {
            Review r = invocation.getArgument(0);
            r.setId(77L);
            r.setCreatedAt(LocalDateTime.now());
            return r;
        });

        CreateReviewRequest request = new CreateReviewRequest();
        request.setOrderItemId(10L);
        request.setRating(5);
        request.setProductQualityRating(5);
        request.setSellerAttitudeRating(4);
        request.setContent("Truyện đẹp, giao nhanh, người bán nhiệt tình!");

        ReviewDTO result = service.createReview(buyerId, request);

        assertNotNull(result);
        assertEquals(77L, result.getId());
        assertEquals(5, result.getRating());
        assertEquals(5, result.getProductQualityRating());
        assertEquals(4, result.getSellerAttitudeRating());
        assertEquals("Truyện đẹp, giao nhanh, người bán nhiệt tình!", result.getContent());
        assertEquals("Nguyen Van A", result.getBuyerName());

        verify(reviewRepository).save(any(Review.class));
    }

    @Test
    void createReview_fails_whenOrderNotCompleted() {
        Long buyerId = 1L;
        createTestOrderItem(1001L, buyerId, OrderStatus.SHIPPING);

        CreateReviewRequest request = new CreateReviewRequest();
        request.setOrderItemId(10L);
        request.setRating(5);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.createReview(buyerId, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("COMPLETED"));
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void createReview_fails_whenUserNotBuyer() {
        Long buyerId = 1L;
        Long hackerId = 2L;
        createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);

        CreateReviewRequest request = new CreateReviewRequest();
        request.setOrderItemId(10L);
        request.setRating(5);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.createReview(hackerId, request)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void createReview_fails_whenAlreadyReviewed() {
        Long buyerId = 1L;
        createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        when(reviewRepository.existsByOrderItemId(10L)).thenReturn(true);

        CreateReviewRequest request = new CreateReviewRequest();
        request.setOrderItemId(10L);
        request.setRating(5);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.createReview(buyerId, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("đã được bạn đánh giá"));
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void getReviewableItem_returnsItemAndStatus() {
        Long buyerId = 1L;
        createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        when(reviewRepository.findByOrderItemId(10L)).thenReturn(Optional.empty());

        ReviewableItemDTO dto = service.getReviewableItem(buyerId, 10L);

        assertNotNull(dto);
        assertEquals(10L, dto.getOrderItemId());
        assertEquals("One Piece Tập 100", dto.getProductTitle());
        assertFalse(dto.isReviewed());
        assertEquals("COMPLETED", dto.getOrderStatus());
    }

    @Test
    void getReviewableItemsByOrderCode_returnsItems() {
        Long buyerId = 1L;
        OrderItem item = createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        Order order = new Order();
        order.setId(1001L);
        order.setOrderCode("ORD-12345");
        order.setBuyerId(buyerId);
        order.setSellerId(99L);
        order.setStatus(OrderStatus.COMPLETED);

        when(orderRepository.findByOrderCode("ORD-12345")).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrderId(1001L)).thenReturn(java.util.List.of(item));
        when(reviewRepository.findByOrderItemIdIn(any())).thenReturn(java.util.List.of());

        java.util.List<ReviewableItemDTO> items = service.getReviewableItemsByOrderCode(buyerId, "ORD-12345");
        assertEquals(1, items.size());
        assertEquals("ORD-12345", items.get(0).getOrderCode());
    }

    @Test
    void getMyReviewableItems_returnsUserPurchasedItems() {
        Long buyerId = 1L;
        OrderItem item = createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        Order order = new Order();
        order.setId(1001L);
        order.setOrderCode("ORD-12345");
        order.setBuyerId(buyerId);
        order.setSellerId(99L);
        order.setStatus(OrderStatus.COMPLETED);

        when(orderRepository.findByBuyerIdOrderByCreatedAtDesc(buyerId)).thenReturn(java.util.List.of(order));
        when(orderItemRepository.findByOrderIdIn(any())).thenReturn(java.util.List.of(item));
        when(reviewRepository.findByOrderItemIdIn(any())).thenReturn(java.util.List.of());

        java.util.List<ReviewableItemDTO> items = service.getMyReviewableItems(buyerId);
        assertEquals(1, items.size());
        assertEquals("ORD-12345", items.get(0).getOrderCode());
        assertEquals("One Piece Tập 100", items.get(0).getProductTitle());
    }

    private Review reviewFor(Long reviewId, Long orderItemId, Long buyerId) {
        Review review = new Review();
        review.setId(reviewId);
        review.setOrderItemId(orderItemId);
        review.setBuyerId(buyerId);
        review.setRating(4);
        review.setContent("Đóng gói kỹ");
        review.setCreatedAt(LocalDateTime.of(2026, 11, 1, 9, 0));
        return review;
    }

    @Test
    void getMyReviewableItems_includesSellerReply_whenSellerReplied() {
        Long buyerId = 1L;
        OrderItem item = createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        Order order = orderRepository.findById(1001L).orElseThrow();

        User seller = new User();
        seller.setId(99L);
        seller.setFullName("Shop Truyện ABC");

        ReviewReply reply = new ReviewReply();
        reply.setId(500L);
        reply.setReviewId(77L);
        reply.setSellerId(99L);
        reply.setContent("Cảm ơn bạn đã ủng hộ shop!");
        reply.setCreatedAt(LocalDateTime.of(2026, 11, 2, 10, 0));
        reply.setUpdatedAt(LocalDateTime.of(2026, 11, 2, 11, 0));

        when(orderRepository.findByBuyerIdOrderByCreatedAtDesc(buyerId)).thenReturn(java.util.List.of(order));
        when(orderItemRepository.findByOrderIdIn(any())).thenReturn(java.util.List.of(item));
        when(reviewRepository.findByOrderItemIdIn(any())).thenReturn(java.util.List.of(reviewFor(77L, 10L, buyerId)));
        when(reviewReplyRepository.findByReviewIdIn(any())).thenReturn(java.util.List.of(reply));
        when(userRepository.findAllById(any())).thenReturn(java.util.List.of(seller));

        ReviewableItemDTO dto = service.getMyReviewableItems(buyerId).get(0);

        assertTrue(dto.isReviewed());
        assertEquals(77L, dto.getReviewId());
        assertNotNull(dto.getSellerReply());
        assertEquals("Cảm ơn bạn đã ủng hộ shop!", dto.getSellerReply().getContent());
        assertEquals("Shop Truyện ABC", dto.getSellerReply().getSellerName());
        assertEquals(LocalDateTime.of(2026, 11, 2, 10, 0), dto.getSellerReply().getCreatedAt());
        assertEquals(LocalDateTime.of(2026, 11, 2, 11, 0), dto.getSellerReply().getUpdatedAt());
    }

    @Test
    void getReviewableItem_hasNoSellerReply_whenSellerHasNotReplied() {
        Long buyerId = 1L;
        createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        when(reviewRepository.findByOrderItemId(10L)).thenReturn(Optional.of(reviewFor(77L, 10L, buyerId)));
        when(reviewReplyRepository.findByReviewIdIn(any())).thenReturn(java.util.List.of());

        ReviewableItemDTO dto = service.getReviewableItem(buyerId, 10L);

        assertTrue(dto.isReviewed());
        assertEquals(77L, dto.getReviewId());
        assertNull(dto.getSellerReply());
    }

    @Test
    void getReviewableItem_skipsReplyLookup_whenNotReviewed() {
        Long buyerId = 1L;
        createTestOrderItem(1001L, buyerId, OrderStatus.COMPLETED);
        when(reviewRepository.findByOrderItemId(10L)).thenReturn(Optional.empty());

        ReviewableItemDTO dto = service.getReviewableItem(buyerId, 10L);

        assertNull(dto.getReviewId());
        assertNull(dto.getSellerReply());
        verifyNoInteractions(reviewReplyRepository);
    }
}

