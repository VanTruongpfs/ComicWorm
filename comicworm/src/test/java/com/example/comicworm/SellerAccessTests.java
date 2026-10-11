package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.AccountController;
import com.example.comicworm.controller.AnalyticsController;
import com.example.comicworm.controller.SellerAccountController;
import com.example.comicworm.controller.ViewController;
import com.example.comicworm.controller.auth.AuthController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.account.SellerUpgradeService;
import com.example.comicworm.service.analytics.AnalyticsService;
import com.example.comicworm.service.auth.IAuthService;
import com.example.comicworm.utils.JwtUtils;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {ViewController.class, SellerAccountController.class, AccountController.class,
        AnalyticsController.class, AuthController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, SellerUpgradeService.class})
class SellerAccessTests {
    @Autowired MockMvc mvc;
    @Autowired SellerUpgradeService upgrades;
    @Autowired CsrfTokenRepository csrfTokens;
    @MockitoBean UserRepository users;
    @MockitoBean UserDetailsService details;
    @MockitoBean JwtUtils jwt;
    @MockitoBean AnalyticsService analytics;
    @MockitoBean IAuthService auth;

    User account(long id, boolean seller) {
        var user = new User();
        user.setId(id); user.setEmail("user" + id + "@example.invalid"); user.setFullName("User " + id);
        user.setRole(UserRole.USER); user.setIsSeller(seller);
        return user;
    }
    CustomUserDetails principal(boolean seller) { return new CustomUserDetails(account(7, seller)); }

