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
import com.example.comicworm.utils.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthServiceImpl implements IAuthService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    @Autowired
    public AuthServiceImpl(UserRepository userRepository,
                           UserMapper userMapper,
                           PasswordEncoder passwordEncoder,
                           JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
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
        // Băm mật khẩu bằng BCrypt trước khi lưu vào database
        user.setPasswordHash(passwordEncoder.encode(registerDTO.getPassword()));

        User savedUser = userRepository.save(user);

        // Tạo App JWT Token riêng
        String accessToken = jwtUtils.generateAccessToken(savedUser.getEmail());
        String refreshToken = jwtUtils.generateRefreshToken(savedUser.getEmail());

        return userMapper.toAuthResponseDTO(savedUser, accessToken, refreshToken);
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

        // 1. Kiểm tra xem người dùng đã tồn tại qua googleSub chưa
        User user = userRepository.findByGoogleSub(googleDTO.getGoogleSub())
                .orElse(null);

        if (user == null) {
            // 2. Nếu chưa tìm thấy theo googleSub, kiểm tra theo email
            user = userRepository.findByEmailAndDeletedAtIsNull(email)
                    .map(existingUser -> {
                        // Liên kết googleSub vào tài khoản đã đăng ký trước đó
                        existingUser.setGoogleSub(googleDTO.getGoogleSub());
                        if (existingUser.getAvatarUrl() == null) {
                            existingUser.setAvatarUrl(googleDTO.getAvatarUrl());
                        }
                        return userRepository.save(existingUser);
                    })
                    .orElseGet(() -> {
                        // 3. Người dùng hoàn toàn mới -> Tạo tài khoản mới
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
}