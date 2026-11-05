package com.example.comicworm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.comicworm.dto.exchange.AdminExchangeDealDTO;
import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.ExchangeOrderLink;
import com.example.comicworm.model.ExchangeRoom;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ExchangeReviewStatus;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.repository.ExchangeOfferItemRepository;
import com.example.comicworm.repository.ExchangeOfferRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.ExchangeRoomRepository;
import com.example.comicworm.repository.ProductRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.exchange.AdminExchangeDealService;
import com.example.comicworm.service.exchange.ExchangeEscrowService;
import com.example.comicworm.service.exchange.ExchangeOrderService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class AdminExchangeDealServiceTests {

    private static final Long HOST = 10L;
    private static final Long PARTNER = 20L;
    private static final Long ADMIN = 1L;

    private final ExchangeOfferRepository offers = mock(ExchangeOfferRepository.class);
    private final ExchangeRoomRepository rooms = mock(ExchangeRoomRepository.class);
    private final ExchangeOfferItemRepository offerItems = mock(ExchangeOfferItemRepository.class);
    private final ExchangeOrderLinkRepository links = mock(ExchangeOrderLinkRepository.class);
    private final ProductRepository products = mock(ProductRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ExchangeOrderService orderService = mock(ExchangeOrderService.class);
    private final ExchangeEscrowService escrowService = mock(ExchangeEscrowService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final AdminExchangeDealService service = new AdminExchangeDealService(
            offers, rooms, offerItems, links, products, users, orderService, escrowService, notifications);

    private ExchangeRoom room;
    private ExchangeOffer offer;

    @BeforeEach
    void setUp() {
        room = new ExchangeRoom();
        room.setId(1L);
        room.setRoomCode("ROOM-1");
        room.setHostId(HOST);
        room.setTargetProductId(300L);
        room.setSelectedOfferId(5L);
        room.setStatus(ExchangeRoomStatus.COMPLETED);

        offer = new ExchangeOffer();
        offer.setId(5L);
        offer.setRoomId(1L);
        offer.setBuyerId(PARTNER);
        offer.setCashCompensation(new BigDecimal("50000"));
        offer.setCompensationPayerId(PARTNER);
        offer.setAdminReviewStatus(ExchangeReviewStatus.PENDING);

        when(offers.findRoomIdById(5L)).thenReturn(Optional.of(1L));
        when(offers.findById(5L)).thenReturn(Optional.of(offer));
        when(rooms.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        when(rooms.findById(1L)).thenReturn(Optional.of(room));
        when(links.findByRoomIdOrderByIdAsc(1L)).thenReturn(List.of(link(PARTNER, 100L), link(HOST, 101L)));
        when(orderService.orderDtos(1L)).thenReturn(List.of());
        when(offerItems.findByOfferId(5L)).thenReturn(List.of());
        when(products.findById(anyLong())).thenReturn(Optional.empty());
        User host = new User();
        host.setId(HOST);
        host.setFullName("Chủ phòng");
        when(users.findById(anyLong())).thenReturn(Optional.empty());
        when(users.findById(HOST)).thenReturn(Optional.of(host));
    }

    private ExchangeOrderLink link(Long recipient, Long orderId) {
        ExchangeOrderLink link = new ExchangeOrderLink();
        link.setRoomId(1L);
        link.setOfferId(5L);
        link.setRecipientId(recipient);
        link.setOrderId(orderId);
        return link;
    }

    @Test
    void approvePendingDealNotifiesBothParties() {
        AdminExchangeDealDTO dto = service.approve(ADMIN, 5L);

        assertEquals(ExchangeReviewStatus.APPROVED, offer.getAdminReviewStatus());
        assertEquals(ADMIN, offer.getReviewedBy());
        assertNotNull(offer.getReviewedAt());
        assertEquals("APPROVED", dto.reviewStatus());
        assertEquals("Chủ phòng", dto.hostName());
        verify(notifications).notify(eq(PARTNER), eq(100L), anyString(), anyString(), anyString());
        verify(notifications).notify(eq(HOST), eq(101L), anyString(), anyString(), anyString());
    }

    @Test
    void approveRefusesDealThatIsNotPending() {
        offer.setAdminReviewStatus(ExchangeReviewStatus.APPROVED);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.approve(ADMIN, 5L));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(notifications, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void approveRefusesOfferThatIsNoLongerSelected() {
        room.setSelectedOfferId(6L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.approve(ADMIN, 5L));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void rejectNeedsReason() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.reject(ADMIN, 5L, " "));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(orderService, never()).cancelByAdmin(any(), any(), any(), any());
        assertEquals(ExchangeReviewStatus.PENDING, offer.getAdminReviewStatus());
    }

    @Test
    void rejectCancelsDealAndNotifiesWithReason() {
        service.reject(ADMIN, 5L, "Truyện không đúng mô tả");

        assertEquals(ExchangeReviewStatus.REJECTED, offer.getAdminReviewStatus());
        assertEquals("Truyện không đúng mô tả", offer.getReviewNote());
        verify(orderService).cancelByAdmin(room, offer, ADMIN, "Admin từ chối giao dịch: Truyện không đúng mô tả");
        verify(notifications).notify(eq(PARTNER), eq(100L), anyString(), contains("Truyện không đúng mô tả"), anyString());
        verify(notifications).notify(eq(HOST), eq(101L), anyString(), contains("Truyện không đúng mô tả"), anyString());
    }

    @Test
    void listReturnsDealsWithRequestedStatus() {
        when(offers.findByAdminReviewStatusOrderByIdDesc(ExchangeReviewStatus.PENDING)).thenReturn(List.of(offer));

        List<AdminExchangeDealDTO> deals = service.list("pending");

        assertEquals(1, deals.size());
        assertEquals("ROOM-1", deals.get(0).roomCode());
        assertEquals(PARTNER, deals.get(0).partnerId());
    }

    @Test
    void listRejectsUnknownStatus() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.list("NOT_SUBMITTED"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
