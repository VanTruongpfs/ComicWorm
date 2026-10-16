package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.admin.AdminUserController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.AdminUserStatsRecord;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.admin.IAdminUserService;
import com.example.comicworm.utils.JwtUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminUserController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AdminUserControllerSecurityTests {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    IAdminUserService adminUserService;

    @MockitoBean
    UserRepository userRepository;

    @MockitoBean
    UserDetailsService userDetailsService;

    @MockitoBean
    JwtUtils jwtUtils;

    private CustomUserDetails userPrincipal(UserRole role) {
        User u = new User();
        u.setId(role == UserRole.ADMIN ? 999L : 123L);
        u.setEmail(role == UserRole.ADMIN ? "admin@test.local" : "buyer@test.local");
        u.setFullName(role == UserRole.ADMIN ? "Super Admin" : "Regular Buyer");
        u.setRole(role);
        u.setIsSeller(false);
        u.setAccountStatus(AccountStatus.ACTIVE);
        return new CustomUserDetails(u);
    }

    @Test
    void unauthenticatedRequestToAdminUsers_returns401Or403() throws Exception {
        mvc.perform(get("/api/admin/users"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void buyerRequestToAdminUsers_returnsForbidden() throws Exception {
        mvc.perform(get("/api/admin/users")
                        .with(user(userPrincipal(UserRole.USER))))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminRequestToAdminUsers_returnsOk() throws Exception {
        when(adminUserService.listUsers(anyString(), anyString(), anyString(), anyInt(), anyInt()))
                .thenReturn(Map.of(
                        "Result", "OK",
                        "Records", Collections.emptyList(),
                        "TotalRecordCount", 0L,
                        "TotalPages", 0,
                        "CurrentPage", 0,
                        "Stats", new AdminUserStatsRecord(10, 2, 0, 1)
                ));

        mvc.perform(get("/api/admin/users")
                        .with(user(userPrincipal(UserRole.ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Result").value("OK"));
    }
}

