package com.example.comicworm;

import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.mapper.UserMapper;
import com.example.comicworm.model.User;
import com.example.comicworm.model.VerificationToken;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.TokenType;
import com.example.comicworm.model.enums.UserRole;
import com.example.comicworm.repository.PasswordResetTokenRepository;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.repository.VerificationTokenRepository;
import com.example.comicworm.service.common.IEmailService;
import com.example.comicworm.service.impl.auth.AuthServiceImpl;
import com.example.comicworm.utils.JwtUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RegisterTests {

    private UserRepository userRepository;
    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private JwtUtils jwtUtils;
    private IEmailService emailService;
    private VerificationTokenRepository tokenRepository;
    private PasswordResetTokenRepository passwordResetTokenRepository;
    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() throws Exception {
        userRepository = mock(UserRepository.class);
        userMapper = new UserMapper(); // Dùng real mapper để test chính xác DTO -> Entity
        passwordEncoder = mock(PasswordEncoder.class);
        jwtUtils = mock(JwtUtils.class);
        emailService = mock(IEmailService.class);
        tokenRepository = mock(VerificationTokenRepository.class);
        passwordResetTokenRepository = mock(PasswordResetTokenRepository.class);

        authService = new AuthServiceImpl(
                userRepository,
                userMapper,
                passwordEncoder,
                jwtUtils,
                emailService,
                tokenRepository,
                passwordResetTokenRepository
        );

        Field baseUrlField = AuthServiceImpl.class.getDeclaredField("baseUrl");
        baseUrlField.setAccessible(true);
        baseUrlField.set(authService, "http://localhost:8080");
    }

    @Nested
    @DisplayName("1. Đăng ký tài khoản (Register)")
    class RegisterFunctionTests {

        @Test
        @DisplayName("Đăng ký thành công: User lưu PENDING_VERIFY, mật khẩu được hash, gửi email xác thực")
        void testRegisterSuccess() {
            UserRegisterDTO dto = new UserRegisterDTO();
            dto.setFullName("Nguyen Van A");
            dto.setEmail("nguyenvana@gmail.com");
            dto.setPassword("Secret123");
            dto.setConfirmPassword("Secret123");
            dto.setTerms(true);

            when(userRepository.existsByEmail("nguyenvana@gmail.com")).thenReturn(false);
            when(passwordEncoder.encode("Secret123")).thenReturn("hashed_Secret123");
            when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                User u = invocation.getArgument(0);
                u.setId(100L);
                return u;
            });
            when(tokenRepository.findTopByUserAndTokenTypeOrderByCreatedAtDesc(any(), eq(TokenType.ACCOUNT_ACTIVATION)))
                    .thenReturn(Optional.empty());
            when(tokenRepository.save(any(VerificationToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

            AuthResponseDTO response = authService.register(dto);

            assertNotNull(response);
            assertEquals("nguyenvana@gmail.com", response.getEmail());
            assertEquals("Nguyen Van A", response.getFullName());
            assertNull(response.getAccessToken(), "Chưa xác thực nên accessToken phải là null");

            // Verify User đã được lưu với đúng trạng thái và mật khẩu hash
            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User saved = userCaptor.getValue();
            assertEquals("hashed_Secret123", saved.getPasswordHash());
            assertEquals(AccountStatus.PENDING_VERIFY, saved.getAccountStatus());
            assertEquals(UserRole.USER, saved.getRole());
            assertFalse(saved.getIsSeller());

            // Verify email đã được gửi kèm link xác thực
            ArgumentCaptor<String> linkCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendVerificationEmail(eq("nguyenvana@gmail.com"), eq("Nguyen Van A"), linkCaptor.capture());
            assertTrue(linkCaptor.getValue().startsWith("http://localhost:8080/auth/verify?token="));
        }

        @Test
        @DisplayName("Đăng ký thất bại khi email đã tồn tại: ném IllegalArgumentException")
        void testRegisterDuplicateEmailThrowsException() {
            UserRegisterDTO dto = new UserRegisterDTO();
            dto.setEmail("existing@gmail.com");
            dto.setPassword("Secret123");
            dto.setFullName("Existing User");

            when(userRepository.existsByEmail("existing@gmail.com")).thenReturn(true);

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    authService.register(dto)
            );
            assertTrue(ex.getMessage().contains("đã được sử dụng"));
            verify(userRepository, never()).save(any());
            verify(emailService, never()).sendVerificationEmail(any(), any(), any());
        }
    }

    @Nested
    @DisplayName("2. Xác thực tài khoản (Verify Account)")
    class VerifyAccountTests {

        @Test
        @DisplayName("Xác thực thành công với token hợp lệ: User chuyển sang ACTIVE, token đổi thành used")
        void testVerifyAccountSuccess() {
            User user = new User();
            user.setId(1L);
            user.setAccountStatus(AccountStatus.PENDING_VERIFY);

            VerificationToken token = new VerificationToken();
            token.setToken("valid-token-123");
            token.setUser(user);
            token.setTokenType(TokenType.ACCOUNT_ACTIVATION);
            token.setIsUsed(false);
            token.setExpiryDate(LocalDateTime.now().plusHours(12));

            when(tokenRepository.findByToken("valid-token-123")).thenReturn(Optional.of(token));

            String result = authService.verifyAccount("valid-token-123");

            assertEquals("SUCCESS", result);
            assertEquals(AccountStatus.ACTIVE, user.getAccountStatus());
            assertTrue(token.getIsUsed());
            verify(userRepository).save(user);
            verify(tokenRepository).save(token);
        }

        @Test
        @DisplayName("Xác thực thất bại khi token không tồn tại: trả về TOKEN_NOT_FOUND")
        void testVerifyAccountTokenNotFound() {
            when(tokenRepository.findByToken("non-existent-token")).thenReturn(Optional.empty());

            String result = authService.verifyAccount("non-existent-token");

            assertEquals("TOKEN_NOT_FOUND", result);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Xác thực thất bại khi token đã dùng: trả về TOKEN_ALREADY_USED")
        void testVerifyAccountTokenAlreadyUsed() {
            VerificationToken token = new VerificationToken();
            token.setToken("used-token");
            token.setIsUsed(true);

            when(tokenRepository.findByToken("used-token")).thenReturn(Optional.of(token));

            String result = authService.verifyAccount("used-token");

            assertEquals("TOKEN_ALREADY_USED", result);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Xác thực thất bại khi token đã hết hạn: trả về TOKEN_EXPIRED")
        void testVerifyAccountTokenExpired() {
            VerificationToken token = new VerificationToken();
            token.setToken("expired-token");
            token.setIsUsed(false);
            token.setExpiryDate(LocalDateTime.now().minusHours(1));

            when(tokenRepository.findByToken("expired-token")).thenReturn(Optional.of(token));

            String result = authService.verifyAccount("expired-token");

            assertEquals("TOKEN_EXPIRED", result);
            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("3. Gửi lại mã xác thực (Resend Verification)")
    class ResendVerificationTests {

        @Test
        @DisplayName("Gửi lại thất bại khi email không tồn tại: ném IllegalArgumentException")
        void testResendEmailNotFoundThrowsException() {
            when(userRepository.findByEmailAndDeletedAtIsNull("unknown@gmail.com")).thenReturn(Optional.empty());

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    authService.resendVerificationEmail("unknown@gmail.com")
            );
            assertTrue(ex.getMessage().contains("Không tìm thấy tài khoản"));
        }

        @Test
        @DisplayName("Gửi lại thất bại khi tài khoản đã kích hoạt (ACTIVE): ném IllegalStateException")
        void testResendAlreadyActiveThrowsException() {
            User user = new User();
            user.setEmail("active@gmail.com");
            user.setAccountStatus(AccountStatus.ACTIVE);

            when(userRepository.findByEmailAndDeletedAtIsNull("active@gmail.com")).thenReturn(Optional.of(user));

            IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                    authService.resendVerificationEmail("active@gmail.com")
            );
            assertTrue(ex.getMessage().contains("đã được kích hoạt"));
        }

        @Test
        @DisplayName("Gửi lại thất bại khi còn trong thời gian chờ (15 phút cooldown): ném IllegalStateException")
        void testResendWithinCooldownThrowsException() {
            User user = new User();
            user.setEmail("wait@gmail.com");
            user.setAccountStatus(AccountStatus.PENDING_VERIFY);

            VerificationToken existingToken = new VerificationToken();
            existingToken.setIsUsed(false);
            existingToken.setResendAvailableAt(LocalDateTime.now().plusMinutes(10));

            when(userRepository.findByEmailAndDeletedAtIsNull("wait@gmail.com")).thenReturn(Optional.of(user));
            when(tokenRepository.findTopByUserAndTokenTypeOrderByCreatedAtDesc(user, TokenType.ACCOUNT_ACTIVATION))
                    .thenReturn(Optional.of(existingToken));

            IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                    authService.resendVerificationEmail("wait@gmail.com")
            );
            assertTrue(ex.getMessage().contains("Vui lòng đợi"));
        }

        @Test
        @DisplayName("Gửi lại thành công khi đã qua cooldown: cập nhật token mới và gửi email")
        void testResendSuccessAfterCooldown() {
            User user = new User();
            user.setEmail("cooldown_passed@gmail.com");
            user.setFullName("Cool Down User");
            user.setAccountStatus(AccountStatus.PENDING_VERIFY);

            VerificationToken existingToken = new VerificationToken();
            existingToken.setIsUsed(false);
            existingToken.setResendAvailableAt(LocalDateTime.now().minusMinutes(1)); // Cooldown đã qua

            when(userRepository.findByEmailAndDeletedAtIsNull("cooldown_passed@gmail.com")).thenReturn(Optional.of(user));
            when(tokenRepository.findTopByUserAndTokenTypeOrderByCreatedAtDesc(user, TokenType.ACCOUNT_ACTIVATION))
                    .thenReturn(Optional.of(existingToken));
            when(tokenRepository.save(any(VerificationToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

            authService.resendVerificationEmail("cooldown_passed@gmail.com");

            verify(tokenRepository).save(existingToken);
            verify(emailService).sendVerificationEmail(eq("cooldown_passed@gmail.com"), eq("Cool Down User"), contains("/auth/verify?token="));
        }
    }

    @Nested
    @DisplayName("4. Kiểm tra Validation của UserRegisterDTO")
    class UserRegisterDTOValidationTests {

        private jakarta.validation.Validator validator;

        @BeforeEach
        void initValidator() {
            jakarta.validation.ValidatorFactory factory = jakarta.validation.Validation.buildDefaultValidatorFactory();
            validator = factory.getValidator();
        }

        @Test
        @DisplayName("Mật khẩu dưới 8 ký tự phải báo lỗi validation")
        void testPasswordShorterThan8CharsFails() {
            UserRegisterDTO dto = new UserRegisterDTO();
            dto.setFullName("Nguyen Van A");
            dto.setEmail("valid@gmail.com");
            dto.setPassword("123456"); // 6 ký tự
            dto.setConfirmPassword("123456");
            dto.setTerms(true);

            var violations = validator.validate(dto);
            assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("password")),
                    "Mật khẩu 6 ký tự phải vi phạm validation min=8");
        }

        @Test
        @DisplayName("Mật khẩu xác nhận để trống phải báo lỗi validation")
        void testConfirmPasswordBlankFails() {
            UserRegisterDTO dto = new UserRegisterDTO();
            dto.setFullName("Nguyen Van A");
            dto.setEmail("valid@gmail.com");
            dto.setPassword("ValidPassword123");
            dto.setConfirmPassword(""); // Trống
            dto.setTerms(true);

            var violations = validator.validate(dto);
            assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("confirmPassword")),
                    "confirmPassword trống phải bị reject");
        }

        @Test
        @DisplayName("Chưa đồng ý điều khoản (terms = null hoặc false) phải báo lỗi validation")
        void testTermsFailsWhenNullOrFalse() {
            UserRegisterDTO dto = new UserRegisterDTO();
            dto.setFullName("Nguyen Van A");
            dto.setEmail("valid@gmail.com");
            dto.setPassword("ValidPassword123");
            dto.setConfirmPassword("ValidPassword123");
            dto.setTerms(null);

            var violations = validator.validate(dto);
            assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("terms")),
                    "terms = null phải bị reject");

            dto.setTerms(false);
            violations = validator.validate(dto);
            assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("terms")),
                    "terms = false phải bị reject");
        }
    }

    @Nested
    @DisplayName("5. Kiểm tra AuthController cho Đăng ký và Resend Verification API")
    class AuthControllerTests {

        private com.example.comicworm.controller.auth.AuthController authController;
        private org.springframework.security.web.csrf.CsrfTokenRepository csrfTokens;

        @BeforeEach
        void initController() {
            csrfTokens = mock(org.springframework.security.web.csrf.CsrfTokenRepository.class);
            authController = new com.example.comicworm.controller.auth.AuthController(authService, csrfTokens);
        }

        @Test
        @DisplayName("Controller: processRegister từ chối khi confirmPassword là null hoặc không khớp")
        void testProcessRegisterRejectsNullOrMismatchedConfirmPassword() {
            UserRegisterDTO dto = new UserRegisterDTO();
            dto.setFullName("Nguyen Van A");
            dto.setEmail("valid@gmail.com");
            dto.setPassword("Secret1234");
            dto.setConfirmPassword(null); // Null
            dto.setTerms(true);

            org.springframework.validation.BeanPropertyBindingResult bindingResult =
                    new org.springframework.validation.BeanPropertyBindingResult(dto, "registerDTO");
            org.springframework.web.servlet.mvc.support.RedirectAttributesModelMap redirectAttributes =
                    new org.springframework.web.servlet.mvc.support.RedirectAttributesModelMap();
            org.springframework.ui.ConcurrentModel model = new org.springframework.ui.ConcurrentModel();

            String view = authController.processRegister(dto, bindingResult, redirectAttributes, model);
            assertEquals("view/auth/html/register", view);
            assertTrue(bindingResult.hasFieldErrors("confirmPassword"), "Phải có field error cho confirmPassword");

            // Trường hợp không khớp
            dto.setConfirmPassword("Different1234");
            bindingResult = new org.springframework.validation.BeanPropertyBindingResult(dto, "registerDTO");
            view = authController.processRegister(dto, bindingResult, redirectAttributes, model);
            assertEquals("view/auth/html/register", view);
            assertTrue(bindingResult.hasFieldErrors("confirmPassword"), "Phải có field error khi mật khẩu không khớp");
        }

        @Test
        @DisplayName("Controller: apiResendVerification trả về JSON thành công khi email hợp lệ")
        void testApiResendVerificationSuccess() {
            User user = new User();
            user.setEmail("test@gmail.com");
            user.setFullName("Test User");
            user.setAccountStatus(AccountStatus.PENDING_VERIFY);

            when(userRepository.findByEmailAndDeletedAtIsNull("test@gmail.com")).thenReturn(Optional.of(user));
            when(tokenRepository.findTopByUserAndTokenTypeOrderByCreatedAtDesc(user, TokenType.ACCOUNT_ACTIVATION))
                    .thenReturn(Optional.empty());
            when(tokenRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

            var response = authController.apiResendVerification(java.util.Map.of("email", "test@gmail.com"));

            assertEquals(200, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals(true, response.getBody().get("success"));
            assertTrue(response.getBody().get("message").toString().contains("Link kích hoạt mới đã được gửi"));
        }

        @Test
        @DisplayName("Controller: apiResendVerification trả về 400 và success: false khi email bị lỗi")
        void testApiResendVerificationFailure() {
            when(userRepository.findByEmailAndDeletedAtIsNull("notfound@gmail.com")).thenReturn(Optional.empty());

            var response = authController.apiResendVerification(java.util.Map.of("email", "notfound@gmail.com"));

            assertEquals(400, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals(false, response.getBody().get("success"));
            assertTrue(response.getBody().get("message").toString().contains("Không tìm thấy tài khoản"));
        }
    }
}

