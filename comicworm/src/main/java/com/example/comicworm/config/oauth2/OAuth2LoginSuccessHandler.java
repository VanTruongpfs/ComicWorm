package com.example.comicworm.config.oauth2;

import com.example.comicworm.dto.general.auth.GoogleLoginDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.service.auth.IAuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final IAuthService authService;
    private final CsrfTokenRepository csrfTokens;

    public OAuth2LoginSuccessHandler(IAuthService authService, CsrfTokenRepository csrfTokens) {
        this.authService = authService;
        this.csrfTokens = csrfTokens;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        try {
            if (!(authentication.getPrincipal() instanceof OAuth2User oauth2User)) {
                throw new IllegalStateException("Không tìm thấy thông tin tài khoản Google.");
            }

            String email = oauth2User.getAttribute("email");
            String sub = oauth2User.getAttribute("sub");
            String name = oauth2User.getAttribute("name");
            String picture = oauth2User.getAttribute("picture");

            if (email == null || email.isBlank()) {
                throw new IllegalArgumentException("Không thể lấy email từ tài khoản Google.");
            }
            if (sub == null || sub.isBlank()) {
                throw new IllegalArgumentException("Không thể xác thực danh tính Google.");
            }

            GoogleLoginDTO googleDTO = new GoogleLoginDTO();
            googleDTO.setGoogleSub(sub);
            googleDTO.setEmail(email.trim().toLowerCase());
            googleDTO.setFullName(name != null && !name.isBlank() ? name.trim() : email);
            googleDTO.setAvatarUrl(picture);

            AuthResponseDTO authResponse = authService.loginWithGoogle(googleDTO);

            // Xóa CSRF session cũ
            csrfTokens.saveToken(null, request, response);

            // Lưu JWT token vào HttpOnly Cookie
            addJwtCookie(response, "accessToken", authResponse.getAccessToken(), 86400); // 1 ngày
            addJwtCookie(response, "refreshToken", authResponse.getRefreshToken(), 7 * 24 * 60 * 60); // 7 ngày

            // Phân quyền chuyển hướng
            String redirectUrl = authResponse.getRole() == UserRole.ADMIN
                    ? "/admin/html/postModeration.html"
                    : "/buyer/html/home.html";

            response.sendRedirect(redirectUrl);
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class)
                    .error("OAuth2 Success Handler Error: {}", e.getMessage(), e);
            String errorMessage = URLEncoder.encode(
                    e.getMessage() != null ? e.getMessage() : "Đăng nhập bằng Google thất bại.",
                    StandardCharsets.UTF_8
            );
            response.sendRedirect("/auth/login?oauthError=" + errorMessage);
        }
    }

    private void addJwtCookie(HttpServletResponse response, String name, String value, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .path("/")
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