    @ParameterizedTest
    @ValueSource(strings = {"index", "revenue", "orders", "reviews", "wallet", "transactions", "withdraw",
            "post-product-hub", "dang-ban-truyen", "quan-ly-bai-dang", "chinh-sua-bai-dang",
            "an-xoa-bai-dang", "quan-ly-san-pham", "quan-ly-voucher", "sidebar"})
    void everySellerPageRequiresLoginAndUpgrade(String page) throws Exception {
        String path = "/seller/html/" + page + ".html";
        mvc.perform(get(path)).andExpect(status().isFound()).andExpect(redirectedUrl("/auth/login"));
        mvc.perform(get(path).with(user(principal(false))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/user/seller-upgrade"));
        mvc.perform(get(path).with(user(principal(true)))).andExpect(status().isOk());
    }

    @Test void headAndAdminCannotBypassSellerUpgrade() throws Exception {
        var admin = account(1, false); admin.setRole(UserRole.ADMIN);
        mvc.perform(head("/seller/html/revenue.html").with(user(principal(false))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/user/seller-upgrade"));
        mvc.perform(get("/seller/html/index.html").with(user(new CustomUserDetails(admin))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/user/seller-upgrade"));
    }

    @Test void assetsStayPublicAndStatisticsRemainRoleProtected() throws Exception {
        mvc.perform(get("/seller/js/revenue.js")).andExpect(status().isOk());
        mvc.perform(get("/api/analytics/seller?from=2026-10-01&to=2026-10-03"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/analytics/seller?from=2026-10-01&to=2026-10-03").with(user(principal(false))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/admin/html/statistics.html").with(user(principal(true))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(analytics);
    }

    @Test void upgradePageExplainsRequirementAndIncludesCsrfToken() throws Exception {
        var response = mvc.perform(get("/user/seller-upgrade").with(user(principal(false))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(response.contains("Nâng cấp lên Người bán"));
        assertTrue(response.contains("name=\"_csrf\""));
        assertTrue(response.contains("User 7"));
        mvc.perform(get("/user/seller-upgrade").with(user(principal(true))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/seller/html/index.html"));
    }

    @Test void upgradeRequiresLoginAndCsrfAndGetDoesNotMutate() throws Exception {
        mvc.perform(get("/user/seller-upgrade")).andExpect(status().isFound());
        mvc.perform(get("/user/seller-upgrade").with(user(principal(false)))).andExpect(status().isOk());
        mvc.perform(post("/user/seller-upgrade").with(user(principal(false))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/user/seller-upgrade?csrfExpired=true"));
        mvc.perform(get("/user/seller-upgrade?csrfExpired=true").with(user(principal(false))))
                .andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("Phiên xác nhận đã hết hạn")));
        mvc.perform(post("/user/seller-upgrade").with(csrf())).andExpect(status().isFound());
        verifyNoInteractions(users);
    }

    @Test void upgradeChangesOnlyLoggedInAccountAndSameJwtCanOpenStatisticsImmediately() throws Exception {
        User buyer = account(7, false);
        when(users.findById(7L)).thenReturn(Optional.of(buyer));
        when(jwt.validateToken("valid-token")).thenReturn(true);
        when(jwt.getEmailFromToken("valid-token")).thenReturn(buyer.getEmail());
        when(details.loadUserByUsername(buyer.getEmail())).thenAnswer(call -> new CustomUserDetails(buyer));
        Cookie cookie = new Cookie("accessToken", "valid-token");
        mvc.perform(get("/api/account/me").cookie(cookie)).andExpect(jsonPath("$.isSeller").value(false));
        mvc.perform(post("/user/seller-upgrade").cookie(cookie).with(csrf()).param("userId", "999"))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/seller/html/index.html"));
        assertTrue(buyer.getIsSeller()); assertEquals(UserRole.USER, buyer.getRole());
        verify(users).findById(7L); verify(users, never()).findById(999L); verify(users).save(buyer);
        mvc.perform(get("/seller/html/revenue.html").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(get("/api/account/me").cookie(cookie)).andExpect(jsonPath("$.isSeller").value(true));
        when(analytics.report(LocalDate.of(2026,10,1), LocalDate.of(2026,10,3), "day", 7L, "User 7"))
                .thenReturn(Map.of("sellerId", "7", "revenue", 0));
        mvc.perform(get("/api/analytics/seller?from=2026-10-01&to=2026-10-03&sellerId=999").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sellerId").value("7"));
        verify(analytics).report(LocalDate.of(2026,10,1), LocalDate.of(2026,10,3), "day", 7L, "User 7");
    }

    @Test void upgradeIsIdempotentAndInactiveOrDeletedAccountsAreRejected() {
        User seller = account(7, true); when(users.findById(7L)).thenReturn(Optional.of(seller));
        upgrades.upgrade(principal(true)); verify(users, never()).save(any());
        for (AccountStatus status : List.of(AccountStatus.LOCKED, AccountStatus.PENDING_VERIFY)) {
            User blocked = account(7, false); blocked.setAccountStatus(status);
            when(users.findById(7L)).thenReturn(Optional.of(blocked));
            assertEquals(403, assertThrows(ResponseStatusException.class, () -> upgrades.upgrade(principal(false))).getStatusCode().value());
            assertFalse(blocked.getIsSeller());
        }
        User deleted = account(7, false); deleted.setDeletedAt(LocalDateTime.now());
        when(users.findById(7L)).thenReturn(Optional.of(deleted));
        assertThrows(ResponseStatusException.class, () -> upgrades.upgrade(principal(false)));
        assertThrows(ResponseStatusException.class, () -> upgrades.upgrade(null));
        verify(users, never()).save(any());
    }

    @Test void accountIdentityRequiresLoginAndLogoutClearsBothJwtCookies() throws Exception {
        mvc.perform(get("/api/account/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account/me").with(user(principal(false))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.role").value("USER")).andExpect(jsonPath("$.isSeller").value(false));
        var logout = mvc.perform(get("/auth/logout")).andExpect(status().isFound()).andReturn().getResponse();
        assertEquals(0, logout.getCookie("accessToken").getMaxAge());
        assertEquals(0, logout.getCookie("refreshToken").getMaxAge());
    }

    @Test void successfulLoginAndLogoutClearPreviousCsrfTokens() throws Exception {
        var loginPage = mvc.perform(get("/auth/login")).andExpect(status().isOk()).andReturn();
        assertNotNull(csrfTokens.loadToken(loginPage.getRequest()));
        var session = (MockHttpSession) loginPage.getRequest().getSession(false);
        when(auth.login(any())).thenReturn(AuthResponseDTO.builder().accessToken("test-access").refreshToken("test-refresh").build());
        var loggedIn = mvc.perform(post("/auth/login").session(session)
                .param("email", "buyer@example.invalid").param("password", "ExamplePassword2026!"))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/buyer/html/home.html")).andReturn();
        assertNull(csrfTokens.loadToken(loggedIn.getRequest()));
        var upgradePage = mvc.perform(get("/user/seller-upgrade").session(session).with(user(principal(false))))
                .andExpect(status().isOk()).andReturn();
        assertNotNull(csrfTokens.loadToken(upgradePage.getRequest()));
        var loggedOut = mvc.perform(get("/auth/logout").session(session)).andExpect(status().isFound()).andReturn();
        assertNull(csrfTokens.loadToken(loggedOut.getRequest()));
    }
}
