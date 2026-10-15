package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.AccountController;
import com.example.comicworm.controller.ViewController;
import com.example.comicworm.controller.admin.AdminModerationController;
import com.example.comicworm.controller.auth.AuthController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.service.admin.AdminModerationService;
import com.example.comicworm.service.auth.IAuthService;
import com.example.comicworm.utils.JwtUtils;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.example.comicworm.repository.UserRepository;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {ViewController.class, AccountController.class, AuthController.class,
        AdminModerationController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AdminAccessTests {
    @Autowired MockMvc mvc;
    @MockitoBean UserRepository users;
    @MockitoBean UserDetailsService details;
    @MockitoBean JwtUtils jwt;
    @MockitoBean IAuthService auth;
    @MockitoBean AdminModerationService moderation;

    CustomUserDetails principal(long id, UserRole role, boolean seller) {
        var user = new User();
        user.setId(id); user.setEmail("user" + id + "@example.invalid"); user.setFullName("User " + id);
        user.setRole(role); user.setIsSeller(seller);
        return new CustomUserDetails(user);
    }
    CustomUserDetails admin() { return principal(1, UserRole.ADMIN, false); }

    @ParameterizedTest
    @ValueSource(strings = {"postModeration", "dashboard", "accounts", "statistics", "hide_post"})
    void adminPagesNeedLoginAndAdminRole(String page) throws Exception {
        String path = "/admin/html/" + page + ".html";
        mvc.perform(get(path)).andExpect(status().isFound()).andExpect(redirectedUrl("/auth/login"));
        mvc.perform(get(path).with(user(principal(7, UserRole.USER, false)))).andExpect(status().isForbidden());
        // A seller is still not an admin.
        mvc.perform(get(path).with(user(principal(8, UserRole.USER, true)))).andExpect(status().isForbidden());
        mvc.perform(get(path).with(user(admin()))).andExpect(status().isOk());
    }

    @Test void adminStaticAssetsStayPublicAndOldAdminLoginUsesSharedLogin() throws Exception {
        mvc.perform(get("/admin/js/postModeration.js")).andExpect(status().isOk());
        mvc.perform(get("/admin/html/login.html")).andExpect(status().isFound())
                .andExpect(redirectedUrl("/auth/login"));
    }

    @Test void moderationApiRequiresAdmin() throws Exception {
        when(moderation.list(any(), any(), anyInt(), anyInt())).thenReturn(Map.of("items", List.of(), "total", 0));
        mvc.perform(get("/api/admin/moderation/products")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/moderation/products").with(user(principal(7, UserRole.USER, true))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/moderation/products").with(user(admin()))).andExpect(status().isOk());
        mvc.perform(get("/api/admin/moderation/products?status=BOGUS").with(user(admin())))
                .andExpect(status().isBadRequest());
    }

    @Test void approveAndRejectNeedAdminAndCsrfAndReason() throws Exception {
        mvc.perform(post("/api/admin/moderation/products/5/approve").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/moderation/products/5/approve").with(user(principal(7, UserRole.USER, true))).with(csrf()))
                .andExpect(status().isForbidden());
        // No CSRF token -> blocked even for an admin.
        mvc.perform(post("/api/admin/moderation/products/5/approve").with(user(admin())))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/moderation/products/5/approve").with(user(admin())).with(csrf()))
                .andExpect(status().isOk());
        verify(moderation).approve(1L, 5L);

        mvc.perform(post("/api/admin/moderation/products/5/reject").with(user(admin())).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        verify(moderation, never()).reject(anyLong(), anyLong(), any());
        mvc.perform(post("/api/admin/moderation/products/5/reject").with(user(admin())).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Anh khong ro rang\"}"))
                .andExpect(status().isOk());
        verify(moderation).reject(1L, 5L, "Anh khong ro rang");
    }

    @Test void loginSendsAdminToModerationAndEveryoneElseToHome() throws Exception {
        when(auth.login(any())).thenReturn(AuthResponseDTO.builder().accessToken("a").refreshToken("r")
                .role(UserRole.ADMIN).build());
        mvc.perform(post("/auth/login").param("email", "admin@example.invalid").param("password", "ExamplePassword2026!"))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/admin/html/postModeration.html"));
        when(auth.login(any())).thenReturn(AuthResponseDTO.builder().accessToken("a").refreshToken("r")
                .role(UserRole.USER).build());
        mvc.perform(post("/auth/login").param("email", "buyer@example.invalid").param("password", "ExamplePassword2026!"))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/buyer/html/home.html"));
        // Already signed in: the login page itself routes by role.
        mvc.perform(get("/auth/login").with(user(admin())))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/admin/html/postModeration.html"));
        mvc.perform(get("/auth/login").with(user(principal(7, UserRole.USER, false))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/buyer/html/home.html"));
    }
}
