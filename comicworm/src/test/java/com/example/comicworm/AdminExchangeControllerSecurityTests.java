package com.example.comicworm;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.WalletController;
import com.example.comicworm.controller.admin.AdminExchangeController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.WalletDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.exchange.AdminExchangeDealService;
import com.example.comicworm.service.exchange.ExchangeEscrowService;
import com.example.comicworm.service.wallet.WalletService;
import com.example.comicworm.utils.JwtUtils;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(controllers = {AdminExchangeController.class, WalletController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AdminExchangeControllerSecurityTests {
    private static final String BASE = "/api/admin/exchange";

    @Autowired MockMvc mvc;
    @MockitoBean AdminExchangeDealService deals;
    @MockitoBean ExchangeEscrowService escrows;
    @MockitoBean WalletService wallets;
    @MockitoBean UserRepository users;
    @MockitoBean UserDetailsService details;
    @MockitoBean JwtUtils jwt;

    private CustomUserDetails principal(UserRole role) {
        User u = new User();
        u.setId(role == UserRole.ADMIN ? 999L : 123L);
        u.setEmail(role == UserRole.ADMIN ? "admin@example.invalid" : "user@example.invalid");
        u.setFullName(role == UserRole.ADMIN ? "Admin" : "Buyer");
        u.setRole(role);
        u.setIsSeller(false);
        return new CustomUserDetails(u);
    }

    @Test
    void anonymousGets401AndBuyerGets403() throws Exception {
        mvc.perform(get(BASE + "/deals")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/deals").with(user(principal(UserRole.USER)))).andExpect(status().isForbidden());
        mvc.perform(post(BASE + "/escrows/9/release").with(user(principal(UserRole.USER))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"x\"}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(deals, escrows);
    }

    @Test
    void adminWriteNeedsCsrfToken() throws Exception {
        mvc.perform(post(BASE + "/deals/5/approve").with(user(principal(UserRole.ADMIN))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(deals);
    }

    @Test
    void adminRejectsDealWithReason() throws Exception {
        mvc.perform(post(BASE + "/deals/5/reject").with(user(principal(UserRole.ADMIN))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Sai mô tả\"}"))
                .andExpect(status().isOk());
        verify(deals).reject(999L, 5L, "Sai mô tả");
    }

    @Test
    void serviceErrorsComeBackAsJsonMessage() throws Exception {
        when(escrows.release(anyLong(), anyLong(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Chưa thể giải ngân"));

        mvc.perform(post(BASE + "/escrows/9/release").with(user(principal(UserRole.ADMIN))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"ok\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Chưa thể giải ngân"));
    }

    @Test
    void walletNeedsLogin() throws Exception {
        mvc.perform(get("/api/wallet/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(wallets);
    }

    @Test
    void walletReturnsOwnBalance() throws Exception {
        when(wallets.myWallet(123L)).thenReturn(new WalletDTO(new BigDecimal("50000"), List.of()));

        mvc.perform(get("/api/wallet/me").with(user(principal(UserRole.USER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(50000));
    }
}
