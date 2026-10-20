package com.example.comicworm;

import com.example.comicworm.config.SecurityConfig;
import com.example.comicworm.config.filters.JwtAuthenticationFilter;
import com.example.comicworm.controller.AccountController;
import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.account.AccountProfileService;
import com.example.comicworm.service.upload.UploadService;
import com.example.comicworm.utils.JwtUtils;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.example.comicworm.service.upload.UploadService;
import java.util.List;
import org.springframework.mock.web.MockMultipartFile;
@WebMvcTest(controllers = AccountController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, AccountProfileService.class})
class AccountProfileTests {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder encoder;
    @MockitoBean UserRepository users;
    @MockitoBean UserDetailsService details;
    @MockitoBean JwtUtils jwt;
    @MockitoBean UploadService uploads;

    User account;

    @BeforeEach
    void setUp() {
        account = new User();
        account.setId(7L);
        account.setEmail("user7@example.invalid");
        account.setFullName("Tên Cũ");
        account.setRole(UserRole.USER);
        account.setIsSeller(false);
        account.setAccountStatus(AccountStatus.ACTIVE);
        account.setPasswordHash(encoder.encode("matkhau-cu-123"));
        when(users.findById(7L)).thenReturn(Optional.of(account));
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
    }

    CustomUserDetails principal() { return new CustomUserDetails(account); }

    String passwordBody(String current, String next, String confirm) {
        return "{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next
                + "\",\"confirmPassword\":\"" + confirm + "\"}";
    }

