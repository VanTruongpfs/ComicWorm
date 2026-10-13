package com.example.comicworm.service.impl.user;

import com.example.comicworm.dto.user.ChangePasswordDTO;
import com.example.comicworm.dto.user.UpdateProfileDTO;
import com.example.comicworm.dto.user.UserProfileResponseDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.upload.UploadService;
import com.example.comicworm.service.user.IUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class UserServiceImpl implements IUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UploadService uploadService;

    @Autowired
    public UserServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           UploadService uploadService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.uploadService = uploadService;
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponseDTO getProfile(Long userId) {
        User user = findUserById(userId);
        return toDTO(user);
    }

    @Override
    @Transactional
    public UserProfileResponseDTO updateProfile(Long userId, UpdateProfileDTO request) {
        User user = findUserById(userId);

        if (request.getFullName() != null && !request.getFullName().trim().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }

        if (request.getPhone() != null) {
            String cleanPhone = request.getPhone().trim();
            user.setPhone(cleanPhone.isBlank() ? null : cleanPhone);
        }

        if (request.getAvatarUrl() != null && !request.getAvatarUrl().trim().isBlank()) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
        }

        User updatedUser = userRepository.save(user);
        return toDTO(updatedUser);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordDTO request) {
        User user = findUserById(userId);

        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            throw new IllegalArgumentException("Mật khẩu mới phải có tối thiểu 8 ký tự.");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Mật khẩu xác nhận không trùng khớp.");
        }

        // Nếu tài khoản có mật khẩu cũ thì bắt buộc kiểm tra mật khẩu hiện tại
        if (user.getPasswordHash() != null) {
            if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
                throw new IllegalArgumentException("Vui lòng nhập mật khẩu hiện tại.");
            }

            if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
                throw new IllegalArgumentException("Mật khẩu hiện tại không chính xác.");
            }

            if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
                throw new IllegalArgumentException("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
            }
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public String uploadAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng chọn một tệp hình ảnh.");
        }

        User user = findUserById(userId);
        String avatarUrl;

        // Nếu Cloudinary đã được cấu hình thì upload lên Cloudinary
        if (uploadService.isConfigured()) {
            UploadService.UploadedImage uploaded = uploadService.upload(file, "comicworm/avatars");
            avatarUrl = uploaded.url();
        } else {
            // Fallback lưu cục bộ tại thư mục uploads/avatars/
            try {
                String uploadsDir = "uploads/avatars";
                File dir = new File(uploadsDir);
                if (!dir.exists()) {
                    dir.mkdirs();
                }

                String ext = getFileExtension(file.getOriginalFilename());
                String fileName = "avatar_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;
                Path targetPath = Paths.get(uploadsDir).resolve(fileName);
                Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

                avatarUrl = "/uploads/avatars/" + fileName;
            } catch (IOException e) {
                throw new RuntimeException("Lưu ảnh đại diện thất bại: " + e.getMessage(), e);
            }
        }

        user.setAvatarUrl(avatarUrl);
        userRepository.save(user);
        return avatarUrl;
    }

    private String getFileExtension(String fileName) {
        if (fileName != null && fileName.lastIndexOf(".") > 0) {
            return fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
        }
        return ".jpg";
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với ID: " + userId));
    }

    private UserProfileResponseDTO toDTO(User user) {
        return UserProfileResponseDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole() != null ? user.getRole().name() : "USER")
                .isSeller(Boolean.TRUE.equals(user.getIsSeller()))
                .hasPassword(user.getPasswordHash() != null)
                .createdAt(user.getCreatedAt())
                .build();
    }
}

