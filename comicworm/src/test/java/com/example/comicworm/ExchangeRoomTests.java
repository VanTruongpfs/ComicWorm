package com.example.comicworm;

import com.example.comicworm.dto.exchange.*;
import com.example.comicworm.model.*;
import com.example.comicworm.model.enums.ExchangeOfferStatus;
import com.example.comicworm.model.enums.ExchangeRoomStatus;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.exchange.impl.ExchangeRoomServiceImpl;
import com.example.comicworm.config.websocket.ExchangeChatWebSocketHandler;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExchangeRoomTests {

    @Mock
    private ExchangeRoomRepository exchangeRoomRepository;
    @Mock
    private ExchangeRoomMemberRepository exchangeRoomMemberRepository;
    @Mock
    private ExchangeOfferRepository exchangeOfferRepository;
    @Mock
    private ExchangeOfferItemRepository exchangeOfferItemRepository;
    @Mock
    private ExchangeMessageRepository exchangeMessageRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ExchangeChatWebSocketHandler webSocketHandler;

    @InjectMocks
    private ExchangeRoomServiceImpl exchangeRoomService;

    private User host;
    private User buyer;
    private Product targetProduct;
    private Product buyerProduct;

    @BeforeEach
    void setUp() {
        host = new User();
        host.setId(10L);
        host.setFullName("Chủ Sở Hữu");
        host.setEmail("host@comicworm.com");

        buyer = new User();
        buyer.setId(20L);
        buyer.setFullName("Người Đề Xuất");
        buyer.setEmail("buyer@comicworm.com");

        targetProduct = new Product();
        targetProduct.setId(101L);
        targetProduct.setSellerId(10L);
        targetProduct.setTitle("One Piece Trọn Bộ");
        targetProduct.setPrice(new BigDecimal("320000"));
        targetProduct.setConditionPercent(90);
        targetProduct.setListingType(ListingType.SELL_AND_TRADE);
        targetProduct.setTradeWishNote("Naruto, Bleach");
        targetProduct.setIsActive(true);

        buyerProduct = new Product();
        buyerProduct.setId(202L);
        buyerProduct.setSellerId(20L);
        buyerProduct.setTitle("Naruto Tập 1-10");
        buyerProduct.setPrice(new BigDecimal("180000"));
        buyerProduct.setConditionPercent(85);
        buyerProduct.setIsActive(true);
    }

    @Test
    @DisplayName("Tạo phòng mới thành công khi chưa có phòng mở cho sản phẩm")
    void createOrGetRoom_createsNewRoomWhenNoneExists() {
        when(productRepository.findById(101L)).thenReturn(Optional.of(targetProduct));
        when(exchangeRoomRepository.findFirstByTargetProductIdAndStatus(101L, ExchangeRoomStatus.OPEN))
                .thenReturn(Optional.empty());

        ExchangeRoom savedRoom = new ExchangeRoom();
        savedRoom.setId(1L);
        savedRoom.setRoomCode("PT-101-1234");
        savedRoom.setHostId(10L);
        savedRoom.setTargetProductId(101L);
        savedRoom.setStatus(ExchangeRoomStatus.OPEN);

        ExchangeRoomMember hostMember = new ExchangeRoomMember();
        hostMember.setRoomId(1L);
        hostMember.setUserId(10L);

        when(exchangeRoomRepository.save(any(ExchangeRoom.class))).thenReturn(savedRoom);
        when(exchangeRoomRepository.findById(1L)).thenReturn(Optional.of(savedRoom));
        when(userRepository.findById(10L)).thenReturn(Optional.of(host));
        when(exchangeRoomMemberRepository.findByRoomIdOrderByJoinedAtAsc(1L)).thenReturn(List.of(hostMember));

        ExchangeRoomDTO dto = exchangeRoomService.createOrGetRoomForProduct(20L, 101L, "Xin chào mình muốn đổi truyện");

        assertNotNull(dto);
        assertEquals(1L, dto.getId());
        assertEquals("PT-101-1234", dto.getRoomCode());
        assertEquals(10L, dto.getHostId());
        assertEquals(ExchangeRoomStatus.OPEN, dto.getStatus());
        verify(exchangeRoomRepository).save(any(ExchangeRoom.class));
        verify(exchangeRoomMemberRepository, atLeastOnce()).save(any(ExchangeRoomMember.class));
    }

    @Test
    @DisplayName("Gửi đề xuất trao đổi (kèo đổi + bù tiền) thành công")
    void proposeOffer_createsPendingOfferWithItemsAndCompensation() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setTargetProductId(101L);
        room.setStatus(ExchangeRoomStatus.OPEN);

        when(exchangeRoomRepository.findById(1L)).thenReturn(Optional.of(room));
        when(exchangeRoomMemberRepository.existsByRoomIdAndUserId(1L, 20L)).thenReturn(true);

        ExchangeOffer savedOffer = new ExchangeOffer();
        savedOffer.setId(50L);
        savedOffer.setRoomId(1L);
        savedOffer.setBuyerId(20L);
        savedOffer.setCashCompensation(new BigDecimal("60000"));
        savedOffer.setStatus(ExchangeOfferStatus.PENDING);
        savedOffer.setBuyerConfirmed(false);
        savedOffer.setHostConfirmed(false);

        when(exchangeOfferRepository.save(any(ExchangeOffer.class))).thenReturn(savedOffer);
        when(productRepository.findById(202L)).thenReturn(Optional.of(buyerProduct));

        ExchangeOfferItem savedItem = new ExchangeOfferItem();
        savedItem.setId(501L);
        savedItem.setOfferId(50L);
        savedItem.setProductId(202L);
        savedItem.setOwnerId(20L);
        savedItem.setQuantity(1);
        savedItem.setTitleSnapshot("Naruto Tập 1-10");
        savedItem.setConditionSnapshot(85);
        when(exchangeOfferItemRepository.save(any(ExchangeOfferItem.class))).thenReturn(savedItem);
        when(userRepository.findById(20L)).thenReturn(Optional.of(buyer));

        CreateExchangeOfferRequest req = new CreateExchangeOfferRequest();
        req.setCashCompensation(new BigDecimal("60000"));
        req.setCompensationDirection("pay");
        req.setNote("Mình bù thêm 60k nhé");
        req.setItems(List.of(new OfferItemInput(202L, 1)));

        ExchangeOfferDTO dto = exchangeRoomService.proposeOffer(1L, 20L, req);

        assertNotNull(dto);
        assertEquals(50L, dto.getId());
        assertEquals(ExchangeOfferStatus.PENDING, dto.getStatus());
        assertEquals(new BigDecimal("60000"), dto.getCashCompensation());
        assertEquals(1, dto.getItems().size());
        assertEquals("Naruto Tập 1-10", dto.getItems().get(0).getTitleSnapshot());
        verify(exchangeMessageRepository).save(any(ExchangeMessage.class));
    }

    @Test
    @DisplayName("Chủ phòng không thể tự gửi đề xuất trao đổi cho chính mình")
    void proposeOffer_failsWhenHostProposesToSelf() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setTargetProductId(101L);
        room.setStatus(ExchangeRoomStatus.OPEN);

        when(exchangeRoomRepository.findById(1L)).thenReturn(Optional.of(room));

        CreateExchangeOfferRequest req = new CreateExchangeOfferRequest();
        assertThrows(ResponseStatusException.class, () -> exchangeRoomService.proposeOffer(1L, 10L, req));
    }

    @Test
    @DisplayName("Không thể đề xuất truyện không thuộc sở hữu của người đề xuất")
    void proposeOffer_failsWhenOfferingProductNotOwnedByBuyer() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setTargetProductId(101L);
        room.setStatus(ExchangeRoomStatus.OPEN);

        when(exchangeRoomRepository.findById(1L)).thenReturn(Optional.of(room));
        when(exchangeRoomMemberRepository.existsByRoomIdAndUserId(1L, 20L)).thenReturn(true);

        Product notOwned = new Product();
        notOwned.setId(303L);
        notOwned.setSellerId(999L); // Không phải của 20L
        notOwned.setTitle("Truyện của người khác");

        when(productRepository.findById(303L)).thenReturn(Optional.of(notOwned));

        CreateExchangeOfferRequest req = new CreateExchangeOfferRequest();
        req.setItems(List.of(new OfferItemInput(303L, 1)));

        assertThrows(ResponseStatusException.class, () -> exchangeRoomService.proposeOffer(1L, 20L, req));
    }

    @Test
    @DisplayName("Không thể đề xuất chính bộ truyện mục tiêu của phòng")
    void proposeOffer_failsWhenOfferingTargetProduct() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setTargetProductId(101L);
        room.setStatus(ExchangeRoomStatus.OPEN);

        when(exchangeRoomRepository.findById(1L)).thenReturn(Optional.of(room));
        when(exchangeRoomMemberRepository.existsByRoomIdAndUserId(1L, 20L)).thenReturn(true);

        Product sameProduct = new Product();
        sameProduct.setId(101L);
        sameProduct.setSellerId(20L);
        sameProduct.setTitle("Trùng truyện phòng");

        when(productRepository.findById(101L)).thenReturn(Optional.of(sameProduct));

        CreateExchangeOfferRequest req = new CreateExchangeOfferRequest();
        req.setItems(List.of(new OfferItemInput(101L, 1)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> exchangeRoomService.proposeOffer(1L, 20L, req));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Không thể dùng chính bộ truyện"));
    }

    @Test
    @DisplayName("Chủ phòng đồng ý đề xuất -> chuyển trạng thái phòng sang AGREED")
    void respondToOffer_acceptUpdatesRoomStatusToAgreed() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setStatus(ExchangeRoomStatus.OPEN);

        ExchangeOffer offer = new ExchangeOffer();
        offer.setId(50L);
        offer.setRoomId(1L);
        offer.setBuyerId(20L);
        offer.setStatus(ExchangeOfferStatus.PENDING);
        offer.setCashCompensation(BigDecimal.ZERO);

        when(exchangeRoomRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        when(exchangeOfferRepository.findByIdAndRoomId(50L, 1L)).thenReturn(Optional.of(offer));
        when(exchangeOfferItemRepository.findByOfferId(50L)).thenReturn(Collections.emptyList());
        when(userRepository.findById(20L)).thenReturn(Optional.of(buyer));

        ExchangeOfferDTO result = exchangeRoomService.respondToOffer(1L, 50L, 10L, true);

        assertEquals(ExchangeOfferStatus.ACCEPTED, result.getStatus());
        assertEquals(ExchangeRoomStatus.AGREED, room.getStatus());
        assertEquals(50L, room.getSelectedOfferId());
        assertFalse(offer.getHostConfirmed());
        assertFalse(offer.getBuyerConfirmed());
    }

    @Test
    @DisplayName("Cả hai bên xác nhận chốt thỏa thuận -> phòng hoàn tất COMPLETED")
    void confirmDeal_bothConfirmedSetsRoomCompleted() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setStatus(ExchangeRoomStatus.AGREED);
        room.setSelectedOfferId(50L);

        ExchangeOffer offer = new ExchangeOffer();
        offer.setId(50L);
        offer.setRoomId(1L);
        offer.setBuyerId(20L);
        offer.setStatus(ExchangeOfferStatus.ACCEPTED);
        offer.setHostConfirmed(true);
        offer.setBuyerConfirmed(false);

        when(exchangeRoomRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        when(exchangeOfferRepository.findByIdAndRoomId(50L, 1L)).thenReturn(Optional.of(offer));
        when(exchangeOfferItemRepository.findByOfferId(50L)).thenReturn(Collections.emptyList());
        when(userRepository.findById(20L)).thenReturn(Optional.of(buyer));

        ExchangeOfferDTO result = exchangeRoomService.confirmDeal(1L, 50L, 20L);

        assertTrue(result.getBuyerConfirmed());
        assertEquals(ExchangeRoomStatus.COMPLETED, room.getStatus());
        assertNotNull(room.getClosedAt());
    }

    private ExchangeRoom agreedRoom() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setStatus(ExchangeRoomStatus.AGREED);
        room.setSelectedOfferId(50L);
        when(exchangeRoomRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(room));
        return room;
    }

    private ExchangeOffer acceptedOffer() {
        ExchangeOffer offer = new ExchangeOffer();
        offer.setId(50L);
        offer.setRoomId(1L);
        offer.setBuyerId(20L);
        offer.setStatus(ExchangeOfferStatus.ACCEPTED);
        when(exchangeOfferRepository.findByIdAndRoomId(50L, 1L)).thenReturn(Optional.of(offer));
        return offer;
    }

    @Test
    void confirmDeal_requiresEachPartyThenCompletesAndIsIdempotent() {
        ExchangeRoom room = agreedRoom();
        ExchangeOffer offer = acceptedOffer();
        when(userRepository.findById(20L)).thenReturn(Optional.of(buyer));
        when(userRepository.findById(10L)).thenReturn(Optional.of(host));

        ExchangeOfferDTO first = exchangeRoomService.confirmDeal(1L, 50L, 20L);
        assertTrue(first.getBuyerConfirmed());
        assertFalse(first.getHostConfirmed());
        assertEquals(ExchangeRoomStatus.AGREED, room.getStatus());
        assertNull(room.getClosedAt());

        ExchangeOfferDTO second = exchangeRoomService.confirmDeal(1L, 50L, 10L);
        assertTrue(second.getHostConfirmed());
        assertTrue(second.getBuyerConfirmed());
        assertEquals(ExchangeRoomStatus.COMPLETED, room.getStatus());
        var closedAt = room.getClosedAt();

        exchangeRoomService.confirmDeal(1L, 50L, 10L);
        assertEquals(closedAt, room.getClosedAt());
        verify(exchangeMessageRepository, times(2)).save(any(ExchangeMessage.class));
        verify(exchangeOfferRepository, times(2)).save(offer);
        verify(exchangeRoomRepository, times(3)).findByIdForUpdate(1L);
    }

    @Test
    void confirmDeal_rejectsPendingOffer() {
        ExchangeRoom room = agreedRoom();
        room.setStatus(ExchangeRoomStatus.OPEN);
        ExchangeOffer offer = acceptedOffer();
        offer.setStatus(ExchangeOfferStatus.PENDING);
        assertThrows(ResponseStatusException.class, () -> exchangeRoomService.confirmDeal(1L, 50L, 20L));
        assertFalse(offer.getBuyerConfirmed());
        verify(exchangeOfferRepository, never()).save(any());
    }

    @Test
    void confirmDeal_rejectsUnselectedOffer() {
        ExchangeRoom room = agreedRoom();
        room.setSelectedOfferId(99L);
        ExchangeOffer offer = acceptedOffer();
        assertThrows(ResponseStatusException.class, () -> exchangeRoomService.confirmDeal(1L, 50L, 20L));
        assertFalse(offer.getBuyerConfirmed());
    }

    @Test
    void confirmDeal_rejectsCancelledRoom() {
        ExchangeRoom room = agreedRoom();
        room.setStatus(ExchangeRoomStatus.CANCELLED);
        ExchangeOffer offer = acceptedOffer();
        assertThrows(ResponseStatusException.class, () -> exchangeRoomService.confirmDeal(1L, 50L, 10L));
        assertFalse(offer.getHostConfirmed());
        assertEquals(ExchangeRoomStatus.CANCELLED, room.getStatus());
    }

    @Test
    void confirmDeal_rejectsOtherRoomMember() {
        agreedRoom();
        acceptedOffer();
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> exchangeRoomService.confirmDeal(1L, 50L, 30L));
        assertEquals(org.springframework.http.HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(exchangeOfferRepository, never()).save(any());
    }

    @Test
    void respondToOffer_cannotChooseAnotherOfferAfterAgreement() {
        agreedRoom();
        assertThrows(ResponseStatusException.class, () -> exchangeRoomService.respondToOffer(1L, 99L, 10L, true));
        verify(exchangeOfferRepository, never()).save(any());
    }

    @Test
    void confirmDeal_broadcastsOnlyAfterTransactionCommits() {
        org.springframework.test.util.ReflectionTestUtils.setField(exchangeRoomService, "webSocketHandler", webSocketHandler);
        agreedRoom();
        acceptedOffer();
        when(userRepository.findById(20L)).thenReturn(Optional.of(buyer));
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            exchangeRoomService.confirmDeal(1L, 50L, 20L);
            verifyNoInteractions(webSocketHandler);
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
            verify(webSocketHandler).broadcast(eq(1L), any());
        } finally {
            TransactionSynchronizationManager.clear();
        }
    }

    @Test
    @DisplayName("Gửi tin nhắn vào phòng thành công")
    void sendMessage_savesAndReturnsMessage() {
        ExchangeRoom room = new ExchangeRoom();
        room.setId(1L);
        room.setHostId(10L);
        room.setStatus(ExchangeRoomStatus.OPEN);

        when(exchangeRoomRepository.findById(1L)).thenReturn(Optional.of(room));
        when(exchangeRoomMemberRepository.existsByRoomIdAndUserId(1L, 20L)).thenReturn(true);

        ExchangeMessage saved = new ExchangeMessage();
        saved.setId(901L);
        saved.setRoomId(1L);
        saved.setSenderId(20L);
        saved.setContent("Cho mình hỏi tình trạng bìa truyện?");

        when(exchangeMessageRepository.save(any(ExchangeMessage.class))).thenReturn(saved);
        when(userRepository.findById(20L)).thenReturn(Optional.of(buyer));

        SendExchangeMessageRequest req = new SendExchangeMessageRequest();
        req.setContent("Cho mình hỏi tình trạng bìa truyện?");

        ExchangeMessageDTO dto = exchangeRoomService.sendMessage(1L, 20L, req);

        assertNotNull(dto);
        assertEquals(901L, dto.getId());
        assertEquals("Cho mình hỏi tình trạng bìa truyện?", dto.getContent());
        assertEquals("Người Đề Xuất", dto.getSenderName());
        assertFalse(dto.isHost());
    }
}
