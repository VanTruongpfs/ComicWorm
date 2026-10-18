package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.seller.SellerOrderController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.SellerOrderStatsRecord;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.seller.ISellerOrderService;
import com.example.comicworm.utils.JwtUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SellerOrderController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class SellerOrderControllerSecurityTests {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ISellerOrderService sellerOrderService;

    @MockitoBean
    UserRepository userRepository;

    @MockitoBean
    UserDetailsService userDetailsService;

    @MockitoBean
    JwtUtils jwtUtils;

    private CustomUserDetails userPrincipal(boolean isSeller) {
        User u = new User();
        u.setId(101L);
        u.setEmail(isSeller ? "seller@test.local" : "buyer@test.local");
        u.setFullName(isSeller ? "Pro Seller" : "Normal Buyer");
        u.setRole(UserRole.USER);
        u.setIsSeller(isSeller);
        u.setAccountStatus(AccountStatus.ACTIVE);
        return new CustomUserDetails(u);
    }

    @Test
    void unauthenticatedRequestToSellerOrders_returns401Or403() throws Exception {
        mvc.perform(get("/api/seller/orders"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void buyerRequestToSellerOrders_returnsForbidden() throws Exception {
        mvc.perform(get("/api/seller/orders")
                        .with(user(userPrincipal(false))))
                .andExpect(status().isForbidden());
    }

    @Test
    void sellerRequestToSellerOrders_returnsOk() throws Exception {
        when(sellerOrderService.listOrders(anyLong(), anyString(), anyString(), anyString(), anyInt(), anyInt()))
                .thenReturn(Map.of(
                        "Result", "OK",
                        "Records", Collections.emptyList(),
                        "TotalRecordCount", 0L,
                        "TotalPages", 0,
                        "CurrentPage", 0,
                        "Stats", new SellerOrderStatsRecord(BigDecimal.ZERO, 0, 0, "100.0%", 0)
                ));

        mvc.perform(get("/api/seller/orders")
                        .with(user(userPrincipal(true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Result").value("OK"));
    }
}

