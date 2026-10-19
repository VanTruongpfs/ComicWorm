package com.example.comicworm;

import com.example.comicworm.model.Category;
import com.example.comicworm.model.CheckoutBatch;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderItem;
import com.example.comicworm.model.Product;
import com.example.comicworm.model.Review;
import com.example.comicworm.model.ReviewReply;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.ReviewRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest
@Transactional
class SellerReviewRepositoryMySqlTests {

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private ReviewRepository reviewRepository;

    @Test
    void filtersSellerReviewsByReplyStateAndNeverReturnsAnotherSellersOrders() {
        User buyer = save(user("Buyer"));
        User seller = save(user("Seller"));
        User anotherSeller = save(user("Other Seller"));
        Review unreplied = createReview(buyer, seller, "Chưa trả lời");
        Review replied = createReview(buyer, seller, "Đã trả lời");
        Review foreignReview = createReview(buyer, anotherSeller, "Đánh giá của shop khác");

        ReviewReply reply = new ReviewReply();
        reply.setReviewId(replied.getId());
        reply.setSellerId(seller.getId());
        reply.setContent("Cảm ơn");
        save(reply);

        Page<ReviewRepository.SellerReviewRow> all = reviewRepository.findSellerReviews(
                seller.getId(), "all", PageRequest.of(0, 10));
        Page<ReviewRepository.SellerReviewRow> noReply = reviewRepository.findSellerReviews(
                seller.getId(), "false", PageRequest.of(0, 10));
        Page<ReviewRepository.SellerReviewRow> hasReply = reviewRepository.findSellerReviews(
                seller.getId(), "true", PageRequest.of(0, 10));

        assertEquals(2, all.getTotalElements());
        assertEquals(replied.getId(), all.getContent().get(0).getReviewId());
        assertEquals(1, noReply.getTotalElements());
        assertEquals(unreplied.getId(), noReply.getContent().get(0).getReviewId());
        assertEquals(1, hasReply.getTotalElements());
        assertEquals(replied.getId(), hasReply.getContent().get(0).getReviewId());
        assertEquals("Buyer", hasReply.getContent().get(0).getBuyerName());
        assertEquals("Cảm ơn", hasReply.getContent().get(0).getReplyContent());
        assertEquals(1L, reviewRepository.findSellerReviews(
                anotherSeller.getId(), "all", PageRequest.of(0, 10)).getTotalElements());
        assertFalse(all.getContent().stream().anyMatch(row -> row.getReviewId().equals(foreignReview.getId())));
    }

    private Review createReview(User buyer, User seller, String content) {
        Category category = new Category();
        category.setName("Manga test " + key());
        category.setSlug(key());
        save(category);

        Product product = new Product();
        product.setSellerId(seller.getId());
        product.setTitle("Truyện test");
        product.setSlug(key());
        product.setDescription("Test product");
        product.setCategoryId(category.getId());
        product.setConditionPercent(100);
        product.setPrice(new BigDecimal("100.00"));
        save(product);

        CheckoutBatch checkout = new CheckoutBatch();
        checkout.setCheckoutCode(key());
        checkout.setBuyerId(buyer.getId());
        checkout.setIdempotencyKey(key());
        checkout.setTotalAmount(new BigDecimal("100.00"));
        checkout.setExpiresAt(LocalDateTime.now().plusDays(1));
        save(checkout);

        Order order = new Order();
        order.setOrderCode(key());
        order.setCheckoutId(checkout.getId());
        order.setBuyerId(buyer.getId());
        order.setSellerId(seller.getId());
        order.setSubtotalAmount(new BigDecimal("100.00"));
        order.setShippingFee(BigDecimal.ZERO);
        order.setTotalAmount(new BigDecimal("100.00"));
        order.setRecipientName("Người nhận");
        order.setRecipientPhone("0900000000");
        order.setShippingAddress("Địa chỉ test");
        order.setStatus(OrderStatus.COMPLETED);
        save(order);

        OrderItem item = new OrderItem();
        item.setOrderId(order.getId());
        item.setProductId(product.getId());
        item.setProductTitle(product.getTitle());
        item.setConditionPercent(100);
        item.setUnitPrice(new BigDecimal("100.00"));
        item.setQuantity(1);
        save(item);

        Review review = new Review();
        review.setOrderItemId(item.getId());
        review.setBuyerId(buyer.getId());
        review.setRating(5);
        review.setContent(content);
        return save(review);
    }

    private User user(String fullName) {
        User user = new User();
        user.setEmail(key() + "@example.test");
        user.setPasswordHash("integration-test");
        user.setFullName(fullName);
        user.setRole(UserRole.USER);
        user.setAccountStatus(AccountStatus.ACTIVE);
        user.setIsSeller(true);
        return user;
    }

    private <T> T save(T entity) {
        entityManager.persist(entity);
        entityManager.flush();
        return entity;
    }

    private String key() {
        return UUID.randomUUID().toString();
    }
}
