package com.example.comicworm;

import com.example.comicworm.dto.user.ChangePasswordDTO;
import com.example.comicworm.dto.user.UpdateProfileDTO;
import com.example.comicworm.dto.user.UserProfileResponseDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.impl.user.UserServiceImpl;
import com.example.comicworm.service.upload.UploadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class UserProfileTests {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private UploadService uploadService;
    private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        uploadService = mock(UploadService.class);
        userService = new UserServiceImpl(userRepository, passwordEncoder, uploadService);
    }

    @Test
    void testGetProfileSuccess() {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");
        user.setFullName("Nguyễn Văn A");
        user.setPhone("0987654321");
        user.setRole(UserRole.USER);
        user.setIsSeller(false);
        user.setPasswordHash("hashed_password");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserProfileResponseDTO profile = userService.getProfile(1L);

        assertNotNull(profile);
        assertEquals("user@example.com", profile.getEmail());
        assertEquals("Nguyễn Văn A", profile.getFullName());
        assertEquals("0987654321", profile.getPhone());
        assertTrue(profile.getHasPassword());
    }

    @Test
    void testUpdateProfileSuccess() {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@example.com");
        user.setFullName("Cũ");
        user.setPhone("0911111111");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateProfileDTO request = new UpdateProfileDTO("Mới", "0999999999", null);
        UserProfileResponseDTO updated = userService.updateProfile(1L, request);

        assertEquals("Mới", updated.getFullName());
        assertEquals("0999999999", updated.getPhone());
        verify(userRepository).save(user);
    }

    @Test
    void testChangePasswordWrongCurrentPassword() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("correct_hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong_pass", "correct_hash")).thenReturn(false);

        ChangePasswordDTO request = new ChangePasswordDTO("wrong_pass", "new_password_123", "new_password_123");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                userService.changePassword(1L, request)
        );
        assertTrue(ex.getMessage().contains("Mật khẩu hiện tại không chính xác"));
    }

    @Test
    void testChangePasswordMismatchConfirm() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("correct_hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        ChangePasswordDTO request = new ChangePasswordDTO("old_pass", "new_password_123", "different_pass");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                userService.changePassword(1L, request)
        );
        assertTrue(ex.getMessage().contains("không trùng khớp"));
    }

    @Test
    void testChangePasswordSuccess() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("old_hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old_pass", "old_hash")).thenReturn(true);
        when(passwordEncoder.matches("new_pass_123", "old_hash")).thenReturn(false);
        when(passwordEncoder.encode("new_pass_123")).thenReturn("new_hash");

        ChangePasswordDTO request = new ChangePasswordDTO("old_pass", "new_pass_123", "new_pass_123");
        userService.changePassword(1L, request);

        assertEquals("new_hash", user.getPasswordHash());
        verify(userRepository).save(user);
    }

    @Test
    void testUploadAvatarCloudinaryConfigured() {
        User user = new User();
        user.setId(1L);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(uploadService.isConfigured()).thenReturn(true);
        when(uploadService.upload(any(), anyString()))
                .thenReturn(new UploadService.UploadedImage("https://res.cloudinary.com/test/avatar.jpg", "public_id"));

        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", "image_bytes".getBytes());
        String url = userService.uploadAvatar(1L, file);

        assertEquals("https://res.cloudinary.com/test/avatar.jpg", url);
        assertEquals(url, user.getAvatarUrl());
        verify(userRepository).save(user);
    }
}

