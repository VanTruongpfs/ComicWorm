package com.example.comicworm;

import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.*;
import com.example.comicworm.model.id.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/** Run against the real schema using tools/verify_spring_mysql.py. */
@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "JPA_INTEGRATION_TEST", matches = "true")
class JpaMappingIntegrationTests {
    @PersistenceContext
    private EntityManager em;

    @Test
    void validatesAllTablesAndLoadsEveryEntity() {
        assertEquals(32, em.getMetamodel().getEntities().size());
        for (var entity : em.getMetamodel().getEntities()) {
            em.createQuery("select e from " + entity.getName() + " e").setMaxResults(1).getResultList();
        }
    }

    @Test
    void persistsCheckoutRefundReviewsPointsAndNotifications() {
        User buyer = user("Buyer");
        User seller = user("Seller");
        Product product = product(seller);

        AuthSession auth = new AuthSession();
        auth.setUserId(buyer.getId());
        auth.setTokenHash("a".repeat(64));
        auth.setExpiresAt(LocalDateTime.now().plusHours(1));
        save(auth);
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(buyer.getId());
        token.setTokenHash("b".repeat(64));
        token.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        save(token);

        Cart cart = new Cart();
        cart.setUserId(buyer.getId());
        save(cart);
        CartItem cartItem = new CartItem();
        cartItem.setCartId(cart.getId());
        cartItem.setProductId(product.getId());
        save(cartItem);

        CheckoutBatch checkout = new CheckoutBatch();
        checkout.setCheckoutCode(key());
        checkout.setBuyerId(buyer.getId());
        checkout.setIdempotencyKey(key());
        checkout.setTotalAmount(new BigDecimal("110.00"));
        checkout.setExpiresAt(LocalDateTime.now().plusMinutes(30));
        save(checkout);

        Order order = new Order();
        order.setOrderCode(key());
        order.setCheckoutId(checkout.getId());
        order.setBuyerId(buyer.getId());
        order.setSellerId(seller.getId());
        order.setSubtotalAmount(new BigDecimal("100.00"));
        order.setShippingFee(new BigDecimal("10.00"));
        order.setTotalAmount(new BigDecimal("110.00"));
        order.setRecipientName("Người nhận thử nghiệm");
        order.setRecipientPhone("0900000000");
        order.setShippingAddress("Địa chỉ thử nghiệm");
        order.setStatus(OrderStatus.COMPLETED);
        order.setPaymentStatus(OrderPaymentStatus.PAID);
        save(order);

        OrderItem item = new OrderItem();
        item.setOrderId(order.getId());
        item.setProductId(product.getId());
        item.setProductTitle(product.getTitle());
        item.setConditionPercent(98);
        item.setUnitPrice(new BigDecimal("100.00"));
        item.setQuantity(1);
        save(item);

        OrderStatusHistory history = new OrderStatusHistory();
        history.setOrderId(order.getId());
        history.setNewStatus(OrderStatus.COMPLETED);
        history.setChangedBy(seller.getId());
        save(history);

        Payment payment = new Payment();
        payment.setPaymentCode(key());
        payment.setCheckoutId(checkout.getId());
        payment.setMethod(PaymentMethod.VIETQR);
        payment.setAmount(new BigDecimal("110.00"));
        payment.setStatus(PaymentStatus.SUCCEEDED);
        payment.setIdempotencyKey(key());
        save(payment);

        PaymentAllocation allocation = new PaymentAllocation();
        allocation.setPaymentId(payment.getId());
        allocation.setOrderId(order.getId());
        allocation.setAmount(new BigDecimal("110.00"));
        save(allocation);
        PaymentEvent event = new PaymentEvent();
        event.setPaymentId(payment.getId());
        event.setProviderEventId(key());
        event.setEventType("PAYMENT_SUCCEEDED");
        save(event);

        Refund refund = new Refund();
        refund.setRefundCode(key());
        refund.setPaymentId(payment.getId());
        refund.setOrderId(order.getId());
        refund.setAmount(new BigDecimal("10.00"));
        refund.setIdempotencyKey(key());
        save(refund);

        Review review = new Review();
        review.setOrderItemId(item.getId());
        review.setBuyerId(buyer.getId());
        review.setRating(5);
        save(review);
        ReviewReply reply = new ReviewReply();
        reply.setReviewId(review.getId());
        reply.setSellerId(seller.getId());
        reply.setContent("Cảm ơn bạn!");
        save(reply);

        LoyaltyAccount account = new LoyaltyAccount();
        account.setUserId(buyer.getId());
        account.setPointsBalance(10L);
        save(account);
        LoyaltyTransaction points = new LoyaltyTransaction();
        points.setUserId(buyer.getId());
        points.setOrderId(order.getId());
        points.setTransactionType(LoyaltyTransactionType.EARN);
        points.setPointsDelta(10L);
        points.setBalanceAfter(10L);
        points.setIdempotencyKey(key());
        save(points);

        Notification notification = new Notification();
        notification.setUserId(buyer.getId());
        notification.setOrderId(order.getId());
        notification.setTitle("Cập nhật đơn hàng");
        notification.setContent("Đơn hàng đã hoàn tất");
        notification.setDeduplicationKey(key());
        save(notification);

        Long refundId = refund.getId();
        Long reviewId = review.getId();
        Long pointId = points.getId();
        em.clear();
        Refund loaded = em.find(Refund.class, refundId);
        assertEquals(order.getId(), loaded.getAllocation().getOrderId());
        assertEquals(payment.getId(), loaded.getAllocation().getPaymentId());
        assertNotNull(em.find(PaymentAllocation.class, new PaymentAllocationId(payment.getId(), order.getId())));
        assertEquals(buyer.getId(), em.find(Review.class, reviewId).getBuyer().getId());
        assertEquals(10L, em.find(LoyaltyTransaction.class, pointId).getLoyaltyAccount().getPointsBalance());
        assertNotNull(loaded.getCreatedAt());
    }

