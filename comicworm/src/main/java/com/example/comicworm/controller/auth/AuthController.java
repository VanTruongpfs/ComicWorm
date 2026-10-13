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

    @PostMapping("/resend-verification")
    public String resendVerification(@RequestParam("email") String email, RedirectAttributes redirectAttributes) {
        try {
            authService.resendVerificationEmail(email);
            redirectAttributes.addFlashAttribute("message", "Link kích hoạt mới đã được gửi đến email của bạn.");
            redirectAttributes.addFlashAttribute("success", true);
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("message", e.getMessage());
            redirectAttributes.addFlashAttribute("success", false);
        }
        return "redirect:/auth/register";
    }

    @GetMapping("/verify")
    public String verifyAccount(@RequestParam("token") String token, Model model) {
        String result = authService.verifyAccount(token);

        switch (result) {
            case "SUCCESS" -> {
                model.addAttribute("success", true);
                model.addAttribute("message", "Kích hoạt tài khoản thành công! Hãy đăng nhập để trải nghiệm.");
            }
            case "TOKEN_ALREADY_USED" -> {
                model.addAttribute("success", true);
                model.addAttribute("message", "Tài khoản này đã được kích hoạt trước đó. Bạn có thể đăng nhập ngay.");
            }
            case "TOKEN_EXPIRED" -> {
                model.addAttribute("success", false);
                model.addAttribute("canResend", true); // Bật nút gửi lại link trên View
                model.addAttribute("message", "Liên kết kích hoạt đã hết hạn (quá 24 giờ). Vui lòng yêu cầu gửi lại link mới.");
            }
            default -> {
                model.addAttribute("success", false);
                model.addAttribute("message", "Liên kết xác thực không hợp lệ hoặc không tồn tại.");
            }
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
