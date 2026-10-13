package com.example.comicworm.service.auth;

import com.example.comicworm.dto.general.auth.GoogleLoginDTO;
import com.example.comicworm.dto.general.auth.UserLoginDTO;
import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;

public interface IAuthService {

    AuthResponseDTO register(UserRegisterDTO registerDTO);

    AuthResponseDTO login(UserLoginDTO loginDTO);

    AuthResponseDTO loginWithGoogle(GoogleLoginDTO googleDTO);

    AuthResponseDTO refreshToken(String refreshToken);

    String verifyAccount(String token);

    void resendVerificationEmail(String email);

    boolean verifyAccount(String token);

    String getMaskedEmail(String identifier);

    void requestPasswordReset(String identifier, String fullEmail);

    boolean validatePasswordResetToken(String token);

    void resetPassword(String token, String newPassword, String confirmPassword);
}