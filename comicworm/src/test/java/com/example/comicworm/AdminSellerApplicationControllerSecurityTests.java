package com.example.comicworm;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
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
import com.example.comicworm.controller.admin.AdminSellerApplicationController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.SellerApplicationDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.SellerApplicationStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.account.SellerApplicationService;
import com.example.comicworm.utils.JwtUtils;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

@WebMvcTest(controllers = AdminSellerApplicationController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AdminSellerApplicationControllerSecurityTests {
    private static final String BASE = "/api/admin/seller-applications";

    @Autowired MockMvc mvc;
    @MockitoBean SellerApplicationService service;
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

    private SellerApplicationDTO dto(String status) {
        return new SellerApplicationDTO(5L, 7L, "User 7", "user7@example.invalid", status, "001099012345",
                "NGUYỄN VĂN MẪU", LocalDate.of(1999, 1, 1), LocalDate.of(2021, 6, 15), "Cục Cảnh sát",
                LocalDateTime.of(2026, 11, 4, 8, 0), null, null);
    }

    @Test void anonymousGets401AndBuyerGets403() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE).with(user(principal(UserRole.USER)))).andExpect(status().isForbidden());
        mvc.perform(post(BASE + "/5/approve").with(user(principal(UserRole.USER))).with(csrf()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test void adminListsPendingByDefault() throws Exception {
        when(service.list(SellerApplicationStatus.PENDING)).thenReturn(List.of(dto("PENDING")));
        mvc.perform(get(BASE).with(user(principal(UserRole.ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(5))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
        verify(service).list(SellerApplicationStatus.PENDING);
    }

    @Test void invalidStatusReturns400() throws Exception {
        mvc.perform(get(BASE + "?status=abc").with(user(principal(UserRole.ADMIN))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
        verify(service, never()).list(any());
    }

    @Test void approveRequiresCsrf() throws Exception {
        mvc.perform(post(BASE + "/5/approve").with(user(principal(UserRole.ADMIN))))
                .andExpect(status().isForbidden());
        verify(service, never()).approve(anyLong(), anyLong());
        when(service.approve(999L, 5L)).thenReturn(dto("APPROVED"));
        mvc.perform(post(BASE + "/5/approve").with(user(principal(UserRole.ADMIN))).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        verify(service).approve(999L, 5L);
    }

    @Test void rejectWithBlankReasonReturns400() throws Exception {
        mvc.perform(post(BASE + "/5/reject").with(user(principal(UserRole.ADMIN))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        verify(service, never()).reject(anyLong(), anyLong(), any());
    }

    @Test void conflictFromServiceIsReturnedAs409() throws Exception {
        when(service.approve(999L, 5L)).thenThrow(
                new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ này đã được xử lý."));
        mvc.perform(post(BASE + "/5/approve").with(user(principal(UserRole.ADMIN))).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Hồ sơ này đã được xử lý."));
    }
}
