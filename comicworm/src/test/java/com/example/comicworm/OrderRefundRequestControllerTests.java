package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.OrderRefundRequestController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.RefundRequestResultDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.OrderPaymentStatus;
import com.example.comicworm.model.enums.RefundRequestStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.service.OrderRefundRequestService;
import com.example.comicworm.utils.JwtUtils;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderRefundRequestController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class OrderRefundRequestControllerTests {
    @Autowired MockMvc mvc;
    @MockitoBean OrderRefundRequestService service;
    @MockitoBean UserDetailsService details;
    @MockitoBean JwtUtils jwt;

    CustomUserDetails principal(long id, boolean seller) {
        User u = new User(); u.setId(id); u.setIsSeller(seller); u.setRole(UserRole.USER);
        u.setEmail("user-" + id + "@example.invalid"); u.setFullName("Người dùng " + id);
        u.setAccountStatus(AccountStatus.ACTIVE);
        return new CustomUserDetails(u);
    }

    @Test void buyerRequestUsesAuthenticatedIdAndReturnsServiceErrorsAsJson() throws Exception {
        String path = "/api/orders/ORD-10/refund-request", body = "{\"reason\":\"Rách bìa\"}";
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());

        when(service.request("ORD-10", 1L, "Rách bìa")).thenReturn(
                new RefundRequestResultDTO("ORD-10", RefundRequestStatus.PENDING, OrderPaymentStatus.PAID));
        mvc.perform(post(path).with(user(principal(1, false))).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundRequestStatus").value("PENDING"));

        when(service.request("ORD-10", 1L, "Muộn")).thenThrow(
                new ResponseStatusException(HttpStatus.CONFLICT, "Đã quá hạn"));
        mvc.perform(post(path).with(user(principal(1, false))).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Muộn\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Đã quá hạn"));
    }

    @Test void sellerDecisionsRequireSellerRoleAndCsrf() throws Exception {
        String approve = "/api/seller/orders/ORD-10/refund-request/approve";
        String reject = "/api/seller/orders/ORD-10/refund-request/reject";
        mvc.perform(post(approve).with(user(principal(1, false))).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post(approve).with(user(principal(2, true)))).andExpect(status().isForbidden());
        verifyNoInteractions(service);

        when(service.approve("ORD-10", 2L)).thenReturn(
                new RefundRequestResultDTO("ORD-10", RefundRequestStatus.APPROVED, OrderPaymentStatus.REFUNDED));
        mvc.perform(post(approve).with(user(principal(2, true))).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentStatus").value("REFUNDED"));

        when(service.reject("ORD-10", 2L, "Đúng mô tả")).thenReturn(
                new RefundRequestResultDTO("ORD-10", RefundRequestStatus.REJECTED, OrderPaymentStatus.PAID));
        mvc.perform(post(reject).with(user(principal(2, true))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Đúng mô tả\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundRequestStatus").value("REJECTED"));
        verify(service).reject(eq("ORD-10"), eq(2L), eq("Đúng mô tả"));
    }
}