    @Test
    void persistsExchangeCompositeKeysAndAiJson() {
        User host = user("Host");
        User buyer = user("Trader");
        Product target = product(host);
        Product offered = product(buyer);

        ProductImage image = new ProductImage();
        image.setProductId(target.getId());
        image.setImageUrl("https://example.com/test.jpg");
        save(image);
        ProductImageFeature feature = new ProductImageFeature();
        feature.setImageId(image.getId());
        feature.setEmbedding(List.of(0.1, 0.2, 0.3));
        feature.setModelName("integration-model");
        save(feature);
        ProductClassification classification = new ProductClassification();
        classification.setProductId(target.getId());
        classification.setStatus(ClassificationStatus.SUCCEEDED);
        classification.setIsComic(true);
        classification.setConfidence(new BigDecimal("0.9900"));
        classification.setModelName("integration-classifier");
        classification.setClassifiedAt(LocalDateTime.now());
        save(classification);

        ConsultationSession session = new ConsultationSession();
        session.setUserId(buyer.getId());
        save(session);
        ConsultationMessage suggestion = new ConsultationMessage();
        suggestion.setSessionId(session.getId());
        suggestion.setSenderType(ConsultationSenderType.ASSISTANT);
        suggestion.setContent("Truyện được đề xuất");
        suggestion.setSuggestedProductIds(List.of(target.getId()));
        save(suggestion);

        ExchangeRoom room = new ExchangeRoom();
        room.setRoomCode(key());
        room.setHostId(host.getId());
        room.setTargetProductId(target.getId());
        save(room);
        ExchangeRoomMember member = new ExchangeRoomMember();
        member.setRoomId(room.getId());
        member.setUserId(buyer.getId());
        save(member);
        ExchangeRoomMember hostMember = new ExchangeRoomMember();
        hostMember.setRoomId(room.getId());
        hostMember.setUserId(host.getId());
        save(hostMember);

        ExchangeOffer offer = new ExchangeOffer();
        offer.setRoomId(room.getId());
        offer.setBuyerId(buyer.getId());
        save(offer);
        ExchangeOfferItem offerItem = new ExchangeOfferItem();
        offerItem.setOfferId(offer.getId());
        offerItem.setProductId(offered.getId());
        offerItem.setOwnerId(buyer.getId());
        offerItem.setQuantity(1);
        offerItem.setTitleSnapshot(offered.getTitle());
        offerItem.setConditionSnapshot(98);
        save(offerItem);
        ExchangeMessage message = new ExchangeMessage();
        message.setRoomId(room.getId());
        message.setSenderId(buyer.getId());
        message.setContent("Mình muốn trao đổi truyện này");
        save(message);

        room.setSelectedOfferId(offer.getId());
        em.flush();
        Long roomId = room.getId();
        Long offerId = offer.getId();
        Long messageId = message.getId();
        em.clear();
        assertEquals(offerId, em.find(ExchangeRoom.class, roomId).getSelectedOffer().getId());
        assertEquals(buyer.getId(), em.find(ExchangeOffer.class, offerId).getBuyerMembership().getUserId());
        assertEquals(roomId, em.find(ExchangeMessage.class, messageId).getSenderMembership().getRoomId());
        assertNotNull(em.find(ExchangeRoomMember.class, new ExchangeRoomMemberId(roomId, buyer.getId())));
        assertEquals(List.of(0.1, 0.2, 0.3), em.find(ProductImageFeature.class, image.getId()).getEmbedding());
        assertEquals(List.of(target.getId()), em.find(ConsultationMessage.class, suggestion.getId()).getSuggestedProductIds());
    }

    private User user(String name) {
        User user = new User();
        user.setEmail(key() + "@example.test");
        user.setGoogleSub(key());
        user.setFullName(name);
        return save(user);
    }

    private Product product(User owner) {
        Category category = new Category();
        category.setName("Manga thử nghiệm");
        category.setSlug(key());
        save(category);
        Author author = new Author();
        author.setName("Tác giả thử nghiệm");
        save(author);
        Publisher publisher = new Publisher();
        publisher.setName("Nhà xuất bản thử nghiệm");
        publisher.setSlug(key());
        save(publisher);
        Product product = new Product();
        product.setSellerId(owner.getId());
        product.setCategoryId(category.getId());
        product.setAuthorId(author.getId());
        product.setPublisherId(publisher.getId());
        product.setTitle("Truyện thử nghiệm");
        product.setSlug(key());
        product.setDescription("Nội dung thử nghiệm entity");
        product.setConditionPercent(98);
        product.setPrice(new BigDecimal("100.00"));
        return save(product);
    }

    private <T> T save(T entity) {
        em.persist(entity);
        em.flush();
        return entity;
    }

    private String key() {
        return UUID.randomUUID().toString();
    }
}
