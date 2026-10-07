package com.example.comicworm.service.impl.auth;

import com.example.comicworm.dto.general.auth.GoogleLoginDTO;
import com.example.comicworm.dto.general.auth.UserLoginDTO;
import com.example.comicworm.dto.general.auth.UserRegisterDTO;
import com.example.comicworm.dto.response.AuthResponseDTO;
import com.example.comicworm.mapper.UserMapper;
import com.example.comicworm.model.User;
import com.example.comicworm.model.enums.AccountStatus;
import com.example.comicworm.repository.UserRepository;
import com.example.comicworm.service.auth.IAuthService;
import com.example.comicworm.service.common.IEmailService;
import com.example.comicworm.utils.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthServiceImpl implements IAuthService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final IEmailService emailService;

    @Value("${app.base.url}")
    private String baseUrl;

    @Autowired
    public AuthServiceImpl(UserRepository userRepository,
                           UserMapper userMapper,
                           PasswordEncoder passwordEncoder,
                           JwtUtils jwtUtils,
                           IEmailService emailService
                           ) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
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
        String verificationToken = UUID.randomUUID().toString();
        user.setVerificationToken(verificationToken);

        User savedUser = userRepository.save(user);

        String verifyLink = baseUrl + "/auth/verify?token=" + verificationToken;
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
            throw new DisabledException("Không tìm thấy tài khoản");
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

    @Override
    @Transactional
    public boolean verifyAccount(String token) {
        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Mã xác thực không hợp lệ hoặc đã hết hạn"));

        // Đổi trạng thái sang ACTIVE và xóa token
        user.setAccountStatus(AccountStatus.ACTIVE);
        user.setVerificationToken(null);
        userRepository.save(user);
        return true;
    }
}