    @Test void writesRequireLogin() throws Exception {
        mvc.perform(put("/api/account/profile").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"A\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/account/password").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(passwordBody("a", "b", "b"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account/csrf")).andExpect(status().isUnauthorized());
        verify(users, never()).save(any());
    }

    @Test void writesRejectMissingCsrfToken() throws Exception {
        mvc.perform(put("/api/account/profile").with(user(principal())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Tên Mới\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/account/password").with(user(principal())).contentType(MediaType.APPLICATION_JSON)
                .content(passwordBody("matkhau-cu-123", "matkhau-moi-456", "matkhau-moi-456")))
                .andExpect(status().isForbidden());
        assertEquals("Tên Cũ", account.getFullName());
        verify(users, never()).save(any());
    }

    @Test void csrfEndpointIssuesToken() throws Exception {
        mvc.perform(get("/api/account/csrf").with(user(principal())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test void updatesFullNameTrimmedAndCollapsed() throws Exception {
        mvc.perform(put("/api/account/profile").with(user(principal())).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"  Thanh   Tú  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("Thanh Tú"))
                .andExpect(jsonPath("$.email").value("user7@example.invalid"));
        assertEquals("Thanh Tú", account.getFullName());
        verify(users).save(account);
    }

    @Test void rejectsBlankAndOverlongNames() throws Exception {
        for (String name : new String[] {"", "   ", "x".repeat(101), "Tên\\u0007lạ"}) {
            mvc.perform(put("/api/account/profile").with(user(principal())).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"" + name + "\"}"))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("fullName"));
        }
        mvc.perform(put("/api/account/profile").with(user(principal())).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
        assertEquals("Tên Cũ", account.getFullName());
        verify(users, never()).save(any());
    }

    @Test void changesPasswordWhenCurrentIsCorrect() throws Exception {
        mvc.perform(post("/api/account/password").with(user(principal())).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody("matkhau-cu-123", "matkhau-moi-456", "matkhau-moi-456")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        assertTrue(encoder.matches("matkhau-moi-456", account.getPasswordHash()));
        assertFalse(encoder.matches("matkhau-cu-123", account.getPasswordHash()));
    }

    @Test void rejectsWrongCurrentPassword() throws Exception {
        String before = account.getPasswordHash();
        mvc.perform(post("/api/account/password").with(user(principal())).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody("sai-mat-khau", "matkhau-moi-456", "matkhau-moi-456")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("currentPassword"));
        assertEquals(before, account.getPasswordHash());
        verify(users, never()).save(any());
    }

    @Test void rejectsWeakSamePasswordAndMismatchedConfirmation() throws Exception {
        String[][] cases = {
                {"matkhau-cu-123", "ngan", "ngan", "newPassword"},
                {"matkhau-cu-123", "matkhau-cu-123", "matkhau-cu-123", "newPassword"},
                {"matkhau-cu-123", "matkhau-moi-456", "khac-hoan-toan", "confirmPassword"},
                {"matkhau-cu-123", "a".repeat(73), "a".repeat(73), "newPassword"}};
        for (String[] c : cases) {
            mvc.perform(post("/api/account/password").with(user(principal())).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(passwordBody(c[0], c[1], c[2])))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(c[3]));
        }
        verify(users, never()).save(any());
    }

    @Test void googleOnlyAccountCannotSetPasswordHere() throws Exception {
        account.setPasswordHash(null);
        mvc.perform(post("/api/account/password").with(user(principal())).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody("x", "matkhau-moi-456", "matkhau-moi-456")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("currentPassword"));
        verify(users, never()).save(any());
    }

    @Test void lockedAccountCannotWrite() throws Exception {
        account.setAccountStatus(AccountStatus.LOCKED);
        mvc.perform(put("/api/account/profile").with(user(principal())).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"X\"}"))
                .andExpect(status().isForbidden());
    }

    // ---- Ảnh đại diện ----
    static final String OLD_URL = "https://res.cloudinary.com/demo/image/upload/v1/comicworm/avatars/oldpic123.webp";
    static final String NEW_URL = "https://res.cloudinary.com/demo/image/upload/v2/comicworm/avatars/newpic456.webp";

    MockMultipartFile image() {
        return new MockMultipartFile("file", "avatar.webp", "image/webp", new byte[] {1, 2, 3});
    }

    @Test void avatarUploadRequiresLoginAndCsrf() throws Exception {
        mvc.perform(multipart("/api/account/avatar").file(image()).with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/account/avatar").file(image()).with(user(principal())))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/account/avatar").with(user(principal()))).andExpect(status().isForbidden());
        verifyNoInteractions(uploads);
        verify(users, never()).save(any());
    }

    @Test void uploadsAvatarStoresUrlAndDeletesPreviousOwnImage() throws Exception {
        account.setAvatarUrl(OLD_URL);
        when(uploads.upload(any(), eq("comicworm/avatars")))
                .thenReturn(new UploadService.UploadedImage(NEW_URL, "comicworm/avatars/newpic456"));
        mvc.perform(multipart("/api/account/avatar").file(image()).with(user(principal())).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value(NEW_URL));
        assertEquals(NEW_URL, account.getAvatarUrl());
        verify(uploads).cleanup(List.of(new UploadService.UploadedImage(OLD_URL, "comicworm/avatars/oldpic123")));
    }

    @Test void neverDeletesAvatarsHostedElsewhere() throws Exception {
        account.setAvatarUrl("https://lh3.googleusercontent.com/a/some-google-photo");
        when(uploads.upload(any(), any()))
                .thenReturn(new UploadService.UploadedImage(NEW_URL, "comicworm/avatars/newpic456"));
        mvc.perform(multipart("/api/account/avatar").file(image()).with(user(principal())).with(csrf()))
                .andExpect(status().isOk());
        verify(uploads, never()).cleanup(any());
    }

    @Test void failedUploadKeepsCurrentAvatar() throws Exception {
        account.setAvatarUrl(OLD_URL);
        when(uploads.upload(any(), any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF."));
        mvc.perform(multipart("/api/account/avatar").file(image()).with(user(principal())).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF."));
        assertEquals(OLD_URL, account.getAvatarUrl());
        verify(users, never()).save(any());
    }

    @Test void newUploadIsCleanedUpWhenSavingFails() throws Exception {
        var uploaded = new UploadService.UploadedImage(NEW_URL, "comicworm/avatars/newpic456");
        when(uploads.upload(any(), any())).thenReturn(uploaded);
        when(users.save(any(User.class))).thenThrow(new IllegalStateException("db down"));
        try {
            mvc.perform(multipart("/api/account/avatar").file(image()).with(user(principal())).with(csrf()));
        } catch (Exception expected) { /* Lỗi DB được đẩy ra ngoài MockMvc. */ }
        verify(uploads).cleanup(List.of(uploaded));
    }

    @Test void removesAvatar() throws Exception {
        account.setAvatarUrl(OLD_URL);
        mvc.perform(delete("/api/account/avatar").with(user(principal())).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").isEmpty());
        assertNull(account.getAvatarUrl());
        verify(uploads).cleanup(List.of(new UploadService.UploadedImage(OLD_URL, "comicworm/avatars/oldpic123")));
    }

    @Test void meIncludesAvatarUrl() throws Exception {
        account.setAvatarUrl(NEW_URL);
        mvc.perform(get("/api/account/me").with(user(principal())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value(NEW_URL));
    }
}
