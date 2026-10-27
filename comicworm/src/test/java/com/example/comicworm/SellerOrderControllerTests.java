package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.OrderController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.Order;
import com.example.comicworm.model.OrderStatusHistory;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.OrderStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.*;
import com.example.comicworm.service.OrderCompletionService;
import com.example.comicworm.service.OrderStatusService;
import com.example.comicworm.service.order.OrderTrackingService;
import com.example.comicworm.utils.JwtUtils;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, OrderTrackingService.class, OrderStatusService.class})
class SellerOrderControllerTests {
    @Autowired MockMvc mvc;
    @MockitoBean OrderRepository orders;
    @MockitoBean OrderItemRepository items;
    @MockitoBean OrderStatusHistoryRepository histories;
    @MockitoBean UserRepository users;
    @MockitoBean ExchangeOrderLinkRepository exchangeLinks;
    @MockitoBean OrderCompletionService completion;
    @MockitoBean UserDetailsService details;
    @MockitoBean JwtUtils jwt;
    Order order;
    List<OrderStatusHistory> history;

    CustomUserDetails principal(long id, boolean seller) {
        User u = new User(); u.setId(id); u.setIsSeller(seller); u.setRole(UserRole.USER);
        u.setEmail("seller-" + id + "@example.invalid"); u.setFullName("Người bán " + id);
        u.setAccountStatus(AccountStatus.ACTIVE);
        return new CustomUserDetails(u);
    }

    @BeforeEach void fixture() {
        order = new Order(); order.setId(10L); order.setOrderCode("ORD-SELLER");
        order.setBuyerId(1L); order.setSellerId(2L); order.setStatus(OrderStatus.WAITING_CONFIRM);
        order.setSubtotalAmount(BigDecimal.TEN); order.setTotalAmount(BigDecimal.TEN);
        order.setRecipientName("Người nhận"); order.setCreatedAt(LocalDateTime.now());
        history = new ArrayList<>();
        when(orders.findByOrderCode("ORD-SELLER")).thenReturn(Optional.of(order));
        when(orders.findByOrderCodeForUpdate("ORD-SELLER")).thenReturn(Optional.of(order));
        when(histories.findByOrderIdOrderByCreatedAtAscIdAsc(10L)).thenReturn(history);
        when(histories.save(any())).thenAnswer(call -> { var h = call.<OrderStatusHistory>getArgument(0); history.add(h); return h; });
    }

    @Test void sellerCanAdvanceThroughRealStatusServiceAndReadPersistedHistory() throws Exception {
        for (String target : List.of("PACKING", "SHIPPING", "DELIVERED")) {
            mvc.perform(patch("/api/seller/orders/ORD-SELLER/status").with(user(principal(2, true))).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + target + "\",\"note\":\"Đã xử lý\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.summary.status").value(target))
                    .andExpect(jsonPath("$.history[-1].newStatus").value(target));
        }
        mvc.perform(get("/api/orders/ORD-SELLER").with(user(principal(2, true))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.nextStatus").isEmpty())
                .andExpect(jsonPath("$.history[-1].note").value("Đã xử lý"));
        verify(histories, times(3)).save(any());
        verifyNoInteractions(completion);
    }

    @Test void requiresLoginSellerRoleAndCsrfBeforeWriting() throws Exception {
        String path = "/api/seller/orders/ORD-SELLER/status", body = "{\"status\":\"PACKING\"}";
        mvc.perform(patch(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(patch(path).with(user(principal(1, false))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(patch(path).with(user(principal(2, true))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        verifyNoInteractions(orders, histories);
    }

    @Test void hidesOtherSellersOrdersAndRejectsBadOrStaleTransitions() throws Exception {
        String path = "/api/seller/orders/ORD-SELLER/status";
        mvc.perform(patch(path).with(user(principal(1, true))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PACKING\"}"))
                .andExpect(status().isNotFound());
        for (String target : List.of("SHIPPING", "CANCELLED", "COMPLETED")) {
            mvc.perform(patch(path).with(user(principal(2, true))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + target + "\"}"))
                    .andExpect(status().isConflict());
        }
        mvc.perform(patch(path).with(user(principal(2, true))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
        verify(histories, never()).save(any());
    }

    @Test void sellerListUsesAuthenticatedIdCombinedFiltersAndServerSort() throws Exception {
        when(orders.searchForSeller(eq(2L), any(), eq("%truyện%"), any())).thenAnswer(call ->
                new PageImpl<>(List.of(order), call.<Pageable>getArgument(3), 1));
        when(orders.countByStatusForSeller(2L)).thenReturn(Collections.singletonList(new Object[] {OrderStatus.WAITING_CONFIRM, 1L}));
        mvc.perform(get("/api/seller/orders").with(user(principal(2, true)))
                .param("status", "processing").param("q", "truyện").param("sort", "price-desc").param("sellerId", "999"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].nextStatus").value("PACKING"))
                .andExpect(jsonPath("$.counts.processing").value(1));
        verify(orders).searchForSeller(eq(2L), eq(Set.of(OrderStatus.WAITING_CONFIRM, OrderStatus.PACKING)),
                eq("%truyện%"), argThat(p -> p.getSort().getOrderFor("totalAmount").isDescending()));
        mvc.perform(get("/api/seller/orders").with(user(principal(2, true))).param("sort", "unknown"))
                .andExpect(status().isBadRequest());
    }

    @Test void sellerCannotUseAdminEndpointAndCorsAllowsProtectedPatch() throws Exception {
        mvc.perform(patch("/api/admin/orders/ORD-SELLER/status").with(user(principal(2, true))).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PACKING\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(options("/api/seller/orders/ORD-SELLER/status").header("Origin", "http://localhost:5500")
                .header("Access-Control-Request-Method", "PATCH").header("Access-Control-Request-Headers", "content-type,x-csrf-token"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PATCH")));
    }
}
