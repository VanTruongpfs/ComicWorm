package com.example.comicworm.service.user;

import com.example.comicworm.dto.user.ChangePasswordDTO;
import com.example.comicworm.dto.user.UpdateProfileDTO;
import com.example.comicworm.dto.user.UserProfileResponseDTO;
import org.springframework.web.multipart.MultipartFile;

public interface IUserService {

    UserProfileResponseDTO getProfile(Long userId);

    UserProfileResponseDTO updateProfile(Long userId, UpdateProfileDTO request);

    void changePassword(Long userId, ChangePasswordDTO request);

    String uploadAvatar(Long userId, MultipartFile file);
}

