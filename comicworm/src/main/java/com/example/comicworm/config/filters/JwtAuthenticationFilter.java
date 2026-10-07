package com.example.comicworm.config.filters;

import com.example.comicworm.utils.JwtUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserDetailsService userDetailsService;

    @Autowired
    public JwtAuthenticationFilter(JwtUtils jwtUtils, UserDetailsService userDetailsService) {
        this.jwtUtils = jwtUtils;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String accessToken = getCookieValue(request, "accessToken");
        String refreshToken = getCookieValue(request, "refreshToken");

        String emailToAuthenticate = null;

        //Kiểm tra AccessToken
        if (accessToken != null && jwtUtils.validateToken(accessToken)) {
            emailToAuthenticate = jwtUtils.getEmailFromToken(accessToken);
        }
        //Nếu AccessToken hết hạn/không hợp lệ -> Thử dùng RefreshToken để tự gia hạn
        else if (refreshToken != null && jwtUtils.validateToken(refreshToken)) {
            emailToAuthenticate = jwtUtils.getEmailFromToken(refreshToken);

            if (emailToAuthenticate != null) {
                // Sinh AccessToken mới
                String newAccessToken = jwtUtils.generateAccessToken(emailToAuthenticate);

                // Cập nhật lại Cookie AccessToken mới gửi về cho Browser
                ResponseCookie newAccessCookie = ResponseCookie.from("accessToken", newAccessToken)
                        .httpOnly(true)
                        .secure(false)
                        .path("/")
                        .maxAge(15 * 60)
                        .sameSite("Lax")
                        .build();

                response.addHeader("Set-Cookie", newAccessCookie.toString());
            }
        }else if (accessToken != null || refreshToken != null) {
            // Xóa Cookie phía Browser bằng cách set maxAge(0)
            deleteAuthCookies(response);
        }

        // Nạp thông tin người dùng vào SecurityContext
        if (emailToAuthenticate != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = userDetailsService.loadUserByUsername(emailToAuthenticate);

                if (userDetails.isEnabled() && userDetails.isAccountNonLocked()) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Trích xuất giá trị Cookie theo tên
     */
    private String getCookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (name.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * Xóa các Cookie xác thực phía Browser khi Token không còn hợp lệ
     */
    private void deleteAuthCookies(HttpServletResponse response) {
        ResponseCookie cleanAccess = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .path("/")
                .maxAge(0) // Xóa ngay lập tức
                .sameSite("Lax")
                .build();

        ResponseCookie cleanRefresh = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .path("/")
                .maxAge(0) // Xóa ngay lập tức
                .sameSite("Lax")
                .build();

        response.addHeader("Set-Cookie", cleanAccess.toString());
        response.addHeader("Set-Cookie", cleanRefresh.toString());
    }
}