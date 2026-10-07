package com.example.comicworm.repository;

import com.example.comicworm.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // Tìm user theo email và đảm bảo chưa bị xóa mềm (deletedAt IS NULL)
    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    // Tìm theo email thông thường (nếu cần kiểm tra cả tài khoản đã xóa)
    Optional<User> findByEmail(String email);

    // Kiểm tra email đã tồn tại hay chưa (phục vụ logic đăng ký)
    boolean existsByEmail(String email);

    // Tìm user theo Google Sub (phục vụ đăng nhập Google ID Token)
    Optional<User> findByGoogleSub(String googleSub);

    Optional<User> findByVerificationToken(String verificationToken);
}
