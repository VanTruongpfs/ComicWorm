package com.example.comicworm.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.repository.OrderItemRepository;
import com.example.comicworm.repository.ExchangeOrderLinkRepository;
import com.example.comicworm.repository.OrderRepository;
import com.example.comicworm.repository.OrderStatusHistoryRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.OrderCompletionService;
import com.example.comicworm.service.OrderStatusService;
import com.example.comicworm.service.order.OrderTrackingService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

class OrderTrackingServiceTests {

    private static final long BUYER = 1L, SELLER = 2L, STRANGER = 3L, ADMIN = 99L;

    private OrderRepository orders;
    private OrderItemRepository items;
    private OrderStatusHistoryRepository histories;
    private UserRepository users;
    private OrderStatusService statusService;
    private OrderCompletionService completionService;
    private ExchangeOrderLinkRepository exchangeLinks;
    private OrderTrackingService service;

    @BeforeEach
    void setUp() {
        orders = mock(OrderRepository.class);
        items = mock(OrderItemRepository.class);
        histories = mock(OrderStatusHistoryRepository.class);
        users = mock(UserRepository.class);
        statusService = mock(OrderStatusService.class);
        completionService = mock(OrderCompletionService.class);
        exchangeLinks = mock(ExchangeOrderLinkRepository.class);
        service = new OrderTrackingService(orders, items, histories, users, statusService, completionService, exchangeLinks);
        when(items.findByOrderIdIn(any())).thenReturn(List.of());
        when(histories.findByOrderIdOrderByCreatedAtAscIdAsc(10L)).thenReturn(List.of());
        when(users.findAllById(any())).thenReturn(List.of());
        when(users.findById(any())).thenReturn(Optional.empty());
    }

    private Order order(OrderStatus status) {
        Order o = new Order();
        o.setId(10L);
        o.setOrderCode("ORD-1");
        o.setBuyerId(BUYER);
        o.setSellerId(SELLER);
        o.setStatus(status);
        o.setPaymentStatus(OrderPaymentStatus.PAID);
        o.setSubtotalAmount(BigDecimal.TEN);
        o.setShippingFee(BigDecimal.ZERO);
        o.setTotalAmount(BigDecimal.TEN);
        o.setRecipientName("A");
        o.setRecipientPhone("0900000000");
        o.setShippingAddress("HCM");
        return o;
    }

    private void given(Order o) {
        when(orders.findByOrderCodeForUpdate("ORD-1")).thenReturn(Optional.of(o));
        when(orders.findByOrderCode("ORD-1")).thenReturn(Optional.of(o));
    }

    @Test
    void adminAdvancesThroughStatusServiceWhichWritesHistory() {
        Order o = order(OrderStatus.WAITING_CONFIRM);
        given(o);

        service.updateStatus("ORD-1", ADMIN, true, "PACKING", "  ok  ");

        verify(statusService).transition(o, OrderStatus.PACKING, ADMIN, "ok");
        verify(completionService, never()).complete(any(), any());
    }

    @Test
    void adminCompletingDeliveredOrderUsesCompletionFlow() {
        Order o = order(OrderStatus.DELIVERED);
        given(o);
        service.updateStatus("ORD-1", ADMIN, true, "COMPLETED", null);
        verify(completionService).complete(10L, ADMIN);
        verify(statusService, never()).transition(any(), any(), any(), any());
    }

    @Test
    void buyerSellerAndStrangerCannotUpdateStatus() {
        Order o = order(OrderStatus.DELIVERED);
        given(o);
        for (long who : new long[] {BUYER, SELLER, STRANGER}) {
            assertThatThrownBy(() -> service.updateStatus("ORD-1", who, false, "COMPLETED", null))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        }
        verify(statusService, never()).transition(any(), any(), any(), any());
        verify(completionService, never()).complete(any(), any());
    }

