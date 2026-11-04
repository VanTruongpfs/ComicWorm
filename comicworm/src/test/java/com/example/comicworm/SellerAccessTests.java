package com.example.comicworm;

import com.example.comicworm.dto.request.SellerApplicationForm;
import com.example.comicworm.dto.response.SellerApplicationDTO;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

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
import com.example.comicworm.service.account.SellerApplicationService;
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
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
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
import com.example.comicworm.service.account.AccountProfileService;
@WebMvcTest(controllers = {ViewController.class, SellerAccountController.class, AccountController.class,
        AnalyticsController.class, AuthController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, AccountProfileService.class})
class SellerAccessTests {
    @Autowired MockMvc mvc;
    @Autowired CsrfTokenRepository csrfTokens;
    @MockitoBean UserRepository users;
    @MockitoBean SellerApplicationService applications;
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
        mvc.perform(get(path)).andExpect(status().isFound()).andExpect(redirectedUrlPattern("**/auth/login"));
        mvc.perform(get(path).with(user(principal(false))))
                .andExpect(status().isForbidden());
        mvc.perform(get(path).with(user(principal(true)))).andExpect(status().isOk());
    }

    @Test void headCannotBypassSellerCheckButAdminsMayOpenSellerPages() throws Exception {
        var admin = account(1, false); admin.setRole(UserRole.ADMIN);
        mvc.perform(head("/seller/html/revenue.html").with(user(principal(false))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/seller/html/index.html").with(user(new CustomUserDetails(admin))))
                .andExpect(status().isOk());
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

    SellerApplicationDTO application(String status, String note) {
        return new SellerApplicationDTO(3L, 7L, "User 7", "user7@example.invalid", status, "001099012345",
                "NGUYỄN VĂN MẪU", LocalDate.of(1999, 1, 1), LocalDate.of(2021, 6, 15), "Cục Cảnh sát",
                LocalDateTime.of(2026, 11, 4, 8, 0), null, note);
    }

    MockHttpServletRequestBuilder sampleSubmission() {
        return sampleSubmission(SellerApplicationForm.sample().idDateOfBirth().toString());
    }

    MockHttpServletRequestBuilder sampleSubmission(String dateOfBirth) {
        var sample = SellerApplicationForm.sample();
        return post("/user/seller-upgrade").with(user(principal(false))).with(csrf())
                .param("idNumber", sample.idNumber()).param("idFullName", sample.idFullName())
                .param("idDateOfBirth", dateOfBirth)
                .param("idIssueDate", sample.idIssueDate().toString())
                .param("idIssuePlace", sample.idIssuePlace());
    }

    @Test void registrationRequiresLogin() throws Exception {
        mvc.perform(get("/user/seller-upgrade")).andExpect(status().isFound())
                .andExpect(redirectedUrlPattern("**/auth/login"));
    }

    @Test void buyerSeesPrefilledFormWhenNoApplication() throws Exception {
        when(applications.latestFor(7L)).thenReturn(Optional.empty());
        mvc.perform(get("/user/seller-upgrade").with(user(principal(false))))
                .andExpect(status().isOk())
                .andExpect(model().attribute("form", SellerApplicationForm.sample()))
                .andExpect(content().string(containsString("001099012345")))
                .andExpect(content().string(containsString("cccd-sample-front.svg")))
                .andExpect(content().string(containsString("Gửi hồ sơ")));
    }

    @Test void buyerSubmitsApplicationAndStaysBuyer() throws Exception {
        mvc.perform(sampleSubmission())
                .andExpect(status().isFound()).andExpect(redirectedUrl("/user/seller-upgrade"));
        verify(applications).submit(7L, SellerApplicationForm.sample());
        mvc.perform(get("/seller/html/index.html").with(user(principal(false))))
                .andExpect(status().isForbidden());
    }

    @Test void pendingApplicationIsShownReadOnly() throws Exception {
        when(applications.latestFor(7L)).thenReturn(Optional.of(application("PENDING", null)));
        mvc.perform(get("/user/seller-upgrade").with(user(principal(false))))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("đang chờ duyệt")))
                .andExpect(content().string(not(containsString("Gửi hồ sơ"))));
    }

    @Test void rejectedApplicationShowsReasonAndForm() throws Exception {
        when(applications.latestFor(7L)).thenReturn(Optional.of(application("REJECTED", "Ảnh mờ")));
        mvc.perform(get("/user/seller-upgrade").with(user(principal(false))))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Ảnh mờ")))
                .andExpect(content().string(containsString("Gửi hồ sơ")));
    }

    @Test void malformedDateShowsFieldErrorInsteadOf500() throws Exception {
        mvc.perform(sampleSubmission("abc"))
                .andExpect(status().isOk())
                .andExpect(model().attributeHasFieldErrors("form", "idDateOfBirth"));
        verify(applications, never()).submit(any(), any());
    }

    @Test void serviceValidationErrorIsShownOnTheForm() throws Exception {
        when(applications.submit(any(), any())).thenThrow(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bạn cần đủ 18 tuổi để đăng ký bán hàng."));
        mvc.perform(sampleSubmission())
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Bạn cần đủ 18 tuổi")));
    }

    @Test void postWithoutCsrfIsRejected() throws Exception {
        mvc.perform(post("/user/seller-upgrade").with(user(principal(false))).param("idNumber", "001099012345"))
                .andExpect(status().isForbidden());
        verify(applications, never()).submit(any(), any());
    }

    @Test void sellerIsRedirectedToSellerHome() throws Exception {
        mvc.perform(get("/user/seller-upgrade").with(user(principal(true))))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/seller/html/index.html"));
        mvc.perform(post("/user/seller-upgrade").with(user(principal(true))).with(csrf()))
                .andExpect(status().isFound()).andExpect(redirectedUrl("/seller/html/index.html"));
        verify(applications, never()).submit(any(), any());
    }

    @Test void sellerAccountWithJwtCanOpenStatisticsAndSellerPages() throws Exception {
        User seller = account(7, true);
        when(users.findById(7L)).thenReturn(Optional.of(seller));
        when(jwt.validateToken("valid-token")).thenReturn(true);
        when(jwt.getEmailFromToken("valid-token")).thenReturn(seller.getEmail());
        when(details.loadUserByUsername(seller.getEmail())).thenAnswer(call -> new CustomUserDetails(seller));
        Cookie cookie = new Cookie("accessToken", "valid-token");
        mvc.perform(get("/api/account/me").cookie(cookie)).andExpect(jsonPath("$.isSeller").value(true));
        mvc.perform(get("/seller/html/revenue.html").cookie(cookie)).andExpect(status().isOk());
        when(analytics.report(LocalDate.of(2026,10,1), LocalDate.of(2026,10,3), "day", 7L, "User 7"))
                .thenReturn(Map.of("sellerId", "7", "revenue", 0));
        mvc.perform(get("/api/analytics/seller?from=2026-10-01&to=2026-10-03&sellerId=999").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sellerId").value("7"));
        verify(analytics).report(LocalDate.of(2026,10,1), LocalDate.of(2026,10,3), "day", 7L, "User 7");
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
        var loggedOut = mvc.perform(get("/auth/logout").session(session)).andExpect(status().isFound()).andReturn();
        assertNull(csrfTokens.loadToken(loggedOut.getRequest()));
        var postLogoutLogin = mvc.perform(get("/auth/login")).andExpect(status().isOk()).andReturn();
        assertNotNull(csrfTokens.loadToken(postLogoutLogin.getRequest()));
    }
}
