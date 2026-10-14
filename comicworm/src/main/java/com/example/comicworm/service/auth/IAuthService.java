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

<<<<<<< HEAD

=======
>>>>>>> f700927ddee828288f86d4e2740f169c46449bd0
    String getMaskedEmail(String identifier);

    void requestPasswordReset(String identifier, String fullEmail);

    boolean validatePasswordResetToken(String token);

    void resetPassword(String token, String newPassword, String confirmPassword);
}