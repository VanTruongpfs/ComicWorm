package com.example.comicworm.config.oauth2;

import com.example.comicworm.dto.general.auth.CustomUserDetails;
import com.example.comicworm.dto.general.auth.GoogleLoginDTO;
import com.example.comicworm.model.User;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.auth.IAuthService;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final IAuthService authService;
    private final UserRepository userRepository;

    public CustomOAuth2UserService(IAuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String email = oAuth2User.getAttribute("email");
        String sub = oAuth2User.getAttribute("sub");
        String name = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");

        if (email == null || email.isBlank()) {
            throw new OAuth2AuthenticationException("Không thể lấy email từ Google.");
        }

        GoogleLoginDTO googleDTO = new GoogleLoginDTO();
        googleDTO.setGoogleSub(sub != null ? sub : email);
        googleDTO.setEmail(email.trim().toLowerCase());
        googleDTO.setFullName(name != null && !name.isBlank() ? name.trim() : email);
        googleDTO.setAvatarUrl(picture);

        // Đăng ký mới hoặc liên kết user vào database
        authService.loginWithGoogle(googleDTO);

        User user = userRepository.findByEmailAndDeletedAtIsNull(email.trim().toLowerCase())
                .orElseThrow(() -> new OAuth2AuthenticationException("Không tìm thấy thông tin tài khoản sau khi xác thực Google"));

        // Trả về CustomUserDetails (đã implement OAuth2User)
        return new CustomUserDetails(user, oAuth2User.getAttributes());
    }
}
