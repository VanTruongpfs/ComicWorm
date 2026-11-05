package com.example.comicworm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.comicworm.dto.exchange.EscrowDTO;
import com.example.comicworm.dto.exchange.EscrowListDTO;
import com.example.comicworm.model.ExchangeEscrow;
import com.example.comicworm.model.ExchangeOffer;
import com.example.comicworm.model.ExchangeOrderLink;
import com.example.comicworm.model.ExchangeRoom;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.enums.EscrowStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.WalletTransactionType;
import com.example.comicworm.repository.ExchangeEscrowRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.ExchangeRoomRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.NotificationService;
import com.example.comicworm.service.exchange.ExchangeEscrowService;
import com.example.comicworm.service.wallet.WalletService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ExchangeEscrowServiceTests {

    private static final Long HOST = 10L;
    private static final Long PARTNER = 20L;
    private static final Long ADMIN = 1L;

    private final ExchangeEscrowRepository escrows = mock(ExchangeEscrowRepository.class);
    private final ExchangeRoomRepository rooms = mock(ExchangeRoomRepository.class);
    private final ExchangeOrderLinkRepository links = mock(ExchangeOrderLinkRepository.class);
    private final OrderRepository orders = mock(OrderRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final WalletService wallet = mock(WalletService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final ExchangeEscrowService service =
            new ExchangeEscrowService(escrows, rooms, links, orders, users, wallet, notifications);

    private ExchangeRoom room;
    private ExchangeOffer offer;

    @BeforeEach
    void setUp() {
        room = new ExchangeRoom();
        room.setId(1L);
        room.setRoomCode("ROOM-1");
        room.setHostId(HOST);
        room.setSelectedOfferId(5L);

        offer = new ExchangeOffer();
        offer.setId(5L);
        offer.setRoomId(1L);
        offer.setBuyerId(PARTNER);
        offer.setCashCompensation(new BigDecimal("50000"));
        offer.setCompensationPayerId(PARTNER);

        when(escrows.save(any(ExchangeEscrow.class))).thenAnswer(call -> {
            ExchangeEscrow escrow = call.getArgument(0);
            if (escrow.getId() == null) escrow.setId(9L);
            return escrow;
        });
        when(rooms.findById(1L)).thenReturn(Optional.of(room));
        when(users.findById(anyLong())).thenReturn(Optional.empty());
    }

    /** Order delivered to {@code recipient}; the other party is the sender. */
    private Order order(Long id, Long recipient, OrderStatus status) {
        Order order = new Order();
        order.setId(id);
        order.setOrderCode("EX-" + id);
        order.setBuyerId(recipient);
        order.setSellerId(recipient.equals(HOST) ? PARTNER : HOST);
        order.setStatus(status);
        when(orders.findById(id)).thenReturn(Optional.of(order));
        return order;
    }

    private ExchangeEscrow escrow(EscrowStatus status) {
        ExchangeEscrow escrow = new ExchangeEscrow();
        escrow.setId(9L);
        escrow.setRoomId(1L);
        escrow.setOfferId(5L);
        escrow.setPayerId(PARTNER);
        escrow.setPayeeId(HOST);
        escrow.setSourceOrderId(100L);
        escrow.setAmount(new BigDecimal("50000"));
        escrow.setStatus(status);
        escrow.setHeldAt(LocalDateTime.of(2026, 11, 5, 9, 0));
        when(escrows.findByIdForUpdate(9L)).thenReturn(Optional.of(escrow));
        return escrow;
    }

    private ExchangeEscrow lastSaved() {
        ArgumentCaptor<ExchangeEscrow> captor = ArgumentCaptor.forClass(ExchangeEscrow.class);
        verify(escrows, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void payerReceivingCodOrderHoldsCompensation() {
        Order paid = order(100L, PARTNER, OrderStatus.COMPLETED);
        Order other = order(101L, HOST, OrderStatus.SHIPPING);
        when(escrows.findByOfferId(5L)).thenReturn(Optional.empty());

        service.onOrderReceived(room, offer, paid, List.of(paid, other));

        ExchangeEscrow saved = lastSaved();
        assertEquals(EscrowStatus.HELD, saved.getStatus());
        assertEquals(PARTNER, saved.getPayerId());
        assertEquals(HOST, saved.getPayeeId());
        assertEquals(new BigDecimal("50000"), saved.getAmount());
        assertEquals(100L, saved.getSourceOrderId());
        assertNotNull(saved.getHeldAt());
    }

    @Test
    void hostCanBeThePayer() {
        offer.setCompensationPayerId(HOST);
        Order paid = order(101L, HOST, OrderStatus.COMPLETED);
        Order other = order(100L, PARTNER, OrderStatus.PACKING);
        when(escrows.findByOfferId(5L)).thenReturn(Optional.empty());

        service.onOrderReceived(room, offer, paid, List.of(other, paid));

        ExchangeEscrow saved = lastSaved();
        assertEquals(HOST, saved.getPayerId());
        assertEquals(PARTNER, saved.getPayeeId());
    }

    @Test
    void escrowIsReadyAtOnceWhenPayerReceivesLast() {
        Order paid = order(100L, PARTNER, OrderStatus.COMPLETED);
        Order other = order(101L, HOST, OrderStatus.COMPLETED);
        when(escrows.findByOfferId(5L)).thenReturn(Optional.empty());

        service.onOrderReceived(room, offer, paid, List.of(paid, other));

        ExchangeEscrow saved = lastSaved();
        assertEquals(EscrowStatus.READY, saved.getStatus());
        assertNotNull(saved.getReadyAt());
    }

    @Test
    void heldEscrowBecomesReadyWhenLastOrderCompletes() {
        ExchangeEscrow held = escrow(EscrowStatus.HELD);
        Order paid = order(100L, PARTNER, OrderStatus.COMPLETED);
        Order other = order(101L, HOST, OrderStatus.COMPLETED);
        when(escrows.findByOfferId(5L)).thenReturn(Optional.of(held));

        service.onOrderReceived(room, offer, other, List.of(paid, other));

        assertEquals(EscrowStatus.READY, held.getStatus());
        assertNotNull(held.getReadyAt());
    }

    @Test
    void receivingWithoutCompensationHoldsNothing() {
        offer.setCashCompensation(BigDecimal.ZERO);
        offer.setCompensationPayerId(null);
        Order paid = order(100L, PARTNER, OrderStatus.COMPLETED);
        when(escrows.findByOfferId(5L)).thenReturn(Optional.empty());

        service.onOrderReceived(room, offer, paid, List.of(paid));

        verify(escrows, never()).save(any());
    }

    @Test
    void nonPayerReceivingDoesNotCreateEscrow() {
        Order received = order(101L, HOST, OrderStatus.COMPLETED);
        Order paid = order(100L, PARTNER, OrderStatus.SHIPPING);
        when(escrows.findByOfferId(5L)).thenReturn(Optional.empty());

        service.onOrderReceived(room, offer, received, List.of(paid, received));

        verify(escrows, never()).save(any());
    }

    @Test
    void releaseCreditsPayeeWallet() {
        ExchangeEscrow ready = escrow(EscrowStatus.READY);
        order(100L, PARTNER, OrderStatus.COMPLETED);
        ExchangeOrderLink payeeLink = new ExchangeOrderLink();
        payeeLink.setOrderId(101L);
        when(links.findByRoomIdAndRecipientId(1L, HOST)).thenReturn(Optional.of(payeeLink));

        EscrowDTO dto = service.release(ADMIN, 9L, "  Đã đối soát COD  ");

        verify(wallet).credit(HOST, new BigDecimal("50000"), WalletTransactionType.ESCROW_RELEASE, 9L, "Đã đối soát COD");
        assertEquals(EscrowStatus.RELEASED, ready.getStatus());
        assertEquals(ADMIN, ready.getResolvedBy());
        assertNotNull(ready.getResolvedAt());
        assertEquals("Đã đối soát COD", ready.getResolutionNote());
        assertEquals("RELEASED", dto.status());
        verify(notifications).notify(eq(HOST), eq(101L), anyString(), anyString(), anyString());
    }

    @Test
    void releaseNeedsEveryOrderCompleted() {
        escrow(EscrowStatus.HELD);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.release(ADMIN, 9L, "note"));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(wallet, never()).credit(any(), any(), any(), any(), any());
    }

    @Test
    void releaseNeedsNote() {
        escrow(EscrowStatus.READY);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.release(ADMIN, 9L, "   "));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(wallet, never()).credit(any(), any(), any(), any(), any());
    }

    @Test
    void refundCreditsPayerWalletWhileHeld() {
        ExchangeEscrow held = escrow(EscrowStatus.HELD);
        order(100L, PARTNER, OrderStatus.COMPLETED);

        service.refund(ADMIN, 9L, "Người bán không gửi truyện");

        verify(wallet).credit(PARTNER, new BigDecimal("50000"), WalletTransactionType.ESCROW_REFUND, 9L,
                "Người bán không gửi truyện");
        assertEquals(EscrowStatus.REFUNDED, held.getStatus());
        verify(notifications).notify(eq(PARTNER), eq(100L), anyString(), anyString(), anyString());
    }

    @Test
    void resolvedEscrowCannotBeRefunded() {
        escrow(EscrowStatus.RELEASED);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.refund(ADMIN, 9L, "note"));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(wallet, never()).credit(any(), any(), any(), any(), any());
    }

    @Test
    void listFiltersByStatusAndReportsTotals() {
        ExchangeEscrow ready = escrow(EscrowStatus.READY);
        order(100L, PARTNER, OrderStatus.COMPLETED);
        when(escrows.findByStatusOrderByIdDesc(EscrowStatus.READY)).thenReturn(List.of(ready));
        ExchangeEscrowRepository.StatusTotal readyTotal = mock(ExchangeEscrowRepository.StatusTotal.class);
        when(readyTotal.getStatus()).thenReturn(EscrowStatus.READY);
        when(readyTotal.getCount()).thenReturn(1L);
        when(readyTotal.getTotal()).thenReturn(new BigDecimal("50000"));
        when(escrows.totalsByStatus()).thenReturn(List.of(readyTotal));

        EscrowListDTO list = service.list("ready");

        assertEquals(1, list.items().size());
        assertEquals("ROOM-1", list.items().get(0).roomCode());
        assertEquals(1L, list.totals().get("READY").count());
        assertEquals(new BigDecimal("50000"), list.totals().get("READY").amount());
        assertEquals(0L, list.totals().get("HELD").count());
    }

    @Test
    void listRejectsUnknownStatus() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.list("LOST"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
