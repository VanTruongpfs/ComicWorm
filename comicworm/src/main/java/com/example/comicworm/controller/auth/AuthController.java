package com.example.comicworm.controller.auth;

import com.example.comicworm.dto.general.auth.UserLoginDTO;
import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.service.auth.IAuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
import java.util.HashMap;
import java.util.Map;

@Controller
@RequestMapping("/auth")
public class AuthController {

    private static final String BUYER_HOME = "redirect:/buyer/html/home.html";
    private static final String ADMIN_HOME = "redirect:/admin/html/postModeration.html";

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
            return authenticatedHome();
        }
        model.addAttribute("loginDTO", new UserLoginDTO());
        return "view/auth/html/login";
    }

    @GetMapping("/register")
    public String showRegisterForm(Model model) {
        if (isAuthenticated()) {
            return authenticatedHome();
        }
        model.addAttribute("registerDTO", new UserRegisterDTO());
        return "view/auth/html/register";
    }

    @GetMapping("/forgot-password")
    public String showForgotPasswordForm(@RequestParam(value = "email", required = false) String email, Model model) {
        if (isAuthenticated()) {
            return authenticatedHome();
        }
        model.addAttribute("prefillEmail", email != null ? email.trim() : "");
        return "view/auth/html/forgot-password";
    }

    @PostMapping("/api/forgot-password/find")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> findAccountForReset(@RequestBody Map<String, String> payload) {
        Map<String, Object> result = new HashMap<>();
        try {
            String identifier = payload.get("identifier");
            String maskedEmail = authService.getMaskedEmail(identifier);
            result.put("success", true);
            result.put("maskedEmail", maskedEmail);
            result.put("identifier", identifier != null ? identifier.trim() : "");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    @PostMapping("/api/forgot-password/send")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> sendResetLink(@RequestBody Map<String, String> payload) {
        Map<String, Object> result = new HashMap<>();
        try {
            String identifier = payload.get("identifier");
            String fullEmail = payload.get("fullEmail");
            authService.requestPasswordReset(identifier, fullEmail);
            result.put("success", true);
            result.put("message", "Đã gửi đường dẫn đổi mật khẩu tới email của bạn. Vui lòng kiểm tra hộp thư!");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
    }

    @GetMapping("/reset-password")
    public String showResetPasswordForm(@RequestParam(value = "token", required = false) String token, Model model) {
        if (isAuthenticated()) {
            return authenticatedHome();
        }
        boolean isValid = authService.validatePasswordResetToken(token);
        model.addAttribute("token", token != null ? token : "");
        model.addAttribute("validToken", isValid);
        if (!isValid) {
            model.addAttribute("errorMessage", "Đường dẫn đổi mật khẩu không hợp lệ hoặc đã hết hạn.");
        }
        return "view/auth/html/reset-password";
    }

    @PostMapping("/api/reset-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> processResetPassword(@RequestBody Map<String, String> payload) {
        Map<String, Object> result = new HashMap<>();
        try {
            String token = payload.get("token");
            String password = payload.get("password");
            String confirmPassword = payload.get("confirmPassword");
            authService.resetPassword(token, password, confirmPassword);
            result.put("success", true);
            result.put("message", "Đổi mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(result);
        }
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

            // Phan quyen: ADMIN vao khu quan tri, nguoi dung thuong ve trang chu
            return authResponse.getRole() == UserRole.ADMIN ? ADMIN_HOME : BUYER_HOME;
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

        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        // Redirect về Endpoint URL "/auth/login?logout"
        return "redirect:/auth/login?logout";
    }

    @PostMapping("/api/logout")
    @ResponseBody
    public org.springframework.http.ResponseEntity<java.util.Map<String, Object>> apiLogout(
            HttpServletResponse response,
            HttpServletRequest request) {
        csrfTokens.saveToken(null, request, response);
        addJwtCookie(response, "accessToken", "", 0);
        addJwtCookie(response, "refreshToken", "", 0);

        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("success", true);
        result.put("message", "Đăng xuất thành công");
        return org.springframework.http.ResponseEntity.ok(result);
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

    private String authenticatedHome() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return admin ? ADMIN_HOME : BUYER_HOME;
    }

    private boolean isAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            return false;
        }

        return authentication.isAuthenticated();
    }
}
