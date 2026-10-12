package com.example.comicworm;

import com.example.comicworm.mapper.UserMapper;
import com.example.comicworm.model.PasswordResetToken;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.repository.PasswordResetTokenRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.common.IEmailService;
import com.example.comicworm.service.impl.auth.AuthServiceImpl;
import com.example.comicworm.utils.JwtUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ForgotPasswordTests {

    private UserRepository userRepository;
    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private JwtUtils jwtUtils;
    private IEmailService emailService;
    private PasswordResetTokenRepository passwordResetTokenRepository;
    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() throws Exception {
        userRepository = mock(UserRepository.class);
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtUtils = mock(JwtUtils.class);
        emailService = mock(IEmailService.class);
        passwordResetTokenRepository = mock(PasswordResetTokenRepository.class);

        authService = new AuthServiceImpl(
                userRepository,
                userMapper,
                passwordEncoder,
                jwtUtils,
                emailService,
                passwordResetTokenRepository
        );

        Field baseUrlField = AuthServiceImpl.class.getDeclaredField("baseUrl");
        baseUrlField.setAccessible(true);
        baseUrlField.set(authService, "http://localhost:8080");
    }

    @Test
    void testMaskEmail() {
        assertEquals("th********g@gmail.com", AuthServiceImpl.maskEmail("thanhtruong@gmail.com"));
        assertEquals("ad*****n@comicworm.com", AuthServiceImpl.maskEmail("admin@comicworm.com"));
        assertEquals("u***r@test.com", AuthServiceImpl.maskEmail("user@test.com"));
        assertEquals("t***@gmail.com", AuthServiceImpl.maskEmail("tu@gmail.com"));
        assertEquals("******", AuthServiceImpl.maskEmail("invalid-email"));
    }

    @Test
    void testGetMaskedEmail() {
        User user = new User();
        user.setId(1L);
        user.setEmail("thanhtruong@gmail.com");
        when(userRepository.findByEmailAndDeletedAtIsNull("thanhtruong@gmail.com")).thenReturn(Optional.of(user));

        String masked = authService.getMaskedEmail("thanhtruong@gmail.com");
        assertEquals("th********g@gmail.com", masked);
    }

    @Test
    void testRequestPasswordResetMismatchedEmailThrowsException() {
        User user = new User();
        user.setId(1L);
        user.setEmail("thanhtruong@gmail.com");
        when(userRepository.findByEmailAndDeletedAtIsNull("thanhtruong@gmail.com")).thenReturn(Optional.of(user));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                authService.requestPasswordReset("thanhtruong@gmail.com", "wrongemail@gmail.com")
        );
        assertTrue(ex.getMessage().contains("không khớp"));
    }

    @Test
    void testRequestPasswordResetSuccess() {
        User user = new User();
        user.setId(1L);
        user.setEmail("thanhtruong@gmail.com");
        user.setFullName("Thanh Truong");
        user.setAccountStatus(AccountStatus.ACTIVE);
        when(userRepository.findByEmailAndDeletedAtIsNull("thanhtruong@gmail.com")).thenReturn(Optional.of(user));

        authService.requestPasswordReset("thanhtruong@gmail.com", "thanhtruong@gmail.com");

        verify(passwordResetTokenRepository).deleteByUserId(1L);
        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
        verify(emailService).sendPasswordResetEmail(eq("thanhtruong@gmail.com"), eq("Thanh Truong"), contains("http://localhost:8080/auth/reset-password?token="));
    }

    @Test
    void testResetPasswordSuccess() {
        User user = new User();
        user.setId(1L);
        user.setEmail("thanhtruong@gmail.com");
        user.setPasswordHash("oldHash");

        PasswordResetToken token = new PasswordResetToken();
        token.setId(10L);
        token.setUserId(1L);
        token.setTokenHash("someHashedToken");
        token.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        token.setUsedAt(null);

        when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newPassword123")).thenReturn("newHashedPassword");

        authService.resetPassword("rawToken", "newPassword123", "newPassword123");

        assertEquals("newHashedPassword", user.getPasswordHash());
        assertNotNull(token.getUsedAt());
        verify(userRepository).save(user);
        verify(passwordResetTokenRepository).save(token);
    }
}

