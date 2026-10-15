package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.admin.ProductModerationController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.AdminProductRecord;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.ListingType;
import com.example.comicworm.model.enums.ModerationStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.admin.IProductModerationService;
import com.example.comicworm.utils.JwtUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ProductModerationController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class ProductModerationControllerSecurityTests {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    IProductModerationService moderationService;

    @MockitoBean
    UserRepository userRepository;

    @MockitoBean
    UserDetailsService userDetailsService;

    @MockitoBean
    JwtUtils jwtUtils;

    private CustomUserDetails userPrincipal(UserRole role) {
        User u = new User();
        u.setId(role == UserRole.ADMIN ? 999L : 123L);
        u.setEmail(role == UserRole.ADMIN ? "admin@comicworm.com" : "user@comicworm.com");
        u.setFullName(role == UserRole.ADMIN ? "Admin User" : "Normal User");
        u.setRole(role);
        u.setIsSeller(true);
        return new CustomUserDetails(u);
    }

    private AdminProductRecord sampleRecord(Long id, ModerationStatus status, String reason) {
        return new AdminProductRecord(
                id, 10L, "Seller", "seller@example.com",
                "Comic Title", "comic-title", "Description",
                "cover.jpg", Collections.emptyList(),
                1, "Manga", 1, "Author", 1, "Publisher",
                "1-5", "Bìa mềm", 2024, 95, new BigDecimal("50000"),
                10, ListingType.SELL, null, true,
                status, reason, 999L, "Admin User", LocalDateTime.now(),
                LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void unauthenticatedAccess_Returns401() throws Exception {
        mvc.perform(get("/api/admin/products"))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/admin/products/1/approve"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void normalUserAccess_Returns403() throws Exception {
        CustomUserDetails normalUser = userPrincipal(UserRole.USER);

        mvc.perform(get("/api/admin/products").with(user(normalUser)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/admin/products/1/approve").with(user(normalUser)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/admin/products/1/reject")
                        .with(user(normalUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Vi pham\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminUser_ApproveProduct_Success() throws Exception {
        CustomUserDetails admin = userPrincipal(UserRole.ADMIN);
        when(moderationService.approve(eq(1L), eq(999L)))
                .thenReturn(sampleRecord(1L, ModerationStatus.APPROVED, null));

        mvc.perform(post("/api/admin/products/1/approve").with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Result").value("OK"))
                .andExpect(jsonPath("$.Record.moderationStatus").value("APPROVED"));
    }

    @Test
    void adminUser_RejectProduct_Success() throws Exception {
        CustomUserDetails admin = userPrincipal(UserRole.ADMIN);
        String reason = "Thông tin không chính xác";
        when(moderationService.reject(eq(1L), eq(999L), eq(reason)))
                .thenReturn(sampleRecord(1L, ModerationStatus.REJECTED, reason));

        mvc.perform(post("/api/admin/products/1/reject")
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Result").value("OK"))
                .andExpect(jsonPath("$.Record.moderationStatus").value("REJECTED"))
                .andExpect(jsonPath("$.Record.moderationReason").value(reason));
    }

    @Test
    void adminUser_RejectProduct_EmptyReason_Returns400() throws Exception {
        CustomUserDetails admin = userPrincipal(UserRole.ADMIN);

        mvc.perform(post("/api/admin/products/1/reject")
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.Result").value("ERROR"));
    }

    @Test
    void adminUser_ListProducts_Success() throws Exception {
        CustomUserDetails admin = userPrincipal(UserRole.ADMIN);
        when(moderationService.list(eq(ModerationStatus.PENDING), any(), eq(0), eq(10)))
                .thenReturn(Map.of(
                        "Result", "OK",
                        "Records", List.of(sampleRecord(1L, ModerationStatus.PENDING, null)),
                        "TotalRecordCount", 1L,
                        "Stats", Map.of("pending", 1L, "approved", 0L, "rejected", 0L)
                ));

        mvc.perform(get("/api/admin/products?status=PENDING").with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Result").value("OK"))
                .andExpect(jsonPath("$.Records[0].id").value(1L))
                .andExpect(jsonPath("$.Records[0].moderationStatus").value("PENDING"));
    }
}
