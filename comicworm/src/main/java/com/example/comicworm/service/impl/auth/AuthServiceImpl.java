package com.example.comicworm.service.impl.auth;

import com.example.comicworm.dto.general.auth.GoogleLoginDTO;
import com.example.comicworm.dto.general.auth.UserLoginDTO;
import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.mapper.UserMapper;
import com.example.comicworm.model.User;
import com.example.comicworm.model.VerificationToken;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.model.enums.TokenType;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.repository.VerificationTokenRepository;
import com.example.comicworm.service.auth.IAuthService;
import com.example.comicworm.service.common.IEmailService;
import com.example.comicworm.utils.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.example.comicworm.model.PasswordResetToken;
import com.example.comicworm.repository.PasswordResetTokenRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthServiceImpl implements IAuthService {
    private final VerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final IEmailService emailService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;

    @Value("${app.base.url}")
    private String baseUrl;

    @Autowired
    public AuthServiceImpl(UserRepository userRepository,
                           UserMapper userMapper,
                           PasswordEncoder passwordEncoder,
                           JwtUtils jwtUtils,
                           IEmailService emailService,
                           VerificationTokenRepository tokenRepository,
                           PasswordResetTokenRepository passwordResetTokenRepository
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
    }

    @Override
    @Transactional
    public AuthResponseDTO register(UserRegisterDTO registerDTO) {
        String email = registerDTO.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email đã được sử dụng trong hệ thống");
        }

        User user = userMapper.toEntity(registerDTO);
        user.setPasswordHash(passwordEncoder.encode(registerDTO.getPassword()));
        user.setAccountStatus(AccountStatus.PENDING_VERIFY);

        User savedUser = userRepository.save(user);

        // Tạo VerificationToken vào bảng riêng bằng hàm hỗ trợ chống spam
        VerificationToken token = createOrRefreshToken(savedUser, TokenType.ACCOUNT_ACTIVATION);

        String verifyLink = baseUrl + "/auth/verify?token=" + token.getToken();
        emailService.sendVerificationEmail(savedUser.getEmail(), savedUser.getFullName(), verifyLink);

        return userMapper.toAuthResponseDTO(savedUser, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponseDTO login(UserLoginDTO loginDTO) {
        String email = loginDTO.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new BadCredentialsException("Email hoặc mật khẩu không chính xác"));

        if (user.getPasswordHash() == null) {
            throw new BadCredentialsException("Tài khoản này được đăng ký qua Google, vui lòng đăng nhập bằng Google hoặc thiết lập mật khẩu");
        }

        if (!passwordEncoder.matches(loginDTO.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Email hoặc mật khẩu không chính xác");
        }

// Check trạng thái tài khoản chưa xác minh Email
        if (user.getAccountStatus() == AccountStatus.PENDING_VERIFY) {
            throw new DisabledException("Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email hoặc yêu cầu gửi lại link xác thực.");
        }

        // Check trạng thái tài khoản bị khóa
        if (user.getAccountStatus() == AccountStatus.LOCKED) {
            throw new IllegalStateException("Tài khoản đã bị khóa");
        }

        String accessToken = jwtUtils.generateAccessToken(user.getEmail());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        return userMapper.toAuthResponseDTO(user, accessToken, refreshToken);
    }

    @Override
    @Transactional
    public AuthResponseDTO loginWithGoogle(GoogleLoginDTO googleDTO) {
        String email = googleDTO.getEmail().trim().toLowerCase();

        //Kiểm tra xem người dùng đã tồn tại qua googleSub chưa
        User user = userRepository.findByGoogleSub(googleDTO.getGoogleSub())
                .orElse(null);

        if (user == null) {
            //Nếu chưa tìm thấy theo googleSub, kiểm tra theo email
            user = userRepository.findByEmailAndDeletedAtIsNull(email)
                    .map(existingUser -> {
                        //liên kết googleSub vào tài khoản đã đăng ký trước đó
                        existingUser.setGoogleSub(googleDTO.getGoogleSub());
                        if (existingUser.getAvatarUrl() == null) {
                            existingUser.setAvatarUrl(googleDTO.getAvatarUrl());
                        }
                        return userRepository.save(existingUser);
                    })
                    .orElseGet(() -> {
                        //Người dùng hoàn toàn mới -> Tạo tài khoản mới
                        User newUser = userMapper.toEntity(googleDTO);
                        return userRepository.save(newUser);
                    });
        }

        if (user.getAccountStatus() == AccountStatus.LOCKED) {
            throw new IllegalStateException("Tài khoản đã bị khóa");
        }

        // Cấp phát App JWT Token của server
        String accessToken = jwtUtils.generateAccessToken(user.getEmail());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        return userMapper.toAuthResponseDTO(user, accessToken, refreshToken);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponseDTO refreshToken(String refreshToken) {
        if (!jwtUtils.validateToken(refreshToken)) {
            throw new BadCredentialsException("Refresh token không hợp lệ hoặc đã hết hạn");
        }

        String email = jwtUtils.getEmailFromToken(refreshToken);
        User user = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new BadCredentialsException("Người dùng không tồn tại"));

        String newAccessToken = jwtUtils.generateAccessToken(user.getEmail());
        return userMapper.toAuthResponseDTO(user, newAccessToken, refreshToken);
    }

    // Tạo hoặc refresh token kích hoạt (có kiểm tra chống spam)
    @Transactional
    public VerificationToken createOrRefreshToken(User user, TokenType tokenType) {
        Optional<VerificationToken> existingTokenOpt =
                tokenRepository.findTopByUserAndTokenTypeOrderByCreatedAtDesc(user, tokenType);

        LocalDateTime now = LocalDateTime.now();

        if (existingTokenOpt.isPresent()) {
            VerificationToken existingToken = existingTokenOpt.get();

            // Kiểm tra xem đã qua thời gian cooldown chưa (ví dụ: 15 phút)
            if (!existingToken.getIsUsed() && now.isBefore(existingToken.getResendAvailableAt())) {
                long minutesRemaining = java.time.Duration.between(now, existingToken.getResendAvailableAt()).toMinutes() + 1;
                throw new IllegalStateException("Vui lòng đợi " + minutesRemaining + " phút nữa trước khi yêu cầu gửi lại link mới.");
            }

            // Đã đủ điều kiện gửi lại -> Cập nhật trực tiếp trên record cũ
            existingToken.setToken(UUID.randomUUID().toString());
            existingToken.setExpiryDate(now.plusHours(24)); // Hiệu lực 24 tiếng
            existingToken.setResendAvailableAt(now.plusMinutes(15)); // Cooldown 15 phút
            existingToken.setIsUsed(false);
            return tokenRepository.save(existingToken);
        }

        // Chưa có record nào -> Tạo mới
        VerificationToken newToken = new VerificationToken();
        newToken.setUser(user);
        newToken.setTokenType(tokenType);
        newToken.setToken(UUID.randomUUID().toString());
        newToken.setExpiryDate(now.plusHours(24));
        newToken.setResendAvailableAt(now.plusMinutes(15));
        newToken.setIsUsed(false);
        return tokenRepository.save(newToken);
    }

    @Transactional
    public void resendVerificationEmail(String email) {
        User user = userRepository.findByEmailAndDeletedAtIsNull(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản với email này"));

        if (user.getAccountStatus() == AccountStatus.ACTIVE) {
            throw new IllegalStateException("Tài khoản này đã được kích hoạt trước đó");
        }

        // Hàm này sẽ tự kiểm tra cooldown 15 phút, nếu gửi liên tục sẽ quăng Exception
        VerificationToken newToken = createOrRefreshToken(user, TokenType.ACCOUNT_ACTIVATION);

        String verifyLink = baseUrl + "/auth/verify?token=" + newToken.getToken();
        emailService.sendVerificationEmail(user.getEmail(), user.getFullName(), verifyLink);
    }

    // Logic kiểm tra khi người dùng nhấp vào link từ email
    @Transactional
    public String verifyAccount(String tokenValue) {
        Optional<VerificationToken> tokenOpt = tokenRepository.findByToken(tokenValue);

        if (tokenOpt.isEmpty()) {
            return "TOKEN_NOT_FOUND"; // Token không tồn tại
        }

        VerificationToken token = tokenOpt.get();

        if (token.getIsUsed()) {
            return "TOKEN_ALREADY_USED"; // Token đã từng kích hoạt rồi
        }

        if (token.getExpiryDate().isBefore(LocalDateTime.now())) {
            return "TOKEN_EXPIRED"; // Link đã quá 24 giờ
        }

        // Hợp lệ: Kích hoạt tài khoản User và đánh dấu token đã dùng
        User user = token.getUser();
        user.setAccountStatus(AccountStatus.ACTIVE);
        userRepository.save(user);

        token.setIsUsed(true);
        tokenRepository.save(token);

        return "SUCCESS";
    }

    @Override
    @Transactional(readOnly = true)
    public String getMaskedEmail(String identifier) {
        User user = findUserByIdentifier(identifier);
        return maskEmail(user.getEmail());
    }

    @Override
    @Transactional
    public void requestPasswordReset(String identifier, String fullEmail) {
        if (fullEmail == null || fullEmail.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập địa chỉ email xác nhận.");
        }

        User user = findUserByIdentifier(identifier);

        if (!user.getEmail().trim().equalsIgnoreCase(fullEmail.trim())) {
            throw new IllegalArgumentException("Email xác nhận không khớp với email của tài khoản.");
        }

        if (user.getAccountStatus() == AccountStatus.LOCKED) {
            throw new IllegalStateException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
        }

        String rawToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(rawToken);

        // Xóa token đặt lại mật khẩu cũ của người dùng này (nếu có)
        passwordResetTokenRepository.deleteByUserId(user.getId());

        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setUserId(user.getId());
        resetToken.setTokenHash(tokenHash);
        resetToken.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        resetToken.setUsedAt(null);
        passwordResetTokenRepository.save(resetToken);

        user.setVerificationToken(rawToken);
        userRepository.save(user);

        String resetLink = baseUrl + "/auth/reset-password?token=" + rawToken;
        emailService.sendPasswordResetEmail(user.getEmail(), user.getFullName(), resetLink);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validatePasswordResetToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        String tokenHash = hashToken(token.trim());
        return passwordResetTokenRepository.findByTokenHash(tokenHash)
                .or(() -> passwordResetTokenRepository.findByTokenHash(token.trim()))
                .filter(t -> t.getUsedAt() == null && t.getExpiresAt().isAfter(LocalDateTime.now()))
                .isPresent();
    }

    @Override
    @Transactional
    public void resetPassword(String token, String newPassword, String confirmPassword) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Mã xác nhận không hợp lệ hoặc đã hết hạn.");
        }
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Mật khẩu mới phải có ít nhất 8 ký tự.");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("Mật khẩu xác nhận không trùng khớp.");
        }

        String tokenHash = hashToken(token.trim());
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .or(() -> passwordResetTokenRepository.findByTokenHash(token.trim()))
                .orElseThrow(() -> new IllegalArgumentException("Liên kết đổi mật khẩu không hợp lệ hoặc không tồn tại."));

        if (resetToken.getUsedAt() != null) {
            throw new IllegalArgumentException("Liên kết đổi mật khẩu này đã được sử dụng trước đó.");
        }

        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Liên kết đổi mật khẩu đã hết hạn (chỉ có hiệu lực trong 15 phút). Vui lòng yêu cầu lại.");
        }

        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản người dùng."));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setVerificationToken(null);
        userRepository.save(user);

        resetToken.setUsedAt(LocalDateTime.now());
        passwordResetTokenRepository.save(resetToken);
    }

    private User findUserByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập email hoặc thông tin tài khoản.");
        }
        String cleanId = identifier.trim();

        // 1. Thử tìm chính xác theo email
        Optional<User> userOpt = userRepository.findByEmailAndDeletedAtIsNull(cleanId.toLowerCase());
        if (userOpt.isPresent()) {
            return userOpt.get();
        }

        // 2. Thử tìm chính xác theo số điện thoại
        userOpt = userRepository.findByPhoneAndDeletedAtIsNull(cleanId);
        if (userOpt.isPresent()) {
            return userOpt.get();
        }

        // 3. Thử tìm theo danh sách ứng viên (ví dụ tiền tố email trước @)
        List<User> candidates = userRepository.findByIdentifierCandidates(cleanId.toLowerCase());
        if (candidates.size() == 1) {
            return candidates.get(0);
        } else if (candidates.size() > 1) {
            throw new IllegalArgumentException("Có nhiều tài khoản khớp với thông tin này, vui lòng nhập chính xác địa chỉ email.");
        }

        throw new IllegalArgumentException("Không tìm thấy tài khoản nào khớp với thông tin bạn cung cấp.");
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "******";
        }
        String[] parts = email.trim().toLowerCase().split("@", 2);
        String name = parts[0];
        String domain = parts[1];

        if (name.length() <= 2) {
            return name.charAt(0) + "***@" + domain;
        } else if (name.length() <= 4) {
            return name.charAt(0) + "***" + name.charAt(name.length() - 1) + "@" + domain;
        } else {
            String prefix = name.substring(0, 2);
            String suffix = name.substring(name.length() - 1);
            int starCount = Math.max(5, name.length() - 3);
            return prefix + "*".repeat(starCount) + suffix + "@" + domain;
        }
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Lỗi thuật toán mã hóa SHA-256: " + e.getMessage(), e);
        }
    }
}