    @Test
    void skippingBackwardsOrCancellingIsRejectedEvenForAdmin() {
        given(order(OrderStatus.WAITING_CONFIRM));
        assertThatThrownBy(() -> service.updateStatus("ORD-1", ADMIN, true, "SHIPPING", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThatThrownBy(() -> service.updateStatus("ORD-1", ADMIN, true, "CANCELLED", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        given(order(OrderStatus.COMPLETED));
        assertThatThrownBy(() -> service.updateStatus("ORD-1", ADMIN, true, "DELIVERED", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        verify(statusService, never()).transition(any(), any(), any(), any());
    }

    @Test
    void invalidStatusIsBadRequest() {
        given(order(OrderStatus.PACKING));
        assertThatThrownBy(() -> service.updateStatus("ORD-1", ADMIN, true, "NOPE", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
    }

    @Test
    void strangerGetsNotFoundForDetail() {
        given(order(OrderStatus.PACKING));
        assertThatThrownBy(() -> service.detail("ORD-1", STRANGER, false))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }

    @Test
    void detailSynthesizesCreationEntryForLegacyOrders() {
        given(order(OrderStatus.PACKING));
        var d = service.detail("ORD-1", BUYER, false);
        assertThat(d.history()).hasSize(1);
        assertThat(d.history().get(0).newStatus()).isEqualTo("WAITING_PAYMENT");
        assertThat(d.summary().nextStatus()).isNull(); // người mua không có bước tiếp theo ở PACKING
    }

    @Test
    void nextStatusIsOfferedOnlyToAdmin() {
        given(order(OrderStatus.DELIVERED));
        assertThat(service.detail("ORD-1", ADMIN, true).summary().nextStatus()).isEqualTo("COMPLETED");
        assertThat(service.detail("ORD-1", BUYER, false).summary().nextStatus()).isNull();
        assertThat(service.detail("ORD-1", SELLER, false).summary().nextStatus()).isNull();
    }

    @Test
    void adminCanViewAnyOrderDetail() {
        given(order(OrderStatus.PACKING));
        assertThat(service.detail("ORD-1", ADMIN, true).summary().orderCode()).isEqualTo("ORD-1");
    }

    @Test
    void sellerAdvancesOwnOrderAndPersistsActorNoteAndEachStatusInHistory() {
        Order o = order(OrderStatus.WAITING_CONFIRM);
        given(o);
        var writingService = new OrderTrackingService(orders, items, histories, users,
                new OrderStatusService(histories), completionService, exchangeLinks);
        for (OrderStatus target : List.of(OrderStatus.PACKING, OrderStatus.SHIPPING, OrderStatus.DELIVERED)) {
            var result = writingService.updateSellerStatus("ORD-1", SELLER, target.name(), "  Đã xử lý  ");
            assertThat(result.summary().status()).isEqualTo(target.name());
        }
        var captor = ArgumentCaptor.forClass(OrderStatusHistory.class);
        verify(histories, org.mockito.Mockito.times(3)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(OrderStatusHistory::getPreviousStatus)
                .containsExactly(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING, OrderStatus.SHIPPING);
        assertThat(captor.getAllValues()).allSatisfy(h -> {
            assertThat(h.getChangedBy()).isEqualTo(SELLER);
            assertThat(h.getNote()).isEqualTo("Đã xử lý");
        });
        verify(completionService, never()).complete(any(), any());
    }

    @Test
    void sellerCannotUpdateAnotherSellersOrderEvenWhenTheyAreTheBuyer() {
        given(order(OrderStatus.WAITING_CONFIRM));
        for (long actor : new long[] { BUYER, STRANGER }) {
            assertThatThrownBy(() -> service.updateSellerStatus("ORD-1", actor, "PACKING", null))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        }
        verify(statusService, never()).transition(any(), any(), any(), any());
    }

    @Test
    void sellerCannotSkipRepeatCancelCompleteOrAdvanceAnUnpaidOrder() {
        for (String[] pair : List.of(new String[] { "WAITING_CONFIRM", "SHIPPING" },
                new String[] { "PACKING", "PACKING" }, new String[] { "PACKING", "CANCELLED" },
                new String[] { "WAITING_PAYMENT", "PACKING" }, new String[] { "DELIVERED", "COMPLETED" },
                new String[] { "COMPLETED", "PACKING" }, new String[] { "CANCELLED", "PACKING" })) {
            given(order(OrderStatus.valueOf(pair[0])));
            assertThatThrownBy(() -> service.updateSellerStatus("ORD-1", SELLER, pair[1], null))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        }
        verify(statusService, never()).transition(any(), any(), any(), any());
        verify(completionService, never()).complete(any(), any());
    }

    @Test
    void nextStatusIsAvailableToTheOwningSellerButNeverForCompletionOrExchangeOrders() {
        given(order(OrderStatus.WAITING_CONFIRM));
        assertThat(service.detail("ORD-1", SELLER, false).summary().nextStatus()).isEqualTo("PACKING");
        assertThat(service.detail("ORD-1", BUYER, false).summary().nextStatus()).isNull();
        var link = new com.example.comicworm.model.ExchangeOrderLink();
        link.setOrderId(10L);
        when(exchangeLinks.findByOrderIdIn(any())).thenReturn(List.of(link));
        when(exchangeLinks.existsByOrderId(10L)).thenReturn(true);
        assertThat(service.detail("ORD-1", SELLER, false).summary().nextStatus()).isNull();
        assertThatThrownBy(() -> service.updateSellerStatus("ORD-1", SELLER, "PACKING", null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        verify(statusService, never()).transition(any(), any(), any(), any());
    }
}
