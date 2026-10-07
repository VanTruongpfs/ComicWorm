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
}