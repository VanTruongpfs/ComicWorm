package com.example.comicworm.controller.auth;

import com.example.comicworm.dto.general.auth.UserLoginDTO;
import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.service.auth.IAuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.Duration;

@Controller
@RequestMapping("/auth")
public class AuthController {

    private final IAuthService authService;
    private final CsrfTokenRepository csrfTokens;

    @Autowired
    public AuthController(IAuthService authService, CsrfTokenRepository csrfTokens) {
        this.authService = authService;
        this.csrfTokens = csrfTokens;
    }

    @GetMapping("/login")
    public String showLoginForm(Model model) {
        if (isAuthenticated()) {
            return "redirect:/buyer/html/home.html";
        }
        model.addAttribute("loginDTO", new UserLoginDTO());
        return "view/auth/html/login";
    }

    @GetMapping("/register")
    public String showRegisterForm(Model model) {
        if (isAuthenticated()) {
            return "redirect:/buyer/html/home.html";
        }
        model.addAttribute("registerDTO", new UserRegisterDTO());
        return "view/auth/html/register";
    }

    @PostMapping("/login")
    public String processLogin(@Valid @ModelAttribute("loginDTO") UserLoginDTO loginDTO,
                               BindingResult bindingResult,
                               HttpServletResponse response,
                               Model model,
                               HttpServletRequest request) {
        if (bindingResult.hasErrors()) {
            return "view/auth/html/login";
        }

        try {
            AuthResponseDTO authResponse = authService.login(loginDTO);
            csrfTokens.saveToken(null, request, response);

            // Lưu Access Token vào HttpOnly Cookie
            addJwtCookie(response, "accessToken", authResponse.getAccessToken(), 86400); // 1 ngày
            // Set Refresh Token (7 ngày)
            addJwtCookie(response, "refreshToken", authResponse.getRefreshToken(), 7 * 24 * 60 * 60);

            return "redirect:/buyer/html/home.html";
        } catch (Exception e) {
            model.addAttribute("errorMessage", e.getMessage());
            return "view/auth/html/login";
        }
    }

    @PostMapping("/register")
    public String processRegister(@Valid @ModelAttribute("registerDTO") UserRegisterDTO registerDTO,
                                  BindingResult bindingResult,
                                  RedirectAttributes redirectAttributes,
                                  Model model) {
        if (bindingResult.hasErrors()) {
            return "view/auth/html/register";
        }

        try {
            if (registerDTO.getConfirmPassword() != null &&
                    !registerDTO.getPassword().equals(registerDTO.getConfirmPassword())) {
                bindingResult.rejectValue("confirmPassword", "error.registerDTO", "Mật khẩu xác nhận không khớp");
                return "view/auth/html/register";
            }

            authService.register(registerDTO);

            // Đánh dấu cờ hiển thị Modal thông báo check email
            redirectAttributes.addFlashAttribute("showVerifyPopup", true);
            redirectAttributes.addFlashAttribute("registeredEmail", registerDTO.getEmail());

            return "redirect:/auth/register";
        } catch (Exception e) {
            model.addAttribute("errorMessage", e.getMessage());
            return "view/auth/html/register";
        }
    }

    @GetMapping("/verify")
    public String verifyAccount(@RequestParam("token") String token, Model model) {
        try {
            authService.verifyAccount(token);
            model.addAttribute("success", true);
            model.addAttribute("message", "Xác thực tài khoản thành công! Tài khoản của bạn đã được kích hoạt.");
        } catch (Exception e) {
            model.addAttribute("success", false);
            model.addAttribute("message", "Xác thực thất bại: " + e.getMessage());
        }
        return "view/auth/html/verify";
    }

    @GetMapping("/logout")
    public String logout(HttpServletResponse response, HttpServletRequest request) {
        csrfTokens.saveToken(null, request, response);
        // Clear both tokens so the filter cannot restore the logged-out session.
        addJwtCookie(response, "accessToken", "", 0);
        addJwtCookie(response, "refreshToken", "", 0);

        // Redirect về Endpoint URL "/auth/login?logout"
        return "redirect:/auth/login?logout";
    }

    // Helper tạo HttpOnly Cookie chuẩn Spring (Hỗ trợ SameSite chống CSRF)
    private void addJwtCookie(HttpServletResponse response, String name, String value, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)            // Chống XSS (JS không đọc được)
                .path("/")                 // Áp dụng cho toàn bộ đường dẫn website
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .sameSite("Lax")           // Bảo mật chống tấn công CSRF
                // .secure(true)           // Bật dòng này khi chạy trên môi trường HTTPS thực tế
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private boolean isAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            return false;
        }

        return authentication.isAuthenticated();
    }
}
