package com.example.comicworm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.ExchangeOfferItem;
import com.example.comicworm.model.ExchangeOrderLink;
import com.example.comicworm.model.ExchangeRoom;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.ExchangeOfferStatus;
import com.example.comicworm.model.enums.ExchangeReviewStatus;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.ExchangeOfferItemRepository;
import com.example.comicworm.repository.ExchangeOfferRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.ExchangeRoomRepository;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.PaymentRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.exchange.ExchangeEscrowService;
import com.example.comicworm.service.exchange.ExchangeOrderService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExchangeOrderReviewGateTests {

    private static final Long HOST = 10L;
    private static final Long PARTNER = 20L;

    @Mock ExchangeRoomRepository rooms;
    @Mock ExchangeOfferRepository offers;
    @Mock ExchangeOfferItemRepository offeredItems;
    @Mock ExchangeOrderLinkRepository links;
    @Mock com.example.comicworm.repository.UserAddressRepository addresses;
    @Mock com.example.comicworm.repository.ProductRepository products;
    @Mock com.example.comicworm.repository.CheckoutBatchRepository batches;
    @Mock OrderRepository orders;
    @Mock OrderItemRepository items;
    @Mock com.example.comicworm.repository.OrderStatusHistoryRepository history;
    @Mock PaymentRepository payments;
    @Mock com.example.comicworm.repository.PaymentAllocationRepository allocations;
    @Mock UserRepository users;
    @Mock com.example.comicworm.service.exchange.IExchangeRoomService roomService;
    @Mock ExchangeEscrowService escrowService;
    @InjectMocks ExchangeOrderService service;

    private ExchangeRoom room;
    private ExchangeOffer offer;
    private ExchangeOrderLink link;
    private Order order;

    @BeforeEach
    void setUp() {
        room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(HOST);
        room.setTargetProductId(300L);
        room.setSelectedOfferId(5L);
        room.setStatus(ExchangeRoomStatus.COMPLETED);

        offer = new ExchangeOffer();
        offer.setId(5L);
        offer.setRoomId(1L);
        offer.setBuyerId(PARTNER);
        offer.setStatus(ExchangeOfferStatus.ACCEPTED);
        offer.setCashCompensation(new BigDecimal("50000"));
        offer.setCompensationPayerId(PARTNER);

        order = new Order();
        order.setId(100L);
        order.setOrderCode("EX-100");
        order.setCheckoutId(70L);
        order.setBuyerId(PARTNER);
        order.setSellerId(HOST);
        order.setStatus(OrderStatus.WAITING_CONFIRM);
        order.setPaymentStatus(OrderPaymentStatus.PENDING);

        link = new ExchangeOrderLink();
        link.setRoomId(1L);
        link.setOfferId(5L);
        link.setRecipientId(PARTNER);
        link.setOrderId(100L);
        link.setShippingMethod("STANDARD");

        when(links.findByOrderId(100L)).thenReturn(Optional.of(link));
        when(links.findByRoomIdOrderByIdAsc(1L)).thenReturn(List.of(link));
        when(rooms.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        when(offers.findByIdAndRoomId(5L, 1L)).thenReturn(Optional.of(offer));
        when(orders.findById(100L)).thenReturn(Optional.of(order));
        when(offeredItems.findByOfferId(5L)).thenReturn(List.of());
        when(users.findById(anyLong())).thenReturn(Optional.empty());
        when(items.findByOrderId(anyLong())).thenReturn(List.of());
        when(payments.findByCheckoutId(anyLong())).thenReturn(List.of());
    }

    @Test
    void dealIsSubmittedForReviewOnceEveryRequiredOrderExists() {
        assertTrue(service.submitForReviewIfReady(room, offer));
        assertEquals(ExchangeReviewStatus.PENDING, offer.getAdminReviewStatus());
    }

    @Test
    void tradeDealWaitsForBothOrders() {
        when(offeredItems.findByOfferId(5L)).thenReturn(List.of(new ExchangeOfferItem()));

        assertFalse(service.submitForReviewIfReady(room, offer));
        assertEquals(ExchangeReviewStatus.NOT_SUBMITTED, offer.getAdminReviewStatus());
    }

    @Test
    void reviewedDealIsNotResubmitted() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.REJECTED);

        assertFalse(service.submitForReviewIfReady(room, offer));
        assertEquals(ExchangeReviewStatus.REJECTED, offer.getAdminReviewStatus());
    }

    @Test
    void senderCannotPrepareBeforeAdminApproves() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.PENDING);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(100L, HOST, "ACCEPT"));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertTrue(error.getReason().contains("chờ admin duyệt"));
        assertEquals(OrderStatus.WAITING_CONFIRM, order.getStatus());
    }

    @Test
    void dealCreatedBeforeReviewStepKeepsWorking() {
        // Orders already existed when the review step shipped, so the deal was never submitted.
        offer.setAdminReviewStatus(ExchangeReviewStatus.NOT_SUBMITTED);

        service.updateStatus(100L, HOST, "ACCEPT");

        assertEquals(ExchangeReviewStatus.APPROVED, offer.getAdminReviewStatus());
        assertEquals(OrderStatus.PACKING, order.getStatus());
    }

    @Test
    void rejectedDealCannotBePrepared() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.REJECTED);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus(100L, HOST, "ACCEPT"));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals(OrderStatus.WAITING_CONFIRM, order.getStatus());
    }

    @Test
    void senderCanPrepareAfterApproval() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.APPROVED);

        service.updateStatus(100L, HOST, "ACCEPT");

        assertEquals(OrderStatus.PACKING, order.getStatus());
    }

    @Test
    void receivingCodOrderHandsOverToEscrow() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.APPROVED);
        order.setStatus(OrderStatus.SHIPPING);

        service.updateStatus(100L, PARTNER, "RECEIVE");

        assertEquals(OrderStatus.COMPLETED, order.getStatus());
        verify(escrowService).onOrderReceived(room, offer, order, List.of(order));
    }

    @Test
    void cancelByPartyDoesNotTouchEscrow() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.PENDING);
        com.example.comicworm.model.Product target = new com.example.comicworm.model.Product();
        target.setStockQuantity(0);
        when(products.lockForExchange(any())).thenReturn(Optional.of(target));

        service.updateStatus(100L, PARTNER, "CANCEL");

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(ExchangeRoomStatus.CANCELLED, room.getStatus());
        verify(escrowService, never()).onOrderReceived(any(), any(), any(), any());
    }
}
