package com.example.comicworm.service.admin;

import com.example.comicworm.dto.request.AdminCreateUserRequest;
import com.example.comicworm.dto.response.AdminUserRecord;
import com.example.comicworm.dto.response.AdminUserStatsRecord;

import java.util.Map;

public interface IAdminUserService {

    Map<String, Object> listUsers(String role, String status, String keyword, int page, int size);

    AdminUserStatsRecord getStats();

    AdminUserRecord getUserDetail(Long userId);

    AdminUserRecord updateUserStatus(Long userId, String status, String reason, Long currentAdminId);

    AdminUserRecord toggleSellerRole(Long userId, Boolean isSeller);

    AdminUserRecord createUser(AdminCreateUserRequest request);

    void softDeleteUser(Long userId, Long currentAdminId);
}

